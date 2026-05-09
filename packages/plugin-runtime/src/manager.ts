import "reflect-metadata";
import { readdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import type { BotEvent } from "@dian/shared";
import {
  PLUGIN_META_KEY,
  HANDLER_META_KEY,
  INTERCEPTOR_META_KEY,
  type EventContext,
  type HandlerMeta,
  type InterceptorMeta,
  type PluginInstance,
  type PluginMeta,
} from "./decorators.js";

// ---------------------------------------------------------------------------
// PluginManager
// ---------------------------------------------------------------------------

export class PluginManager {
  private readonly _plugins = new Map<string, PluginInstance>();
  private readonly _blacklist = new Set<string>();
  private _maintenanceMode = false;
  private _watcher: FSWatcher | null = null;
  private _pluginsDir: string | null = null;

  // ── 加载 ──────────────────────────────────────────────────────────────────

  /**
   * 扫描目录，动态 import 所有插件并注册。
   * 约定：每个 .js 文件或子目录（含 index.js）默认导出一个被 @Plugin 装饰的类。
   */
  async loadAll(pluginsDir: string): Promise<void> {
    this._pluginsDir = resolve(pluginsDir);

    let entries: string[];
    try {
      entries = await readdir(this._pluginsDir);
    } catch {
      return; // 目录不存在时跳过
    }

    for (const entry of entries) {
      const fullPath = resolve(this._pluginsDir, entry);
      const ext = extname(entry);
      if (ext !== ".js" && ext !== "") continue;
      await this._loadFile(fullPath);
    }
  }

  private async _loadFile(filePath: string): Promise<void> {
    let imported: Record<string, unknown>;
    try {
      imported = (await import(filePath)) as Record<string, unknown>;
    } catch (err) {
      console.error(`[plugin-runtime] 加载插件失败 "${filePath}":`, err);
      return;
    }

    const PluginClass = imported.default;
    if (typeof PluginClass !== "function") {
      console.warn(`[plugin-runtime] "${filePath}" 未默认导出类，已跳过`);
      return;
    }

    const meta = Reflect.getMetadata(PLUGIN_META_KEY, PluginClass) as PluginMeta | undefined;
    if (!meta) {
      console.warn(`[plugin-runtime] "${filePath}" 未使用 @Plugin 装饰，已跳过`);
      return;
    }

    const instance = new (PluginClass as new () => unknown)();
    const handlers: HandlerMeta[] =
      (Reflect.getMetadata(HANDLER_META_KEY, PluginClass) as HandlerMeta[] | undefined) ?? [];
    const interceptors: InterceptorMeta[] =
      (Reflect.getMetadata(INTERCEPTOR_META_KEY, PluginClass) as InterceptorMeta[] | undefined) ?? [];

    // 按 priority 升序排列
    interceptors.sort((a, b) => a.priority - b.priority);

    this._plugins.set(meta.name, { meta, handlers, interceptors, instance, filePath });
    console.info(`[plugin-runtime] 插件 "${meta.name}" 已加载`);
  }

  // ── 卸载 / 热重载 ─────────────────────────────────────────────────────────

  unload(name: string): void {
    if (this._plugins.delete(name)) {
      console.info(`[plugin-runtime] 插件 "${name}" 已卸载`);
    }
  }

  async reload(name: string): Promise<void> {
    const plugin = this._plugins.get(name);
    if (!plugin) {
      console.warn(`[plugin-runtime] 找不到插件 "${name}"，无法 reload`);
      return;
    }
    this.unload(name);
    await this._loadFile(plugin.filePath);
  }

  // ── 文件监听热重载 ────────────────────────────────────────────────────────

  watch(): void {
    if (this._watcher || !this._pluginsDir) return;

    this._watcher = chokidar.watch(this._pluginsDir, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 50 },
    });

    this._watcher.on("change", (filePath: string) => {
      // 找到对应插件并 reload
      for (const [name, plugin] of this._plugins) {
        if (plugin.filePath === filePath) {
          this.reload(name).catch(console.error);
          return;
        }
      }
      // 新文件
      this._loadFile(filePath).catch(console.error);
    });

    this._watcher.on("add", (filePath: string) => {
      this._loadFile(filePath).catch(console.error);
    });

    this._watcher.on("unlink", (filePath: string) => {
      for (const [name, plugin] of this._plugins) {
        if (plugin.filePath === filePath) {
          this.unload(name);
          return;
        }
      }
    });
  }

  async unwatch(): Promise<void> {
    if (this._watcher) {
      await this._watcher.close();
      this._watcher = null;
    }
  }

  // ── 事件分发 ──────────────────────────────────────────────────────────────

  /**
   * 将事件分发给所有匹配的 handler。
   * 先按 priority 执行 interceptors，任意 interceptor 可调用 stopPropagation() 终止。
   * 再按注册顺序执行匹配 pattern 的 handlers。
   */
  async dispatch(event: BotEvent): Promise<void> {
    if (this._maintenanceMode) return;

    let stopped = false;
    const ctx: EventContext = {
      event,
      stopPropagation() {
        stopped = true;
      },
    };

    // 1. 执行所有 interceptors（已全局按 priority 排序）
    const allInterceptors: Array<{ plugin: PluginInstance; meta: InterceptorMeta }> = [];
    for (const plugin of this._plugins.values()) {
      if (this._blacklist.has(plugin.meta.name)) continue;
      for (const im of plugin.interceptors) {
        allInterceptors.push({ plugin, meta: im });
      }
    }
    allInterceptors.sort((a, b) => a.meta.priority - b.meta.priority);

    for (const { plugin, meta } of allInterceptors) {
      if (stopped) return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (plugin.instance as any)[meta.method](ctx);
      } catch (err) {
        console.error(`[plugin-runtime] interceptor "${meta.method}" 异常:`, err);
      }
    }

    if (stopped) return;

    // 2. 执行匹配 pattern 的 handlers
    const messageText = extractMessageText(event);

    for (const plugin of this._plugins.values()) {
      if (stopped) return;
      if (this._blacklist.has(plugin.meta.name)) continue;

      for (const hm of plugin.handlers) {
        if (stopped) break;
        if (!matchPattern(hm.pattern, messageText)) continue;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (plugin.instance as any)[hm.method](ctx);
        } catch (err) {
          console.error(
            `[plugin-runtime] handler "${plugin.meta.name}.${hm.method}" 异常:`,
            err,
          );
        }
      }
    }
  }

  // ── 黑名单 & 维护模式 ─────────────────────────────────────────────────────

  addToBlacklist(name: string): void {
    this._blacklist.add(name);
  }

  removeFromBlacklist(name: string): void {
    this._blacklist.delete(name);
  }

  setMaintenanceMode(enabled: boolean): void {
    this._maintenanceMode = enabled;
  }

  // ── 只读信息 ──────────────────────────────────────────────────────────────

  get plugins(): PluginInstance[] {
    return [...this._plugins.values()];
  }

  get maintenanceMode(): boolean {
    return this._maintenanceMode;
  }
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

function matchPattern(pattern: RegExp | string, text: string): boolean {
  if (pattern instanceof RegExp) return pattern.test(text);
  return text === pattern;
}

function extractMessageText(event: BotEvent): string {
  // BotEvent.payload 根据 event_type 有不同结构，尽量提取文本
  const payload = event.payload as Record<string, unknown>;
  if (typeof payload.message === "string") return payload.message;
  if (Array.isArray(payload.message)) {
    return (payload.message as Array<{ type: string; data: { text?: string } }>)
      .filter((seg) => seg.type === "text")
      .map((seg) => seg.data.text ?? "")
      .join("");
  }
  return "";
}

// ---------------------------------------------------------------------------
// 全局单例
// ---------------------------------------------------------------------------

export const pluginManager = new PluginManager();

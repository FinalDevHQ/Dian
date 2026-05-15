import "reflect-metadata";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { resolve, extname, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import chokidar, { type FSWatcher } from "chokidar";
import type { BotEvent } from "@dian/shared";
import {
  PLUGIN_META_KEY,
  HANDLER_META_KEY,
  INTERCEPTOR_META_KEY,
  type CommandEntry,
  type CommandPublicMeta,
  type EventContext,
  type HandlerMeta,
  type InterceptorMeta,
  type PluginInstance,
  type PluginMeta,
  type PluginPublicMeta,
  type PluginSetupContext,
  type RouteEntry,
  type UIDeclaration,
} from "./decorators.js";

// ---------------------------------------------------------------------------
// PluginManager
// ---------------------------------------------------------------------------

export class PluginManager {
  private readonly _plugins = new Map<string, PluginInstance>();
  private readonly _blacklist = new Set<string>();
  /**
   * 插件 → 允许响应事件的 botId 白名单。
   * 语义：未在 map 中或集合为空 ⇒ 对**任何 bot 都不响应**（白名单默认拒绝）。
   * 装载/卸载插件不会清掉这里的配置，方便插件 reload 后保留作用域。
   */
  private readonly _botScope = new Map<string, Set<string>>();
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
      if (ext === ".js") {
        await this._loadFile(fullPath);
      } else if (ext === "") {
        // 目录插件：显式解析到 index.js（ESM 不支持裸目录 import）
        const indexFile = resolve(fullPath, "index.js");
        if (existsSync(indexFile)) {
          await this._loadFile(indexFile);
        }
      }
    }
  }

  private async _loadFile(filePath: string): Promise<void> {
    let imported: Record<string, unknown>;
    try {
      // Windows 路径需要转换为 file:// URL，否则 ESM loader 报错
      // 加 ?t=<timestamp> 绕过 Node ESM 模块缓存，保证 reload 时能拿到新代码
      // （Node 的 import() 对同一 URL 永久缓存，不带 query 就拿不到磁盘上的最新版本）
      const url = `${pathToFileURL(filePath).href}?t=${Date.now()}`;
      imported = (await import(url)) as Record<string, unknown>;
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

    // ── 收集 onSetup 注册的路由/指令/UI ───────────────────────────────────
    const routes: RouteEntry[] = [];
    const commands: CommandEntry[] = [];
    let ui: UIDeclaration | null = null;

    // 支持 @Plugin 元数据里内联声明 UI
    if ((meta as PluginMeta & { ui?: UIDeclaration }).ui) {
      ui = (meta as PluginMeta & { ui?: UIDeclaration }).ui!;
    }

    // 如果插件实现了 onSetup 方法，调用之
    if (typeof (instance as Record<string, unknown>)["onSetup"] === "function") {
      const ctx: PluginSetupContext = {
        route(method, path, handler) {
          routes.push({ method, path, handler });
        },
        command(entry) {
          commands.push(entry);
        },
        ui(decl) {
          ui = decl;
        },
      };
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (instance as any).onSetup(ctx);
      } catch (err) {
        console.error(`[plugin-runtime] 插件 "${meta.name}" onSetup 异常:`, err);
      }
    }

    this._plugins.set(meta.name, {
      meta,
      handlers,
      interceptors,
      routes,
      commands,
      ui,
      instance,
      filePath,
    });
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

    const isPluginEntry = (filePath: string): boolean => {
      if (extname(filePath) !== ".js") return false;
      const rel = relative(this._pluginsDir!, filePath);
      const parts = rel.split(sep);
      // 直接子文件: plugins/foo.js  或  目录插件入口: plugins/foo/index.js
      return parts.length === 1 || (parts.length === 2 && parts[1] === "index.js");
    };

    this._watcher.on("change", (filePath: string) => {
      if (!isPluginEntry(filePath)) return;
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
      if (!isPluginEntry(filePath)) return;
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
   * 生成树状帮助菜单文本
   * 遍历所有已注册的命令，按分类组织成树状结构
   */
  generateHelpText(): string {
    const lines: string[] = ["📋 可用命令："];
    
    // 收集所有命令，按分类分组
    const categorized = new Map<string, Array<{ name: string; description?: string; children?: CommandEntry[] }>>();
    const uncategorized: Array<{ name: string; description?: string; children?: CommandEntry[] }> = [];

    for (const plugin of this._plugins.values()) {
      if (this._blacklist.has(plugin.meta.name)) continue;
      
      for (const cmd of plugin.commands) {
        const entry = { name: cmd.name, description: cmd.description, children: cmd.children };
        if (cmd.category) {
          if (!categorized.has(cmd.category)) {
            categorized.set(cmd.category, []);
          }
          categorized.get(cmd.category)!.push(entry);
        } else {
          uncategorized.push(entry);
        }
      }
    }

    // 渲染分类命令
    let categoryIndex = 0;
    for (const [category, commands] of categorized) {
      categoryIndex++;
      const isLastCategory = categoryIndex === categorized.size && uncategorized.length === 0;
      lines.push(`${isLastCategory ? "└" : "├"}─ ${category}`);
      
      for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i];
        const isLast = i === commands.length - 1;
        const prefix = isLastCategory ? "   " : "│  ";
        const branch = isLast ? "└" : "├";
        const desc = cmd.description ? ` - ${cmd.description}` : "";
        lines.push(`${prefix}${branch} ${cmd.name}${desc}`);
        
        // 渲染子命令
        if (cmd.children && cmd.children.length > 0) {
          const childPrefix = isLastCategory ? "   " : "│  ";
          renderChildren(cmd.children, lines, `${childPrefix}${isLast ? "   " : "│  "}`);
        }
      }
    }

    // 渲染未分类命令
    for (let i = 0; i < uncategorized.length; i++) {
      const cmd = uncategorized[i];
      const isLast = i === uncategorized.length - 1;
      const branch = isLast ? "└" : "├";
      const desc = cmd.description ? ` - ${cmd.description}` : "";
      lines.push(`${branch} ${cmd.name}${desc}`);
      
      if (cmd.children && cmd.children.length > 0) {
        renderChildren(cmd.children, lines, isLast ? "   " : "│  ");
      }
    }

    return lines.join("\n");
  }

  /**
   * 将事件分发给所有匹配的 handler。
   * 先按 priority 执行 interceptors，任意 interceptor 可调用 stopPropagation() 终止。
   * 再按注册顺序执行匹配 pattern 的 handlers。
   */
  async dispatch(
    event: BotEvent,
    reply: (text: string) => Promise<void> = async () => {},
  ): Promise<void> {
    if (this._maintenanceMode) return;

    let stopped = false;
    const ctx: EventContext = {
      event,
      stopPropagation() { stopped = true; },
      reply,
    };

    // 1. 执行所有 interceptors（已全局按 priority 排序）
    const allInterceptors: Array<{ plugin: PluginInstance; meta: InterceptorMeta }> = [];
    for (const plugin of this._plugins.values()) {
      if (this._blacklist.has(plugin.meta.name)) continue;
      if (!this.isPluginEnabledForBot(plugin.meta.name, event.botId)) continue;
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

    // 2. 内置菜单/帮助命令
    const messageText = extractMessageText(event);
    if (/^菜单$|^help$|^帮助$/i.test(messageText.trim())) {
      try {
        await reply(this.generateHelpText());
      } catch (err) {
        console.error(`[plugin-runtime] 生成帮助菜单异常:`, err);
      }
      return;
    }

    // 3. 执行匹配 pattern 的 handlers + commands

    for (const plugin of this._plugins.values()) {
      if (stopped) return;
      if (this._blacklist.has(plugin.meta.name)) continue;
      if (!this.isPluginEnabledForBot(plugin.meta.name, event.botId)) continue;

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

      for (const cmd of plugin.commands) {
        if (stopped) break;
        if (!matchPattern(cmd.pattern, messageText)) continue;
        try {
          await cmd.handler(ctx);
        } catch (err) {
          console.error(
            `[plugin-runtime] command "${plugin.meta.name}/${cmd.name}" 异常:`,
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

  // ── Bot 作用域（白名单，默认空 = 拒绝所有 bot） ──────────────────────────

  /**
   * 设置插件允许响应的 bot 列表。传空数组 ⇒ 任何 bot 都不响应。
   */
  setPluginBots(name: string, botIds: readonly string[]): void {
    this._botScope.set(name, new Set(botIds));
  }

  /** 读取插件当前的 bot 白名单（已注册顺序无保证；返回数组拷贝）。 */
  getPluginBots(name: string): string[] {
    return [...(this._botScope.get(name) ?? [])];
  }

  /** 判断某个 bot 是否在指定插件的白名单内。 */
  isPluginEnabledForBot(name: string, botId: string): boolean {
    const set = this._botScope.get(name);
    return !!set && set.has(botId);
  }

  /** 批量导入持久化的 scope 配置（启动时调用）。 */
  bulkSetPluginBots(map: Record<string, readonly string[]>): void {
    for (const [name, bots] of Object.entries(map)) {
      this._botScope.set(name, new Set(bots));
    }
  }

  /** 导出当前所有 scope 配置（用于持久化）。 */
  exportPluginBots(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const [name, set] of this._botScope) {
      out[name] = [...set];
    }
    return out;
  }

  // ── 只读信息 ──────────────── 

  get plugins(): PluginInstance[] {
    return [...this._plugins.values()];
  }

  get maintenanceMode(): boolean {
    return this._maintenanceMode;
  }

  /**
   * 返回所有插件的公开元信息（不包含 handler 实现）。
   * 主要供前端 API 使用。
   */
  listPluginsMeta(): PluginPublicMeta[] {
    return [...this._plugins.values()].map((p) => ({
      name: p.meta.name,
      description: p.meta.description,
      version: p.meta.version,
      author: p.meta.author,
      icon: p.meta.icon,
      enabled: !this._blacklist.has(p.meta.name),
      handlerCount: p.handlers.length,
      commandCount: p.commands.length,
      handlers: p.handlers.map((h) => ({
        method: h.method,
        pattern: stringifyPattern(h.pattern),
      })),
      commands: p.commands.map((c) => ({
        name: c.name,
        pattern: stringifyPattern(c.pattern),
        description: c.description,
        category: c.category,
        children: c.children ? mapCommandChildren(c.children) : undefined,
      })),
      bots: this.getPluginBots(p.meta.name),
      routes: p.routes.map((r) => ({ method: r.method, path: r.path })),
      hasUI: p.ui !== null,
      uiUrl: p.ui?.externalUrl
        ? p.ui.externalUrl
        : p.ui
          ? `/plugins/${encodeURIComponent(p.meta.name)}/ui/`
          : null,
    }));
  }
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

function matchPattern(
  pattern: RegExp | string | (() => RegExp | string),
  text: string,
): boolean {
  // 函数形式：每次匹配时求值，实现"配置即改即生效"
  const resolved = typeof pattern === "function" ? pattern() : pattern;
  if (resolved instanceof RegExp) return resolved.test(text);
  return text === resolved;
}

/**
 * 把 pattern 转成可读字符串，用于前端展示。
 * - string  : 原样返回
 * - RegExp  : 返回 .toString() 形式（如 "/^!echo (.+)$/"）
 * - function: 调用并把返回值再递归 stringify。函数求值异常时返回 "<dynamic>"
 */
function stringifyPattern(
  pattern: RegExp | string | (() => RegExp | string),
): string {
  try {
    const resolved = typeof pattern === "function" ? pattern() : pattern;
    if (resolved instanceof RegExp) return resolved.toString();
    return String(resolved);
  } catch {
    return "<dynamic>";
  }
}

function extractMessageText(event: BotEvent): string {
  // 标准路径：mapOneBotEvent 已把文本提取到 payload.text
  const payload = event.payload as Record<string, unknown>;
  if (typeof payload.text === "string") return payload.text;
  // 兼容路径：payload.message 直接是字符串或消息段数组
  if (typeof payload.message === "string") return payload.message;
  if (Array.isArray(payload.message)) {
    return (payload.message as Array<{ type: string; data: { text?: string } }>)
      .filter((seg) => seg.type === "text")
      .map((seg) => seg.data.text ?? "")
      .join("");
  }
  return "";
}

/**
 * 递归渲染子命令树
 */
function renderChildren(
  children: CommandEntry[],
  lines: string[],
  prefix: string,
): void {
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const isLast = i === children.length - 1;
    const branch = isLast ? "└" : "├";
    const desc = child.description ? ` - ${child.description}` : "";
    lines.push(`${prefix}${branch} ${child.name}${desc}`);
    
    if (child.children && child.children.length > 0) {
      renderChildren(child.children, lines, `${prefix}${isLast ? "   " : "│  "}`);
    }
  }
}

/**
 * 递归映射子命令到公开元信息
 */
function mapCommandChildren(children: CommandEntry[]): CommandPublicMeta[] {
  return children.map((c) => ({
    name: c.name,
    pattern: stringifyPattern(c.pattern),
    description: c.description,
    category: c.category,
    children: c.children ? mapCommandChildren(c.children) : undefined,
  }));
}

// ---------------------------------------------------------------------------
// 全局单例
// ---------------------------------------------------------------------------

export const pluginManager = new PluginManager();

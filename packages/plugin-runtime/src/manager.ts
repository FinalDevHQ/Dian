import "reflect-metadata";
import { sep } from "node:path";
import type { BotEvent, SendActionFn } from "@myfinal/shared";
import type {
  PluginInstance,
  PluginPublicMeta,
  PluginStore,
} from "./decorators.js";
import { stringifyPattern } from "./utils/pattern.js";
import { generateHelpText, mapCommandChildren } from "./help/HelpGenerator.js";
import { dispatchEvent } from "./dispatch/PluginDispatcher.js";
import { PluginRegistry } from "./registry/PluginRegistry.js";
import { PluginLoader } from "./loader/PluginLoader.js";
import { HotReloadWatcher } from "./loader/HotReloadWatcher.js";
import { BotScopeManager } from "./scope/BotScopeManager.js";

// ---------------------------------------------------------------------------
// PluginManager（facade，对外 API 不变）
// ---------------------------------------------------------------------------

export class PluginManager {
  private readonly _registry = new PluginRegistry();
  private readonly _loader = new PluginLoader();
  private readonly _watcher = new HotReloadWatcher();
  private readonly _scope = new BotScopeManager();
  private _maintenanceMode = false;
  private _installLock = false;
  private _pluginsDir: string | null = null;
  /** BotManager 引用，用于插件发送消息 */
  private _botManager: { getBots(): Array<{ botId: string; sendAction(request: { action: string; params?: Record<string, unknown> }): Promise<{ ok: boolean; status: string; message?: string; data?: unknown }> }> } | null = null;

  // ── 加载 ──────────────────────────────────────────────────────────────────

  /**
   * 扫描目录，动态 import 所有插件并注册。
   * 约定：每个 .js 文件或子目录（含 index.js）默认导出一个被 @Plugin 装饰的类。
   */
  async loadAll(pluginsDir: string): Promise<void> {
    this._pluginsDir = pluginsDir;
    const files = await this._loader.scanDir(pluginsDir);
    for (const file of files) {
      await this._loadFile(file);
    }
  }

  private async _loadFile(filePath: string): Promise<void> {
    const instance = await this._loader.loadFile(filePath);
    if (instance) {
      this._registry.set(instance.meta.name, instance);
    }
  }

  // ── 安装锁 ────────────────────────────────────────────────────────────────

  setInstallLock(locked: boolean): void {
    this._installLock = locked;
  }

  get installLock(): boolean {
    return this._installLock;
  }

  /**
   * 注册插件加载完成后的回调。
   * 每次插件加载（首次或热重载）完成后都会调用，可在此统一处理框架级资源注册。
   * 应在 loadAll / loadFromPath 之前设置。
   */
  setOnPluginLoaded(fn: (plugin: PluginInstance) => void | Promise<void>): void {
    this._loader.setOnPluginLoaded(fn);
  }

  /**
   * 设置 BotManager 引用，用于插件发送消息。
   * 应在插件加载完成后调用。
   */
  setBotManager(botManager: { getBots(): Array<{ botId: string; sendAction(request: { action: string; params?: Record<string, unknown> }): Promise<{ ok: boolean; status: string; message?: string; data?: unknown }> }> }): void {
    this._botManager = botManager;
  }

  /**
   * 发送 Bot Action（供插件调用）。
   * 默认使用第一个可用的 Bot。
   */
  async sendBotAction(action: string, params?: Record<string, unknown>): Promise<{ ok: boolean; status: string; message?: string; data?: unknown }> {
    if (!this._botManager) {
      return { ok: false, status: "failed", message: "BotManager not initialized" };
    }
    const bots = this._botManager.getBots();
    if (bots.length === 0) {
      return { ok: false, status: "failed", message: "No bots available" };
    }
    // 使用第一个可用的 Bot
    return bots[0].sendAction({ action, params });
  }

  // ── 公开加载 / 按目录卸载 ──────────────────────────────────────────────────

  /** 加载指定路径的插件文件（供安装路由显式调用）。 */
  async loadFromPath(filePath: string): Promise<void> {
    await this._loadFile(filePath);
  }

  /** 卸载 filePath 位于指定目录下的所有已加载插件。返回被卸载的插件名列表。 */
  unloadByDir(dir: string): string[] {
    const unloaded = this._registry.unloadByDir(dir, sep);
    for (const name of unloaded) {
      console.info(`[plugin-runtime] 插件 "${name}" 已卸载`);
    }
    return unloaded;
  }

  // ── 卸载 / 热重载 ─────────────────────────────────────────────────────────

  unload(name: string): void {
    if (this._registry.delete(name)) {
    const plugin = this._plugins.get(name);
    if (plugin) {
      // 调用插件实例的 onStop 生命周期钩子（如有），清理定时器等资源
      if (typeof (plugin.instance as Record<string, unknown>)["onStop"] === "function") {
        try {
          (plugin.instance as any).onStop();
        } catch (err) {
          console.error(`[plugin-runtime] 插件 "${name}" onStop 异常:`, err);
        }
      }
      this._plugins.delete(name);
      console.info(`[plugin-runtime] 插件 "${name}" 已卸载`);
    }
  }

  async reload(name: string): Promise<void> {
    const plugin = this._registry.get(name);
    if (!plugin) {
      console.warn(`[plugin-runtime] 找不到插件 "${name}"，无法 reload`);
      return;
    }
    this.unload(name);
    await this._loadFile(plugin.filePath);
  }

  // ── 文件监听热重载 ────────────────────────────────────────────────────────

  watch(): void {
    if (!this._pluginsDir) return;
    this._watcher.watch(this._pluginsDir, {
      isInstallLocked: () => this._installLock,
      onChange: (filePath) => {
        const existing = this._registry.findByFilePath(filePath);
        if (existing) {
          this.reload(existing.meta.name).catch(console.error);
        } else {
          this._loadFile(filePath).catch(console.error);
        }
      },
      onAdd: (filePath) => {
        this._loadFile(filePath).catch(console.error);
      },
      onUnlink: (filePath) => {
        const existing = this._registry.findByFilePath(filePath);
        if (existing) {
          this.unload(existing.meta.name);
        }
      },
    });
  }

  async unwatch(): Promise<void> {
    await this._watcher.unwatch();
  }

  // ── 事件分发 ──────────────────────────────────────────────────────────────

  /** 生成树状帮助菜单文本 */
  generateHelpText(): string {
    return generateHelpText(this._registry.all(), this._registry.blacklist as Set<string>);
  }

  /**
   * 将事件分发给所有匹配的 handler。
   * 先按 priority 执行 interceptors，任意 interceptor 可调用 stopPropagation() 终止。
   * 再按注册顺序执行匹配 pattern 的 handlers。
   */
  async dispatch(
    event: BotEvent,
    reply: (text: string) => Promise<void> = async () => {},
    sendAction: SendActionFn = async () => ({ ok: false, status: "failed", message: "sendAction not implemented" }),
    store?: PluginStore,
  ): Promise<void> {
    if (this._maintenanceMode) return;
    await dispatchEvent(
      this._registry.all(),
      this._registry.blacklist as Set<string>,
      (name, botId) => this._scope.isEnabledForBot(name, botId),
      event,
      reply,
      sendAction,
      store,
    );
  }

  // ── 黑名单 & 维护模式 ─────────────────────────────────────────────────────

  addToBlacklist(name: string): void {
    this._registry.addToBlacklist(name);
  }

  removeFromBlacklist(name: string): void {
    this._registry.removeFromBlacklist(name);
  }

  setMaintenanceMode(enabled: boolean): void {
    this._maintenanceMode = enabled;
  }

  // ── Bot 作用域 ────────────────────────────────────────────────────────────

  setPluginBots(name: string, botIds: readonly string[]): void {
    this._scope.setPluginBots(name, botIds);
  }

  getPluginBots(name: string): string[] {
    return this._scope.getPluginBots(name);
  }

  isPluginEnabledForBot(name: string, botId: string): boolean {
    return this._scope.isEnabledForBot(name, botId);
  }

  bulkSetPluginBots(map: Record<string, readonly string[]>): void {
    this._scope.bulkSet(map);
  }

  exportPluginBots(): Record<string, string[]> {
    return this._scope.export();
  }

  // ── 只读信息 ──────────────────────────────────────────────────────────────

  get pluginsDir(): string | null {
    return this._pluginsDir;
  }

  get plugins(): PluginInstance[] {
    return this._registry.all();
  }

  get maintenanceMode(): boolean {
    return this._maintenanceMode;
  }

  /**
   * 返回所有插件的公开元信息（不包含 handler 实现）。
   * 主要供前端 API 使用。
   */
  listPluginsMeta(): PluginPublicMeta[] {
    return this._registry.all().map((p) => ({
      name: p.meta.name,
      description: p.meta.description,
      version: p.meta.version,
      author: p.meta.author,
      icon: p.meta.icon,
      enabled: !this._registry.isBlacklisted(p.meta.name),
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
      bots: this._scope.getPluginBots(p.meta.name),
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
// 全局单例
// ---------------------------------------------------------------------------

export const pluginManager = new PluginManager();

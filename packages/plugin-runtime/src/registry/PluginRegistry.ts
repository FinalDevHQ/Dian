import { resolve } from "node:path";
import type { PluginInstance } from "../decorators.js";

/**
 * 插件注册表：管理已加载插件的 Map 和黑名单 Set。
 * 不负责加载/卸载逻辑，只做纯粹的数据存取。
 */
export class PluginRegistry {
  private readonly _plugins = new Map<string, PluginInstance>();
  private readonly _blacklist = new Set<string>();

  get(name: string): PluginInstance | undefined {
    return this._plugins.get(name);
  }

  set(name: string, instance: PluginInstance): void {
    this._plugins.set(name, instance);
  }

  has(name: string): boolean {
    return this._plugins.has(name);
  }

  delete(name: string): boolean {
    return this._plugins.delete(name);
  }

  values(): IterableIterator<PluginInstance> {
    return this._plugins.values();
  }

  entries(): IterableIterator<[string, PluginInstance]> {
    return this._plugins.entries();
  }

  get size(): number {
    return this._plugins.size;
  }

  // ── 黑名单 ────────────────────────────────────────────────────────────────

  addToBlacklist(name: string): void {
    this._blacklist.add(name);
  }

  removeFromBlacklist(name: string): void {
    this._blacklist.delete(name);
  }

  isBlacklisted(name: string): boolean {
    return this._blacklist.has(name);
  }

  get blacklist(): ReadonlySet<string> {
    return this._blacklist;
  }

  // ── 便捷方法 ──────────────────────────────────────────────────────────────

  /** 返回所有插件实例的快照数组 */
  all(): PluginInstance[] {
    return [...this._plugins.values()];
  }

  /** 通过 filePath 查找插件 */
  findByFilePath(filePath: string): PluginInstance | undefined {
    for (const plugin of this._plugins.values()) {
      if (plugin.filePath === filePath) return plugin;
    }
    return undefined;
  }

  /** 卸载 filePath 位于指定目录下的所有插件，返回被卸载的插件名列表 */
  unloadByDir(dir: string, pathSep: string): string[] {
    const normalizedDir = resolve(dir);
    const unloaded: string[] = [];
    for (const [name, plugin] of this._plugins) {
      const fp = resolve(plugin.filePath);
      if (fp.startsWith(normalizedDir + pathSep) || fp.startsWith(normalizedDir + "/")) {
        this._plugins.delete(name);
        unloaded.push(name);
      }
    }
    return unloaded;
  }
}

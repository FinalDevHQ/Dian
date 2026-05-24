import type { CommandEntry, EventContext, Pattern, PluginInstance } from "../decorators.js";
import { stringifyPattern } from "../utils/pattern.js";

export type CommandId = string;
export type PluginId = string;
export type CommandHandler = (ctx: EventContext) => void | Promise<void>;

export interface CommandRecord {
  id: CommandId;
  pluginId: PluginId;
  name: string;
  path: string[];
  fullName: string;
  description?: string;
  category?: string;
  aliases: string[];
  hidden: boolean;
  order: number;
  parentId: CommandId | null;
  childIds: CommandId[];
  pattern?: Pattern;
  handler?: CommandHandler;
}

export interface CommandPublicNode {
  id: CommandId;
  pluginId: PluginId;
  name: string;
  path: string[];
  fullName: string;
  description?: string;
  category?: string;
  pattern: string;
  aliases: string[];
  hidden: boolean;
  order: number;
  children: CommandPublicNode[];
}

export class CommandRegistry {
  private readonly _byId = new Map<CommandId, CommandRecord>();
  private readonly _byPlugin = new Map<PluginId, Set<CommandId>>();
  private readonly _rootsByPlugin = new Map<PluginId, Set<CommandId>>();
  private readonly _byFullName = new Map<string, CommandId>();
  private _version = 0;

  get version(): number {
    return this._version;
  }

  registerPlugin(plugin: PluginInstance): void {
    const pluginId = plugin.meta.name;
    this.unregisterPlugin(pluginId);

    for (const command of plugin.commands) {
      this._registerNode(pluginId, command, [], null, undefined, new WeakSet<object>());
    }
    this._version++;
  }

  unregisterPlugin(pluginId: PluginId): void {
    const ids = this._byPlugin.get(pluginId);
    if (!ids || ids.size === 0) return;

    for (const id of ids) {
      const record = this._byId.get(id);
      if (record) this._byFullName.delete(this._fullNameKey(record.pluginId, record.fullName));
      this._byId.delete(id);
    }
    this._byPlugin.delete(pluginId);
    this._rootsByPlugin.delete(pluginId);
    this._version++;
  }

  getByPlugin(pluginId: PluginId, options: { includeHidden?: boolean } = {}): CommandRecord[] {
    const ids = this._byPlugin.get(pluginId);
    if (!ids) return [];

    return [...ids]
      .map((id) => this._byId.get(id))
      .filter((record): record is CommandRecord => Boolean(record))
      .filter((record) => options.includeHidden || !record.hidden)
      .sort(compareCommands);
  }

  getRootsByPlugin(pluginId: PluginId, options: { includeHidden?: boolean } = {}): CommandPublicNode[] {
    const rootIds = this._rootsByPlugin.get(pluginId);
    if (!rootIds) return [];

    return [...rootIds]
      .map((id) => this._toPublicNode(id, options))
      .filter((node): node is CommandPublicNode => Boolean(node))
      .sort(comparePublicCommands);
  }

  countByPlugin(pluginId: PluginId, options: { includeHidden?: boolean; includeGroups?: boolean } = {}): number {
    return this.getByPlugin(pluginId, options).filter((record) => {
      if (options.includeGroups) return true;
      return Boolean(record.pattern && record.handler);
    }).length;
  }

  snapshot(options: { includeHidden?: boolean; pluginId?: PluginId } = {}): CommandPublicNode[] {
    const pluginIds = options.pluginId ? [options.pluginId] : [...this._rootsByPlugin.keys()];
    return pluginIds.flatMap((pluginId) => this.getRootsByPlugin(pluginId, options));
  }

  private _registerNode(
    pluginId: PluginId,
    entry: CommandEntry,
    parentPath: string[],
    parentId: CommandId | null,
    inheritedCategory: string | undefined,
    ancestors: WeakSet<object>,
  ): CommandId {
    if (ancestors.has(entry)) {
      throw new Error(`[plugin-runtime] command tree for "${pluginId}" contains a circular reference`);
    }

    ancestors.add(entry);
    const path = [...parentPath, entry.name];
    const fullName = path.join(" ");
    const id = this._commandId(pluginId, path);
    const key = this._fullNameKey(pluginId, fullName);

    if (this._byFullName.has(key)) {
      throw new Error(`[plugin-runtime] duplicate command "${fullName}" in plugin "${pluginId}"`);
    }

    const record: CommandRecord = {
      id,
      pluginId,
      name: entry.name,
      path,
      fullName,
      description: entry.description,
      category: entry.category ?? inheritedCategory,
      aliases: entry.aliases ?? [],
      hidden: entry.hidden ?? false,
      order: entry.order ?? 0,
      parentId,
      childIds: [],
      pattern: entry.pattern,
      handler: entry.handler,
    };

    this._byId.set(id, record);
    this._byFullName.set(key, id);
    this._ensureSet(this._byPlugin, pluginId).add(id);
    if (parentId) {
      const parent = this._byId.get(parentId);
      if (parent) parent.childIds.push(id);
    } else {
      this._ensureSet(this._rootsByPlugin, pluginId).add(id);
    }

    for (const child of entry.children ?? []) {
      this._registerNode(pluginId, child, path, id, record.category, ancestors);
    }

    ancestors.delete(entry);
    return id;
  }

  private _toPublicNode(id: CommandId, options: { includeHidden?: boolean }): CommandPublicNode | null {
    const record = this._byId.get(id);
    if (!record) return null;
    if (record.hidden && !options.includeHidden) return null;

    return {
      id: record.id,
      pluginId: record.pluginId,
      name: record.name,
      path: [...record.path],
      fullName: record.fullName,
      description: record.description,
      category: record.category,
      pattern: stringifyPattern(record.pattern),
      aliases: [...record.aliases],
      hidden: record.hidden,
      order: record.order,
      children: record.childIds
        .map((childId) => this._toPublicNode(childId, options))
        .filter((node): node is CommandPublicNode => Boolean(node))
        .sort(comparePublicCommands),
    };
  }

  private _ensureSet<K, V>(map: Map<K, Set<V>>, key: K): Set<V> {
    let set = map.get(key);
    if (!set) {
      set = new Set<V>();
      map.set(key, set);
    }
    return set;
  }

  private _commandId(pluginId: PluginId, path: string[]): CommandId {
    return `${encodeURIComponent(pluginId)}:${path.map((part) => encodeURIComponent(part)).join("/")}`;
  }

  private _fullNameKey(pluginId: PluginId, fullName: string): string {
    return `${pluginId}:${fullName}`;
  }
}

function compareCommands(a: CommandRecord, b: CommandRecord): number {
  return a.order - b.order || a.fullName.localeCompare(b.fullName, "zh-Hans-CN");
}

function comparePublicCommands(a: CommandPublicNode, b: CommandPublicNode): number {
  return a.order - b.order || a.fullName.localeCompare(b.fullName, "zh-Hans-CN");
}

import type { CommandEntry, EventContext, Pattern, PluginInstance } from "../decorators.js";
import { stringifyPattern } from "../utils/pattern.js";

export type CommandId = string;
export type PluginId = string;
export type CommandHandler = (ctx: EventContext) => void | Promise<void>;

export interface CommandRecord {
  id: CommandId;
  pluginId: PluginId;
  name: string;
  segment: string;
  path: string[];
  fullPath: string;
  fullName: string;
  description?: string;
  usage?: string;
  examples: string[];
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
  segment: string;
  path: string[];
  fullPath: string;
  fullName: string;
  parentId: CommandId | null;
  description?: string;
  usage?: string;
  examples: string[];
  category?: string;
  pattern: string;
  aliases: string[];
  hidden: boolean;
  order: number;
  children: CommandPublicNode[];
}

export interface CommandBreadcrumbItem {
  id: CommandId;
  name: string;
  fullPath: string;
}

export type CommandResolveResult =
  | { type: "root"; children: CommandPublicNode[] }
  | { type: "command"; command: CommandPublicNode; children: CommandPublicNode[]; breadcrumb: CommandBreadcrumbItem[] }
  | { type: "ambiguous"; candidates: CommandPublicNode[] }
  | { type: "not_found"; query: string; suggestions: CommandPublicNode[] };

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
      // key 在注册时用的是 segment-based path（record.path.join(" ")），不是 displayName-based fullName
      if (record) this._byFullName.delete(this._fullNameKey(record.pluginId, record.path.join(" ")));
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

  roots(options: { includeHidden?: boolean; pluginId?: PluginId } = {}): CommandPublicNode[] {
    return this.snapshot(options);
  }

  get(id: CommandId, options: { includeHidden?: boolean } = {}): CommandPublicNode | null {
    return this._toPublicNode(id, options);
  }

  children(id: CommandId, options: { includeHidden?: boolean } = {}): CommandPublicNode[] {
    const record = this._byId.get(id);
    if (!record) return [];
    return record.childIds
      .map((childId) => this._toPublicNode(childId, options))
      .filter((node): node is CommandPublicNode => Boolean(node))
      .sort(comparePublicCommands);
  }

  breadcrumb(id: CommandId): CommandBreadcrumbItem[] {
    const items: CommandBreadcrumbItem[] = [];
    let current = this._byId.get(id);
    while (current) {
      items.push({ id: current.id, name: current.name, fullPath: current.fullPath });
      current = current.parentId ? this._byId.get(current.parentId) : undefined;
    }
    return items.reverse();
  }

  resolveHelpPath(input = "", options: { includeHidden?: boolean; pluginId?: PluginId } = {}): CommandResolveResult {
    const query = input.trim();
    const roots = this.roots(options);
    if (!query) return { type: "root", children: roots };

    const tokens = tokenizeHelpPath(query);
    if (tokens.length === 0) return { type: "root", children: roots };

    const candidates = this._resolveFromRoots(tokens, options);
    if (candidates.length === 1) {
      const command = candidates[0];
      return {
        type: "command",
        command,
        children: this.children(command.id, options),
        breadcrumb: this.breadcrumb(command.id),
      };
    }
    if (candidates.length > 1) return { type: "ambiguous", candidates };

    return { type: "not_found", query, suggestions: this._suggest(tokens.join(" "), options) };
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
    const segment = entry.segment ?? entry.name;
    const path = [...parentPath, segment];
    const displayPath = parentId ? [...(this._byId.get(parentId)?.fullName.split(" ") ?? []), entry.name] : [entry.name];
    const fullName = path.join(" ");
    const fullPath = path.join(".");
    const id = this._commandId(pluginId, path);
    const key = this._fullNameKey(pluginId, fullName);

    if (this._byFullName.has(key)) {
      throw new Error(`[plugin-runtime] duplicate command "${fullName}" in plugin "${pluginId}"`);
    }

    const record: CommandRecord = {
      id,
      pluginId,
      name: entry.name,
      segment,
      path,
      fullPath,
      fullName: displayPath.join(" "),
      description: entry.description,
      usage: entry.usage,
      examples: entry.examples ?? [],
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
      segment: record.segment,
      path: [...record.path],
      fullPath: record.fullPath,
      fullName: record.fullName,
      parentId: record.parentId,
      description: record.description,
      usage: record.usage,
      examples: [...record.examples],
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

  private _resolveFromRoots(tokens: string[], options: { includeHidden?: boolean; pluginId?: PluginId }): CommandPublicNode[] {
    const pluginIds = options.pluginId ? [options.pluginId] : [...this._rootsByPlugin.keys()];
    const matches: CommandPublicNode[] = [];
    for (const pluginId of pluginIds) {
      const roots = this.getRootsByPlugin(pluginId, options);
      const resolved = resolvePathInNodes(roots, tokens);
      matches.push(...resolved);
    }
    return matches;
  }

  private _suggest(query: string, options: { includeHidden?: boolean; pluginId?: PluginId }): CommandPublicNode[] {
    const normalized = normalizeHelpToken(query);
    if (!normalized) return [];
    const all = flattenPublicNodes(this.roots(options));
    return all
      .filter((node) => labelsForNode(node).some((label) => normalizeHelpToken(label).includes(normalized)))
      .slice(0, 5);
  }
}

function compareCommands(a: CommandRecord, b: CommandRecord): number {
  return a.order - b.order || a.fullName.localeCompare(b.fullName, "zh-Hans-CN");
}

function comparePublicCommands(a: CommandPublicNode, b: CommandPublicNode): number {
  return a.order - b.order || a.fullName.localeCompare(b.fullName, "zh-Hans-CN");
}

function tokenizeHelpPath(input: string): string[] {
  return input
    .trim()
    .split(/[.\s]+/)
    .map(normalizeHelpToken)
    .filter(Boolean);
}

function normalizeHelpToken(input: string): string {
  return input.trim().toLowerCase().replace(/[\s/_-]+/g, " ");
}

function labelsForNode(node: CommandPublicNode): string[] {
  return [node.name, node.segment, node.fullPath, node.fullName, ...node.aliases].filter(Boolean);
}

function matchesNode(node: CommandPublicNode, token: string): boolean {
  return labelsForNode(node).some((label) => normalizeHelpToken(label) === token);
}

function resolvePathInNodes(nodes: CommandPublicNode[], tokens: string[]): CommandPublicNode[] {
  const [token, ...rest] = tokens;
  const currentMatches = nodes.filter((node) => matchesNode(node, token));
  if (rest.length === 0) return currentMatches;
  return currentMatches.flatMap((node) => resolvePathInNodes(node.children, rest));
}

function flattenPublicNodes(nodes: CommandPublicNode[]): CommandPublicNode[] {
  return nodes.flatMap((node) => [node, ...flattenPublicNodes(node.children)]);
}

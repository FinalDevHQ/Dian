import type { CommandEntry, PluginInstance } from "../decorators.js";
import type { CommandPublicNode } from "../registry/CommandRegistry.js";
import { stringifyPattern } from "../utils/pattern.js";

export interface HelpPluginView {
  name: string;
  description?: string;
  icon?: string;
  commands: CommandPublicNode[];
  commandCount: number;
}

/**
 * 生成一级帮助菜单文本。
 * 默认按插件展示，避免不同插件的分类混在一起。
 */
export function generateHelpText(plugins: PluginInstance[], blacklist: Set<string>): string {
  const lines: string[] = ["📋 可用命令："];
  const enabledPlugins = plugins.filter((plugin) => !blacklist.has(plugin.meta.name) && plugin.commands.length > 0);

  for (let i = 0; i < enabledPlugins.length; i++) {
    const plugin = enabledPlugins[i];
    const isLast = i === enabledPlugins.length - 1;
    const displayName = plugin.meta.description || plugin.meta.name;
    const icon = plugin.meta.icon ? `${plugin.meta.icon} ` : "";
  lines.push(`${isLast ? "└" : "├"}─ ${icon}${displayName} (${plugin.commands.length}条)`);
  }

  lines.push("发送插件名查看详细命令。");
  return lines.join("\n");
}

export function generateHelpTextFromViews(plugins: HelpPluginView[]): string {
  const lines: string[] = ["📋 可用命令："];
  const enabledPlugins = plugins.filter((plugin) => plugin.commandCount > 0);

  for (let i = 0; i < enabledPlugins.length; i++) {
    const plugin = enabledPlugins[i];
    const isLast = i === enabledPlugins.length - 1;
    const displayName = plugin.description || plugin.name;
    const icon = plugin.icon ? `${plugin.icon} ` : "";
    lines.push(`${isLast ? "└" : "├"}─ ${icon}${displayName} (${plugin.commandCount}条)`);
  }

  lines.push("发送插件名查看详细命令。");
  return lines.join("\n");
}

/**
 * 生成某个插件的详细命令列表。
 * 匹配逻辑：输入文本与插件名或插件描述模糊匹配。
 */
export function generatePluginHelpText(plugins: PluginInstance[], blacklist: Set<string>, text: string): string | null {
  const query = text.trim().toLowerCase();
  const enabledPlugins = plugins.filter((plugin) => !blacklist.has(plugin.meta.name) && plugin.commands.length > 0);

  // 精确匹配插件名
  let matched = enabledPlugins.find((p) => p.meta.name.toLowerCase() === query);
  // 模糊匹配插件描述
  if (!matched) {
    matched = enabledPlugins.find((p) => {
      const desc = (p.meta.description || "").toLowerCase();
      return desc.includes(query) || query.includes(desc);
    });
  }
  // 模糊匹配插件名
  if (!matched) {
    matched = enabledPlugins.find((p) => p.meta.name.toLowerCase().includes(query) || query.includes(p.meta.name.toLowerCase()));
  }

  if (!matched) return null;

  const displayName = matched.meta.description || matched.meta.name;
  const icon = matched.meta.icon ? `${matched.meta.icon} ` : "";
  const lines: string[] = [`${icon}${displayName} 命令列表：`];

  const categorized = new Map<string, CommandEntry[]>();
  const uncategorized: CommandEntry[] = [];

  for (const cmd of matched.commands) {
    if (cmd.category) {
      if (!categorized.has(cmd.category)) categorized.set(cmd.category, []);
      categorized.get(cmd.category)!.push(cmd);
    } else {
      uncategorized.push(cmd);
    }
  }

  for (const [category, cmds] of categorized) {
    lines.push(`├─ ${category}`);
    for (let i = 0; i < cmds.length; i++) {
      const cmd = cmds[i];
      const isLast = i === cmds.length - 1;
      const branch = isLast ? "└" : "├";
      const desc = cmd.description ? ` - ${cmd.description}` : "";
      lines.push(`│  ${branch}─ ${cmd.name}${desc}`);
      if (cmd.children && cmd.children.length > 0) {
        renderChildren(cmd.children, lines, `│  ${isLast ? "   " : "│  "}`);
      }
    }
  }

  for (let i = 0; i < uncategorized.length; i++) {
    const cmd = uncategorized[i];
    const isLast = i === uncategorized.length - 1;
    const branch = isLast ? "└" : "├";
    const desc = cmd.description ? ` - ${cmd.description}` : "";
    lines.push(`${branch}─ ${cmd.name}${desc}`);
    if (cmd.children && cmd.children.length > 0) {
      renderChildren(cmd.children, lines, `${isLast ? "   " : "│  "}`);
    }
  }

  lines.push(`共 ${matched.commands.length} 条指令`);
  return lines.join("\n");
}

export function generatePluginHelpTextFromViews(plugins: HelpPluginView[], text: string): string | null {
  const query = text.trim().toLowerCase();
  const enabledPlugins = plugins.filter((plugin) => plugin.commandCount > 0);

  let matched = enabledPlugins.find((p) => p.name.toLowerCase() === query);
  if (!matched) {
    matched = enabledPlugins.find((p) => {
      const desc = (p.description || "").toLowerCase();
      return desc.length > 0 && (desc.includes(query) || query.includes(desc));
    });
  }
  if (!matched) {
    matched = enabledPlugins.find((p) => p.name.toLowerCase().includes(query) || query.includes(p.name.toLowerCase()));
  }

  if (!matched) return null;

  const displayName = matched.description || matched.name;
  const icon = matched.icon ? `${matched.icon} ` : "";
  const lines: string[] = [`${icon}${displayName} 命令列表：`];

  const categorized = new Map<string, CommandPublicNode[]>();
  const uncategorized: CommandPublicNode[] = [];

  for (const cmd of matched.commands) {
    if (cmd.category) {
      if (!categorized.has(cmd.category)) categorized.set(cmd.category, []);
      categorized.get(cmd.category)!.push(cmd);
    } else {
      uncategorized.push(cmd);
    }
  }

  for (const [category, cmds] of categorized) {
    lines.push(`├─ ${category}`);
    renderPublicChildren(cmds, lines, "│  ");
  }

  renderPublicChildren(uncategorized, lines, "");
  lines.push(`共 ${matched.commandCount} 条指令`);
  return lines.join("\n");
}

/**
 * 递归映射子命令到公开元信息（供 listPluginsMeta 使用）。
 */
export function mapCommandChildren(children: CommandEntry[]): Array<{
  name: string;
  pattern: string;
  description?: string;
  category?: string;
  children?: ReturnType<typeof mapCommandChildren>;
}> {
  return children.map((c) => ({
    name: c.name,
    pattern: stringifyPattern(c.pattern),
    description: c.description,
    category: c.category,
    children: c.children ? mapCommandChildren(c.children) : undefined,
  }));
}

// ── 内部 ────────────────────────────────────────────────────────────────────

function renderChildren(children: CommandEntry[], lines: string[], prefix: string): void {
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const isLast = i === children.length - 1;
    const branch = isLast ? "└" : "├";
    const desc = child.description ? ` - ${child.description}` : "";
    lines.push(`${prefix}${branch}─ ${child.name}${desc}`);

    if (child.children && child.children.length > 0) {
      renderChildren(child.children, lines, `${prefix}${isLast ? "   " : "│  "}`);
    }
  }
}

function renderPublicChildren(children: CommandPublicNode[], lines: string[], prefix: string): void {
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const isLast = i === children.length - 1;
    const branch = isLast ? "└" : "├";
    const desc = child.description ? ` - ${child.description}` : "";
    lines.push(`${prefix}${branch}─ ${child.name}${desc}`);

    if (child.children.length > 0) {
      renderPublicChildren(child.children, lines, `${prefix}${isLast ? "   " : "│  "}`);
    }
  }
}

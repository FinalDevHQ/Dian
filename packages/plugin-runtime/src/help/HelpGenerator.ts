import type { CommandEntry, PluginInstance } from "../decorators.js";
import { stringifyPattern } from "../utils/pattern.js";

interface CommandNode {
  name: string;
  description?: string;
  children?: CommandEntry[];
}

/**
 * 生成一级帮助菜单文本。
 * 默认只展示分类，避免群里刷出完整指令清单。
 */
export function generateHelpText(plugins: PluginInstance[], blacklist: Set<string>): string {
  const lines: string[] = ["📋 可用命令："];

  const categorized = new Map<string, CommandNode[]>();
  const uncategorized: CommandNode[] = [];

  for (const plugin of plugins) {
    if (blacklist.has(plugin.meta.name)) continue;

    for (const cmd of plugin.commands) {
      const entry: CommandNode = { name: cmd.name, description: cmd.description, children: cmd.children };
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

  const categoryEntries = Array.from(categorized.entries());
  for (let i = 0; i < categoryEntries.length; i++) {
    const [category, commands] = categoryEntries[i];
    const isLastCategory = i === categoryEntries.length - 1 && uncategorized.length === 0;
    lines.push(`${isLastCategory ? "└" : "├"}─ ${category} (${commands.length}条)`);
  }

  if (uncategorized.length > 0) {
    lines.push(`└─ 其他 (${uncategorized.length}条)`);
  }

  lines.push("发送具体指令名查看或直接使用对应命令。");
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
    lines.push(`${prefix}${branch} ${child.name}${desc}`);

    if (child.children && child.children.length > 0) {
      renderChildren(child.children, lines, `${prefix}${isLast ? "   " : "│  "}`);
    }
  }
}

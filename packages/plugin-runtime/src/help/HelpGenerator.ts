import type { CommandEntry, PluginInstance } from "../decorators.js";
import { stringifyPattern } from "../utils/pattern.js";

interface CommandNode {
  name: string;
  description?: string;
  children?: CommandEntry[];
}

/**
 * 生成树状帮助菜单文本。
 * 纯函数，不依赖任何外部状态。
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

      if (cmd.children && cmd.children.length > 0) {
        const childPrefix = isLastCategory ? "   " : "│  ";
        renderChildren(cmd.children, lines, `${childPrefix}${isLast ? "   " : "│  "}`);
      }
    }
  }

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

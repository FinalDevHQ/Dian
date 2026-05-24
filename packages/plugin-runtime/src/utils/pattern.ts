import type { Pattern } from "../decorators.js";

/**
 * 测试 pattern 是否匹配给定文本。
 * 函数形式每次求值，实现"配置即改即生效"。
 */
export function matchPattern(pattern: Pattern, text: string): boolean {
  const resolved = typeof pattern === "function" ? pattern() : pattern;
  if (resolved instanceof RegExp) return resolved.test(text);
  return text === resolved;
}

/**
 * 把 pattern 转成可读字符串，用于前端展示。
 * - string  : 原样返回
 * - RegExp  : .toString()（如 "/^!echo (.+)$/"）
 * - function: 调用并递归 stringify，异常时返回 "<dynamic>"
 */
export function stringifyPattern(pattern: Pattern | undefined): string {
  if (!pattern) return "";
  try {
    const resolved = typeof pattern === "function" ? pattern() : pattern;
    if (resolved instanceof RegExp) return resolved.toString();
    return String(resolved);
  } catch {
    return "<dynamic>";
  }
}

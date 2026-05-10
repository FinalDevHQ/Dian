import { writeFile } from "node:fs/promises";
import yaml from "js-yaml";

/** 解析 YAML 字符串为任意 JS 值（解析错误会抛出）。 */
export function parseYaml(text: string): unknown {
  return yaml.load(text);
}

/**
 * 序列化任意值为 YAML 字符串。
 *
 * 注意：该函数会**丢失原文件中的注释**——这是 js-yaml 的固有限制，
 * 调用方需自行决定是否值得用结构化写入换掉手写格式。
 */
export function dumpYaml(value: unknown): string {
  return yaml.dump(value, {
    noRefs: true,
    lineWidth: 120,
    sortKeys: false,
  });
}

/** 把任意值序列化为 YAML 后写入指定路径（utf-8）。 */
export async function writeYamlFile(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, dumpYaml(value), "utf8");
}

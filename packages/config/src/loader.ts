import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import yaml from "js-yaml";
import type { ZodSchema } from "zod";
import {
  BotsSchema,
  SettingsSchema,
  TemplatesSchema,
  type AllConfig,
  type BotsConfig,
  type Settings,
  type TemplatesConfig,
} from "./schema.js";

// ---------------------------------------------------------------------------
// 内部工具
// ---------------------------------------------------------------------------

/**
 * 读取 YAML 文件并用给定 Zod schema 解析，校验失败时抛出详细错误。
 */
function loadYaml<T>(filePath: string, schema: ZodSchema<T>): T {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch (err) {
    throw new Error(
      `[config] 无法读取配置文件 "${filePath}": ${(err as NodeJS.ErrnoException).message}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (err) {
    throw new Error(
      `[config] YAML 解析失败 "${filePath}": ${(err as Error).message}`,
    );
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const details = result.error.issues
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((e: any) => `  - ${(e.path as PropertyKey[]).map(String).join(".")}: ${e.message as string}`)
      .join("\n");
    throw new Error(
      `[config] 配置校验失败 "${filePath}":\n${details}`,
    );
  }

  return result.data;
}

// ---------------------------------------------------------------------------
// 公开 API
// ---------------------------------------------------------------------------

export interface LoaderOptions {
  /** 配置目录路径，默认为 `<cwd>/config` */
  configDir?: string;
}

/**
 * 从磁盘加载全量配置（settings + bots + templates）。
 * 任意一项校验失败都会抛出错误，应在启动阶段调用以阻断进程。
 */
export function loadAllConfig(options: LoaderOptions = {}): AllConfig {
  const dir = resolve(options.configDir ?? "config");

  const settings: Settings = loadYaml(
    resolve(dir, "settings.yaml"),
    SettingsSchema,
  );

  const bots: BotsConfig = loadYaml(
    resolve(dir, "bot.yaml"),
    BotsSchema,
  );

  const templates: TemplatesConfig = loadYaml(
    resolve(dir, "templates.yaml"),
    TemplatesSchema,
  );

  return { settings, bots, templates };
}

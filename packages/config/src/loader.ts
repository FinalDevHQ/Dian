import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve, dirname } from "node:path";
import yaml from "js-yaml";
import type { ZodSchema } from "zod";
import {
  BotConfigSchema,
  SettingsSchema,
  TemplatesSchema,
  type AllConfig,
  type BotConfig,
  type Settings,
  type TemplatesConfig,
} from "./schema.js";

// ---------------------------------------------------------------------------
// 默认配置
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: Settings = {
  logLevel: "info",
  storage: {
    sqlite: "data/dian.db",
  },
  auth: {
    // 默认密码: change_me（请在 WebUI 或 settings.yaml 中修改）
    passwordHash: "$2b$10$swI7YQr18cCg1AzA6v5SleT.J5xfdp.LbvXp0IpmbCPxT7OPquDZO",
    // 首次启动时自动生成唯一随机密钥并写入 settings.yaml，重启后从文件读取保持稳定
    jwtSecret: randomBytes(32).toString("hex"),
    tokenExpiresIn: 86400,
  },
};

const DEFAULT_BOT: BotConfig = {
  bot: {
    botId: "my-bot",
    enabled: false,
    mode: "hybrid",
    ws: {
      url: "ws://127.0.0.1:6700/",
      accessToken: "",
      heartbeatIntervalMs: 30000,
      reconnectIntervalMs: 5000,
    },
    http: {
      baseUrl: "http://127.0.0.1:5700/",
      accessToken: "",
      timeoutMs: 5000,
    },
  },
};

const DEFAULT_TEMPLATES: TemplatesConfig = {
  templates: {
    welcome: "欢迎 {name} 加入群聊！",
    goodbye: "再见，{name}，期待你的归来。",
  },
};

// ---------------------------------------------------------------------------
// 内部工具
// ---------------------------------------------------------------------------

/**
 * 确保目录存在
 */
function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * 如果文件不存在，创建默认配置文件
 */
function ensureConfigFile(filePath: string, defaultContent: object): void {
  if (!existsSync(filePath)) {
    ensureDir(filePath);
    const content = yaml.dump(defaultContent, { lineWidth: -1 });
    writeFileSync(filePath, content, "utf-8");
    console.log(`[config] 已创建默认配置文件: ${filePath}`);
  }
}

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
 * 尝试加载并校验 YAML 文件；若文件缺失、内容为空或校验失败，
 * 自动用 defaultValue 覆盖写回文件并返回默认值，而不是抛出错误。
 * 这样全新克隆 + docker compose up 的用户无需手动建配置文件。
 */
function loadYamlOrDefault<T>(
  filePath: string,
  schema: ZodSchema<T>,
  defaultValue: T,
): T {
  // 文件不存在 → 写入默认值
  if (!existsSync(filePath)) {
    ensureConfigFile(filePath, defaultValue as object);
    return defaultValue;
  }

  try {
    return loadYaml(filePath, schema);
  } catch (err) {
    // 校验失败（格式错误 / 旧格式 / 空文件）→ 用默认值覆盖，保留坏文件备份
    const backup = `${filePath}.bak`;
    try {
      writeFileSync(backup, readFileSync(filePath, "utf-8"), "utf-8");
    } catch {
      // 备份失败无需中断
    }
    const content = yaml.dump(defaultValue as object, { lineWidth: -1 });
    writeFileSync(filePath, content, "utf-8");
    console.warn(
      `[config] 配置文件 "${filePath}" 校验失败，已重置为默认值（原文件备份为 .bak）:\n` +
        `  原因: ${(err as Error).message}`,
    );
    return defaultValue;
  }
}

/**
 * 从磁盘加载全量配置（settings + bot + templates）。
 * 文件不存在或校验失败时均自动回退到内置默认值并写回磁盘，
 * 确保全新克隆后直接 docker compose up 也能正常启动。
 */
export function loadAllConfig(options: LoaderOptions = {}): AllConfig {
  const dir = resolve(options.configDir ?? "config");

  const settings: Settings = loadYamlOrDefault(
    resolve(dir, "settings.yaml"),
    SettingsSchema,
    DEFAULT_SETTINGS,
  );

  const bot: BotConfig = loadYamlOrDefault(
    resolve(dir, "bot.yaml"),
    BotConfigSchema,
    DEFAULT_BOT,
  );

  const templates: TemplatesConfig = loadYamlOrDefault(
    resolve(dir, "templates.yaml"),
    TemplatesSchema,
    DEFAULT_TEMPLATES,
  );

  return { settings, bot, templates };
}

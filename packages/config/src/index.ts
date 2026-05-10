// Schema & 类型
export type {
  Settings,
  BotEntry,
  BotWsConfig,
  BotHttpConfig,
  BotsConfig,
  TemplatesConfig,
  AllConfig,
} from "./schema.js";

export {
  SettingsSchema,
  BotsSchema,
  TemplatesSchema,
  BotEntrySchema,
  OneBotWsConfigSchema,
  OneBotHttpConfigSchema,
  LogLevelSchema,
} from "./schema.js";

// Loader
export { loadAllConfig } from "./loader.js";
export type { LoaderOptions } from "./loader.js";

// Writer
export { parseYaml, dumpYaml, writeYamlFile } from "./writer.js";

// Service
export { ConfigService, configService } from "./service.js";
export type { ConfigChangeEvent, ConfigServiceEvents } from "./service.js";

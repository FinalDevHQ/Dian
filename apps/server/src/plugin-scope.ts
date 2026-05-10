import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pluginManager } from "@dian/plugin-runtime";
import type { LogService } from "@dian/logger";

/**
 * 插件 → bot 白名单的持久化。
 *
 * 文件格式（config/plugin-scope.json）：
 *   { "ping-pong": ["botA", "botB"], "anti-spam": [] }
 *
 * 语义：
 *   - 不在文件里、或值为空数组 ⇒ 该插件对**任何 bot 都不响应**（白名单默认拒绝）
 *   - PluginManager._botScope 是单一事实源，本模块只做磁盘 ⇄ 内存的同步
 */

export interface PluginScopeIO {
  load: () => Promise<void>;
  save: () => Promise<void>;
}

export function createPluginScopeIO(
  configDir: string,
  logger: LogService,
): PluginScopeIO {
  const file = resolve(configDir, "plugin-scope.json");
  const log = logger.child({ component: "PluginScope" });

  return {
    async load() {
      if (!existsSync(file)) {
        log.info(`No plugin-scope file at ${file}, starting with empty scope`);
        return;
      }
      try {
        const raw = await readFile(file, "utf8");
        const data = JSON.parse(raw) as unknown;
        if (!isStringArrayMap(data)) {
          log.warn(`plugin-scope.json shape invalid, ignored`);
          return;
        }
        pluginManager.bulkSetPluginBots(data);
        log.info(`Loaded plugin scope`, {
          plugins: Object.keys(data).length,
        });
      } catch (err) {
        log.error(`Failed to load plugin-scope.json`, {
          err: (err as Error).message,
        });
      }
    },

    async save() {
      const data = pluginManager.exportPluginBots();
      try {
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, JSON.stringify(data, null, 2), "utf8");
      } catch (err) {
        log.error(`Failed to save plugin-scope.json`, {
          err: (err as Error).message,
        });
        throw err;
      }
    },
  };
}

function isStringArrayMap(v: unknown): v is Record<string, string[]> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  for (const val of Object.values(v as Record<string, unknown>)) {
    if (!Array.isArray(val)) return false;
    if (!val.every((s) => typeof s === "string")) return false;
  }
  return true;
}

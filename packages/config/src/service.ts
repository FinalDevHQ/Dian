import { EventEmitter } from "node:events";
import { resolve } from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import { loadAllConfig } from "./loader.js";
import type { AllConfig, BotEntry, Settings, TemplatesConfig } from "./schema.js";

// ---------------------------------------------------------------------------
// 事件类型声明（TypeScript 严格事件类型）
// ---------------------------------------------------------------------------

export interface ConfigChangeEvent {
  /** 哪个文件触发了变更 */
  file: "settings.yaml" | "bot.yaml" | "templates.yaml";
  /** 变更后的完整配置快照 */
  config: AllConfig;
}

export interface ConfigServiceEvents {
  change: [event: ConfigChangeEvent];
  error: [err: Error];
}

// ---------------------------------------------------------------------------
// ConfigService
// ---------------------------------------------------------------------------

export class ConfigService extends EventEmitter<ConfigServiceEvents> {
  private _config: AllConfig | null = null;
  private _configDir: string = resolve("config");
  private _watcher: FSWatcher | null = null;

  // ── 初始化 ──────────────────────────────────────────────────────────────

  /**
   * 从磁盘加载全量配置。必须在使用任何 getter 之前调用。
   * 加载或校验失败会抛出错误，阻断启动流程。
   *
   * @param configDir 配置目录，默认 `<cwd>/config`
   */
  init(configDir?: string): void {
    if (configDir) {
      this._configDir = resolve(configDir);
    }
    this._config = loadAllConfig({ configDir: this._configDir });
  }

  // ── Getter ───────────────────────────────────────────────────────────────

  private get config(): AllConfig {
    if (!this._config) {
      throw new Error("[config] ConfigService 尚未初始化，请先调用 init()");
    }
    return this._config;
  }

  get settings(): Settings {
    return this.config.settings;
  }

  get bots(): BotEntry[] {
    return this.config.bots.bots;
  }

  get templates(): TemplatesConfig["templates"] {
    return this.config.templates.templates;
  }

  // ── 热重载 ───────────────────────────────────────────────────────────────

  /**
   * 开启文件监听，配置文件变更时自动重新加载并校验。
   * 校验成功后替换配置并 emit `change` 事件；校验失败时 emit `error` 事件，
   * 保留上一次有效配置不变。
   */
  watch(): void {
    if (this._watcher) return;

    const files = [
      resolve(this._configDir, "settings.yaml"),
      resolve(this._configDir, "bot.yaml"),
      resolve(this._configDir, "templates.yaml"),
    ];

    this._watcher = chokidar.watch(files, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    });

    this._watcher.on("change", (changedPath: string) => {
      const fileName = changedPath.replace(/\\/g, "/").split("/").pop() as
        | "settings.yaml"
        | "bot.yaml"
        | "templates.yaml";

      let next: AllConfig;
      try {
        next = loadAllConfig({ configDir: this._configDir });
      } catch (err) {
        this.emit("error", err as Error);
        return;
      }

      this._config = next;
      this.emit("change", { file: fileName, config: next });
    });
  }

  /**
   * 停止文件监听。
   */
  async unwatch(): Promise<void> {
    if (this._watcher) {
      await this._watcher.close();
      this._watcher = null;
    }
  }

  // ── 脱敏 ─────────────────────────────────────────────────────────────────

  /**
   * 返回脱敏后的完整配置快照（屏蔽所有 accessToken 字段）。
   * 用于向 Web 面板暴露配置信息时使用。
   */
  redact(): AllConfig {
    const cfg = this.config;
    return {
      settings: cfg.settings,
      templates: cfg.templates,
      bots: {
        bots: cfg.bots.bots.map((bot) => ({
          ...bot,
          ws: bot.ws
            ? { ...bot.ws, accessToken: bot.ws.accessToken ? "***" : undefined }
            : undefined,
          http: bot.http
            ? { ...bot.http, accessToken: bot.http.accessToken ? "***" : undefined }
            : undefined,
        })),
      },
    };
  }
}

/** 全局单例 */
export const configService = new ConfigService();

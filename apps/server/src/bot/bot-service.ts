import type { LogService } from "@myfinal/logger";
import type { ConfigService } from "@myfinal/config";
import type { BotEvent } from "@myfinal/shared";
import { BotInstance } from "./bot-instance.js";

/**
 * BotService — 单机器人生命周期管理
 *
 * - 读取 bot.yaml 初始化唯一的 BotInstance
 * - 提供统一的 start / stop / reloadConfig
 */
export class BotService {
  private instance: BotInstance | null = null;
  private readonly log: ReturnType<LogService["child"]>;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LogService,
    private readonly onEvent: (event: BotEvent) => Promise<void>
  ) {
    this.log = logger.child({ component: "BotService" });
  }

  async start(): Promise<void> {
    const entry = this.config.bot;
    const enabled = entry.enabled !== false;

    if (!enabled) {
      this.log.info(`Bot "${entry.botId}" is disabled, skipping start`);
      return;
    }

    this.log.info(`Starting bot "${entry.botId}"...`);

    this.instance = new BotInstance(entry, this.logger, this.onEvent);
    try {
      await this.instance.start();
      this.log.info(`Bot "${entry.botId}" started successfully`);
    } catch (err) {
      this.log.warn(
        `Bot "${entry.botId}" initial connect failed; will keep retrying in background`,
        { err: err instanceof Error ? err.message : String(err) }
      );
    }
  }

  /** 获取当前 bot 的状态 */
  getBotState(): {
    botId: string;
    enabled: boolean;
    running: boolean;
    status:
      | "disabled"
      | "idle"
      | "connecting"
      | "connected"
      | "reconnecting"
      | "closed"
      | "no-ws";
  } {
    const entry = this.config.bot;
    const enabled = entry.enabled !== false;
    const status = !enabled
      ? ("disabled" as const)
      : (this.instance?.status ?? ("idle" as const));

    return {
      botId: entry.botId,
      enabled,
      running: !!this.instance,
      status,
    };
  }

  async stop(): Promise<void> {
    this.log.info("Stopping bot...");
    if (this.instance) {
      await this.instance.stop();
      this.instance = null;
    }
    this.log.info("Bot stopped");
  }

  async reloadConfig(): Promise<void> {
    this.log.info("Reloading bot config...");
    await this.stop();
    await this.start();
  }

  getBot(): BotInstance | undefined {
    return this.instance ?? undefined;
  }
}

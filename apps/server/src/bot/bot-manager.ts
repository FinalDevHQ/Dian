import type { LogService } from "@dian/logger";
import type { ConfigService } from "@dian/config";
import type { BotEvent } from "@dian/shared";
import { BotInstance } from "./bot-instance.js";

/**
 * BotManager — 多机器人生命周期管理
 *
 * - 读取 bot.yaml 初始化所有 BotInstance
 * - 提供统一的 start / stop / reloadConfig
 */
export class BotManager {
  private readonly bots = new Map<string, BotInstance>();
  private readonly log: ReturnType<LogService["child"]>;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LogService,
    private readonly onEvent: (event: BotEvent) => Promise<void>
  ) {
    this.log = logger.child({ component: "BotManager" });
  }

  async start(): Promise<void> {
    const bots = this.config.bots;
    const enabled = bots.filter((b) => b.enabled !== false);
    const skipped = bots.length - enabled.length;
    this.log.info(
      `Starting ${enabled.length} bot(s)${skipped > 0 ? ` (skipped ${skipped} disabled)` : ""}...`
    );

    let failed = 0;
    for (const entry of enabled) {
      const instance = new BotInstance(entry, this.logger, this.onEvent);
      // 始终注册实例：即使首次握手失败，底层 WsClient 也会进入 reconnecting
      // 状态自动重连，前端通过 /status 可观察到 connecting/reconnecting/connected。
      this.bots.set(entry.botId, instance);
      try {
        await instance.start();
      } catch (err) {
        failed++;
        this.log.warn(
          `Bot "${entry.botId}" initial connect failed; will keep retrying in background`,
          { err: err instanceof Error ? err.message : String(err) }
        );
      }
    }

    this.log.info(
      `Bots startup complete: ${this.bots.size} registered, ${failed} initial failure(s)`
    );
  }

  /** 全部已配置的 botId（含 disabled） */
  getConfiguredBotIds(): string[] {
    return this.config.bots.map((b) => b.botId);
  }

  /** 全部已配置 bot 的状态（含 disabled） */
  getBotStates(): {
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
  }[] {
    return this.config.bots.map((b) => {
      const enabled = b.enabled !== false;
      const inst = this.bots.get(b.botId);
      const status = !enabled
        ? ("disabled" as const)
        : (inst?.status ?? ("idle" as const));
      return {
        botId: b.botId,
        enabled,
        running: !!inst,
        status,
      };
    });
  }

  async stop(): Promise<void> {
    this.log.info("Stopping all bots...");
    await Promise.all([...this.bots.values()].map((b) => b.stop()));
    this.bots.clear();
    this.log.info("All bots stopped");
  }

  async reloadConfig(): Promise<void> {
    this.log.info("Reloading bot config...");
    await this.stop();
    await this.start();
  }

  getBot(botId: string): BotInstance | undefined {
    return this.bots.get(botId);
  }

  getBots(): BotInstance[] {
    return [...this.bots.values()];
  }
}

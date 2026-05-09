import type { OneBotAdapter } from "@dian/sdk";
import type { BotEvent } from "@dian/shared";
import type { LogService } from "@dian/logger";
import type { BotEntry } from "@dian/config";
import { OneBotAdapter as Adapter } from "@dian/sdk";

/**
 * 单个 Bot 实例，持有独立的 Adapter 和日志上下文
 */
export class BotInstance {
  readonly botId: string;
  private readonly adapter: OneBotAdapter;
  private readonly log: ReturnType<LogService["child"]>;

  constructor(
    entry: BotEntry,
    logger: LogService,
    private readonly onEvent: (event: BotEvent) => Promise<void>
  ) {
    this.botId = entry.botId;
    this.log = logger.child({ bot: entry.botId });

    this.adapter = new Adapter({
      botId: entry.botId,
      mode: entry.mode,
      ws: entry.ws,
      http: entry.http,
    });

    this.adapter.onEvent(async (event) => {
      try {
        await this.onEvent(event);
      } catch (err) {
        this.log.error("Event handler threw an error", { err });
      }
    });
  }

  async start(): Promise<void> {
    this.log.info("Starting bot...");
    await this.adapter.start();
    this.log.info("Bot started");
  }

  async stop(): Promise<void> {
    this.log.info("Stopping bot...");
    await this.adapter.stop();
    this.log.info("Bot stopped");
  }
}

import type { BotEvent } from "@dian/shared";
import type { OneBotWsConfig } from "./types.js";

export type OneBotEventHandler = (event: BotEvent) => Promise<void> | void;

export class OneBotWsClient {
  private eventHandler?: OneBotEventHandler;

  constructor(private readonly config: OneBotWsConfig) {}

  onEvent(handler: OneBotEventHandler): void {
    this.eventHandler = handler;
  }

  async connect(): Promise<void> {
    void this.config;
  }

  async close(): Promise<void> {
    this.eventHandler = undefined;
  }

  async emit(event: BotEvent): Promise<void> {
    await this.eventHandler?.(event);
  }
}

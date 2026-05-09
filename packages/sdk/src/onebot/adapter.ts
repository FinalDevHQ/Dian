import type { ActionResult, BotEvent } from "@dian/shared";
import { OneBotHttpClient } from "./http-client.js";
import { OneBotWsClient } from "./ws-client.js";
import type { OneBotActionRequest, OneBotAdapterConfig } from "./types.js";

export class OneBotAdapter {
  private readonly wsClient?: OneBotWsClient;
  private readonly httpClient?: OneBotHttpClient;
  private eventHandler?: (event: BotEvent) => Promise<void> | void;

  constructor(private readonly config: OneBotAdapterConfig) {
    if (config.ws) {
      this.wsClient = new OneBotWsClient(config.ws);
    }

    if (config.http) {
      this.httpClient = new OneBotHttpClient(config.http);
    }
  }

  onEvent(handler: (event: BotEvent) => Promise<void> | void): void {
    this.eventHandler = handler;
    this.wsClient?.onEvent(handler);
  }

  async start(): Promise<void> {
    await this.wsClient?.connect();
  }

  async stop(): Promise<void> {
    await this.wsClient?.close();
    this.eventHandler = undefined;
  }

  async sendAction<TData = unknown>(request: OneBotActionRequest): Promise<ActionResult<TData>> {
    if (!this.httpClient) {
      return {
        ok: false,
        status: "failed",
        message: `HTTP transport is not configured for bot ${this.config.botId}`,
      };
    }

    return this.httpClient.request<TData>(request);
  }
}

import type { ActionResult, BotEvent } from "@dian/shared";

export type OneBotTransportMode = "ws" | "http" | "hybrid";

export interface OneBotWsConfig {
  url: string;
  accessToken?: string;
  heartbeatIntervalMs?: number;
  reconnectIntervalMs?: number;
}

export interface OneBotHttpConfig {
  baseUrl: string;
  accessToken?: string;
  timeoutMs?: number;
}

export interface OneBotAdapterConfig {
  botId: string;
  mode: OneBotTransportMode;
  ws?: OneBotWsConfig;
  http?: OneBotHttpConfig;
}

export interface OneBotActionRequest<TParams extends Record<string, unknown> = Record<string, unknown>> {
  action: string;
  params?: TParams;
  echo?: string;
}

export type OneBotActionResponse<TData = unknown> = ActionResult<TData>;

export type OneBotEvent = BotEvent;

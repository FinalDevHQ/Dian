export type Platform = "onebot";

export type BotEventType =
  | "message"
  | "message_sent"
  | "notice"
  | "request"
  | "meta_event";

export interface BotEvent {
  eventId: string;
  botId: string;
  platform: Platform;
  type: BotEventType;
  timestamp: number;
  payload: Record<string, unknown>;
  raw: unknown;
}

export interface ActionResult<TData = unknown> {
  ok: boolean;
  status: "ok" | "failed" | "timeout";
  retcode?: number;
  message?: string;
  data?: TData;
}

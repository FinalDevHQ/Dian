import type { BotEvent } from "@myfinal/shared";

/**
 * 从 BotEvent 中提取纯文本消息。
 * 优先 payload.text，兼容 payload.message（字符串或消息段数组）。
 */
export function extractMessageText(event: BotEvent): string {
  const payload = event.payload as Record<string, unknown>;
  if (typeof payload.text === "string") return payload.text;
  if (typeof payload.message === "string") return payload.message;
  if (Array.isArray(payload.message)) {
    return (payload.message as Array<{ type: string; data: { text?: string } }>)
      .filter((seg) => seg.type === "text")
      .map((seg) => seg.data.text ?? "")
      .join("");
  }
  return "";
}

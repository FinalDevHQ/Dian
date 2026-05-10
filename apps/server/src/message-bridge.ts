import type { BotEvent } from "@dian/shared";
import type { MessageRepository } from "@dian/storage";

/**
 * 把 BotEvent 中的 message 类型事件持久化到 messages 表。
 * 设计原则与 log-bridge 一致：fire-and-forget，写入失败只打 stderr，不影响主流程。
 *
 * @returns 卸载函数（目前不需要，保留对称性）
 */
export function installMessagePersistence(
  repo: MessageRepository
): (event: BotEvent) => void {
  return (event: BotEvent) => {
    // 只持久化用户发送的消息（message 类型）
    if (event.type !== "message") return;

    repo
      .writeMessage({
        eventId:    event.eventId,
        botId:      event.botId,
        subtype:    event.subtype,               // 'group' / 'private' / ...
        groupId:    event.payload.groupId,
        userId:     event.payload.userId,
        senderName: event.payload.senderName,
        messageId:  event.payload.messageId,
        text:       event.payload.text,
        timestamp:  event.timestamp,
      })
      .catch((err) => {
        process.stderr.write(
          `[message-bridge] failed to persist message: ${(err as Error).message}\n`
        );
      });
  };
}

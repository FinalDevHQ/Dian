import type { BotEvent } from "@dian/shared";
import type { LogService } from "@dian/logger";
import type { MessageRepository } from "@dian/storage";
import { pluginManager } from "@dian/plugin-runtime";
import type { BotManager } from "../bot/bot-manager.js";

/**
 * EventDispatcher — 事件路由
 *
 * 负责将来自各 BotInstance 的事件分发给插件系统
 */
export class EventDispatcher {
  private readonly log: ReturnType<LogService["child"]>;
  /** 简单去重：记录最近处理过的 eventId */
  private readonly seen = new Set<string>();
  private readonly MAX_SEEN = 2000;
  private botManager?: BotManager;
  private messageRepo?: MessageRepository;

  constructor(logger: LogService) {
    this.log = logger.child({ component: "EventDispatcher" });
  }

  setBotManager(botManager: BotManager): void {
    this.botManager = botManager;
  }

  setMessageRepository(repo: MessageRepository): void {
    this.messageRepo = repo;
  }

  async dispatch(event: BotEvent): Promise<void> {
    // 去重
    if (this.seen.has(event.eventId)) {
      this.log.debug("Duplicate event, skipped", { eventId: event.eventId });
      return;
    }
    this.seen.add(event.eventId);
    if (this.seen.size > this.MAX_SEEN) {
      // 清掉最早加入的那批
      const iter = this.seen.values();
      for (let i = 0; i < 500; i++) this.seen.delete(iter.next().value!);
    }

    this.log.debug(
      "Dispatching event",
      { eventId: event.eventId, type: event.type, botId: event.botId }
    );

    const bot = this.botManager?.getBot(event.botId);

    // 构建 reply 回调：根据事件来源发送群消息或私聊消息
    const reply = async (text: string): Promise<void> => {
      if (!bot) {
        this.log.warn("reply called but bot not found", { botId: event.botId });
        return;
      }
      const { groupId, userId } = event.payload;
      const action = groupId ? "send_group_msg" : userId ? "send_private_msg" : null;
      if (!action) {
        this.log.warn("reply skipped: event has neither groupId nor userId", {
          eventId: event.eventId,
        });
        return;
      }
      const params = groupId
        ? { group_id: Number(groupId), message: text }
        : { user_id: Number(userId), message: text };

      const result = await bot.sendAction({ action, params });
      if (!result.ok) {
        // 发送失败必须显式记录，否则上层完全感知不到
        this.log.error("Failed to send reply", {
          botId: event.botId,
          action,
          params,
          status: result.status,
          retcode: result.retcode,
          message: result.message,
        });
      } else {
        this.log.debug("Reply sent", { botId: event.botId, action, params });
        // 存储机器人发送的消息，用于后续撤回
        if (this.messageRepo && result.data) {
          const replyMsgId = (result.data as { message_id?: number }).message_id;
          if (replyMsgId != null) {
            this.messageRepo.writeMessage({
              eventId: `${event.botId}:reply:${replyMsgId}`,
              botId: event.botId,
              subtype: groupId ? "group" : "private",
              groupId: groupId,
              userId: undefined, // 机器人发的，没有 userId
              senderName: undefined,
              messageId: String(replyMsgId),
              text: text,
              timestamp: Math.floor(Date.now() / 1000),
            }).catch((err) => {
              this.log.error("Failed to persist reply message", { err });
            });
          }
        }
      }
    };

    // 构建 sendAction 回调：让插件可以调用底层 API
    const sendAction = async (action: string, params?: Record<string, unknown>) => {
      if (!bot) {
        this.log.warn("sendAction called but bot not found", { botId: event.botId });
        return { ok: false, status: "failed" as const, message: "Bot not found" };
      }
      const result = await bot.sendAction({ action, params });
      
      // 存储机器人通过 sendAction 发送的消息
      if (result.ok && this.messageRepo && action === "send_group_msg" && result.data) {
        const replyMsgId = (result.data as { message_id?: number }).message_id;
        if (replyMsgId != null) {
          const groupId = params?.group_id;
          this.messageRepo.writeMessage({
            eventId: `${event.botId}:send:${replyMsgId}`,
            botId: event.botId,
            subtype: "group",
            groupId: groupId ? String(groupId) : undefined,
            userId: undefined,
            senderName: undefined,
            messageId: String(replyMsgId),
            text: typeof params?.message === "string" ? params.message : undefined,
            timestamp: Math.floor(Date.now() / 1000),
          }).catch((err) => {
            this.log.error("Failed to persist sendAction message", { err });
          });
        }
      }
      
      return result;
    };

    try {
      await pluginManager.dispatch(event, reply, sendAction);
    } catch (err) {
      this.log.error("Plugin dispatch error", { err, eventId: event.eventId });
    }
  }
}

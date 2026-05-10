import type { BotEvent } from "@dian/shared";
import type { LogService } from "@dian/logger";
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

  constructor(logger: LogService) {
    this.log = logger.child({ component: "EventDispatcher" });
  }

  setBotManager(botManager: BotManager): void {
    this.botManager = botManager;
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

    // 构建 reply 回调：根据事件来源发送群消息或私聊消息
    const bot = this.botManager?.getBot(event.botId);
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
      }
    };

    try {
      await pluginManager.dispatch(event, reply);
    } catch (err) {
      this.log.error("Plugin dispatch error", { err, eventId: event.eventId });
    }
  }
}

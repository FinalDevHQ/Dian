import type { BotEvent } from "@dian/shared";
import type { LogService } from "@dian/logger";
import { pluginManager } from "@dian/plugin-runtime";

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

  constructor(logger: LogService) {
    this.log = logger.child({ component: "EventDispatcher" });
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

    try {
      await pluginManager.dispatch(event);
    } catch (err) {
      this.log.error("Plugin dispatch error", { err, eventId: event.eventId });
    }
  }
}

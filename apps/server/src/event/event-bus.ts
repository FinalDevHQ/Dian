import type { BotEvent } from "@dian/shared";

/**
 * EventBus — 进程内事件广播
 *
 * 责任：
 * - 维护最近 N 条事件的环形历史（页面打开时可一次性拿到）
 * - 把新事件实时广播给所有订阅者（HTTP SSE 用）
 *
 * 注意：仅内存存储，进程重启即丢失。如需持久化，请走 storage 层。
 */
export class EventBus {
  private readonly subscribers = new Set<(event: BotEvent) => void>();
  private readonly history: BotEvent[] = [];
  private readonly maxHistory: number;

  constructor(maxHistory = 200) {
    this.maxHistory = maxHistory;
  }

  /** 发布事件：写入历史 + 广播给所有订阅者 */
  publish(event: BotEvent): void {
    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history.splice(0, this.history.length - this.maxHistory);
    }
    for (const fn of this.subscribers) {
      try {
        fn(event);
      } catch {
        // 订阅者异常不应影响其他订阅者
      }
    }
  }

  /** 订阅；返回取消订阅函数 */
  subscribe(fn: (event: BotEvent) => void): () => void {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  }

  /**
   * 拉取历史事件（最早 → 最新）
   * @param limit  最大返回条数，默认全部
   */
  getHistory(limit?: number): BotEvent[] {
    if (limit == null || limit >= this.history.length) {
      return [...this.history];
    }
    return this.history.slice(-limit);
  }

  /** 当前订阅者数量（仅用于调试） */
  get subscriberCount(): number {
    return this.subscribers.size;
  }
}

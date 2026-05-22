import type { AnyHandler } from "../types.js";

/**
 * HookBus — 广播 & 管道两种模型
 */
export class HookBus {
  private readonly _handlers = new Map<string, AnyHandler[]>();

  /** 注册一个 hook handler */
  register(hook: string, handler: AnyHandler): void {
    if (!this._handlers.has(hook)) {
      this._handlers.set(hook, []);
    }
    this._handlers.get(hook)!.push(handler);
  }

  /** 注销一个 hook handler */
  unregister(hook: string, handler: AnyHandler): void {
    const list = this._handlers.get(hook);
    if (!list) return;
    const idx = list.indexOf(handler);
    if (idx !== -1) list.splice(idx, 1);
  }

  /**
   * 广播模型：并发触发所有 handler，fire-and-forget。
   * 单个 handler 的异常不会中断其他 handler。
   */
  async emit(hook: string, ...args: unknown[]): Promise<void> {
    const list = this._handlers.get(hook) ?? [];
    await Promise.allSettled(list.map((h) => h(...args)));
  }

  /**
   * 管道模型：串行执行 handler 链，每个 handler 接收上一个的返回值。
   * 任意 handler 抛出异常则中断管道并向上传播。
   *
   * @param hook hook 名称
   * @param initial 初始值（将被依次传入每个 handler）
   * @returns 最终经过所有 handler 处理后的值
   */
  async pipeline<T>(hook: string, initial: T): Promise<T> {
    const list = this._handlers.get(hook) ?? [];
    let value = initial;
    for (const handler of list) {
      value = (await handler(value)) as T;
    }
    return value;
  }

  /** 清除某个 hook 的所有 handler */
  clear(hook: string): void {
    this._handlers.delete(hook);
  }

  /** 清除所有 hook */
  clearAll(): void {
    this._handlers.clear();
  }
}

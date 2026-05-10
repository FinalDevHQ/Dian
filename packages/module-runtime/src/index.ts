// ---------------------------------------------------------------------------
// Module 接口 — 所有模块必须实现
// ---------------------------------------------------------------------------

export interface Module {
  /** 模块唯一名称 */
  readonly name: string;
  /** 模块启动，在 ModuleManager.discoverAndStart() 中调用 */
  setup(): Promise<void>;
  /** 模块停止，在 ModuleManager.stopAll() 中调用 */
  teardown(): Promise<void>;
}

// ---------------------------------------------------------------------------
// HookBus — 广播 & 管道两种模型
// ---------------------------------------------------------------------------

type AnyHandler = (...args: unknown[]) => unknown | Promise<unknown>;

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

// ---------------------------------------------------------------------------
// ModuleManager
// ---------------------------------------------------------------------------

export class ModuleManager {
  /** 已注册的模块，按注册顺序存储（teardown 时逆序） */
  private readonly _modules: Module[] = [];

  /**
   * 手动注册一个模块（用于程序化注册，不通过目录扫描）。
   */
  register(mod: Module): void {
    if (this._modules.find((m) => m.name === mod.name)) {
      throw new Error(`[module-runtime] 模块 "${mod.name}" 已注册，不可重复注册`);
    }
    this._modules.push(mod);
  }

  /**
   * 从目录扫描并启动所有模块。
   *
   * 约定：目录下每个子目录或 .js 文件默认导出一个实现 Module 接口的对象。
   *
   * @param modulesDir 模块目录绝对路径
   */
  async discoverAndStart(modulesDir: string): Promise<void> {
    const { readdir } = await import("node:fs/promises");
    const { resolve, extname } = await import("node:path");

    let entries: string[];
    try {
      entries = await readdir(modulesDir);
    } catch {
      // 目录不存在时跳过，不报错
      return;
    }

    for (const entry of entries) {
      const fullPath = resolve(modulesDir, entry);
      const ext = extname(entry);

      // 只处理 .js 文件和无扩展名目录（目录化模块）
      if (ext !== ".js" && ext !== "") continue;

      let mod: unknown;
      try {
        const imported = await import(fullPath) as Record<string, unknown>;
        mod = imported.default;
      } catch (err) {
        console.error(`[module-runtime] 加载模块失败 "${entry}":`, err);
        continue;
      }

      if (!isModule(mod)) {
        console.warn(`[module-runtime] "${entry}" 未导出合法的 Module，已跳过`);
        continue;
      }

      try {
        this.register(mod);
        await mod.setup();
        console.info(`[module-runtime] 模块 "${mod.name}" 已启动`);
      } catch (err) {
        console.error(`[module-runtime] 模块 "${mod.name}" setup 失败:`, err);
      }
    }
  }

  /**
   * 按注册逆序调用所有模块的 teardown()。
   */
  async stopAll(): Promise<void> {
    const reversed = [...this._modules].reverse();
    for (const mod of reversed) {
      try {
        await mod.teardown();
        console.info(`[module-runtime] 模块 "${mod.name}" 已停止`);
      } catch (err) {
        console.error(`[module-runtime] 模块 "${mod.name}" teardown 失败:`, err);
      }
    }
  }

  /** 获取所有已注册模块列表（只读） */
  get modules(): readonly Module[] {
    return this._modules;
  }
}

// ---------------------------------------------------------------------------
// 类型守卫
// ---------------------------------------------------------------------------

function isModule(val: unknown): val is Module {
  return (
    typeof val === "object" &&
    val !== null &&
    typeof (val as Module).name === "string" &&
    typeof (val as Module).setup === "function" &&
    typeof (val as Module).teardown === "function"
  );
}

// ---------------------------------------------------------------------------
// 全局单例
// ---------------------------------------------------------------------------

export const hookBus = new HookBus();
export const moduleManager = new ModuleManager();

/**
 * Module 接口 — 所有模块必须实现
 */
export interface Module {
  /** 模块唯一名称 */
  readonly name: string;
  /** 模块启动，在 ModuleManager.discoverAndStart() 中调用 */
  setup(): Promise<void>;
  /** 模块停止，在 ModuleManager.stopAll() 中调用 */
  teardown(): Promise<void>;
}

export type AnyHandler = (...args: unknown[]) => unknown | Promise<unknown>;

export function isModule(val: unknown): val is Module {
  return (
    typeof val === "object" &&
    val !== null &&
    typeof (val as Module).name === "string" &&
    typeof (val as Module).setup === "function" &&
    typeof (val as Module).teardown === "function"
  );
}

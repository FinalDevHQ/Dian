import type { BotEvent } from "@dian/shared";

// ---------------------------------------------------------------------------
// 装饰器元数据 key
// ---------------------------------------------------------------------------

export const PLUGIN_META_KEY = Symbol("dian:plugin");
export const HANDLER_META_KEY = Symbol("dian:handlers");
export const INTERCEPTOR_META_KEY = Symbol("dian:interceptors");

// ---------------------------------------------------------------------------
// 插件元信息
// ---------------------------------------------------------------------------

export interface PluginMeta {
  name: string;
  description?: string;
  version?: string;
}

// ---------------------------------------------------------------------------
// Handler 注册信息
// ---------------------------------------------------------------------------

export interface HandlerMeta {
  /** 方法名 */
  method: string;
  /** 匹配模式：正则或精确字符串（对消息 message 字段做匹配） */
  pattern: RegExp | string;
}

// ---------------------------------------------------------------------------
// Interceptor 注册信息
// ---------------------------------------------------------------------------

export interface InterceptorMeta {
  /** 方法名 */
  method: string;
  /** 优先级，数字越小越先执行，默认 100 */
  priority: number;
}

// ---------------------------------------------------------------------------
// 插件实例类型（已加载、注册好 handler 的插件）
// ---------------------------------------------------------------------------

export interface PluginInstance {
  meta: PluginMeta;
  handlers: HandlerMeta[];
  interceptors: InterceptorMeta[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instance: any;
  /** 插件源文件路径，用于热重载 */
  filePath: string;
}

// ---------------------------------------------------------------------------
// 事件上下文（handler 接收的参数）
// ---------------------------------------------------------------------------

export interface EventContext {
  event: BotEvent;
  /** 调用此方法可阻止后续 handler 继续处理该事件 */
  stopPropagation(): void;
}

// ---------------------------------------------------------------------------
// @Plugin 装饰器
// ---------------------------------------------------------------------------

export function Plugin(meta: PluginMeta): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(PLUGIN_META_KEY, meta, target);
  };
}

// ---------------------------------------------------------------------------
// @Handler 装饰器
// ---------------------------------------------------------------------------

export function Handler(pattern: RegExp | string): MethodDecorator {
  return (target, propertyKey) => {
    const existing: HandlerMeta[] =
      (Reflect.getMetadata(HANDLER_META_KEY, target.constructor) as HandlerMeta[] | undefined) ?? [];
    existing.push({ method: String(propertyKey), pattern });
    Reflect.defineMetadata(HANDLER_META_KEY, existing, target.constructor);
  };
}

// ---------------------------------------------------------------------------
// @Interceptor 装饰器
// ---------------------------------------------------------------------------

export function Interceptor(priority = 100): MethodDecorator {
  return (target, propertyKey) => {
    const existing: InterceptorMeta[] =
      (Reflect.getMetadata(INTERCEPTOR_META_KEY, target.constructor) as InterceptorMeta[] | undefined) ?? [];
    existing.push({ method: String(propertyKey), priority });
    Reflect.defineMetadata(INTERCEPTOR_META_KEY, existing, target.constructor);
  };
}

import type { BotEvent, SendActionFn, ActionResult } from "@dian/shared";

// ---------------------------------------------------------------------------
// 路由 / 指令 / UI 声明（供 onSetup 使用）
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RouteHandler = (request: any, reply: any) => unknown | Promise<unknown>;

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RouteEntry {
  method: HttpMethod;
  /** 路径，相对于 /plugins/:name/api，如 '/status' */
  path: string;
  handler: RouteHandler;
}

/**
 * 匹配模式：
 * - string  : 与消息文本严格相等
 * - RegExp  : 正则测试
 * - function: 每次事件分发时调用，返回上面两种之一。
 *             用这种形式可以实现"配置改了立即生效"的动态指令，
 *             无需重启服务/重新注册。
 */
export type Pattern = RegExp | string | (() => RegExp | string);

export interface CommandEntry {
  /** 指令名称，如 /help */
  name: string;
  /** 匹配规则，同 @Handler pattern */
  pattern: Pattern;
  description?: string;
  handler: (ctx: EventContext) => void | Promise<void>;
  /** 分类名，用于菜单分组展示，如 "基础群管" */
  category?: string;
  /** 子命令列表，用于树状菜单展示 */
  children?: CommandEntry[];
}

export interface UIDeclaration {
  /**
   * 静态文件目录，相对于插件文件所在目录。
   * 服务地址: /plugins/:name/ui/*
   */
  staticDir?: string;
  /** 直接嵌入的外部 URL（iframe src），不与 staticDir 同时用 */
  externalUrl?: string;
  /** 首页入口，相对于 staticDir，默认 index.html */
  entry?: string;
}

/** 指令的公开信息（前端展示用，不含 handler 实现） */
export interface CommandPublicMeta {
  /** 指令名，例如 "/help" */
  name: string;
  /** 当前 pattern 的字符串表示（函数 pattern 会被实时求值） */
  pattern: string;
  description?: string;
  /** 分类名 */
  category?: string;
  /** 子命令（递归结构） */
  children?: CommandPublicMeta[];
}

/** 事件处理器（@Handler）的公开信息 */
export interface HandlerPublicMeta {
  /** 类方法名 */
  method: string;
  /** 当前 pattern 的字符串表示（函数 pattern 会被实时求值） */
  pattern: string;
}

/** 暴露给前端 API 的插件公开信息（不包含 handler 实现） */
export interface PluginPublicMeta {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  icon?: string;
  enabled: boolean;
  handlerCount: number;
  commandCount: number;
  /** 已注册的事件处理器（@Handler）详情 */
  handlers: HandlerPublicMeta[];
  /** 已注册的指令（ctx.command）详情 */
  commands: CommandPublicMeta[];
  /** 当前生效的 bot 白名单（空数组表示任何 bot 都不响应） */
  bots: string[];
  routes: { method: HttpMethod; path: string }[];
  hasUI: boolean;
  /** UI 访问地址（iframe src） */
  uiUrl: string | null;
}

/** 插件 onSetup 接收的上下文，用于注册路由/指令/UI */
export interface PluginSetupContext {
  /** 注册 HTTP API 路由，路径自动带 /plugins/:name/api 前缀 */
  route(method: HttpMethod, path: string, handler: RouteHandler): void;
  /** 注册指令（等同于命令式版本的 @Handler） */
  command(entry: CommandEntry): void;
  /** 声明插件 Web UI */
  ui(decl: UIDeclaration): void;
}

// ---------------------------------------------------------------------------
// 装饰器元数据 key
// ---------------------------------------------------------------------------

export const PLUGIN_META_KEY = Symbol.for("dian:plugin");
export const HANDLER_META_KEY = Symbol.for("dian:handlers");
export const INTERCEPTOR_META_KEY = Symbol.for("dian:interceptors");

// ---------------------------------------------------------------------------
// 插件元信息
// ---------------------------------------------------------------------------

export interface PluginMeta {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  /** emoji 或图标 URL */
  icon?: string;
}

// ---------------------------------------------------------------------------
// Handler 注册信息
// ---------------------------------------------------------------------------

export interface HandlerMeta {
  /** 方法名 */
  method: string;
  /** 匹配模式：正则、精确字符串，或返回它们的函数（动态/可热更新） */
  pattern: Pattern;
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
  /** 通过 onSetup ctx.route() 注册的 HTTP 路由 */
  routes: RouteEntry[];
  /** 通过 onSetup ctx.command() 注册的指令 */
  commands: CommandEntry[];
  /** 通过 onSetup ctx.ui() 或 @Plugin meta.ui 声明的 UI */
  ui: UIDeclaration | null;
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
  /** 向事件来源（群/私聊）发送文本回复 */
  reply(text: string): Promise<void>;
  /**
   * 发送 action 请求到底层 API（OneBot/飞书等）
   * @param action  action 名称，如 "send_group_msg"、"set_group_ban"
   * @param params  action 参数
   * @returns       ActionResult
   */
  sendAction(action: string, params?: Record<string, unknown>): Promise<ActionResult>;
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

export function Handler(pattern: Pattern): MethodDecorator {
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

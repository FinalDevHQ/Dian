/**
 * 平台标识，目前只支持 OneBot（QQ）
 */
export type Platform = "onebot";

// ---------------------------------------------------------------------------
// 统一事件类型（领域层使用，与协议无关）
// ---------------------------------------------------------------------------

/**
 * 事件大类，对应 OneBot post_type
 */
export type BotEventType =
  | "message"       // 收到消息
  | "message_sent"  // 机器人自己发出的消息
  | "notice"        // 通知（进群、退群、撤回等）
  | "request"       // 请求（加好友、加群）
  | "meta_event";   // 元事件（心跳、生命周期）

/**
 * 统一事件对象
 * 所有上层模块（插件、模块）只与此类型交互，不接触协议原始字段
 */
export interface BotEvent {
  /** 幂等 ID，格式：{botId}:{message_id 或 time+random} */
  eventId: string;
  /** 机器人标识，对应配置中的 botId */
  botId: string;
  /** 来源平台 */
  platform: Platform;
  /** 事件大类 */
  type: BotEventType;
  /** 事件子类型，如 message.group / notice.group_increase */
  subtype: string;
  /** 事件时间戳（秒级，与 OneBot 保持一致） */
  timestamp: number;
  /** 结构化 payload，包含核心字段（消息内容、发送者等） */
  payload: EventPayload;
  /** 原始协议数据，调试或高级用途时使用 */
  raw: unknown;
}

/**
 * 统一 payload，把常用字段从 OneBot 原始结构中抽出
 */
export interface EventPayload {
  /** 消息文本（message 事件可用） */
  text?: string;
  /** 用户 ID */
  userId?: string;
  /** 群组 ID（群消息可用） */
  groupId?: string;
  /** 频道 ID（频道消息可用） */
  channelId?: string;
  /** 消息 ID（message 事件可用，用于撤回/引用） */
  messageId?: string;
  /** 发送者昵称 */
  senderName?: string;
  /** 其余字段保留 */
  [key: string]: unknown;
}

/**
 * Action 调用结果（HTTP 发送动作的返回）
 */
export interface ActionResult<TData = unknown> {
  /** 是否成功 */
  ok: boolean;
  /** 状态：ok = 成功，failed = 业务失败，timeout = 超时 */
  status: "ok" | "failed" | "timeout";
  /** OneBot 返回码（非 0 时代表失败） */
  retcode?: number;
  /** 错误描述 */
  message?: string;
  /** 成功时的返回数据 */
  data?: TData;
}

/**
 * 通用 action 发送函数类型
 * 插件通过此函数调用底层 API（OneBot/飞书等），无需关心具体实现
 */
export type SendActionFn = (action: string, params?: Record<string, unknown>) => Promise<ActionResult>;

// ---------------------------------------------------------------------------
// OneBot v11 原始事件类型（仅 sdk 内部使用，外部不应直接依赖）
// ---------------------------------------------------------------------------

/**
 * OneBot v11 原始事件结构（上报 JSON 的顶层字段）
 */
export interface OneBotRawEvent {
  time: number;
  self_id: number;
  post_type: "message" | "message_sent" | "notice" | "request" | "meta_event";
  message_type?: "private" | "group";
  notice_type?: string;
  request_type?: string;
  meta_event_type?: string;
  sub_type?: string;
  message_id?: number;
  user_id?: number;
  group_id?: number;
  message?: string | OneBotMessageSegment[];
  raw_message?: string;
  sender?: {
    user_id?: number;
    nickname?: string;
    card?: string;
    role?: "owner" | "admin" | "member";
  };
  [key: string]: unknown;
}

/**
 * OneBot 消息段（CQ 码的结构化表示）
 */
export interface OneBotMessageSegment {
  type: string;
  data: Record<string, string>;
}

// ---------------------------------------------------------------------------
// 事件映射工具函数
// ---------------------------------------------------------------------------

/**
 * 从 OneBot 原始事件提取纯文本消息
 * - 字符串格式：直接返回
 * - 消息段数组：提取所有 type=text 的段拼接
 */
function extractText(message: OneBotRawEvent["message"]): string {
  if (!message) return "";
  if (typeof message === "string") return message;
  return message
    .filter((seg) => seg.type === "text")
    .map((seg) => seg.data["text"] ?? "")
    .join("");
}

/**
 * 生成幂等 eventId
 * - 有 message_id 时用 {botId}:{message_id}
 * - 否则用 {botId}:{time}:{random}
 */
function buildEventId(botId: string, raw: OneBotRawEvent): string {
  if (raw.message_id != null) {
    return `${botId}:${raw.message_id}`;
  }
  return `${botId}:${raw.time}:${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 将 OneBot 原始事件映射为统一 BotEvent
 * @param botId  配置中的 botId（区分多机器人）
 * @param raw    从 WS 上报解析出的原始对象
 */
export function mapOneBotEvent(botId: string, raw: OneBotRawEvent): BotEvent {
  // 计算子类型，形如 message.group / notice.group_increase
  const subParts: string[] = [];
  if (raw.message_type) subParts.push(raw.message_type);
  if (raw.notice_type) subParts.push(raw.notice_type);
  if (raw.request_type) subParts.push(raw.request_type);
  if (raw.meta_event_type) subParts.push(raw.meta_event_type);
  if (raw.sub_type) subParts.push(raw.sub_type);
  const subtype = subParts.join(".");

  const payload: EventPayload = {
    text: extractText(raw.message),
    userId: raw.user_id != null ? String(raw.user_id) : undefined,
    groupId: raw.group_id != null ? String(raw.group_id) : undefined,
    messageId: raw.message_id != null ? String(raw.message_id) : undefined,
    senderName: raw.sender?.card || raw.sender?.nickname,
  };

  return {
    eventId: buildEventId(botId, raw),
    botId,
    platform: "onebot",
    type: raw.post_type as BotEventType,
    subtype,
    timestamp: raw.time,
    payload,
    raw,
  };
}

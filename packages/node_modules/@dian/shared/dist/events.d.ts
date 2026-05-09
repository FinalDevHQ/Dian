/**
 * 平台标识，目前只支持 OneBot（QQ）
 */
export type Platform = "onebot";
/**
 * 事件大类，对应 OneBot post_type
 */
export type BotEventType = "message" | "message_sent" | "notice" | "request" | "meta_event";
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
/**
 * 将 OneBot 原始事件映射为统一 BotEvent
 * @param botId  配置中的 botId（区分多机器人）
 * @param raw    从 WS 上报解析出的原始对象
 */
export declare function mapOneBotEvent(botId: string, raw: OneBotRawEvent): BotEvent;
//# sourceMappingURL=events.d.ts.map
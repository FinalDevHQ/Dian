// ---------------------------------------------------------------------------
// 事件映射工具函数
// ---------------------------------------------------------------------------
/**
 * 从 OneBot 原始事件提取纯文本消息
 * - 字符串格式：直接返回
 * - 消息段数组：提取所有 type=text 的段拼接
 */
function extractText(message) {
    if (!message)
        return "";
    if (typeof message === "string")
        return message;
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
function buildEventId(botId, raw) {
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
export function mapOneBotEvent(botId, raw) {
    // 计算子类型，形如 message.group / notice.group_increase
    const subParts = [];
    if (raw.message_type)
        subParts.push(raw.message_type);
    if (raw.notice_type)
        subParts.push(raw.notice_type);
    if (raw.request_type)
        subParts.push(raw.request_type);
    if (raw.meta_event_type)
        subParts.push(raw.meta_event_type);
    if (raw.sub_type)
        subParts.push(raw.sub_type);
    const subtype = subParts.join(".");
    const payload = {
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
        type: raw.post_type,
        subtype,
        timestamp: raw.time,
        payload,
        raw,
    };
}
//# sourceMappingURL=events.js.map
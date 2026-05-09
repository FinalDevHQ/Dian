import type { ActionResult, BotEvent } from "@dian/shared";
import type { OneBotActionRequest, OneBotAdapterConfig } from "./types.js";
/**
 * OneBotAdapter —— 统一门面（Facade）
 *
 * 策略：
 * - 事件接入（ingress）：WebSocket（实时、低延迟）
 * - 动作发出（egress）：HTTP（可重试、超时可控）
 *
 * 上层（BotManager / MessageService）只与此类交互，
 * 不感知底层是 WS 还是 HTTP，也不接触 OneBot 原始字段。
 *
 * 使用示例：
 * ```ts
 * const adapter = new OneBotAdapter({
 *   botId: "bot1",
 *   mode: "hybrid",
 *   ws:   { url: "ws://127.0.0.1:6700", accessToken: "xxx" },
 *   http: { baseUrl: "http://127.0.0.1:5700", accessToken: "xxx" },
 * });
 *
 * adapter.onEvent(async (event) => {
 *   console.log("Received:", event.type, event.payload.text);
 * });
 *
 * await adapter.start();
 *
 * const result = await adapter.sendAction({
 *   action: "send_group_msg",
 *   params: { group_id: 123456, message: "hello" },
 * });
 * ```
 */
export declare class OneBotAdapter {
    private readonly config;
    private readonly wsClient?;
    private readonly httpClient?;
    /** 事件处理回调（由上层注册） */
    private eventHandler?;
    /**
     * @param config  适配器配置，需至少包含 ws 或 http 之一
     */
    constructor(config: OneBotAdapterConfig);
    /**
     * 注册事件回调
     * 来自 WS 的所有 BotEvent 都会投递到此回调
     * 必须在 start() 之前调用
     */
    onEvent(handler: (event: BotEvent) => Promise<void> | void): void;
    /**
     * 启动适配器
     * - 建立 WS 连接（如果配置了 ws）
     * - HTTP 客户端无状态，无需初始化
     */
    start(): Promise<void>;
    /**
     * 停止适配器
     * - 主动关闭 WS 连接（不再自动重连）
     * - 清除事件回调
     */
    stop(): Promise<void>;
    /**
     * 发送 OneBot action（走 HTTP）
     *
     * @param request  action 名称与参数
     * @returns        统一 ActionResult
     *
     * 常用 action 示例：
     * - send_private_msg  { user_id, message }
     * - send_group_msg    { group_id, message }
     * - delete_msg        { message_id }
     * - get_group_info    { group_id }
     */
    sendAction<TData = unknown>(request: OneBotActionRequest): Promise<ActionResult<TData>>;
    /**
     * 当前 WS 连接状态
     * undefined 表示未配置 WS
     */
    get wsState(): import("./ws-client.js").WsState | undefined;
    /**
     * 配置合法性检查
     * - hybrid 模式：ws + http 都必须配置
     * - ws 模式：必须有 ws
     * - http 模式：必须有 http（仅发送，无法接收事件）
     */
    private _validateConfig;
}
//# sourceMappingURL=adapter.d.ts.map
import type { BotEvent } from "@dian/shared";
import type { OneBotWsConfig } from "./types.js";
/** WS 客户端的连接状态 */
export type WsState = "idle" | "connecting" | "connected" | "reconnecting" | "closed";
/** 事件回调类型 */
export type OneBotEventHandler = (event: BotEvent) => Promise<void> | void;
/**
 * OneBot v11 正向 WebSocket 客户端
 *
 * 职责：
 * - 建立并维持到 OneBot 实现（如 go-cqhttp）的 WS 长连接
 * - 维持心跳（若服务端不主动发心跳包则客户端定时 ping）
 * - 连接断开后按配置间隔自动重连
 * - 将上报的原始 JSON 解析并映射为统一 BotEvent 投递给上层
 *
 * 使用示例：
 * ```ts
 * const client = new OneBotWsClient("bot1", { url: "ws://127.0.0.1:6700" });
 * client.onEvent(async (event) => { ... });
 * await client.connect();
 * ```
 */
export declare class OneBotWsClient {
    private readonly botId;
    private readonly config;
    private ws;
    private state;
    private heartbeatTimer;
    private reconnectTimer;
    /** 是否主动关闭（主动关闭时不再重连） */
    private manualClose;
    private handler?;
    /**
     * @param botId   机器人标识，用于生成 eventId 和日志上下文
     * @param config  WS 连接配置
     */
    constructor(botId: string, config: OneBotWsConfig);
    /**
     * 注册事件回调
     * 每次收到来自 OneBot 的上报事件（message/notice/request/meta）都会调用此回调
     */
    onEvent(handler: OneBotEventHandler): void;
    /** 当前连接状态 */
    get connectionState(): WsState;
    /**
     * 建立 WebSocket 连接
     * 若已连接则直接返回
     */
    connect(): Promise<void>;
    /**
     * 主动关闭连接，不再重连
     */
    close(): Promise<void>;
    /**
     * 核心连接逻辑
     * 每次（包括重连）都通过此方法创建新的 WebSocket 实例
     */
    private _doConnect;
    /**
     * 解析并分发收到的 WS 消息
     * 非 JSON 或格式不符预期时静默丢弃（避免因脏数据崩溃）
     */
    private _handleMessage;
    /**
     * 启动客户端心跳
     * OneBot 服务端会主动发心跳 meta_event；
     * 这里额外用 WS ping 帧维持 TCP 连接，防止中间网络设备切断空闲连接
     */
    private _startHeartbeat;
    private _stopHeartbeat;
    /**
     * 调度重连
     * 采用固定间隔（非指数退避），简单可预期
     */
    private _scheduleReconnect;
    private _clearTimers;
}
//# sourceMappingURL=ws-client.d.ts.map
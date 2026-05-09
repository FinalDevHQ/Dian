import type { ActionResult } from "@dian/shared";
import type { OneBotActionRequest, OneBotHttpConfig } from "./types.js";
/**
 * OneBot v11 HTTP API 客户端
 *
 * 职责：
 * - 向 OneBot 实现（如 go-cqhttp）的 HTTP API 端点发送 action 请求
 * - 统一处理超时、网络错误、业务错误码
 * - 对网络/超时错误自动重试（业务错误不重试）
 *
 * OneBot HTTP API 约定：
 * - POST /{action}  Body: JSON { ...params }
 * - 响应: { status: "ok"|"failed", retcode: number, data: ... }
 *
 * 使用示例：
 * ```ts
 * const client = new OneBotHttpClient({
 *   baseUrl: "http://127.0.0.1:5700",
 *   accessToken: "your_token",
 *   timeoutMs: 5000,
 * });
 * const result = await client.request({
 *   action: "send_group_msg",
 *   params: { group_id: 123456, message: "hello" },
 * });
 * ```
 */
export declare class OneBotHttpClient {
    private readonly config;
    /** 最大重试次数（仅针对网络/超时错误） */
    private static readonly MAX_RETRIES;
    constructor(config: OneBotHttpConfig);
    /**
     * 发送 OneBot action 请求
     * @param body  action 名称与参数
     * @returns     统一 ActionResult
     */
    request<TData = unknown>(body: OneBotActionRequest): Promise<ActionResult<TData>>;
    /**
     * 执行单次 HTTP 请求
     * 使用 Node 内置 fetch（Node 18+），无需额外依赖
     */
    private _doRequest;
}
//# sourceMappingURL=http-client.d.ts.map
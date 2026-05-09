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
export class OneBotHttpClient {
    config;
    /** 最大重试次数（仅针对网络/超时错误） */
    static MAX_RETRIES = 2;
    constructor(config) {
        this.config = config;
    }
    // ---------------------------------------------------------------------------
    // 公共 API
    // ---------------------------------------------------------------------------
    /**
     * 发送 OneBot action 请求
     * @param body  action 名称与参数
     * @returns     统一 ActionResult
     */
    async request(body) {
        let lastError;
        for (let attempt = 0; attempt <= OneBotHttpClient.MAX_RETRIES; attempt++) {
            try {
                return await this._doRequest(body);
            }
            catch (err) {
                lastError = err;
                // 业务错误（OneBotApiError）不重试
                if (err instanceof OneBotApiError) {
                    return {
                        ok: false,
                        status: "failed",
                        retcode: err.retcode,
                        message: err.message,
                    };
                }
                // 超时错误：标记为 timeout
                if (err instanceof OneBotTimeoutError) {
                    if (attempt === OneBotHttpClient.MAX_RETRIES) {
                        return { ok: false, status: "timeout", message: err.message };
                    }
                    // 重试前稍作等待
                    await sleep(300 * (attempt + 1));
                    continue;
                }
                // 其余网络错误：重试
                if (attempt === OneBotHttpClient.MAX_RETRIES)
                    break;
                await sleep(300 * (attempt + 1));
            }
        }
        // 所有重试耗尽
        const msg = lastError instanceof Error ? lastError.message : String(lastError);
        return { ok: false, status: "failed", message: `Network error: ${msg}` };
    }
    // ---------------------------------------------------------------------------
    // 内部实现
    // ---------------------------------------------------------------------------
    /**
     * 执行单次 HTTP 请求
     * 使用 Node 内置 fetch（Node 18+），无需额外依赖
     */
    async _doRequest(body) {
        const { baseUrl, accessToken, timeoutMs = 5_000 } = this.config;
        const url = `${baseUrl}/${body.action}`;
        const headers = {
            "Content-Type": "application/json",
        };
        if (accessToken) {
            // OneBot 鉴权：Authorization 头部携带 Bearer token
            headers["Authorization"] = `Bearer ${accessToken}`;
        }
        // AbortController 用于超时控制
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        let response;
        try {
            response = await fetch(url, {
                method: "POST",
                headers,
                body: JSON.stringify(body.params ?? {}),
                signal: controller.signal,
            });
        }
        catch (err) {
            if (err.name === "AbortError") {
                throw new OneBotTimeoutError(`Request to ${url} timed out after ${timeoutMs}ms`);
            }
            throw err;
        }
        finally {
            clearTimeout(timer);
        }
        // HTTP 层错误（4xx/5xx）视为网络问题，上层会重试
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
        }
        let json;
        try {
            json = (await response.json());
        }
        catch {
            throw new Error(`Invalid JSON response from ${url}`);
        }
        // OneBot 业务层错误（retcode !== 0）
        if (json.status === "failed" || json.retcode !== 0) {
            throw new OneBotApiError(json.msg ?? `API failed with retcode ${json.retcode}`, json.retcode);
        }
        return {
            ok: true,
            status: "ok",
            retcode: json.retcode,
            data: json.data,
        };
    }
}
/**
 * OneBot 业务层错误（retcode !== 0）
 * 这类错误不应重试（如消息撤回超时、权限不足等）
 */
class OneBotApiError extends Error {
    retcode;
    constructor(message, retcode) {
        super(message);
        this.retcode = retcode;
        this.name = "OneBotApiError";
    }
}
/**
 * 请求超时错误
 */
class OneBotTimeoutError extends Error {
    constructor(message) {
        super(message);
        this.name = "OneBotTimeoutError";
    }
}
/** 简单延迟工具 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=http-client.js.map
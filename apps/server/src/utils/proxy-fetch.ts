/**
 * proxyFetch — 支持 HTTP/HTTPS 代理的 fetch 工具
 *
 * 代理地址优先级（高 → 低）:
 *   1. 环境变量  HTTPS_PROXY / HTTP_PROXY
 *   2. settings.yaml 中的 httpsProxy 字段（可在 WebUI 配置文件编辑器中实时修改）
 *
 * settings.yaml 示例:
 *   httpsProxy: "http://192.168.1.1:7890"
 *   # 或使用公共 GitHub 代理:
 *   httpsProxy: "https://ghproxy.net"
 */

import { fetch, ProxyAgent, type RequestInit } from "undici";
import { configService } from "@myfinal/config";

const ENV_PROXY =
  process.env.HTTPS_PROXY ??
  process.env.https_proxy ??
  process.env.HTTP_PROXY ??
  process.env.http_proxy;

/**
 * 替代原生 fetch，自动走代理（未配置则直连）。
 * 每次调用时重新读取 settings.yaml 中的代理地址，修改后无需重启容器即可生效。
 */
export async function proxyFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  // 环境变量优先，其次读 settings.yaml（支持 WebUI 热修改）
  const proxyUrl = ENV_PROXY ?? configService.settings.httpsProxy;

  if (proxyUrl) {
    const agent = new ProxyAgent(proxyUrl);
    return fetch(url, { ...init, dispatcher: agent }) as unknown as Response;
  }
  return globalThis.fetch(url, init as globalThis.RequestInit);
}

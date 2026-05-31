/**
 * proxyFetch — 支持 HTTP/HTTPS 代理的 fetch 工具
 *
 * Node.js 原生 fetch 不读取 HTTPS_PROXY / HTTP_PROXY 环境变量。
 * 本模块通过 undici（Node 22 内置）的 ProxyAgent 实现代理支持。
 *
 * 用法：在 docker-compose.yml 或系统环境中设置：
 *   HTTPS_PROXY=http://your-proxy:7890
 *   NO_PROXY=localhost,127.0.0.1
 */

import { fetch, ProxyAgent, type RequestInit } from "undici";

const proxyUrl =
  process.env.HTTPS_PROXY ??
  process.env.https_proxy ??
  process.env.HTTP_PROXY ??
  process.env.http_proxy;

const agent = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

/**
 * 替代原生 fetch，自动走 HTTPS_PROXY 代理（未配置则直连）。
 */
export async function proxyFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  if (agent) {
    // undici fetch 返回的 Response 与 Web API 兼容
    return fetch(url, { ...init, dispatcher: agent }) as unknown as Response;
  }
  return globalThis.fetch(url, init as globalThis.RequestInit);
}

/**
 * 后端 API 客户端
 *
 * 开发环境通过 Vite proxy 把 /api/* 转发到 http://localhost:3000/*
 * 生产环境可以通过 VITE_API_BASE_URL 覆盖 baseURL
 */
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "")

export interface HealthResponse {
  status: "ok"
  ts: number
}

export interface BotInfo {
  botId: string
}

export interface StatusResponse {
  bots: BotInfo[]
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`)
  }
  return (await res.json()) as T
}

export interface ConfigFileMeta {
  name: string
  size: number
  modifiedMs: number
}

export interface ConfigFileContent extends ConfigFileMeta {
  content: string
}

export const api = {
  health: () => request<HealthResponse>("/health"),
  status: () => request<StatusResponse>("/status"),

  listConfigFiles: () =>
    request<{ files: ConfigFileMeta[] }>("/config/files"),
  getConfigFile: (name: string) =>
    request<ConfigFileContent>(`/config/files/${encodeURIComponent(name)}`),
  saveConfigFile: (name: string, content: string) =>
    request<ConfigFileMeta>(`/config/files/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),
}

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

// ─── Bot 事件 ───────────────────────────────────────────────────────────────

export type BotEventType =
  | "message"
  | "message_sent"
  | "notice"
  | "request"
  | "meta_event"

export interface BotEventPayload {
  text?: string
  userId?: string
  groupId?: string
  channelId?: string
  messageId?: string
  senderName?: string
  [key: string]: unknown
}

export interface BotEvent {
  eventId: string
  botId: string
  platform: string
  type: BotEventType
  subtype: string
  timestamp: number
  payload: BotEventPayload
  raw: unknown
}

export interface RecentEventsQuery {
  limit?: number
  botId?: string
  type?: BotEventType
}

export interface ConfigFileMeta {
  name: string
  size: number
  modifiedMs: number
}

export interface ConfigFileContent extends ConfigFileMeta {
  content: string
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") usp.set(k, String(v))
  }
  const s = usp.toString()
  return s ? `?${s}` : ""
}

/** 事件流 SSE 地址（含 query），主动用 EventSource 连接 */
export function eventStreamUrl(filter: { botId?: string; type?: BotEventType }): string {
  return `${BASE_URL}/events/stream${buildQuery(filter)}`
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

  recentEvents: (q: RecentEventsQuery = {}) =>
    request<{ events: BotEvent[] }>(
      `/events/recent${buildQuery({ limit: q.limit, botId: q.botId, type: q.type })}`
    ),
}

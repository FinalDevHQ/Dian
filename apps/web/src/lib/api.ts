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
    let detail = ""
    try {
      const body = await res.json()
      if (body && typeof body.error === "string") detail = `: ${body.error}`
    } catch {
      /* body 不是 json，忽略 */
    }
    throw new Error(`HTTP ${res.status} ${res.statusText}${detail}`)
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

// ─── 数据库浏览器 ────────────────────────────────────────────────────────────

export interface DataSourceMeta {
  name: string
  kind: "sqlite"
  location: string
  ready: boolean
}

export interface TableInfo {
  name: string
  rowCount: number
}

export interface ColumnInfo {
  name: string
  type: string
  notNull: boolean
  pk: boolean
  defaultValue: unknown
}

export interface QueryResult {
  columns: { name: string }[]
  rows: unknown[][]
  rowCount: number
  truncated: boolean
  rowsAffected?: number
  lastInsertRowid?: number | string
  durationMs: number
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

  listDbSources: () => request<{ sources: DataSourceMeta[] }>("/db/sources"),
  listDbTables: (source: string) =>
    request<{ tables: TableInfo[] }>(
      `/db/sources/${encodeURIComponent(source)}/tables`
    ),
  getDbSchema: (source: string, table: string) =>
    request<{ columns: ColumnInfo[] }>(
      `/db/sources/${encodeURIComponent(source)}/tables/${encodeURIComponent(table)}/schema`
    ),
  runDbQuery: (
    source: string,
    sql: string,
    opts: { readOnly?: boolean; params?: unknown[] } = {}
  ) =>
    request<QueryResult>(
      `/db/sources/${encodeURIComponent(source)}/query`,
      {
        method: "POST",
        body: JSON.stringify({
          sql,
          readOnly: opts.readOnly ?? true,
          params: opts.params ?? [],
        }),
      }
    ),
}

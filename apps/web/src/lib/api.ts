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

/**
 * Bot 连接状态
 * - disabled     ：在配置中被禁用
 * - idle         ：实例未启动
 * - connecting   ：首次握手进行中
 * - connected    ：WS 已连接（在线）
 * - reconnecting ：连接已断开，等待重连
 * - closed       ：连接已关闭（主动停止或不再重连）
 * - no-ws        ：仅配置 HTTP，没有 WS 通道
 */
export type BotStatus =
  | "disabled"
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "closed"
  | "no-ws"

export interface BotInfo {
  botId: string
  /** 是否启用此 bot 的连接（false 时不会创建 adapter） */
  enabled: boolean
  /** 适配器实例是否已创建并注册 */
  running: boolean
  /** 实时连接状态 */
  status: BotStatus
}

export interface StatusResponse {
  bots: BotInfo[]
}

// ─── Bot 管理（添加 / 删除 / 启停） ────────────────────────────────────────

export type BotMode = "ws" | "http" | "hybrid"

export interface BotWsConfigInput {
  url: string
  accessToken?: string
  heartbeatIntervalMs?: number
  reconnectIntervalMs?: number
}

export interface BotHttpConfigInput {
  baseUrl: string
  accessToken?: string
  timeoutMs?: number
}

export interface BotEntryInput {
  botId: string
  enabled?: boolean
  mode: BotMode
  ws?: BotWsConfigInput
  http?: BotHttpConfigInput
}

// ─── 系统信息（仪表盘用） ─────────────────────────────────────────────────────

export interface SystemInfo {
  ts: number
  os: {
    platform: string
    type: string
    release: string
    arch: string
    hostname: string
    uptimeSec: number
  }
  node: {
    version: string
    pid: number
    uptimeSec: number
    cwd: string
  }
  cpu: {
    model: string
    cores: number
    speedMHz: number
    /** 0..100 */
    usagePercent: number
    loadAvg: [number, number, number]
  }
  memory: {
    totalBytes: number
    freeBytes: number
    usedBytes: number
    /** 0..100 */
    usagePercent: number
    process: {
      rssBytes: number
      heapUsedBytes: number
      heapTotalBytes: number
      externalBytes: number
    }
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      // 只在有 body 时加 Content-Type，避免 Fastify 对无 body 的 DELETE 报 400
      ...(init?.body != null ? { "Content-Type": "application/json" } : {}),
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

// ─── 插件管理 ────────────────────────────────────────────────────────────────

export interface PluginCommandMeta {
  name: string
  pattern: string
  description?: string
}

export interface PluginHandlerMeta {
  method: string
  pattern: string
}

export interface PluginPublicMeta {
  name: string
  description?: string
  version?: string
  author?: string
  icon?: string
  enabled: boolean
  handlerCount: number
  commandCount: number
  handlers: PluginHandlerMeta[]
  commands: PluginCommandMeta[]
  /** 当前生效的 bot 白名单（空数组表示任何 bot 都不响应） */
  bots: string[]
  routes: { method: string; path: string }[]
  hasUI: boolean
  uiUrl: string | null
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
  system: () => request<SystemInfo>("/system"),

  // Bot 管理
  addBot: (entry: BotEntryInput) =>
    request<{ ok: boolean; bot: BotEntryInput }>("/bots", {
      method: "POST",
      body: JSON.stringify(entry),
    }),
  deleteBot: (botId: string) =>
    request<{ ok: boolean }>(`/bots/${encodeURIComponent(botId)}`, {
      method: "DELETE",
    }),
  setBotEnabled: (botId: string, enabled: boolean) =>
    request<{ ok: boolean }>(
      `/bots/${encodeURIComponent(botId)}/enabled`,
      { method: "PUT", body: JSON.stringify({ enabled }) }
    ),

  listConfigFiles: () =>
    request<{ files: ConfigFileMeta[] }>("/config/files"),
  getConfigFile: (name: string) =>
    request<ConfigFileContent>(`/config/files/${encodeURIComponent(name)}`),
  saveConfigFile: (name: string, content: string) =>
    request<ConfigFileMeta>(`/config/files/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),
  formatYaml: (content: string) =>
    request<{ content: string }>("/config/format", {
      method: "POST",
      body: JSON.stringify({ content }),
    }),

  recentEvents: (q: RecentEventsQuery = {}) =>
    request<{ events: BotEvent[] }>(
      `/events/recent${buildQuery({ limit: q.limit, botId: q.botId, type: q.type })}`
    ),

  listPlugins: () => request<{ plugins: PluginPublicMeta[] }>("/plugins"),
  setPluginEnabled: (name: string, enabled: boolean) =>
    request<{ ok: boolean }>(`/plugins/${encodeURIComponent(name)}/enabled`, {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    }),
  setPluginBots: (name: string, bots: string[]) =>
    request<{ ok: boolean; bots: string[]; rejected: string[] }>(
      `/plugins/${encodeURIComponent(name)}/bots`,
      { method: "PUT", body: JSON.stringify({ bots }) }
    ),
  deletePlugin: (name: string) =>
    request<{ ok: boolean }>(`/plugins/${encodeURIComponent(name)}`, { method: "DELETE" }),

  uploadPlugin: (name: string, file: File) => {
    const safeName = name.replace(/\.zip$/i, "")
    return fetch(`${BASE_URL}/plugins/upload?name=${encodeURIComponent(safeName)}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: file,
    }).then(async (res) => {
      const data = await res.json() as { ok?: boolean; error?: string; name?: string }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      return data
    })
  },

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

// ─── 统计接口 ─────────────────────────────────────────────────────────────────

export interface StatsFilter {
  botId?: string
  groupId?: string
  /** Unix 秒 */
  from?: number
  /** Unix 秒 */
  to?: number
}

export interface OverviewStats {
  total: number
  groups: number
  users: number
  byBot: { botId: string; count: number }[]
}

export interface GroupStat {
  groupId: string
  count: number
  lastAt: number
}

export interface UserStat {
  userId: string
  senderName?: string
  count: number
  lastAt: number
}

export interface TrendPoint {
  date: string
  count: number
}

/** groupId → 群名 映射 */
export type GroupNameMap = Record<string, string>

function buildStatsQuery(filter: StatsFilter & { limit?: number }): string {
  const p: Record<string, string | number | undefined> = {
    botId:   filter.botId,
    groupId: filter.groupId,
    from:    filter.from,
    to:      filter.to,
    limit:   filter.limit,
  }
  return buildQuery(p)
}

// ─── 插件市场 ─────────────────────────────────────────────────────────────────

const MARKET_INDEX_URL =
  "https://raw.githubusercontent.com/FinalDevHQ/Dian-plugins/main/index.json"

export interface MarketPluginChangelog {
  version: string
  date: string
  notes: string
}

export interface MarketPlugin {
  name: string
  displayName: string
  description: string
  version: string
  author: string
  icon?: string
  tags?: string[]
  hasUI?: boolean
  minRuntimeVersion?: string
  homepage?: string
  downloadUrl: string
  changelog?: MarketPluginChangelog[]
}

export interface MarketIndex {
  apiVersion: string
  updatedAt: string
  plugins: MarketPlugin[]
}

export const marketApi = {
  /** 拉取市场注册表（直接 fetch GitHub raw，支持 CORS） */
  async fetchIndex(): Promise<MarketIndex> {
    const res = await fetch(MARKET_INDEX_URL)
    if (!res.ok) throw new Error(`拉取市场列表失败 (${res.status})`)
    return res.json() as Promise<MarketIndex>
  },
  /** 让服务端代理下载并安装插件 ZIP */
  async installFromUrl(url: string): Promise<{ ok: boolean; name: string }> {
    const res = await fetch(`${BASE_URL}/plugins/install-from-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error((err as { error?: string }).error ?? res.statusText)
    }
    return res.json() as Promise<{ ok: boolean; name: string }>
  },
}

export const statsApi = {
  overview: (f: StatsFilter = {}) =>
    request<OverviewStats>(`/stats/messages/overview${buildStatsQuery(f)}`),
  byGroup: (f: StatsFilter & { limit?: number } = {}) =>
    request<{ groups: GroupStat[] }>(`/stats/messages/by-group${buildStatsQuery(f)}`),
  byUser: (f: StatsFilter & { limit?: number } = {}) =>
    request<{ users: UserStat[] }>(`/stats/messages/by-user${buildStatsQuery(f)}`),
  trend: (f: StatsFilter = {}) =>
    request<{ trend: TrendPoint[] }>(`/stats/messages/trend${buildStatsQuery(f)}`),
  /** 获取已缓存的群名。传空数组/不传时返回全部 */
  groupNames: (groupIds: string[] = []) => {
    const qs = groupIds.length ? `?groupIds=${groupIds.join(",")}` : ""
    return request<GroupNameMap>(`/stats/group-names${qs}`)
  },
  /** 触发向所有活跃 bot 同步群名 */
  syncGroupNames: () =>
    request<{ ok: boolean; synced: number }>("/stats/group-names/sync", { method: "POST" }),
}

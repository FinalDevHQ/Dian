import { type ReactNode, useCallback, useEffect, useState } from "react"
import { Activity, Blocks, Bot, CheckCircle2, Clock, Cpu, MemoryStick, RefreshCw, Server, XCircle } from "lucide-react"
import { api, type BotInfo, type BotStatus, type HealthResponse, type PluginPublicMeta, type SystemInfo } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const POLL_INTERVAL = 5000

function formatTs(ts: number): string {
  return new Date(ts).toLocaleString()
}

export function DashboardPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [bots, setBots] = useState<BotInfo[] | null>(null)
  const [system, setSystem] = useState<SystemInfo | null>(null)
  const [plugins, setPlugins] = useState<PluginPublicMeta[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [h, s, sys, pl] = await Promise.all([
        api.health(),
        api.status(),
        api.system().catch(() => null),
        api.listPlugins().then((r) => r.plugins).catch(() => null),
      ])
      setHealth(h)
      setBots(s.bots)
      setSystem(sys)
      setPlugins(pl)
      setLastUpdated(Date.now())
    } catch (err) {
      setHealth(null)
      setBots(null)
      setSystem(null)
      setPlugins(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = window.setTimeout(refresh, 0)
    const id = window.setInterval(refresh, POLL_INTERVAL)
    return () => {
      window.clearTimeout(t)
      window.clearInterval(id)
    }
  }, [refresh])

  const online = health?.status === "ok"

  // 概览统计
  const botTotal = bots?.length ?? 0
  const botOnline = bots?.filter((b) => b.status === "connected" || b.status === "no-ws").length ?? 0
  const pluginTotal = plugins?.length ?? 0
  const pluginEnabled = plugins?.filter((p) => p.enabled).length ?? 0
  const totalCommands = plugins?.reduce((sum, p) => sum + p.commandCount, 0) ?? 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          连接到 <code className="font-mono">/api</code>（dev 代理 →
          <span className="ml-1 font-mono">localhost:3000</span>）
        </p>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              更新于 {formatTs(lastUpdated)}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw
              className={loading ? "animate-spin" : undefined}
              aria-hidden
            />
            刷新
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <XCircle className="size-4 text-destructive" aria-hidden />
            <CardTitle className="text-destructive">无法连接到服务器</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              请确认 <code className="font-mono">apps/server</code> 已启动
              （默认监听 <code className="font-mono">:3000</code>）。
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── 顶部概览卡片 ─────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewStat
          icon={<Activity className="size-4" />}
          label="服务器"
          value={health ? (online ? "在线" : "异常") : "离线"}
          sub={system ? `运行 ${formatDuration(system.node.uptimeSec)}` : undefined}
          color={online ? "emerald" : "rose"}
          loading={loading && !health}
        />
        <OverviewStat
          icon={<Bot className="size-4" />}
          label="Bot"
          value={`${botOnline} / ${botTotal}`}
          sub="在线 / 总数"
          color={botOnline > 0 ? "emerald" : "muted"}
          loading={loading && !bots}
        />
        <OverviewStat
          icon={<Blocks className="size-4" />}
          label="插件"
          value={`${pluginEnabled} / ${pluginTotal}`}
          sub={`${totalCommands} 条命令`}
          color={pluginEnabled > 0 ? "sky" : "muted"}
          loading={loading && !plugins}
        />
        <OverviewStat
          icon={<Clock className="size-4" />}
          label="系统运行"
          value={system ? formatDuration(system.os.uptimeSec) : "—"}
          sub={system ? system.os.hostname : undefined}
          color="muted"
          loading={loading && !system}
        />
      </div>

      {/* ── 服务器状态 + Bot 概况 ─────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-muted-foreground" aria-hidden />
                <CardTitle>服务器状态</CardTitle>
              </div>
              {health ? (
                <Badge variant={online ? "default" : "destructive"}>
                  {online ? (
                    <CheckCircle2 className="size-3" aria-hidden />
                  ) : (
                    <XCircle className="size-3" aria-hidden />
                  )}
                  {online ? "在线" : "异常"}
                </Badge>
              ) : loading ? (
                <Skeleton className="h-5 w-14" />
              ) : (
                <Badge variant="destructive">离线</Badge>
              )}
            </div>
            <CardDescription>GET /health</CardDescription>
          </CardHeader>
          <CardContent>
            {health ? (
              <dl className="grid grid-cols-[6rem_1fr] gap-y-2 text-sm">
                <dt className="text-muted-foreground">status</dt>
                <dd className="font-mono">{health.status}</dd>
                <dt className="text-muted-foreground">ts</dt>
                <dd className="font-mono">{formatTs(health.ts)}</dd>
              </dl>
            ) : loading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">暂无数据</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="size-4 text-muted-foreground" aria-hidden />
              <CardTitle>Bot 概况</CardTitle>
              {bots && <Badge variant="secondary">{bots.length}</Badge>}
            </div>
            <CardDescription>各 Bot 当前连接状态</CardDescription>
          </CardHeader>
          <CardContent>
            {bots ? (
              bots.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无 Bot，前往「Bot 管理」页面添加。</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {bots.map((b) => (
                    <BotMiniCard key={b.botId} bot={b} />
                  ))}
                </div>
              )
            ) : loading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">暂无数据</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 系统信息 / CPU / 内存 ─────────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <SystemCard system={system} loading={loading} />
        <CpuCard system={system} loading={loading} />
        <MemoryCard system={system} loading={loading} />
      </div>

      <p className="text-center text-xs text-muted-foreground">
        每 {POLL_INTERVAL / 1000}s 自动刷新
      </p>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// 概览统计卡片
// ────────────────────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  emerald: "text-emerald-600",
  rose: "text-rose-600",
  sky: "text-sky-600",
  muted: "text-muted-foreground",
}

function OverviewStat({
  icon,
  label,
  value,
  sub,
  color = "muted",
  loading: isLoading,
}: {
  icon: ReactNode
  label: string
  value: string
  sub?: string
  color?: string
  loading?: boolean
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          {isLoading ? (
            <Skeleton className="mt-1 h-5 w-16" />
          ) : (
            <p className={`text-lg font-semibold tabular-nums ${COLOR_MAP[color] ?? ""}`}>
              {value}
            </p>
          )}
          {sub && <p className="truncate text-[11px] text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Bot 迷你卡（仪表盘概览用，只读）
// ────────────────────────────────────────────────────────────────────────────

const BOT_STATUS_META: Record<
  BotStatus,
  { label: string; className: string; dot: string }
> = {
  connected: {
    label: "在线",
    className: "border-emerald-500/40 text-emerald-700",
    dot: "bg-emerald-500",
  },
  connecting: {
    label: "连接中",
    className: "border-amber-500/40 text-amber-700",
    dot: "bg-amber-500 animate-pulse",
  },
  reconnecting: {
    label: "重连中",
    className: "border-rose-500/40 text-rose-700",
    dot: "bg-rose-500 animate-pulse",
  },
  closed: {
    label: "已停止",
    className: "border-rose-500/40 text-rose-700",
    dot: "bg-rose-500",
  },
  idle: {
    label: "未启动",
    className: "border-muted-foreground/30 text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  "no-ws": {
    label: "仅 HTTP",
    className: "border-sky-500/40 text-sky-700",
    dot: "bg-sky-500",
  },
  disabled: {
    label: "已禁用",
    className: "border-muted-foreground/30 text-muted-foreground",
    dot: "bg-muted-foreground/60",
  },
}

function BotMiniCard({ bot }: { bot: BotInfo }) {
  const meta = BOT_STATUS_META[bot.status] ?? BOT_STATUS_META.idle
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <Bot className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-mono text-sm">{bot.botId}</span>
      <Badge variant="outline" className={`shrink-0 gap-1.5 text-[11px] ${meta.className}`}>
        <span className={`size-1.5 rounded-full ${meta.dot}`} />
        {meta.label}
      </Badge>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// 子卡片
// ────────────────────────────────────────────────────────────────────────────

function SystemCard({ system, loading }: { system: SystemInfo | null; loading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Server className="size-4 text-muted-foreground" aria-hidden />
          <CardTitle>系统信息</CardTitle>
        </div>
        <CardDescription>GET /system · 操作系统与 Node 进程</CardDescription>
      </CardHeader>
      <CardContent>
        {system ? (
          <dl className="grid grid-cols-[7rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">主机</dt>
            <dd className="font-mono truncate">{system.os.hostname}</dd>
            <dt className="text-muted-foreground">平台</dt>
            <dd className="font-mono">
              {system.os.platform} ({system.os.arch}) · {system.os.release}
            </dd>
            <dt className="text-muted-foreground">系统运行</dt>
            <dd className="font-mono">{formatDuration(system.os.uptimeSec)}</dd>
            <dt className="text-muted-foreground">Node</dt>
            <dd className="font-mono">{system.node.version} · pid {system.node.pid}</dd>
            <dt className="text-muted-foreground">进程运行</dt>
            <dd className="font-mono">{formatDuration(system.node.uptimeSec)}</dd>
            <dt className="text-muted-foreground">cwd</dt>
            <dd className="font-mono truncate" title={system.node.cwd}>{system.node.cwd}</dd>
          </dl>
        ) : loading ? (
          <CardSkeleton lines={5} />
        ) : (
          <p className="text-sm text-muted-foreground">暂无数据</p>
        )}
      </CardContent>
    </Card>
  )
}

function CpuCard({ system, loading }: { system: SystemInfo | null; loading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="size-4 text-muted-foreground" aria-hidden />
            <CardTitle>CPU</CardTitle>
          </div>
          {system && (
            <Badge variant="secondary">{system.cpu.cores} 核</Badge>
          )}
        </div>
        <CardDescription className="truncate" title={system?.cpu.model}>
          {system?.cpu.model ?? "—"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {system ? (
          <div className="flex flex-col gap-3">
            <UsageBar label="使用率" value={system.cpu.usagePercent} />
            <dl className="grid grid-cols-[6rem_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">主频</dt>
              <dd className="font-mono">{(system.cpu.speedMHz / 1000).toFixed(2)} GHz</dd>
              <dt className="text-muted-foreground">负载</dt>
              <dd className="font-mono">
                {system.cpu.loadAvg.map((n) => n.toFixed(2)).join(" / ")}
                <span className="ml-2 text-xs text-muted-foreground">1m / 5m / 15m</span>
              </dd>
            </dl>
          </div>
        ) : loading ? (
          <CardSkeleton lines={3} />
        ) : (
          <p className="text-sm text-muted-foreground">暂无数据</p>
        )}
      </CardContent>
    </Card>
  )
}

function MemoryCard({ system, loading }: { system: SystemInfo | null; loading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MemoryStick className="size-4 text-muted-foreground" aria-hidden />
          <CardTitle>内存</CardTitle>
        </div>
        <CardDescription>系统总内存与 Node 进程占用</CardDescription>
      </CardHeader>
      <CardContent>
        {system ? (
          <div className="flex flex-col gap-3">
            <UsageBar
              label="系统内存"
              value={system.memory.usagePercent}
              caption={`${formatBytes(system.memory.usedBytes)} / ${formatBytes(system.memory.totalBytes)}`}
            />
            <UsageBar
              label="进程堆"
              value={
                system.memory.process.heapTotalBytes > 0
                  ? (system.memory.process.heapUsedBytes / system.memory.process.heapTotalBytes) * 100
                  : 0
              }
              caption={`${formatBytes(system.memory.process.heapUsedBytes)} / ${formatBytes(system.memory.process.heapTotalBytes)}`}
            />
            <dl className="grid grid-cols-[6rem_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">RSS</dt>
              <dd className="font-mono">{formatBytes(system.memory.process.rssBytes)}</dd>
              <dt className="text-muted-foreground">External</dt>
              <dd className="font-mono">{formatBytes(system.memory.process.externalBytes)}</dd>
            </dl>
          </div>
        ) : loading ? (
          <CardSkeleton lines={4} />
        ) : (
          <p className="text-sm text-muted-foreground">暂无数据</p>
        )}
      </CardContent>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// 小工具
// ────────────────────────────────────────────────────────────────────────────

function UsageBar({ label, value, caption }: { label: string; value: number; caption?: string }) {
  const v = Math.max(0, Math.min(100, value))
  // 颜色阈值：<60 绿，<85 黄，>=85 红
  const color =
    v >= 85 ? "bg-destructive" : v >= 60 ? "bg-amber-500" : "bg-emerald-500"
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums">
          {v.toFixed(1)}%
          {caption && <span className="ml-2 text-muted-foreground">{caption}</span>}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-[width] duration-300 ${color}`}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  )
}

function CardSkeleton({ lines }: { lines: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  )
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`
}

function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "—"
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

import { useCallback, useEffect, useMemo, useState } from "react"
import { Activity, Bot, CheckCircle2, Cpu, MemoryStick, RefreshCw, Server, XCircle } from "lucide-react"
import { api, type BotInfo, type HealthResponse, type SystemInfo } from "@/lib/api"
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
import { useBotScope } from "@/contexts/bot-scope-context"

const POLL_INTERVAL = 5000

function formatTs(ts: number): string {
  return new Date(ts).toLocaleString()
}

export function DashboardPage() {
  const { scope } = useBotScope()
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [bots, setBots] = useState<BotInfo[] | null>(null)
  const [system, setSystem] = useState<SystemInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  const visibleBots = useMemo(() => {
    if (!bots) return null
    if (scope === "all") return bots
    return bots.filter((b) => b.botId === scope)
  }, [bots, scope])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [h, s, sys] = await Promise.all([
        api.health(),
        api.status(),
        api.system().catch(() => null),
      ])
      setHealth(h)
      setBots(s.bots)
      setSystem(sys)
      setLastUpdated(Date.now())
    } catch (err) {
      setHealth(null)
      setBots(null)
      setSystem(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // 首次加载放入微任务，避免 effect 中同步 setState 触发级联渲染告警
    const t = window.setTimeout(refresh, 0)
    const id = window.setInterval(refresh, POLL_INTERVAL)
    return () => {
      window.clearTimeout(t)
      window.clearInterval(id)
    }
  }, [refresh])

  const online = health?.status === "ok"

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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
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

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="size-4 text-muted-foreground" aria-hidden />
                <CardTitle>
                  {scope === "all" ? "Bot 列表" : "当前 Bot"}
                </CardTitle>
              </div>
              {visibleBots ? (
                <Badge variant="secondary">{visibleBots.length}</Badge>
              ) : loading ? (
                <Skeleton className="h-5 w-8" />
              ) : null}
            </div>
            <CardDescription>
              GET /status{scope !== "all" && ` · 过滤: ${scope}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {visibleBots ? (
              visibleBots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {scope === "all"
                    ? "没有正在运行的 Bot。"
                    : `Bot "${scope}" 不在线。`}
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {visibleBots.map((b) => (
                    <li
                      key={b.botId}
                      className="flex items-center justify-between py-2 text-sm"
                    >
                      <span className="font-mono">{b.botId}</span>
                      <Badge variant="outline">running</Badge>
                    </li>
                  ))}
                </ul>
              )
            ) : loading ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-2/3" />
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

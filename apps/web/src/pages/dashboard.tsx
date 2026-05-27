import { type ReactNode, useCallback, useEffect, useState } from "react"
import { Activity, Blocks, Bot, Cpu, MemoryStick, RefreshCw, Server, XCircle } from "lucide-react"
import { api, type BotInfo, type BotStatus, type HealthResponse, type PluginPublicMeta, type SystemInfo } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const POLL_INTERVAL = 5000

function formatTs(ts: number): string {
  return new Date(ts).toLocaleString()
}

export function DashboardPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [bot, setBot] = useState<BotInfo | null>(null)
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
      setBot(s.bot)
      setSystem(sys)
      setPlugins(pl)
      setLastUpdated(Date.now())
    } catch (err) {
      setHealth(null)
      setBot(null)
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

  const botOnline = bot?.status === "connected" || bot?.status === "no-ws" ? 1 : 0
  const pluginTotal = plugins?.length ?? 0
  const pluginEnabled = plugins?.filter((p) => p.enabled).length ?? 0
  const totalCommands = plugins?.reduce((sum, p) => sum + p.commandCount, 0) ?? 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-gray-400">
          连接到 <code className="font-mono text-gray-500">/api</code>（dev 代理 →
          <span className="ml-1 font-mono text-gray-500">localhost:3000</span>）
        </p>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[11px] text-gray-400">
              更新于 {formatTs(lastUpdated)}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className="h-7 rounded-full border-gray-200 bg-white/60 px-3 text-[11px] text-gray-500 backdrop-blur-sm hover:bg-white hover:text-gray-700"
          >
            <RefreshCw
              className={cn("size-3", loading && "animate-spin")}
              aria-hidden
            />
            刷新
          </Button>
        </div>
      </div>

      {error && (
        <Card className="overflow-hidden border-red-200/60 bg-red-50/60 backdrop-blur-sm">
          <CardHeader className="flex-row items-center gap-2 space-y-0 pb-2">
            <XCircle className="size-4 text-red-400" aria-hidden />
            <CardTitle className="text-[13px] text-red-600">无法连接到服务器</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[12px] text-red-500/80">{error}</p>
            <p className="mt-1.5 text-[11px] text-red-400/70">
              请确认 <code className="font-mono">apps/server</code> 已启动
              （默认监听 <code className="font-mono">:3000</code>）。
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── 顶部概览卡片 ─────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <OverviewStat
          icon={<Activity className="size-4" strokeWidth={1.5} />}
          label="服务器"
          value={health ? (online ? "在线" : "异常") : "离线"}
          sub={system ? `运行 ${formatDuration(system.node.uptimeSec)}` : undefined}
          glowColor={online ? "green" : "red"}
          loading={loading && !health}
        />
        <OverviewStat
          icon={<Bot className="size-4" strokeWidth={1.5} />}
          label="Bot"
          value={bot ? (botOnline > 0 ? "在线" : "离线") : "未配置"}
          sub={bot ? bot.botId : "单 bot 模式"}
          glowColor={botOnline > 0 ? "purple" : "gray"}
          loading={loading && !bot}
        />
        <OverviewStat
          icon={<Blocks className="size-4" strokeWidth={1.5} />}
          label="插件"
          value={`${pluginEnabled} / ${pluginTotal}`}
          sub={`${totalCommands} 条命令`}
          glowColor={pluginEnabled > 0 ? "blue" : "gray"}
          loading={loading && !plugins}
        />
      </div>

      {/* ── 插件概览 + Bot 概况 ─────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden rounded-2xl border-gray-200/50 bg-white/60 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gray-200/40 lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-violet-50">
                  <Blocks className="size-3.5 text-violet-500" strokeWidth={1.5} />
                </div>
                <CardTitle className="text-[13px] font-semibold text-gray-700">插件概览</CardTitle>
              </div>
              {plugins && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                  {pluginEnabled}/{pluginTotal}
                </span>
              )}
            </div>
            <CardDescription className="text-[11px]">已启用插件 · 共 {totalCommands} 条命令</CardDescription>
          </CardHeader>
          <CardContent>
            {plugins ? (
              plugins.length === 0 ? (
                <p className="text-[12px] text-gray-400">暂无插件</p>
              ) : (
                <ul className="space-y-1">
                  {plugins
                    .filter((p) => p.enabled)
                    .slice(0, 6)
                    .map((p) => (
                      <li
                        key={p.name}
                        className="flex items-center justify-between rounded-xl border border-gray-100 bg-white/50 px-3 py-2 text-[12px] transition-colors hover:bg-white/80"
                      >
                        <span className="truncate font-medium text-gray-700">{p.name}</span>
                        <span className="shrink-0 text-[10px] text-gray-400">
                          {p.commandCount} 命令
                        </span>
                      </li>
                    ))}
                  {plugins.filter((p) => p.enabled).length > 6 && (
                    <li className="pt-1 text-center text-[10px] text-gray-400">
                      …等共 {plugins.filter((p) => p.enabled).length} 个插件
                    </li>
                  )}
                </ul>
              )
            ) : loading ? (
              <div className="space-y-2">
                <Skeleton className="h-9 w-full rounded-xl" />
                <Skeleton className="h-9 w-full rounded-xl" />
                <Skeleton className="h-9 w-full rounded-xl" />
              </div>
            ) : (
              <p className="text-[12px] text-gray-400">暂无数据</p>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border-gray-200/50 bg-white/60 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gray-200/40 lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-sky-50">
                <Bot className="size-3.5 text-sky-500" strokeWidth={1.5} />
              </div>
              <CardTitle className="text-[13px] font-semibold text-gray-700">Bot 概况</CardTitle>
              {bot && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                  {bot.botId}
                </span>
              )}
            </div>
            <CardDescription className="text-[11px]">Bot 当前连接状态</CardDescription>
          </CardHeader>
          <CardContent>
            {bot ? (
              <BotMiniCard bot={bot} />
            ) : loading ? (
              <Skeleton className="h-12 w-full rounded-xl" />
            ) : (
              <p className="text-[12px] text-gray-400">暂无数据，前往「Bot 设置」页面配置。</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 系统信息 / CPU / 内存 ─────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SystemCard system={system} loading={loading} />
        <CpuCard system={system} loading={loading} />
        <MemoryCard system={system} loading={loading} />
      </div>

      <p className="text-center text-[10px] text-gray-400">
        每 {POLL_INTERVAL / 1000}s 自动刷新
      </p>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// 概览统计卡片
// ────────────────────────────────────────────────────────────────────────────

const GLOW_MAP: Record<string, { bg: string; ring: string; shadow: string }> = {
  green: {
    bg: "bg-emerald-50",
    ring: "ring-emerald-100",
    shadow: "shadow-emerald-100/50",
  },
  purple: {
    bg: "bg-violet-50",
    ring: "ring-violet-100",
    shadow: "shadow-violet-100/50",
  },
  blue: {
    bg: "bg-sky-50",
    ring: "ring-sky-100",
    shadow: "shadow-sky-100/50",
  },
  red: {
    bg: "bg-red-50",
    ring: "ring-red-100",
    shadow: "shadow-red-100/50",
  },
  gray: {
    bg: "bg-gray-50",
    ring: "ring-gray-100",
    shadow: "shadow-gray-100/50",
  },
}

const VALUE_COLOR: Record<string, string> = {
  green: "text-emerald-600",
  purple: "text-violet-600",
  blue: "text-sky-600",
  red: "text-red-500",
  gray: "text-gray-400",
}

function OverviewStat({
  icon,
  label,
  value,
  sub,
  glowColor = "gray",
  loading: isLoading,
}: {
  icon: ReactNode
  label: string
  value: string
  sub?: string
  glowColor?: string
  loading?: boolean
}) {
  const glow = GLOW_MAP[glowColor] ?? GLOW_MAP.gray
  return (
    <Card className="overflow-hidden rounded-2xl border-gray-200/50 bg-white/60 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gray-200/40">
      <CardContent className="flex items-center gap-3.5 p-4">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 shadow-sm",
            glow.bg,
            glow.ring,
            glow.shadow,
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium tracking-wide text-gray-400">{label}</p>
          {isLoading ? (
            <Skeleton className="mt-1 h-5 w-16 rounded-lg" />
          ) : (
            <p className={cn("text-[18px] font-bold tabular-nums tracking-tight", VALUE_COLOR[glowColor] ?? "text-gray-700")}>
              {value}
            </p>
          )}
          {sub && <p className="truncate text-[10px] text-gray-400/80">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Bot 迷你卡
// ────────────────────────────────────────────────────────────────────────────

const BOT_STATUS_META: Record<
  BotStatus,
  { label: string; dot: string; text: string }
> = {
  connected: {
    label: "在线",
    dot: "bg-emerald-400 shadow-emerald-200",
    text: "text-emerald-600",
  },
  connecting: {
    label: "连接中",
    dot: "bg-amber-400 shadow-amber-200 animate-pulse",
    text: "text-amber-600",
  },
  reconnecting: {
    label: "重连中",
    dot: "bg-rose-400 shadow-rose-200 animate-pulse",
    text: "text-rose-600",
  },
  closed: {
    label: "已停止",
    dot: "bg-rose-400 shadow-rose-200",
    text: "text-rose-600",
  },
  idle: {
    label: "未启动",
    dot: "bg-gray-300 shadow-gray-100",
    text: "text-gray-400",
  },
  "no-ws": {
    label: "仅 HTTP",
    dot: "bg-sky-400 shadow-sky-200",
    text: "text-sky-600",
  },
  disabled: {
    label: "已禁用",
    dot: "bg-gray-300/60 shadow-gray-100",
    text: "text-gray-400",
  },
}

function BotMiniCard({ bot }: { bot: BotInfo }) {
  const meta = BOT_STATUS_META[bot.status] ?? BOT_STATUS_META.idle
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white/50 px-3 py-2.5 transition-colors hover:bg-white/80">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gray-50">
        <Bot className="size-3.5 text-gray-400" strokeWidth={1.5} />
      </div>
      <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-gray-600">{bot.botId}</span>
      <span className={cn("flex items-center gap-1.5 text-[10px] font-medium", meta.text)}>
        <span className={cn("size-1.5 rounded-full shadow-sm", meta.dot)} />
        {meta.label}
      </span>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// 子卡片
// ────────────────────────────────────────────────────────────────────────────

function SystemCard({ system, loading }: { system: SystemInfo | null; loading: boolean }) {
  return (
    <Card className="overflow-hidden rounded-2xl border-gray-200/50 bg-white/60 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gray-200/40">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-50">
            <Server className="size-3.5 text-indigo-500" strokeWidth={1.5} />
          </div>
          <CardTitle className="text-[13px] font-semibold text-gray-700">系统信息</CardTitle>
        </div>
        <CardDescription className="text-[11px]">操作系统与 Node 进程</CardDescription>
      </CardHeader>
      <CardContent>
        {system ? (
          <dl className="flex flex-col gap-2.5 text-[12px]">
            <SystemRow label="主机" value={system.os.hostname} mono />
            <SystemRow label="平台" value={`${system.os.platform} (${system.os.arch}) · ${system.os.release}`} mono />
            <SystemRow label="系统运行" value={formatDuration(system.os.uptimeSec)} />
            <SystemRow label="Node" value={`${system.node.version} · pid ${system.node.pid}`} mono />
            <SystemRow label="进程运行" value={formatDuration(system.node.uptimeSec)} />
            <div className="flex items-start gap-3">
              <dt className="shrink-0 pt-0.5 text-[11px] text-gray-400">cwd</dt>
              <dd
                className="min-w-0 flex-1 truncate rounded-lg bg-gray-50/80 px-2 py-1 font-mono text-[11px] text-gray-500 ring-1 ring-gray-100"
                title={system.node.cwd}
              >
                {system.node.cwd}
              </dd>
            </div>
          </dl>
        ) : loading ? (
          <CardSkeleton lines={5} />
        ) : (
          <p className="text-[12px] text-gray-400">暂无数据</p>
        )}
      </CardContent>
    </Card>
  )
}

function CpuCard({ system, loading }: { system: SystemInfo | null; loading: boolean }) {
  return (
    <Card className="overflow-hidden rounded-2xl border-gray-200/50 bg-white/60 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gray-200/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-violet-50">
              <Cpu className="size-3.5 text-violet-500" strokeWidth={1.5} />
            </div>
            <CardTitle className="text-[13px] font-semibold text-gray-700">CPU</CardTitle>
          </div>
          {system && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
              {system.cpu.cores} 核
            </span>
          )}
        </div>
        <CardDescription className="truncate text-[11px]" title={system?.cpu.model}>
          {system?.cpu.model ?? "—"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {system ? (
          <div className="flex flex-col gap-3">
            <UsageBar label="使用率" value={system.cpu.usagePercent} />
            <dl className="flex flex-col gap-2 text-[12px]">
              <SystemRow label="主频" value={`${(system.cpu.speedMHz / 1000).toFixed(2)} GHz`} />
              <div className="flex items-start gap-3">
                <dt className="shrink-0 text-[11px] text-gray-400">负载</dt>
                <dd className="min-w-0 flex-1">
                  <span className="font-mono text-[12px] font-medium text-gray-700">
                    {system.cpu.loadAvg.map((n) => n.toFixed(2)).join(" / ")}
                  </span>
                  <span className="ml-1.5 text-[10px] text-gray-400">1m / 5m / 15m</span>
                </dd>
              </div>
            </dl>
          </div>
        ) : loading ? (
          <CardSkeleton lines={3} />
        ) : (
          <p className="text-[12px] text-gray-400">暂无数据</p>
        )}
      </CardContent>
    </Card>
  )
}

function MemoryCard({ system, loading }: { system: SystemInfo | null; loading: boolean }) {
  return (
    <Card className="overflow-hidden rounded-2xl border-gray-200/50 bg-white/60 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gray-200/40">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-sky-50">
            <MemoryStick className="size-3.5 text-sky-500" strokeWidth={1.5} />
          </div>
          <CardTitle className="text-[13px] font-semibold text-gray-700">内存</CardTitle>
        </div>
        <CardDescription className="text-[11px]">系统总内存与 Node 进程占用</CardDescription>
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
            <dl className="flex flex-col gap-2 text-[12px]">
              <SystemRow label="RSS" value={formatBytes(system.memory.process.rssBytes)} />
              <SystemRow label="External" value={formatBytes(system.memory.process.externalBytes)} />
            </dl>
          </div>
        ) : loading ? (
          <CardSkeleton lines={4} />
        ) : (
          <p className="text-[12px] text-gray-400">暂无数据</p>
        )}
      </CardContent>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// 小工具
// ────────────────────────────────────────────────────────────────────────────

function SystemRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="shrink-0 text-[11px] text-gray-400">{label}</dt>
      <dd className={cn("min-w-0 flex-1 truncate text-[12px] font-medium text-gray-700", mono && "font-mono")}>
        {value}
      </dd>
    </div>
  )
}

function UsageBar({ label, value, caption }: { label: string; value: number; caption?: string }) {
  const v = Math.max(0, Math.min(100, value))
  const gradient =
    v >= 85
      ? "from-rose-400 to-pink-500"
      : v >= 60
        ? "from-amber-400 to-orange-400"
        : "from-emerald-400 to-teal-400"
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="text-gray-400">{label}</span>
        <span className="font-mono tabular-nums font-medium text-gray-600">
          {v.toFixed(1)}%
          {caption && <span className="ml-1.5 text-[10px] font-normal text-gray-400">{caption}</span>}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className={cn("h-full rounded-full bg-gradient-to-r transition-[width] duration-500 ease-out", gradient)}
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
        <Skeleton key={i} className="h-4 w-full rounded-lg" />
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

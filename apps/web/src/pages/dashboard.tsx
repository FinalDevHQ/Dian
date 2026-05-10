import { useCallback, useEffect, useMemo, useState } from "react"
import { Activity, Bot, CheckCircle2, Cpu, Loader2, MemoryStick, Plus, RefreshCw, Server, Trash2, XCircle } from "lucide-react"
import { api, type BotEntryInput, type BotInfo, type BotMode, type HealthResponse, type SystemInfo } from "@/lib/api"
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
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useBotScope } from "@/contexts/bot-scope-context"
import { cn } from "@/lib/utils"

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
  /** 以 botId 为键记录正在 toggle/删除中的 bot，避免重复点击 */
  const [busyBots, setBusyBots] = useState<Record<string, boolean>>({})
  const [addOpen, setAddOpen] = useState(false)

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
              <div className="flex items-center gap-2">
                {visibleBots ? (
                  <Badge variant="secondary">{visibleBots.length}</Badge>
                ) : loading ? (
                  <Skeleton className="h-5 w-8" />
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddOpen(true)}
                  title="添加 bot"
                >
                  <Plus className="size-3.5" />添加
                </Button>
              </div>
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
                    <BotRow
                      key={b.botId}
                      bot={b}
                      busy={!!busyBots[b.botId]}
                      onToggle={async (enabled) => {
                        setBusyBots((m) => ({ ...m, [b.botId]: true }))
                        try {
                          await api.setBotEnabled(b.botId, enabled)
                          // 依赖 watcher 触发 reload；为了 UX 走顺一些，等 800ms 后主动刷新
                          setTimeout(refresh, 800)
                        } catch (err) {
                          setError(err instanceof Error ? err.message : String(err))
                        } finally {
                          setBusyBots((m) => ({ ...m, [b.botId]: false }))
                        }
                      }}
                      onDelete={async () => {
                        if (!window.confirm(`确定删除 bot “${b.botId}” 吗？该操作会从 bot.yaml 中移除该条目。`)) return
                        setBusyBots((m) => ({ ...m, [b.botId]: true }))
                        try {
                          await api.deleteBot(b.botId)
                          setTimeout(refresh, 800)
                        } catch (err) {
                          setError(err instanceof Error ? err.message : String(err))
                        } finally {
                          setBusyBots((m) => ({ ...m, [b.botId]: false }))
                        }
                      }}
                    />
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

      {addOpen && (
        <AddBotDialog
          onClose={() => setAddOpen(false)}
          onSuccess={() => { setAddOpen(false); setTimeout(refresh, 800) }}
        />
      )}

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
// Bot 列表行
// ────────────────────────────────────────────────────────────────────────────

function BotRow({
  bot,
  busy,
  onToggle,
  onDelete,
}: {
  bot: BotInfo
  busy: boolean
  onToggle: (enabled: boolean) => Promise<void> | void
  onDelete: () => Promise<void> | void
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate font-mono">{bot.botId}</span>
        {bot.enabled ? (
          <Badge
            variant="outline"
            className={cn(
              bot.running
                ? "border-emerald-500/40 text-emerald-700"
                : "border-amber-500/40 text-amber-700"
            )}
          >
            {bot.running ? "running" : "starting"}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            disabled
          </Badge>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {busy ? (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        ) : (
          <Switch
            checked={bot.enabled}
            disabled={busy}
            onCheckedChange={(v) => { void onToggle(v) }}
            aria-label={`toggle ${bot.botId}`}
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => { void onDelete() }}
          title="删除 bot"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </li>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// 添加 Bot 弹窗
// ────────────────────────────────────────────────────────────────────────────

function AddBotDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [botId, setBotId] = useState("")
  const [mode, setMode] = useState<BotMode>("hybrid")
  const [wsUrl, setWsUrl] = useState("")
  const [wsToken, setWsToken] = useState("")
  const [httpUrl, setHttpUrl] = useState("")
  const [httpToken, setHttpToken] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const needWs = mode === "ws" || mode === "hybrid"
  const needHttp = mode === "http" || mode === "hybrid"

  const submit = async () => {
    setErr(null)
    if (!botId.trim()) { setErr("botId 不能为空"); return }
    if (needWs && !wsUrl.trim()) { setErr("WS URL 不能为空"); return }
    if (needHttp && !httpUrl.trim()) { setErr("HTTP baseUrl 不能为空"); return }

    const entry: BotEntryInput = {
      botId: botId.trim(),
      mode,
      enabled: true,
      ...(needWs && {
        ws: {
          url: wsUrl.trim(),
          ...(wsToken.trim() && { accessToken: wsToken.trim() }),
        },
      }),
      ...(needHttp && {
        http: {
          baseUrl: httpUrl.trim(),
          ...(httpToken.trim() && { accessToken: httpToken.trim() }),
        },
      }),
    }

    setSubmitting(true)
    try {
      await api.addBot(entry)
      onSuccess()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-muted-foreground" />
            <span className="font-semibold">添加 Bot</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <XCircle className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bot-id">botId</Label>
              <Input
                id="bot-id"
                placeholder="例如：点点"
                value={botId}
                onChange={(e) => setBotId(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bot-mode">传输模式</Label>
              <select
                id="bot-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as BotMode)}
                disabled={submitting}
                className="flex h-9 w-full rounded-md border bg-input/30 px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                <option value="hybrid">hybrid（推荐）</option>
                <option value="ws">ws（仅事件）</option>
                <option value="http">http（仅 action）</option>
              </select>
            </div>
          </div>

          {needWs && (
            <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3">
              <Label className="text-xs">WebSocket</Label>
              <Input
                placeholder="ws://192.168.x.x:13001/"
                value={wsUrl}
                onChange={(e) => setWsUrl(e.target.value)}
                disabled={submitting}
              />
              <Input
                placeholder="accessToken（可选）"
                value={wsToken}
                onChange={(e) => setWsToken(e.target.value)}
                disabled={submitting}
              />
            </div>
          )}

          {needHttp && (
            <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3">
              <Label className="text-xs">HTTP</Label>
              <Input
                placeholder="http://192.168.x.x:13000/"
                value={httpUrl}
                onChange={(e) => setHttpUrl(e.target.value)}
                disabled={submitting}
              />
              <Input
                placeholder="accessToken（可选）"
                value={httpToken}
                onChange={(e) => setHttpToken(e.target.value)}
                disabled={submitting}
              />
            </div>
          )}

          {err && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {err}
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
              取消
            </Button>
            <Button className="flex-1" onClick={submit} disabled={submitting}>
              {submitting && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              {submitting ? "添加中…" : "添加"}
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            提交后会写入 <code className="font-mono">config/bot.yaml</code>，
            框架检测到文件变化会自动重启所有 bot 连接。注意：写入时<strong>会丢失原有注释</strong>。
          </p>
        </div>
      </div>
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

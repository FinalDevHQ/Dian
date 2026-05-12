import { useCallback, useEffect, useMemo, useState } from "react"
import { Bot, Loader2, Pencil, Plus, RefreshCw, Trash2, XCircle } from "lucide-react"
import { api, type BotEntryInput, type BotInfo, type BotMode, type BotStatus } from "@/lib/api"
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

type BotDetail = BotInfo & { config?: BotEntryInput }

export function BotManagePage() {
  const { scope } = useBotScope()
  const [bots, setBots] = useState<BotDetail[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [busyBots, setBusyBots] = useState<Record<string, boolean>>({})
  const [addOpen, setAddOpen] = useState(false)
  const [editingBotId, setEditingBotId] = useState<string | null>(null)

  const visibleBots = useMemo(() => {
    if (!bots) return null
    if (scope === "all") return bots
    return bots.filter((b) => b.botId === scope)
  }, [bots, scope])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const s = await api.status()
      // 并行拉取每个 bot 的详细配置
      const details = await Promise.all(
        s.bots.map(async (b) => {
          try {
            const { bot: cfg } = await api.getBot(b.botId)
            return { ...b, config: cfg } as BotDetail
          } catch {
            return { ...b } as BotDetail
          }
        })
      )
      setBots(details)
      setLastUpdated(Date.now())
    } catch (err) {
      setBots(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  // 挂载时加载一次 + 页面重新可见时刷新
  useEffect(() => {
    const t = window.setTimeout(refresh, 0)

    const onVis = () => {
      if (!document.hidden) refresh()
    }
    document.addEventListener("visibilitychange", onVis)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [refresh])

  // 统计
  const onlineCount = bots?.filter((b) => b.status === "connected" || b.status === "no-ws").length ?? 0
  const totalCount = bots?.length ?? 0

  return (
    <div className="flex flex-col gap-6">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            管理所有 Bot 连接配置 · 共 <strong>{totalCount}</strong> 个，
            <span className="text-emerald-600">{onlineCount}</span> 个在线
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              更新于 {new Date(lastUpdated).toLocaleString()}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" /> 添加 Bot
          </Button>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : undefined} aria-hidden />
            刷新
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <XCircle className="size-4 text-destructive" aria-hidden />
            <CardTitle className="text-destructive">请求失败</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Bot 卡片列表 */}
      {visibleBots ? (
        visibleBots.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              {scope === "all" ? "暂无 Bot，点击右上角「添加 Bot」开始配置。" : `Bot「${scope}」不在线。`}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleBots.map((b) => (
              <BotCard
                key={b.botId}
                bot={b}
                busy={!!busyBots[b.botId]}
                onEdit={() => setEditingBotId(b.botId)}
                onToggle={async (enabled) => {
                  // 乐观更新：先改本地状态
                  setBots((prev) => {
                    if (!prev) return prev
                    return prev.map((bot) =>
                      bot.botId === b.botId ? { ...bot, enabled } : bot
                    )
                  })
                  setBusyBots((m) => ({ ...m, [b.botId]: true }))
                  try {
                    await api.setBotEnabled(b.botId, enabled)
                  } catch (err) {
                    // 失败回滚
                    setBots((prev) => {
                      if (!prev) return prev
                      return prev.map((bot) =>
                        bot.botId === b.botId ? { ...bot, enabled: !enabled } : bot
                      )
                    })
                    setError(err instanceof Error ? err.message : String(err))
                  } finally {
                    setBusyBots((m) => ({ ...m, [b.botId]: false }))
                  }
                }}
                onDelete={async () => {
                  if (!window.confirm(`确定删除 bot "${b.botId}" 吗？该操作会从 bot.yaml 中移除该条目。`)) return
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
          </div>
        )
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-5">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {addOpen && (
        <BotEditorDialog
          mode="add"
          onClose={() => setAddOpen(false)}
          onSuccess={() => { setAddOpen(false); setTimeout(refresh, 800) }}
        />
      )}

      {editingBotId !== null && (
        <BotEditorDialog
          mode="edit"
          botId={editingBotId}
          onClose={() => setEditingBotId(null)}
          onSuccess={() => { setEditingBotId(null); setTimeout(refresh, 800) }}
        />
      )}

    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Bot 状态徽章
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
    label: "离线 · 重连中",
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

function BotStatusBadge({ status }: { status: BotStatus }) {
  const meta = BOT_STATUS_META[status] ?? BOT_STATUS_META.idle
  return (
    <Badge
      variant="outline"
      className={`gap-1.5 ${meta.className}`}
      title={status}
    >
      <span className={`size-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </Badge>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Bot 卡片
// ────────────────────────────────────────────────────────────────────────────

function BotCard({
  bot,
  busy,
  onEdit,
  onToggle,
  onDelete,
}: {
  bot: BotDetail
  busy: boolean
  onEdit: () => void
  onToggle: (enabled: boolean) => Promise<void> | void
  onDelete: () => Promise<void> | void
}) {
  const cfg = bot.config
  const modeLabel: Record<BotMode, string> = {
    hybrid: "hybrid（WS + HTTP）",
    ws: "ws（仅事件）",
    http: "http（仅 action）",
  }

  return (
    <Card className="relative">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Bot className="size-5 text-muted-foreground" />
            <CardTitle className="text-base font-mono">{bot.botId}</CardTitle>
          </div>
          <BotStatusBadge status={bot.status} />
        </div>
        <CardDescription className="text-xs">
          {bot.enabled ? "已启用" : "已禁用"} · {bot.running ? "运行中" : "未运行"}
          {cfg && (
            <span className="ml-1">· {modeLabel[cfg.mode]}</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 配置信息 */}
        {cfg && (
          <div className="space-y-1.5 text-xs text-muted-foreground">
            {cfg.ws && (
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 rounded bg-sky-50 px-1 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-400">
                  WS
                </span>
                <span className="truncate font-mono">{cfg.ws.url}</span>
                {cfg.ws.accessToken && (
                  <Badge variant="outline" className="shrink-0 text-[10px] border-amber-200/60 text-amber-700">
                    Token 已设
                  </Badge>
                )}
              </div>
            )}
            {cfg.http && (
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 rounded bg-emerald-50 px-1 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                  HTTP
                </span>
                <span className="truncate font-mono">{cfg.http.baseUrl}</span>
                {cfg.http.accessToken && (
                  <Badge variant="outline" className="shrink-0 text-[10px] border-amber-200/60 text-amber-700">
                    Token 已设
                  </Badge>
                )}
              </div>
            )}
            {!cfg.ws && !cfg.http && (
              <p className="text-[11px] text-muted-foreground">无连接配置</p>
            )}
          </div>
        )}

        {/* 操作栏 */}
        <div className="flex items-center justify-between border-t pt-2">
          <div className="flex items-center gap-2">
            <Switch
              checked={bot.enabled}
              disabled={busy}
              onCheckedChange={(v) => { void onToggle(v) }}
              aria-label={`toggle ${bot.botId}`}
            />
            <span className="text-xs text-muted-foreground">
              {bot.enabled ? "启用" : "禁用"}
            </span>
            {busy && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" disabled={busy} onClick={onEdit} title="编辑 bot">
              <Pencil className="size-3.5" />
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => { void onDelete() }} title="删除 bot">
              <Trash2 className="size-3.5 text-destructive/70" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Bot 编辑器弹窗（添加 / 编辑共用）
// ────────────────────────────────────────────────────────────────────────────

type BotEditorProps =
  | {
      mode: "add"
      onClose: () => void
      onSuccess: () => void
    }
  | {
      mode: "edit"
      botId: string
      onClose: () => void
      onSuccess: () => void
    }

function BotEditorDialog(props: BotEditorProps) {
  const isEdit = props.mode === "edit"
  const originalBotId = isEdit ? props.botId : null

  const [botId, setBotId] = useState("")
  const [mode, setMode] = useState<BotMode>("hybrid")
  const [wsUrl, setWsUrl] = useState("")
  const [wsToken, setWsToken] = useState("")
  const [httpUrl, setHttpUrl] = useState("")
  const [httpToken, setHttpToken] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  /** 编辑模式下加载初始数据 */
  const [loadingInitial, setLoadingInitial] = useState(isEdit)

  const needWs = mode === "ws" || mode === "hybrid"
  const needHttp = mode === "http" || mode === "hybrid"

  // 编辑模式：拉取原配置回填
  useEffect(() => {
    if (!isEdit || !originalBotId) return
    let cancelled = false
    setLoadingInitial(true)
    api
      .getBot(originalBotId)
      .then(({ bot }) => {
        if (cancelled) return
        setBotId(bot.botId)
        setMode(bot.mode)
        setWsUrl(bot.ws?.url ?? "")
        setWsToken(bot.ws?.accessToken ?? "")
        setHttpUrl(bot.http?.baseUrl ?? "")
        setHttpToken(bot.http?.accessToken ?? "")
      })
      .catch((e) => {
        if (cancelled) return
        setErr(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setLoadingInitial(false)
      })
    return () => {
      cancelled = true
    }
  }, [isEdit, originalBotId])

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
      if (isEdit && originalBotId) {
        await api.updateBot(originalBotId, entry)
      } else {
        await api.addBot(entry)
      }
      props.onSuccess()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  const title = isEdit ? `编辑 Bot · ${originalBotId}` : "添加 Bot"
  const submitLabel = isEdit
    ? submitting ? "保存中…" : "保存"
    : submitting ? "添加中…" : "添加"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-muted-foreground" />
            <span className="font-semibold">{title}</span>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <XCircle className="size-4" />
          </button>
        </div>

        {loadingInitial ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> 加载配置…
          </div>
        ) : (
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
                {isEdit && botId.trim() !== originalBotId && (
                  <p className="text-[11px] text-amber-600">
                    将从 <code className="font-mono">{originalBotId}</code> 改名为{" "}
                    <code className="font-mono">{botId.trim()}</code>
                  </p>
                )}
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
              <Button variant="outline" className="flex-1" onClick={props.onClose} disabled={submitting}>
                取消
              </Button>
              <Button className="flex-1" onClick={submit} disabled={submitting}>
                {submitting && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                {submitLabel}
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground">
              提交后会写入 <code className="font-mono">config/bot.yaml</code>，
              框架检测到文件变化会自动重启所有 bot 连接。注意：写入时<strong>会丢失原有注释</strong>。
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

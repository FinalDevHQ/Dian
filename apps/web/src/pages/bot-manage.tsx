import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Bot, Eye, EyeOff, Loader2, Pencil, Plus, RefreshCw, Trash2, XCircle } from "lucide-react"
import { api, type BotEntryInput, type BotInfo, type BotMode, type BotStatus } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useBotScope } from "@/contexts/bot-scope-context"
import { cn } from "@/lib/utils"

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
  const [hideConfig, setHideConfig] = useState(false)

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

  useEffect(() => {
    const t = window.setTimeout(refresh, 0)
    const onVis = () => { if (!document.hidden) refresh() }
    document.addEventListener("visibilitychange", onVis)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [refresh])

  const onlineCount = bots?.filter((b) => b.status === "connected" || b.status === "no-ws").length ?? 0
  const totalCount = bots?.length ?? 0

  return (
    <div className="flex flex-col gap-5">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-gray-400">
          管理所有 Bot 连接配置 · 共 <span className="font-medium text-gray-600">{totalCount}</span> 个，
          <span className="font-medium text-emerald-500">{onlineCount}</span> 个在线
        </p>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[11px] text-gray-400">
              更新于 {new Date(lastUpdated).toLocaleString()}
            </span>
          )}
          <button
            onClick={() => setHideConfig(!hideConfig)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium",
              "border transition-all duration-200",
              hideConfig
                ? "border-violet-200/60 bg-violet-50/80 text-violet-600"
                : "border-gray-200/60 bg-white/60 text-gray-500 hover:border-gray-300 hover:bg-white hover:text-gray-700",
            )}
          >
            {hideConfig ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
            {hideConfig ? "显示配置" : "隐藏配置"}
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium",
              "border border-gray-200/60 bg-white/60 text-gray-500 backdrop-blur-sm",
              "transition-all duration-200 hover:border-gray-300 hover:bg-white hover:text-gray-700 hover:shadow-sm",
            )}
          >
            <Plus className="size-3" />
            添加 Bot
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium",
              "border border-gray-200/60 bg-white/60 text-gray-500 backdrop-blur-sm",
              "transition-all duration-200 hover:border-gray-300 hover:bg-white hover:text-gray-700",
            )}
          >
            <RefreshCw className={cn("size-3", loading && "animate-spin")} />
            刷新
          </button>
        </div>
      </div>

      {error && (
        <div className="overflow-hidden rounded-2xl border border-red-200/60 bg-red-50/60 p-4 backdrop-blur-sm">
          <div className="flex items-start gap-2">
            <XCircle className="mt-0.5 size-4 shrink-0 text-red-400" />
            <div>
              <p className="text-[13px] font-medium text-red-600">请求失败</p>
              <p className="mt-1 text-[12px] text-red-500/80">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Bot 卡片列表 */}
      {visibleBots ? (
        visibleBots.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200/50 bg-white/60 py-16 text-gray-400 backdrop-blur-sm">
            <Bot className="mb-3 size-8 opacity-30" />
            <p className="text-[13px]">
              {scope === "all" ? "暂无 Bot，点击右上角「添加 Bot」开始配置。" : `Bot「${scope}」不在线。`}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleBots.map((b) => (
              <BotCard
                key={b.botId}
                bot={b}
                busy={!!busyBots[b.botId]}
                compact={hideConfig}
                onEdit={() => setEditingBotId(b.botId)}
                onToggle={async (enabled) => {
                  setBots((prev) => prev?.map((bot) =>
                    bot.botId === b.botId ? { ...bot, enabled } : bot
                  ) ?? prev)
                  setBusyBots((m) => ({ ...m, [b.botId]: true }))
                  try {
                    await api.setBotEnabled(b.botId, enabled)
                  } catch (err) {
                    setBots((prev) => prev?.map((bot) =>
                      bot.botId === b.botId ? { ...bot, enabled: !enabled } : bot
                    ) ?? prev)
                    setError(err instanceof Error ? err.message : String(err))
                  } finally {
                    setBusyBots((m) => ({ ...m, [b.botId]: false }))
                  }
                }}
                onDelete={async () => {
                  if (!window.confirm(`确定删除 bot "${b.botId}" 吗？`)) return
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-gray-200/50 bg-white/60 p-5 backdrop-blur-sm">
              <div className="space-y-3">
                <Skeleton className="h-5 w-2/3 rounded-lg" />
                <Skeleton className="h-4 w-1/2 rounded-lg" />
                <Skeleton className="h-8 w-full rounded-lg" />
              </div>
            </div>
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
// Bot 状态
// ────────────────────────────────────────────────────────────────────────────

const BOT_STATUS_META: Record<BotStatus, { label: string; dot: string; text: string }> = {
  connected:    { label: "在线",   dot: "bg-emerald-400 shadow-emerald-200", text: "text-emerald-600" },
  connecting:   { label: "连接中", dot: "bg-amber-400 shadow-amber-200 animate-pulse", text: "text-amber-600" },
  reconnecting: { label: "重连中", dot: "bg-rose-400 shadow-rose-200 animate-pulse", text: "text-rose-600" },
  closed:       { label: "已停止", dot: "bg-rose-400 shadow-rose-200", text: "text-rose-600" },
  idle:         { label: "未启动", dot: "bg-gray-300 shadow-gray-100", text: "text-gray-400" },
  "no-ws":      { label: "仅HTTP", dot: "bg-sky-400 shadow-sky-200", text: "text-sky-600" },
  disabled:     { label: "已禁用", dot: "bg-gray-300/60 shadow-gray-100", text: "text-gray-400" },
}

// ────────────────────────────────────────────────────────────────────────────
// Bot 卡片
// ────────────────────────────────────────────────────────────────────────────

function BotCard({
  bot,
  busy,
  compact,
  onEdit,
  onToggle,
  onDelete,
}: {
  bot: BotDetail
  busy: boolean
  compact: boolean
  onEdit: () => void
  onToggle: (enabled: boolean) => Promise<void> | void
  onDelete: () => Promise<void> | void
}) {
  const [hovered, setHovered] = useState(false)
  const cfg = bot.config
  const meta = BOT_STATUS_META[bot.status] ?? BOT_STATUS_META.idle
  const showDetail = !compact || hovered

  const modeLabel: Record<BotMode, string> = {
    hybrid: "WS + HTTP",
    ws: "仅 WS",
    http: "仅 HTTP",
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-white/60 backdrop-blur-sm",
        "transition-all duration-300 ease-out",
        hovered
          ? "border-gray-300/80 shadow-lg shadow-gray-200/40 -translate-y-0.5"
          : "border-gray-200/50 shadow-sm",
      )}
    >
      {/* 顶部渐变条 */}
      <div className={cn(
        "h-0.5 w-full transition-opacity duration-300",
        bot.status === "connected" || bot.status === "no-ws"
          ? "bg-gradient-to-r from-emerald-400 to-teal-400 opacity-60"
          : bot.status === "connecting" || bot.status === "reconnecting"
            ? "bg-gradient-to-r from-amber-400 to-orange-400 opacity-60"
            : "bg-gradient-to-r from-gray-300 to-gray-200 opacity-40",
      )} />

      <div className="p-4">
        {/* 头部：名称 + 状态 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-xl ring-1 shadow-sm transition-shadow duration-300",
              bot.status === "connected" || bot.status === "no-ws"
                ? "bg-emerald-50 ring-emerald-100 shadow-emerald-100/50"
                : "bg-gray-50 ring-gray-100 shadow-gray-100/50",
            )}>
              <Bot className={cn(
                "size-4",
                bot.status === "connected" || bot.status === "no-ws"
                  ? "text-emerald-500"
                  : "text-gray-400",
              )} strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-[14px] font-bold text-gray-800">{bot.botId}</span>
                <span className="flex items-center gap-1 text-[10px] font-medium">
                  <span className={cn("size-1.5 rounded-full shadow-sm", meta.dot)} />
                  <span className={meta.text}>{meta.label}</span>
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                {bot.enabled ? "已启用" : "已禁用"} · {bot.running ? "运行中" : "未运行"}
                {cfg && <span className="ml-1">· {modeLabel[cfg.mode]}</span>}
              </p>
            </div>
          </div>

          {/* 启用开关 */}
          <div className="flex items-center gap-1.5">
            {busy && <Loader2 className="size-3 animate-spin text-gray-400" />}
            <Switch
              checked={bot.enabled}
              disabled={busy}
              onCheckedChange={(v) => { void onToggle(v) }}
              aria-label={`toggle ${bot.botId}`}
            />
          </div>
        </div>

        {/* 连接配置 - 简洁模式下隐藏，hover 时展开 */}
        <div className={cn(
          "overflow-hidden transition-all duration-300 ease-out",
          showDetail ? "mt-3 max-h-40 opacity-100" : "max-h-0 opacity-0",
        )}>
          {cfg && (cfg.ws || cfg.http) ? (
            <div className="space-y-1.5 rounded-xl bg-gray-50/60 p-3 ring-1 ring-gray-100/80">
              {cfg.ws && (
                <div className="flex items-center gap-2">
                  <span className="shrink-0 rounded-md bg-sky-100/60 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-sky-600">
                    WS
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-gray-400">
                    {cfg.ws.url}
                  </span>
                  {cfg.ws.accessToken && (
                    <span className="flex shrink-0 items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[9px] text-gray-400">
                      <span className="text-[10px]">🔒</span>
                    </span>
                  )}
                </div>
              )}
              {cfg.http && (
                <div className="flex items-center gap-2">
                  <span className="shrink-0 rounded-md bg-emerald-100/60 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-emerald-600">
                    HTTP
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-gray-400">
                    {cfg.http.baseUrl}
                  </span>
                  {cfg.http.accessToken && (
                    <span className="flex shrink-0 items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[9px] text-gray-400">
                      <span className="text-[10px]">🔒</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-gray-400">无连接配置</p>
          )}
        </div>

        {/* 操作按钮 - hover 时浮现 */}
        <div className={cn(
          "flex items-center justify-end gap-1 pt-2 transition-all duration-300",
          hovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1",
        )}>
          <button
            onClick={onEdit}
            disabled={busy}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <Pencil className="size-3" />
            编辑
          </button>
          <button
            onClick={() => { void onDelete() }}
            disabled={busy}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 className="size-3" />
            删除
          </button>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Bot 编辑器弹窗
// ────────────────────────────────────────────────────────────────────────────

type BotEditorProps =
  | { mode: "add"; onClose: () => void; onSuccess: () => void }
  | { mode: "edit"; botId: string; onClose: () => void; onSuccess: () => void }

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
  const [loadingInitial, setLoadingInitial] = useState(isEdit)
  const initialLoadStarted = useRef(new Set<string>())

  const needWs = mode === "ws" || mode === "hybrid"
  const needHttp = mode === "http" || mode === "hybrid"

  useEffect(() => {
    if (!isEdit || !originalBotId) return
    if (initialLoadStarted.current.has(originalBotId)) return
    initialLoadStarted.current.add(originalBotId)
    setLoadingInitial(true)
    api.getBot(originalBotId)
      .then(({ bot }) => {
        setBotId(bot.botId)
        setMode(bot.mode)
        setWsUrl(bot.ws?.url ?? "")
        setWsToken(bot.ws?.accessToken ?? "")
        setHttpUrl(bot.http?.baseUrl ?? "")
        setHttpToken(bot.http?.accessToken ?? "")
      })
      .catch((e) => { setErr(e instanceof Error ? e.message : String(e)) })
      .finally(() => { setLoadingInitial(false) })
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
      ...(needWs && { ws: { url: wsUrl.trim(), ...(wsToken.trim() && { accessToken: wsToken.trim() }) } }),
      ...(needHttp && { http: { baseUrl: httpUrl.trim(), ...(httpToken.trim() && { accessToken: httpToken.trim() }) } }),
    }

    setSubmitting(true)
    try {
      if (isEdit && originalBotId) await api.updateBot(originalBotId, entry)
      else await api.addBot(entry)
      props.onSuccess()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  const title = isEdit ? `编辑 Bot · ${originalBotId}` : "添加 Bot"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200/60 bg-white/90 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-violet-50">
              <Bot className="size-3.5 text-violet-500" strokeWidth={1.5} />
            </div>
            <span className="text-[13px] font-semibold text-gray-700">{title}</span>
          </div>
          <button
            onClick={props.onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <XCircle className="size-4" />
          </button>
        </div>

        {loadingInitial ? (
          <div className="flex items-center justify-center gap-2 p-10 text-[12px] text-gray-400">
            <Loader2 className="size-4 animate-spin" /> 加载配置…
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bot-id" className="text-[11px] text-gray-400">botId</Label>
                <Input
                  id="bot-id"
                  placeholder="例如：点点"
                  value={botId}
                  onChange={(e) => setBotId(e.target.value)}
                  disabled={submitting}
                  className="h-8 rounded-xl border-gray-200/60 bg-white/60 text-[12px] backdrop-blur-sm focus:border-violet-300 focus:ring-violet-200/50"
                />
                {isEdit && botId.trim() !== originalBotId && (
                  <p className="text-[10px] text-amber-500">
                    将改名为 <code className="font-mono">{botId.trim()}</code>
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bot-mode" className="text-[11px] text-gray-400">传输模式</Label>
                <select
                  id="bot-mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as BotMode)}
                  disabled={submitting}
                  className="flex h-8 w-full rounded-xl border border-gray-200/60 bg-white/60 px-3 text-[12px] backdrop-blur-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-200/50"
                >
                  <option value="hybrid">hybrid（推荐）</option>
                  <option value="ws">ws（仅事件）</option>
                  <option value="http">http（仅 action）</option>
                </select>
              </div>
            </div>

            {needWs && (
              <div className="flex flex-col gap-2.5 rounded-xl border border-gray-100 bg-gray-50/40 p-3">
                <Label className="text-[11px] font-medium text-gray-500">WebSocket</Label>
                <Input
                  placeholder="ws://192.168.x.x:13001/"
                  value={wsUrl}
                  onChange={(e) => setWsUrl(e.target.value)}
                  disabled={submitting}
                  className="h-8 rounded-lg border-gray-200/60 bg-white text-[12px] font-mono"
                />
                <Input
                  placeholder="accessToken（可选）"
                  value={wsToken}
                  onChange={(e) => setWsToken(e.target.value)}
                  disabled={submitting}
                  className="h-8 rounded-lg border-gray-200/60 bg-white text-[12px] font-mono"
                />
              </div>
            )}

            {needHttp && (
              <div className="flex flex-col gap-2.5 rounded-xl border border-gray-100 bg-gray-50/40 p-3">
                <Label className="text-[11px] font-medium text-gray-500">HTTP</Label>
                <Input
                  placeholder="http://192.168.x.x:13000/"
                  value={httpUrl}
                  onChange={(e) => setHttpUrl(e.target.value)}
                  disabled={submitting}
                  className="h-8 rounded-lg border-gray-200/60 bg-white text-[12px] font-mono"
                />
                <Input
                  placeholder="accessToken（可选）"
                  value={httpToken}
                  onChange={(e) => setHttpToken(e.target.value)}
                  disabled={submitting}
                  className="h-8 rounded-lg border-gray-200/60 bg-white text-[12px] font-mono"
                />
              </div>
            )}

            {err && (
              <div className="rounded-xl border border-red-200/60 bg-red-50/60 px-3 py-2 text-[11px] text-red-500">
                {err}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={props.onClose}
                disabled={submitting}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200/60 bg-white/60 px-3 py-2 text-[12px] text-gray-500 backdrop-blur-sm transition-all hover:bg-white hover:text-gray-700"
              >
                取消
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-3 py-2 text-[12px] font-medium text-white shadow-sm shadow-violet-200/50 transition-all hover:from-violet-600 hover:to-indigo-600 hover:shadow-md"
              >
                {submitting && <Loader2 className="size-3 animate-spin" />}
                {isEdit ? (submitting ? "保存中…" : "保存") : (submitting ? "添加中…" : "添加")}
              </button>
            </div>

            <p className="text-[10px] text-gray-400">
              提交后写入 <code className="font-mono">config/bot.yaml</code>，框架会自动重启连接。
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

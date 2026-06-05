import { useCallback, useEffect, useState } from "react"
import { Bot, Loader2, RefreshCw, Save, XCircle } from "lucide-react"
import { api, type BotEntryInput, type BotInfo, type BotMode, type BotStatus } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export function BotSettingsPage() {
  const [bot, setBot] = useState<BotEntryInput | null>(null)
  const [botState, setBotState] = useState<BotInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  // 表单状态
  const [botId, setBotId] = useState("")
  const [mode, setMode] = useState<BotMode>("hybrid")
  const [wsUrl, setWsUrl] = useState("")
  const [wsToken, setWsToken] = useState("")
  const [httpUrl, setHttpUrl] = useState("")
  const [httpToken, setHttpToken] = useState("")

  const needWs = mode === "ws" || mode === "hybrid"
  const needHttp = mode === "http" || mode === "hybrid"

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [botData, statusData] = await Promise.all([
        api.getBot(),
        api.status(),
      ])
      const entry = botData.bot
      setBot(entry)
      setBotState(statusData.bot)
      setBotId(entry.botId)
      setMode(entry.mode)
      setWsUrl(entry.ws?.url ?? "")
      setWsToken(entry.ws?.accessToken ?? "")
      setHttpUrl(entry.http?.baseUrl ?? "")
      setHttpToken(entry.http?.accessToken ?? "")
      setLastUpdated(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = window.setTimeout(refresh, 0)
    return () => window.clearTimeout(t)
  }, [refresh])

  const handleSave = async () => {
    setError(null)
    setSuccess(null)
    if (!botId.trim()) { setError("botId 不能为空"); return }
    if (needWs && !wsUrl.trim()) { setError("WS URL 不能为空"); return }
    if (needHttp && !httpUrl.trim()) { setError("HTTP baseUrl 不能为空"); return }

    const entry: BotEntryInput = {
      botId: botId.trim(),
      mode,
      enabled: bot?.enabled ?? true,
      ...(needWs && { ws: { url: wsUrl.trim(), ...(wsToken.trim() && { accessToken: wsToken.trim() }) } }),
      ...(needHttp && { http: { baseUrl: httpUrl.trim(), ...(httpToken.trim() && { accessToken: httpToken.trim() }) } }),
    }

    setSaving(true)
    try {
      await api.updateBot(entry)
      setSuccess("配置已保存")
      setTimeout(refresh, 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleToggleEnabled = async (enabled: boolean) => {
    setError(null)
    try {
      await api.setBotEnabled(enabled)
      setBot((prev) => prev ? { ...prev, enabled } : prev)
      setBotState((prev) => prev ? { ...prev, enabled } : prev)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const statusMeta: Record<BotStatus, { label: string; dot: string; text: string }> = {
    connected:    { label: "在线",   dot: "bg-emerald-400 shadow-emerald-200", text: "text-emerald-600" },
    connecting:   { label: "连接中", dot: "bg-amber-400 shadow-amber-200 animate-pulse", text: "text-amber-600" },
    reconnecting: { label: "重连中", dot: "bg-rose-400 shadow-rose-200 animate-pulse", text: "text-rose-600" },
    closed:       { label: "已停止", dot: "bg-rose-400 shadow-rose-200", text: "text-rose-600" },
    idle:         { label: "未启动", dot: "bg-gray-300 shadow-gray-100", text: "text-gray-400" },
    "no-ws":      { label: "仅HTTP", dot: "bg-sky-400 shadow-sky-200", text: "text-sky-600" },
    disabled:     { label: "已禁用", dot: "bg-gray-300/60 shadow-gray-100", text: "text-gray-400" },
  }

  const meta = botState ? statusMeta[botState.status] ?? statusMeta.idle : statusMeta.idle

  return (
    <div className="flex flex-col gap-5">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          配置 OneBot 连接
        </p>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-gray-400">
              更新于 {new Date(lastUpdated).toLocaleString()}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
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
              <p className="text-sm font-medium text-red-600">错误</p>
              <p className="mt-1 text-xs text-red-500/80">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="overflow-hidden rounded-2xl border border-emerald-200/60 bg-emerald-50/60 p-4 backdrop-blur-sm">
          <p className="text-sm font-medium text-emerald-600">{success}</p>
        </div>
      )}

      {loading ? (
        <div className="overflow-hidden rounded-2xl border border-gray-200/50 bg-white/60 p-5 backdrop-blur-sm">
          <div className="space-y-3">
            <Skeleton className="h-5 w-2/3 rounded-lg" />
            <Skeleton className="h-4 w-1/2 rounded-lg" />
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200/50 bg-white/60 backdrop-blur-sm">
          {/* 状态栏 */}
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-xl ring-1 shadow-sm",
                botState?.status === "connected" || botState?.status === "no-ws"
                  ? "bg-emerald-50 ring-emerald-100 shadow-emerald-100/50"
                  : "bg-gray-50 ring-gray-100 shadow-gray-100/50",
              )}>
                <Bot className={cn(
                  "size-4",
                  botState?.status === "connected" || botState?.status === "no-ws"
                    ? "text-emerald-500"
                    : "text-gray-400",
                )} strokeWidth={1.5} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-800">{botState?.botId ?? botId}</span>
                  <span className="flex items-center gap-1 text-xs font-medium">
                    <span className={cn("size-1.5 rounded-full shadow-sm", meta.dot)} />
                    <span className={meta.text}>{meta.label}</span>
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  {botState?.enabled ? "已启用" : "已禁用"} · {botState?.running ? "运行中" : "未运行"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">启用</span>
              <Switch
                checked={bot?.enabled ?? true}
                onCheckedChange={(v) => { void handleToggleEnabled(v) }}
              />
            </div>
          </div>

          {/* 配置表单 */}
          <div className="flex flex-col gap-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bot-id" className="text-xs text-gray-400">botId</Label>
                <Input
                  id="bot-id"
                  placeholder="例如：点点"
                  value={botId}
                  onChange={(e) => setBotId(e.target.value)}
                  disabled={saving}
                  className="h-8 rounded-xl border-gray-200/60 bg-white/60 text-xs backdrop-blur-sm focus:border-violet-300 focus:ring-violet-200/50"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bot-mode" className="text-xs text-gray-400">传输模式</Label>
                <select
                  id="bot-mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as BotMode)}
                  disabled={saving}
                  className="flex h-8 w-full rounded-xl border border-gray-200/60 bg-white/60 px-3 text-xs backdrop-blur-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-200/50"
                >
                  <option value="hybrid">hybrid（推荐）</option>
                  <option value="ws">ws（仅事件）</option>
                  <option value="http">http（仅 action）</option>
                </select>
              </div>
            </div>

            {needWs && (
              <div className="flex flex-col gap-2.5 rounded-xl border border-gray-100 bg-gray-50/40 p-3">
                <Label className="text-xs font-medium text-gray-500">WebSocket</Label>
                <Input
                  placeholder="ws://192.168.x.x:13001/"
                  value={wsUrl}
                  onChange={(e) => setWsUrl(e.target.value)}
                  disabled={saving}
                  className="h-8 rounded-lg border-gray-200/60 bg-white text-xs font-mono"
                />
                <Input
                  placeholder="accessToken（可选）"
                  value={wsToken}
                  onChange={(e) => setWsToken(e.target.value)}
                  disabled={saving}
                  className="h-8 rounded-lg border-gray-200/60 bg-white text-xs font-mono"
                />
              </div>
            )}

            {needHttp && (
              <div className="flex flex-col gap-2.5 rounded-xl border border-gray-100 bg-gray-50/40 p-3">
                <Label className="text-xs font-medium text-gray-500">HTTP</Label>
                <Input
                  placeholder="http://192.168.x.x:13000/"
                  value={httpUrl}
                  onChange={(e) => setHttpUrl(e.target.value)}
                  disabled={saving}
                  className="h-8 rounded-lg border-gray-200/60 bg-white text-xs font-mono"
                />
                <Input
                  placeholder="accessToken（可选）"
                  value={httpToken}
                  onChange={(e) => setHttpToken(e.target.value)}
                  disabled={saving}
                  className="h-8 rounded-lg border-gray-200/60 bg-white text-xs font-mono"
                />
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-3 py-2 text-xs font-medium text-white shadow-sm shadow-violet-200/50 transition-all hover:from-violet-600 hover:to-indigo-600 hover:shadow-md"
            >
              {saving && <Loader2 className="size-3 animate-spin" />}
              <Save className="size-3" />
              {saving ? "保存中…" : "保存配置"}
            </button>

            <p className="text-xs text-gray-400">
              保存后写入 <code className="font-mono">config/bot.yaml</code>，框架会自动重载连接。
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  BookOpen,
  Bot as BotIcon,
  Box,
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  Network,
  PlugZap,
  RefreshCw,
  TerminalSquare,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { api, type PluginPublicMeta } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

// ── 上传插件弹窗 ────────────────────────────────────────────────────────────

function UploadDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const accept = (f: File) => {
    if (!f.name.endsWith(".zip")) {
      setResult({ ok: false, msg: "只支持 .zip 格式" })
      return
    }
    setFile(f)
    setResult(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) accept(f)
  }

  const handleInstall = async () => {
    if (!file) return
    setUploading(true)
    setResult(null)
    try {
      await api.uploadPlugin(file.name, file)
      setResult({ ok: true, msg: `插件 "${file.name.replace(/\.zip$/i, "")}" 安装成功，HTTP 路由重启后生效` })
      onSuccess()
    } catch (err) {
      setResult({ ok: false, msg: err instanceof Error ? err.message : String(err) })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border bg-background shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Upload className="size-4 text-muted-foreground" />
            <span className="font-semibold">安装插件</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 主体 */}
        <div className="flex flex-col gap-4 p-5">
          {/* 拖放区域 */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 transition-colors",
              dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50"
            )}
          >
            <Upload className={cn("size-8 transition-colors", dragging ? "text-primary" : "text-muted-foreground/50")} />
            {file ? (
              <div className="text-center">
                <p className="font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm">拖放 ZIP 文件到此处</p>
                <p className="text-xs text-muted-foreground">或点击选择文件</p>
              </div>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip,application/octet-stream"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) accept(f) }}
          />

          {/* 结果提示 */}
          {result && (
            <div className={cn(
              "flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
              result.ok
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700"
                : "border-destructive/30 bg-destructive/5 text-destructive"
            )}>
              {result.ok
                ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                : <AlertCircle className="mt-0.5 size-3.5 shrink-0" />}
              {result.msg}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={uploading}>
              关闭
            </Button>
            <Button
              className="flex-1"
              onClick={handleInstall}
              disabled={!file || uploading || result?.ok === true}
            >
              {uploading ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Upload className="mr-1.5 size-3.5" />}
              {uploading ? "安装中…" : "安装"}
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            ZIP 会解压到 <code className="font-mono">plugins/&lt;name&gt;/</code> 目录。
            事件 handler / 指令热加载生效；HTTP API 路由需重启服务。
          </p>
        </div>
      </div>
    </div>
  )
}

function PluginIcon({ icon, name }: { icon?: string; name: string }) {
  const isUrl = icon?.startsWith("http") || icon?.startsWith("/")
  if (icon && isUrl) {
    return (
      <img
        src={icon}
        alt={name}
        className="size-10 rounded-lg border object-cover"
      />
    )
  }
  return (
    <div className="flex size-10 items-center justify-center rounded-lg border bg-muted text-xl">
      {icon ?? <Box className="size-5 text-muted-foreground" />}
    </div>
  )
}

function MethodBadge({ method }: { method: string }) {
  const cls: Record<string, string> = {
    GET: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
    POST: "bg-blue-500/10 text-blue-700 border-blue-500/30",
    PUT: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    PATCH: "bg-violet-500/10 text-violet-700 border-violet-500/30",
    DELETE: "bg-red-500/10 text-red-700 border-red-500/30",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1 py-0.5 font-mono text-[10px] font-semibold",
        cls[method] ?? "bg-muted text-muted-foreground"
      )}
    >
      {method}
    </span>
  )
}

function PluginDetail({
  plugin,
  availableBots,
  onToggle,
  onDelete,
  onBotsChange,
}: {
  plugin: PluginPublicMeta
  /** 全部已运行的 botId（取自 /status） */
  availableBots: string[]
  onToggle: (name: string, enabled: boolean) => Promise<void>
  onDelete: (name: string) => Promise<void>
  onBotsChange: (name: string, bots: string[]) => Promise<void>
}) {
  const [toggling, setToggling] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [savingBots, setSavingBots] = useState(false)

  // 现代的 server-state：以 plugin.bots 为唯一源，点击 checkbox 直接调 API
  const toggleBot = async (botId: string) => {
    if (savingBots) return
    const has = plugin.bots.includes(botId)
    const next = has ? plugin.bots.filter((b) => b !== botId) : [...plugin.bots, botId]
    setSavingBots(true)
    try { await onBotsChange(plugin.name, next) } finally { setSavingBots(false) }
  }

  const setAllBots = async (all: boolean) => {
    setSavingBots(true)
    try { await onBotsChange(plugin.name, all ? [...availableBots] : []) } finally { setSavingBots(false) }
  }

  const handleToggle = async (v: boolean) => {
    setToggling(true)
    try { await onToggle(plugin.name, v) } finally { setToggling(false) }
  }

  const handleDelete = async () => {
    if (!confirm) { setConfirm(true); setTimeout(() => setConfirm(false), 4000); return }
    setDeleting(true)
    try { await onDelete(plugin.name) } finally { setDeleting(false); setConfirm(false) }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-5">
      {/* 头部 */}
      <div className="flex items-start gap-4">
        <PluginIcon icon={plugin.icon} name={plugin.name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold leading-none">{plugin.name}</h2>
            {plugin.version && (
              <Badge variant="secondary">v{plugin.version}</Badge>
            )}
            <Badge
              variant="outline"
              className={cn(
                plugin.enabled
                  ? "border-emerald-500/40 text-emerald-600"
                  : "border-muted-foreground/30 text-muted-foreground"
              )}
            >
              {plugin.enabled ? "已启用" : "已禁用"}
            </Badge>
          </div>
          {plugin.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {plugin.description}
            </p>
          )}
          {plugin.author && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              作者：{plugin.author}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2">
            {toggling ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : (
              <Switch checked={plugin.enabled} onCheckedChange={handleToggle} />
            )}
            <span className="text-sm">{plugin.enabled ? "启用" : "禁用"}</span>
          </label>
          <Button
            variant={confirm ? "destructive" : "ghost"}
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            title="卸载插件"
          >
            {deleting
              ? <Loader2 className="size-3.5 animate-spin" />
              : <Trash2 className="size-3.5" />}
            {confirm && <span className="ml-1 text-xs">确认?</span>}
          </Button>
        </div>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: <TerminalSquare className="size-4" />, label: "事件处理器", count: plugin.handlerCount },
          { icon: <BookOpen className="size-4" />, label: "指令", count: plugin.commandCount },
          { icon: <Network className="size-4" />, label: "API 路由", count: plugin.routes.length },
        ].map((s) => (
          <Card key={s.label} className="gap-1 p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              {s.icon}
              <span className="text-xs">{s.label}</span>
            </div>
            <p className="text-2xl font-bold tabular-nums">{s.count}</p>
          </Card>
        ))}
      </div>

      {/* 作用范围（Bot 白名单） */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BotIcon className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm">作用 Bot</CardTitle>
              {savingBots && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
            </div>
            {availableBots.length > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                  disabled={savingBots || plugin.bots.length === availableBots.length}
                  onClick={() => setAllBots(true)}
                >全选</button>
                <span className="text-muted-foreground">·</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                  disabled={savingBots || plugin.bots.length === 0}
                  onClick={() => setAllBots(false)}
                >清空</button>
              </div>
            )}
          </div>
          <CardDescription className="text-xs">
            勾选后，该插件仅对选中的 bot 响应事件。默认为空 → 任何 bot 都不响应。
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          {availableBots.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              未检测到运行中的 bot，请先在 <code className="font-mono">config/bot.yaml</code> 中配置。
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableBots.map((botId) => {
                const checked = plugin.bots.includes(botId)
                return (
                  <button
                    key={botId}
                    type="button"
                    onClick={() => toggleBot(botId)}
                    disabled={savingBots}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors disabled:opacity-50",
                      checked
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700"
                        : "hover:bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-3.5 items-center justify-center rounded-sm border",
                        checked
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-muted-foreground/40"
                      )}
                    >
                      {checked && <CheckCircle2 className="size-3" />}
                    </span>
                    <span className="font-mono">{botId}</span>
                  </button>
                )
              })}
            </div>
          )}
          {plugin.bots.length === 0 && availableBots.length > 0 && (
            <p className="mt-2 text-[11px] text-amber-600">
              ⚠️ 当前未选中任何 bot，插件事件不会被触发。
            </p>
          )}
        </CardContent>
      </Card>

      {/* API 路由 */}
      {plugin.routes.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">API 路由</CardTitle>
            <CardDescription className="text-xs">
              前缀：/plugins/{plugin.name}/api
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ul className="space-y-1.5">
              {plugin.routes.map((r, i) => (
                <li key={i} className="flex items-center gap-2 font-mono text-xs">
                  <MethodBadge method={r.method} />
                  <span className="text-muted-foreground">/plugins/{plugin.name}/api</span>
                  <span>{r.path}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* UI iframe */}
      {plugin.hasUI && plugin.uiUrl && (
        <Card className="flex flex-1 flex-col overflow-hidden">
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 py-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Globe className="size-4 text-muted-foreground" />
              插件界面
            </CardTitle>
            <a
              href={plugin.uiUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="size-3" />
              新窗口
            </a>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <iframe
              src={plugin.uiUrl}
              className="size-full border-0"
              title={`${plugin.name} UI`}
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export function PluginsPage({ onPluginsChange }: { onPluginsChange?: () => void }) {
  const [plugins, setPlugins] = useState<PluginPublicMeta[] | null>(null)
  const [availableBots, setAvailableBots] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const loadRef = useRef(0)

  const loadPlugins = useCallback(async () => {
    const id = ++loadRef.current
    setLoading(true)
    setError(null)
    try {
      // 同步拉插件列表 + 可用 bot 列表（给 bot 多选用）
      const [r, s] = await Promise.all([
        api.listPlugins(),
        api.status().catch(() => ({ bots: [] as { botId: string }[] })),
      ])
      if (id !== loadRef.current) return
      setPlugins(r.plugins)
      setAvailableBots(s.bots.map((b) => b.botId))
      setSelected((prev) => {
        if (prev && r.plugins.some((p) => p.name === prev)) return prev
        return r.plugins[0]?.name ?? null
      })
      // 通知父组件刷新插件导航
      onPluginsChange?.()
    } catch (err) {
      if (id === loadRef.current)
        setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (id === loadRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    setTimeout(() => { loadPlugins() }, 0)
  }, [loadPlugins])

  const handleToggle = useCallback(
    async (name: string, enabled: boolean) => {
      try {
        await api.setPluginEnabled(name, enabled)
        setPlugins((prev) =>
          prev?.map((p) => (p.name === name ? { ...p, enabled } : p)) ?? prev
        )
        // 启停会影响导航栏（启用→出现，禁用→消失）
        onPluginsChange?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [onPluginsChange]
  )

  const handleDelete = useCallback(
    async (name: string) => {
      try {
        await api.deletePlugin(name)
        setPlugins((prev) => prev?.filter((p) => p.name !== name) ?? prev)
        setSelected((prev) => (prev === name ? null : prev))
        // 删除后从导航栏移除
        onPluginsChange?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [onPluginsChange]
  )

  const handleBotsChange = useCallback(
    async (name: string, bots: string[]) => {
      try {
        const r = await api.setPluginBots(name, bots)
        // 后端返回 accepted——以响应为准，避免丢进去的未知 bot
        setPlugins((prev) =>
          prev?.map((p) => (p.name === name ? { ...p, bots: r.bots } : p)) ?? prev
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    []
  )

  const selectedPlugin = plugins?.find((p) => p.name === selected) ?? null

  const [uploadOpen, setUploadOpen] = useState(false)

  return (
    <div className="grid h-[calc(100vh-8rem)] grid-cols-[16rem_1fr] gap-4">
      {uploadOpen && (
        <UploadDialog
          onClose={() => setUploadOpen(false)}
          onSuccess={() => { setTimeout(() => { loadPlugins() }, 800) }}
        />
      )}

      {/* ── 左侧插件列表 ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            已安装 {plugins?.length ?? 0} 个
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUploadOpen(true)}
              title="安装插件"
            >
              <Upload className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadPlugins}
              disabled={loading}
              title="刷新"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="size-3.5" />
            {error}
          </div>
        )}

        <div className="flex flex-1 flex-col gap-1 overflow-auto">
          {plugins === null ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              加载中…
            </div>
          ) : plugins.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <PlugZap className="size-8 opacity-40" />
              <p>暂无插件</p>
              <p className="text-xs">将 .js 文件放入 plugins/ 目录</p>
            </div>
          ) : (
            plugins.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => setSelected(p.name)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                  selected === p.name
                    ? "border-sidebar-accent-foreground/20 bg-sidebar-accent text-sidebar-accent-foreground"
                    : "border-transparent hover:bg-muted"
                )}
              >
                <PluginIcon icon={p.icon} name={p.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">
                      {p.name}
                    </span>
                    {!p.enabled && (
                      <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                    )}
                  </div>
                  {p.description && (
                    <p className="truncate text-xs text-muted-foreground">
                      {p.description}
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    {p.version && <span>v{p.version}</span>}
                    <span
                      className={cn(
                        "flex items-center gap-0.5",
                        p.bots.length === 0 && "text-amber-600"
                      )}
                      title={p.bots.length === 0 ? "未选中任何 bot——事件不会被触发" : `作用于 ${p.bots.join(", ")}`}
                    >
                      <BotIcon className="size-2.5" />
                      {p.bots.length}
                    </span>
                    {p.routes.length > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Network className="size-2.5" />
                        {p.routes.length}
                      </span>
                    )}
                    {p.hasUI && (
                      <span className="flex items-center gap-0.5">
                        <Globe className="size-2.5" />
                        UI
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── 右侧详情 / iframe ── */}
      <Card className="flex min-h-0 flex-col overflow-hidden">
        {selectedPlugin ? (
          <PluginDetail
            plugin={selectedPlugin}
            availableBots={availableBots}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onBotsChange={handleBotsChange}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <PlugZap className="size-12 opacity-30" />
            <p className="text-sm">选择一个插件查看详情</p>
          </div>
        )}
      </Card>
    </div>
  )
}

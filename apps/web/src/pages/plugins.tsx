import { useCallback, useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  BookOpen,
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
import { UninstallDialog } from "@/components/uninstall-dialog"

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
  // 冲突状态：后端返回 409 时保存已有插件信息，等待用户确认覆盖
  const [conflict, setConflict] = useState<{ name: string; currentVersion: string | null } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const accept = (f: File) => {
    if (!f.name.endsWith(".zip")) {
      setResult({ ok: false, msg: "只支持 .zip 格式" })
      return
    }
    setFile(f)
    setResult(null)
    setConflict(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) accept(f)
  }

  const doUpload = async (force: boolean) => {
    if (!file) return
    setUploading(true)
    setResult(null)
    try {
      const data = await api.uploadPlugin(file.name, file, force)
      // 后端返回 409：插件已存在，等待用户确认
      if (data.exists) {
        setConflict({ name: data.name ?? file.name.replace(/\.zip$/i, ""), currentVersion: data.currentVersion ?? null })
        return
      }
      const pluginName = data.name ?? file.name.replace(/\.zip$/i, "")
      setResult({ ok: true, msg: `插件 "${pluginName}" ${data.replaced ? "覆盖更新" : "安装"}成功，已自动加载` })
      setConflict(null)
      onSuccess()
    } catch (err) {
      setResult({ ok: false, msg: err instanceof Error ? err.message : String(err) })
    } finally {
      setUploading(false)
    }
  }

  const handleInstall = () => doUpload(false)
  const handleForceInstall = () => doUpload(true)

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

          {/* 覆盖安装确认 */}
          {conflict && (
            <div className="flex flex-col gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
              <div className="flex items-start gap-2 text-xs text-amber-700">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  插件 <strong>"{conflict.name}"</strong> 已安装
                  {conflict.currentVersion ? ` (v${conflict.currentVersion})` : ""}
                  ，继续将覆盖现有版本。
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setConflict(null)}
                  disabled={uploading}
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-amber-500 text-xs text-white hover:bg-amber-600"
                  onClick={handleForceInstall}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                  覆盖安装
                </Button>
              </div>
            </div>
          )}

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

          {/* 操作按钮（冲突确认时隐藏，避免双排按钮） */}
          {!conflict && (
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
          )}

          <p className="text-[11px] text-muted-foreground">
            ZIP 会解压到 <code className="font-mono">plugins/&lt;name&gt;/</code> 目录并自动加载。
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
  devSession,
  onToggle,
  onDelete,
  onDisconnectDev,
}: {
  plugin: PluginPublicMeta
  devSession?: { connectedAt: number; lastSyncAt?: number }
  onToggle: (name: string, enabled: boolean) => Promise<void>
  onDelete: (name: string) => Promise<void>
  onDisconnectDev?: (name: string) => Promise<void>
}) {
  const [toggling, setToggling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const handleToggle = async (v: boolean) => {
    setToggling(true)
    try { await onToggle(plugin.name, v) } finally { setToggling(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try { await onDelete(plugin.name) } finally { setDeleting(false) }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto p-6">
      {/* 头部 */}
      <div className="flex items-start gap-4 rounded-xl border bg-gradient-to-r from-muted/40 to-transparent p-4">
        <PluginIcon icon={plugin.icon} name={plugin.name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold leading-none tracking-tight">{plugin.name}</h2>
            {plugin.version && (
              <Badge variant="secondary" className="font-mono text-[10px]">v{plugin.version}</Badge>
            )}
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] uppercase tracking-wider",
                plugin.enabled
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                  : "border-muted-foreground/30 text-muted-foreground"
              )}
            >
              {plugin.enabled ? "已启用" : "已禁用"}
            </Badge>
          </div>
          {plugin.description && (
            <p className="mt-1.5 text-sm text-muted-foreground">
              {plugin.description}
            </p>
          )}
          {plugin.author && (
            <p className="mt-1 text-xs text-muted-foreground/70">
              作者：{plugin.author}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2">
            {toggling ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : (
              <Switch checked={plugin.enabled} onCheckedChange={handleToggle} />
            )}
          </label>
          <Button
            variant="ghost"
            size="sm"
            className="size-8 p-0"
            onClick={handleDelete}
            disabled={deleting}
            title="卸载插件"
          >
            {deleting
              ? <Loader2 className="size-3.5 animate-spin" />
              : <Trash2 className="size-3.5" />}
          </Button>
        </div>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: <TerminalSquare className="size-4" />, label: "事件处理器", count: plugin.handlerCount, color: "text-blue-500" },
          { icon: <BookOpen className="size-4" />, label: "指令", count: plugin.commandCount, color: "text-violet-500" },
          { icon: <Network className="size-4" />, label: "API 路由", count: plugin.routes.length, color: "text-emerald-500" },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm">
            <div className={cn("flex size-9 items-center justify-center rounded-lg bg-muted", s.color)}>
              {s.icon}
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums leading-none">{s.count}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 远程开发会话 */}
      {devSession && (
        <Card className="shrink-0 border-l-2 border-l-emerald-500/50">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
                </span>
                <CardTitle className="text-sm">远程开发</CardTitle>
              </div>
              {onDisconnectDev && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
                  disabled={disconnecting}
                  onClick={async () => {
                    setDisconnecting(true)
                    try { await onDisconnectDev(plugin.name) } finally { setDisconnecting(false) }
                  }}
                >
                  {disconnecting ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
                  断开连接
                </Button>
              )}
            </div>
            <CardDescription className="text-xs leading-relaxed">
              外部插件项目正在通过 WebSocket 实时同步构建产物
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">连接时间</span>
              <span className="font-mono tabular-nums">{new Date(devSession.connectedAt).toLocaleString("zh-CN")}</span>
            </div>
            {devSession.lastSyncAt && (
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">最近同步</span>
                <span className="font-mono tabular-nums">{new Date(devSession.lastSyncAt).toLocaleString("zh-CN")}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* API 路由 */}
      {plugin.routes.length > 0 && (
        <Card className="shrink-0">
          <CardHeader className="py-3">
            <div className="flex items-center gap-2">
              <Network className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm">API 路由</CardTitle>
            </div>
            <CardDescription className="text-xs">
              前缀：<code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">/plugins/{plugin.name}/api</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="max-h-60 space-y-1 overflow-auto rounded-md border bg-muted/30 p-2">
              {plugin.routes.map((r, i) => (
                <div key={i} className="flex items-center gap-2 rounded px-2 py-1.5 font-mono text-xs transition-colors hover:bg-muted">
                  <MethodBadge method={r.method} />
                  <span className="text-muted-foreground/60">/plugins/{plugin.name}/api</span>
                  <span className="font-medium">{r.path}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* UI iframe */}
      {plugin.hasUI && plugin.uiUrl && (
        <Card className="flex min-h-[480px] flex-1 flex-col overflow-hidden">
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 border-b py-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Globe className="size-4 text-muted-foreground" />
              操作界面
            </CardTitle>
            <a
              href={plugin.uiUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ExternalLink className="size-3" />
              新窗口打开
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
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [devSessions, setDevSessions] = useState<Map<string, { connectedAt: number; lastSyncAt?: number }>>(new Map())
  const loadRef = useRef(0)

  // 卸载弹窗状态
  const [uninstallPlugin, setUninstallPlugin] = useState<string | null>(null)
  const [uninstallTables, setUninstallTables] = useState<string[]>([])
  const [uninstallLoading, setUninstallLoading] = useState(false)
  const [uninstallTablesLoading, setUninstallTablesLoading] = useState(false)

  const loadPlugins = useCallback(async () => {
    const id = ++loadRef.current
    setLoading(true)
    setError(null)
    try {
      // 同步拉插件列表 + 开发状态
      const [r, dev] = await Promise.all([
        api.listPlugins(),
        api.getDevStatus().catch(() => ({ ok: false, sessions: [] as { pluginName: string; connectedAt: number; lastSyncAt?: number }[] })),
      ])
      if (id !== loadRef.current) return
      setPlugins(r.plugins)
      const sessionMap = new Map<string, { connectedAt: number; lastSyncAt?: number }>()
      for (const s of dev.sessions) {
        sessionMap.set(s.pluginName, { connectedAt: s.connectedAt, lastSyncAt: s.lastSyncAt })
      }
      setDevSessions(sessionMap)
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
      // 打开卸载弹窗并加载表列表
      setUninstallPlugin(name)
      setUninstallTablesLoading(true)
      try {
        const { tables } = await api.getPluginTables(name)
        setUninstallTables(tables)
      } catch {
        setUninstallTables([])
      } finally {
        setUninstallTablesLoading(false)
      }
    },
    []
  )

  const handleUninstallConfirm = useCallback(
    async (deleteData: boolean) => {
      if (!uninstallPlugin) return
      setUninstallLoading(true)
      try {
        await api.deletePlugin(uninstallPlugin, deleteData)
        setPlugins((prev) => prev?.filter((p) => p.name !== uninstallPlugin) ?? prev)
        setSelected((prev) => (prev === uninstallPlugin ? null : prev))
        setUninstallPlugin(null)
        setUninstallTables([])
        // 删除后从导航栏移除
        onPluginsChange?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setUninstallLoading(false)
      }
    },
    [uninstallPlugin, onPluginsChange]
  )

  const handleUninstallCancel = useCallback(() => {
    setUninstallPlugin(null)
    setUninstallTables([])
  }, [])

  const selectedPlugin = plugins?.find((p) => p.name === selected) ?? null

  const [uploadOpen, setUploadOpen] = useState(false)

  return (
    <div className="grid h-[calc(100vh-8rem)] min-h-0 grid-cols-[18rem_1fr] gap-5">
      {uploadOpen && (
        <UploadDialog
          onClose={() => setUploadOpen(false)}
          onSuccess={() => { setTimeout(() => { loadPlugins() }, 800) }}
        />
      )}

      {/* 卸载确认弹窗 */}
      <UninstallDialog
        open={!!uninstallPlugin}
        pluginName={uninstallPlugin ?? ""}
        tables={uninstallTables}
        loading={uninstallLoading || uninstallTablesLoading}
        onConfirm={handleUninstallConfirm}
        onCancel={handleUninstallCancel}
      />

      {/* ── 左侧插件列表 ── */}
      <Card className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">
            插件 <span className="ml-1 text-xs font-normal text-muted-foreground">({plugins?.length ?? 0})</span>
          </span>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="size-7 p-0"
              onClick={() => setUploadOpen(true)}
              title="安装插件"
            >
              <Upload className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="size-7 p-0"
              onClick={loadPlugins}
              disabled={loading}
              title="刷新"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {error && (
          <div className="mx-3 mt-3 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="size-3.5" />
            {error}
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto p-2">
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
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
                  selected === p.name
                    ? "bg-primary/8 ring-1 ring-primary/20 shadow-sm"
                    : "hover:bg-muted/70"
                )}
              >
                {selected === p.name && (
                  <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-primary" />
                )}
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
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {p.description}
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                    {p.version && <span className="font-mono">v{p.version}</span>}
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
                    {devSessions.has(p.name) && (
                      <span className="flex items-center gap-0.5 text-emerald-600">
                        <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                        开发中
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </Card>

      {/* ── 右侧详情 / iframe ── */}
      <Card className="flex min-h-0 flex-col overflow-hidden border shadow-sm">
        {selectedPlugin ? (
          <PluginDetail
            plugin={selectedPlugin}
            devSession={devSessions.get(selectedPlugin.name)}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onDisconnectDev={async (name) => {
              try {
                await api.disconnectDev(name)
                setDevSessions((prev) => {
                  const next = new Map(prev)
                  next.delete(name)
                  return next
                })
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err))
              }
            }}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
            <div className="rounded-full bg-muted p-6">
              <PlugZap className="size-10 opacity-40" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">选择一个插件</p>
              <p className="mt-1 text-xs text-muted-foreground/70">从左侧列表选择插件查看详情和配置</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

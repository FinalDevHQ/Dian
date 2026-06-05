import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Store,
  ArrowUpCircle,
} from "lucide-react"
import { api, marketApi, type MarketPlugin, type PluginPublicMeta } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

// ── 安装状态 ─────────────────────────────────────────────────────────────────

type InstallState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success" }
  | { kind: "error"; msg: string }
  | { kind: "conflict"; currentVersion: string | null }

// ── 标签语义配色 ─────────────────────────────────────────────────────────────

const TAG_COLORS: Record<string, string> = {
  UI:    "bg-violet-100/60 text-violet-600/80 border-violet-300/30",
  工具:  "bg-sky-100/60 text-sky-600/80 border-sky-300/30",
  示例:  "bg-amber-100/60 text-amber-600/80 border-amber-300/30",
  娱乐:  "bg-rose-100/60 text-rose-600/80 border-rose-300/30",
  管理:  "bg-emerald-100/60 text-emerald-600/80 border-emerald-300/30",
  系统:  "bg-slate-100/60 text-slate-600/80 border-slate-300/30",
  通知:  "bg-orange-100/60 text-orange-600/80 border-orange-300/30",
  游戏:  "bg-fuchsia-100/60 text-fuchsia-600/80 border-fuchsia-300/30",
  权限:  "bg-teal-100/60 text-teal-600/80 border-teal-300/30",
}

// 未知标签 fallback 调色板（按字符码取模）
const FALLBACK_PALETTES = [
  "bg-fuchsia-100/60 text-fuchsia-600/80 border-fuchsia-300/30",
  "bg-teal-100/60 text-teal-600/80 border-teal-300/30",
  "bg-orange-100/60 text-orange-600/80 border-orange-300/30",
  "bg-indigo-100/60 text-indigo-600/80 border-indigo-300/30",
]

function tagColor(tag: string): string {
  if (TAG_COLORS[tag]) return TAG_COLORS[tag]
  const hash = [...tag].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return FALLBACK_PALETTES[hash % FALLBACK_PALETTES.length]
}

// ── 顶部装饰色（由插件名哈希决定，每张卡片独特） ─────────────────────────────

const CARD_ACCENTS = [
  "from-violet-400 via-indigo-300 to-sky-200",
  "from-sky-400 via-cyan-300 to-teal-200",
  "from-rose-400 via-pink-300 to-fuchsia-200",
  "from-amber-400 via-orange-300 to-yellow-200",
  "from-emerald-400 via-teal-300 to-cyan-200",
  "from-indigo-400 via-purple-300 to-violet-200",
]

function cardAccent(name: string): string {
  const hash = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return CARD_ACCENTS[hash % CARD_ACCENTS.length]
}

// ── 单张插件卡片 ─────────────────────────────────────────────────────────────

function PluginCard({
  plugin,
  installed,
  onInstalled,
}: {
  plugin: MarketPlugin
  installed: PluginPublicMeta | undefined
  onInstalled: () => void
}) {
  const [state, setState] = useState<InstallState>({ kind: "idle" })

  const isInstalledUpToDate = installed?.version === plugin.version
  const needsUpdate         = !!installed && !isInstalledUpToDate
  const showInstalled       = state.kind === "success" || isInstalledUpToDate

  const doInstall = useCallback(async (force: boolean) => {
    setState({ kind: "loading" })
    try {
      const data = await marketApi.installFromUrl(plugin.downloadUrl, force)
      // 后端返回 409：插件已存在
      if (data.exists) {
        // 如果本来就是更新操作，直接以 force 重试
        if (needsUpdate) {
          const retry = await marketApi.installFromUrl(plugin.downloadUrl, true)
          if (retry.exists) throw new Error("覆盖安装失败")
          setState({ kind: "success" })
          onInstalled()
          return
        }
        // 首次安装但服务器上已有同名插件 → 让用户确认
        setState({ kind: "conflict", currentVersion: data.currentVersion ?? null })
        return
      }
      setState({ kind: "success" })
      onInstalled()
    } catch (err) {
      setState({ kind: "error", msg: err instanceof Error ? err.message : String(err) })
    }
  }, [plugin.downloadUrl, needsUpdate, onInstalled])

  const handleInstall = useCallback(() => doInstall(false), [doInstall])
  const handleForceInstall = useCallback(() => doInstall(true), [doInstall])

  const icon        = plugin.icon
  const isEmojiIcon = icon && !/^https?:\/\//.test(icon) && !icon.startsWith("/")
  const accent      = cardAccent(plugin.name)

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80",
        "shadow-sm backdrop-blur-md",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-1 hover:shadow-lg hover:shadow-gray-200/50 hover:border-gray-300/80",
        "dark:border-gray-700/60 dark:bg-gray-900/80 dark:hover:shadow-gray-900/50 dark:hover:border-gray-600/80",
      )}
    >
      {/* 顶部渐变装饰条 */}
      <div className={cn("h-0.5 w-full bg-gradient-to-r opacity-50 group-hover:opacity-80 transition-opacity duration-300", accent)} />

      {/* 卡片主体 */}
      <div className="flex flex-1 flex-col gap-3 p-4">

        {/* 图标 + 名称 + 徽章行 */}
        <div className="flex items-start gap-2.5">
          {/* 图标 */}
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg text-xl",
              "bg-gradient-to-br from-gray-50 to-gray-100 ring-1 ring-gray-200/60",
            )}
          >
            {icon ? (
              isEmojiIcon ? (
                <span role="img" aria-label={plugin.displayName}>{icon}</span>
              ) : (
                <img src={icon} alt={plugin.displayName} className="size-7 rounded object-contain" />
              )
            ) : (
              <Store className="size-5 text-muted-foreground" />
            )}
          </div>

          {/* 文字区 */}
          <div className="min-w-0 flex-1 pt-0.5">
            {/* 名称 + 版本 */}
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="truncate text-sm font-bold leading-tight tracking-tight">
                {plugin.displayName}
              </span>
              {/* 版本号 — 轻盈小字 */}
              <span className="shrink-0 font-mono text-xs text-muted-foreground/50">
                v{plugin.version}
              </span>
            </div>

            {/* 作者 + 运行时要求 */}
            <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground/70">
              <span>by {plugin.author}</span>
              {plugin.minRuntimeVersion && (
                <>
                  <span className="opacity-30">·</span>
                  <span className="text-xs opacity-50">需要 Dian ≥ {plugin.minRuntimeVersion}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* 描述 */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground cursor-default">
                {plugin.description}
              </p>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p>{plugin.description}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* 标签 */}
        {plugin.tags && plugin.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {plugin.tags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-[1px] text-xs font-medium tracking-wide",
                  tagColor(tag),
                )}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* 错误提示 */}
        {state.kind === "error" && (
          <div className="flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            <span className="leading-relaxed">{state.msg}</span>
          </div>
        )}

        {/* 覆盖安装确认 */}
        {state.kind === "conflict" && (
          <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5">
            <p className="text-xs leading-relaxed text-amber-700">
              该插件已安装{state.currentVersion ? ` (v${state.currentVersion})` : ""}，是否覆盖为 v{plugin.version}？
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-6 flex-1 rounded-full border-gray-200 text-xs"
                onClick={() => setState({ kind: "idle" })}
              >
                取消
              </Button>
              <Button
                size="sm"
                className="h-6 flex-1 rounded-full bg-amber-400 text-xs text-white hover:bg-amber-500"
                onClick={() => void handleForceInstall()}
              >
                覆盖安装
              </Button>
            </div>
          </div>
        )}

        {/* 底部操作栏 */}
        <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3.5">
          {/* 主页链接 */}
          {plugin.homepage ? (
            <a
              href={plugin.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-1.5 text-xs text-gray-400",
                "transition-colors hover:text-gray-700",
              )}
            >
              <ExternalLink className="size-3.5" />
              主页
            </a>
          ) : (
            <span />
          )}

          {/* 安装 / 状态按钮 */}
          {state.kind === "loading" ? (
            <Button size="sm" disabled className="h-7 gap-1.5 rounded-full bg-gray-100 px-4 text-xs text-gray-400">
              <Loader2 className="size-3.5 animate-spin" />
              安装中…
            </Button>
          ) : showInstalled ? (
            // 已安装 — 内敛低调
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                "text-emerald-500/60",
              )}
            >
              <CheckCircle2 className="size-3.5" />
              已安装
            </span>
          ) : needsUpdate ? (
            <Button
              size="sm"
              className="h-7 gap-1.5 rounded-full bg-gradient-to-r from-pink-400 to-violet-400 px-4 text-xs text-white hover:from-pink-500 hover:to-violet-500"
              onClick={() => void handleInstall()}
            >
              <ArrowUpCircle className="size-3.5" />
              更新 → v{plugin.version}
            </Button>
          ) : state.kind === "conflict" ? (
            <span />
          ) : (
            <Button
              size="sm"
              onClick={() => void handleInstall()}
              variant={state.kind === "error" ? "outline" : "default"}
              className={cn(
                "h-7 rounded-full px-4 text-xs",
                state.kind === "error"
                  ? "border-red-300 text-red-500 hover:bg-red-50"
                  : "bg-gray-900 text-white hover:bg-gray-800",
              )}
            >
              {state.kind === "error" ? "重试" : "安装"}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 主页面 ───────────────────────────────────────────────────────────────────

interface MarketPageProps {
  onPluginsChange?: () => void
}

export function MarketPage({ onPluginsChange }: MarketPageProps) {
  const [marketPlugins, setMarketPlugins] = useState<MarketPlugin[]>([])
  const [installed, setInstalled]         = useState<PluginPublicMeta[]>([])
  const [updatedAt, setUpdatedAt]         = useState<string>("")
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState<string | null>(null)
  const [search, setSearch]               = useState("")
  const [activeTag, setActiveTag]         = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const initialLoadDone = useRef(false)

  // ── Ctrl+K / ⌘K 聚焦搜索框 ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  // ── 拉取数据 ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [index, { plugins: inst }] = await Promise.all([
        marketApi.fetchIndex(),
        api.listPlugins(),
      ])
      setMarketPlugins(index.plugins)
      setUpdatedAt(index.updatedAt)
      setInstalled(inst)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true
    void load()
  }, [load])

  // ── 安装成功后刷新已安装列表 + 触发侧边栏更新 ────────────────────────
  const handleInstalled = useCallback(async () => {
    try {
      const { plugins: inst } = await api.listPlugins()
      setInstalled(inst)
    } catch { /* ignore */ }
    onPluginsChange?.()
  }, [onPluginsChange])

  // ── 所有标签（去重）────────────────────────────────────────────────────
  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const p of marketPlugins) {
      for (const t of p.tags ?? []) set.add(t)
    }
    return [...set]
  }, [marketPlugins])

  // ── 过滤后的插件 ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return marketPlugins.filter((p) => {
      if (activeTag && !(p.tags ?? []).includes(activeTag)) return false
      if (!q) return true
      return (
        p.displayName.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q) ||
        (p.tags ?? []).some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [marketPlugins, search, activeTag])

  // ── installed 查找辅助 ────────────────────────────────────────────────
  const installedMap = useMemo(
    () => new Map(installed.map((p) => [p.name, p])),
    [installed]
  )

  // ── 加载态 ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-28 text-muted-foreground">
        <Loader2 className="size-7 animate-spin" />
        <p className="text-sm">正在拉取插件市场…</p>
      </div>
    )
  }

  // ── 错误态 ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-28">
        <AlertCircle className="size-8 text-destructive/60" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-1.5 size-3.5" />
          重试
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">

      {/* ── 搜索 + 刷新 ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {/* 搜索框 */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
          <input
            ref={searchRef}
            type="text"
            placeholder="搜索插件名、作者、标签…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "h-9 w-full rounded-lg border border-gray-200 bg-white pr-16 pl-9",
              "text-sm outline-none placeholder:text-gray-400",
              "focus:border-violet-300 focus:ring-2 focus:ring-violet-200/50 transition-all duration-200",
            )}
          />
          {/* Ctrl+K 提示 */}
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            <kbd className="inline-flex h-5 items-center rounded border border-gray-200 bg-gray-50 px-1 font-mono text-xs text-gray-400">
              Ctrl
            </kbd>
            <kbd className="inline-flex h-5 items-center rounded border border-gray-200 bg-gray-50 px-1 font-mono text-xs text-gray-400">
              K
            </kbd>
          </div>
        </div>

        {/* 更新时间 + 刷新 */}
        <div className="flex items-center gap-2 ml-auto">
          {updatedAt && (
            <span className="hidden text-xs text-muted-foreground/60 sm:inline">
              更新于 {updatedAt}
            </span>
          )}
          <button
            onClick={() => void load()}
            title="刷新"
            className="flex size-9 items-center justify-center cursor-pointer rounded-lg border border-gray-200 bg-white text-gray-400 transition-all duration-200 hover:border-gray-300 hover:text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200 dark:hover:bg-gray-700"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>

      {/* ── 标签筛选 Pills ─────────────────────────────────────────────── */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {/* 全部 */}
          <button
            onClick={() => setActiveTag(null)}
            className={cn(
              "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium tracking-wide transition-all duration-200",
              activeTag === null
                ? "border-violet-300/50 bg-violet-100/80 text-violet-700 shadow-sm shadow-violet-200/50"
                : "border-gray-200/80 bg-white/50 text-gray-500 hover:border-gray-300 hover:text-gray-700",
            )}
          >
            全部
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium tracking-wide transition-all duration-200",
                activeTag === tag
                  ? "border-violet-300/50 bg-violet-100/80 text-violet-700 shadow-sm shadow-violet-200/50"
                  : "border-gray-200/80 bg-white/50 text-gray-500 hover:border-gray-300 hover:text-gray-700",
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* ── 数量提示 ───────────────────────────────────────────────────── */}
      <p className="text-xs text-muted-foreground/70">
        共 {filtered.length} 个插件
        {(search || activeTag) && `，已从 ${marketPlugins.length} 个中筛选`}
      </p>

      {/* ── 插件卡片网格 ────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <Store className="size-8 opacity-30" />
          <p className="text-sm">没有找到匹配的插件</p>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((plugin) => (
            <PluginCard
              key={plugin.name}
              plugin={plugin}
              installed={installedMap.get(plugin.name)}
              onInstalled={handleInstalled}
            />
          ))}
        </div>
      )}
    </div>
  )
}

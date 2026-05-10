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
import { cn } from "@/lib/utils"

// ── 安装状态 ─────────────────────────────────────────────────────────────────

type InstallState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success" }
  | { kind: "error"; msg: string }

// ── 标签语义配色 ─────────────────────────────────────────────────────────────

const TAG_COLORS: Record<string, string> = {
  UI:    "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800",
  工具:  "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800",
  示例:  "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  娱乐:  "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800",
  管理:  "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
}

// 未知标签 fallback 调色板（按字符码取模）
const FALLBACK_PALETTES = [
  "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950 dark:text-fuchsia-300 dark:border-fuchsia-800",
  "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800",
  "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
  "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800",
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

  const handleInstall = useCallback(async () => {
    setState({ kind: "loading" })
    try {
      await marketApi.installFromUrl(plugin.downloadUrl)
      setState({ kind: "success" })
      onInstalled()
    } catch (err) {
      setState({ kind: "error", msg: err instanceof Error ? err.message : String(err) })
    }
  }, [plugin.downloadUrl, onInstalled])

  const icon        = plugin.icon
  const isEmojiIcon = icon && !/^https?:\/\//.test(icon) && !icon.startsWith("/")
  const accent      = cardAccent(plugin.name)

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-card/80",
        "shadow-sm backdrop-blur-sm",
        "transition-all duration-200 ease-out",
        "hover:-translate-y-1 hover:shadow-xl hover:border-foreground/20",
      )}
    >
      {/* 顶部渐变装饰条 */}
      <div className={cn("h-1 w-full bg-gradient-to-r opacity-80", accent)} />

      {/* 卡片主体 */}
      <div className="flex flex-1 flex-col gap-4 p-5">

        {/* 图标 + 名称 + 徽章行 */}
        <div className="flex items-start gap-3.5">
          {/* 图标 */}
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl text-2xl",
              "bg-gradient-to-br from-muted to-muted/60 shadow-inner ring-1 ring-border/60",
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-[15px] font-semibold leading-tight tracking-tight">
                {plugin.displayName}
              </span>
              {/* 精致版本号 — 深色小胶囊 */}
              <span className="shrink-0 rounded-md bg-foreground/8 px-1.5 py-0.5 font-mono text-[10px] font-medium text-foreground/60 ring-1 ring-border/50">
                v{plugin.version}
              </span>
            </div>

            {/* 作者 + 运行时要求 */}
            <p className="mt-1 flex items-center gap-1 truncate text-[12px] text-muted-foreground">
              <span>by {plugin.author}</span>
              {plugin.minRuntimeVersion && (
                <>
                  <span className="opacity-40">·</span>
                  <span className="opacity-60">需要 Dian ≥ {plugin.minRuntimeVersion}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* 描述 */}
        <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
          {plugin.description}
        </p>

        {/* 标签 */}
        {plugin.tags && plugin.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {plugin.tags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
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
          <div className="flex items-start gap-1.5 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            <span className="leading-relaxed">{state.msg}</span>
          </div>
        )}

        {/* 底部操作栏 */}
        <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-3.5">
          {/* 主页链接 */}
          {plugin.homepage ? (
            <a
              href={plugin.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-1.5 text-[12px] text-muted-foreground/70",
                "transition-colors hover:text-foreground",
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
            <Button size="sm" disabled className="h-7 gap-1.5 px-3 text-xs">
              <Loader2 className="size-3.5 animate-spin" />
              安装中…
            </Button>
          ) : showInstalled ? (
            // 已安装 — 绿色标识，更突出
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium",
                "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
                "dark:bg-emerald-950 dark:text-emerald-400 dark:ring-emerald-800",
              )}
            >
              <CheckCircle2 className="size-3.5" />
              已安装
            </span>
          ) : needsUpdate ? (
            <Button
              size="sm"
              className="h-7 gap-1.5 bg-amber-500 px-3 text-xs text-white hover:bg-amber-600"
              onClick={() => void handleInstall()}
            >
              <ArrowUpCircle className="size-3.5" />
              更新 → v{plugin.version}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => void handleInstall()}
              variant={state.kind === "error" ? "outline" : "default"}
              className={cn(
                "h-7 px-4 text-xs",
                state.kind === "error" && "border-destructive/40 text-destructive hover:bg-destructive/5",
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

  useEffect(() => { void load() }, [load])

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
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchRef}
            type="text"
            placeholder="搜索插件名、作者、标签…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "h-9 w-full rounded-lg border border-input bg-background pr-16 pl-9",
              "text-sm outline-none ring-offset-background placeholder:text-muted-foreground",
              "focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-shadow",
            )}
          />
          {/* Ctrl+K 提示 */}
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            <kbd className="inline-flex h-5 items-center rounded border bg-muted px-1 font-mono text-[10px] text-muted-foreground">
              Ctrl
            </kbd>
            <kbd className="inline-flex h-5 items-center rounded border bg-muted px-1 font-mono text-[10px] text-muted-foreground">
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
            className="flex size-9 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
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
              "rounded-full border px-3.5 py-1 text-[12px] font-medium transition-all duration-150",
              activeTag === null
                ? "border-violet-400 bg-violet-500 text-white shadow-sm shadow-violet-200 dark:shadow-violet-900"
                : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            全部
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={cn(
                "rounded-full border px-3.5 py-1 text-[12px] font-medium transition-all duration-150",
                activeTag === tag
                  ? "border-violet-400 bg-violet-500 text-white shadow-sm shadow-violet-200 dark:shadow-violet-900"
                  : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* ── 数量提示 ───────────────────────────────────────────────────── */}
      <p className="text-[12px] text-muted-foreground/70">
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

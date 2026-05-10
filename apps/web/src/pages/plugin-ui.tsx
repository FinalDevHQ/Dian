import { ExternalLink, Puzzle } from "lucide-react"

export interface PluginNavItem {
  /** "plugin:NAME" */
  key: string
  name: string
  /** 显示名（name 的别名，供外部统一使用） */
  label: string
  /** emoji 或图片 URL */
  icon?: string
  uiUrl: string
  description?: string
  version?: string
}

export function PluginUiPage({ plugin }: { plugin: PluginNavItem }) {
  const { name, label, icon, uiUrl, description, version } = plugin
  const isImgIcon = icon?.startsWith("http") || icon?.startsWith("/")

  return (
    <div className="flex h-full flex-col">
      {/* ── 顶部信息栏 ── */}
      <div className="flex shrink-0 items-center gap-3 border-b bg-background px-5 py-3">
        {/* 插件图标 */}
        {icon ? (
          isImgIcon ? (
            <img src={icon} alt={name} className="size-7 rounded-md border object-cover" />
          ) : (
            <span className="text-xl leading-none">{icon}</span>
          )
        ) : (
          <Puzzle className="size-5 text-muted-foreground" />
        )}

        {/* 名称 + 元信息 */}
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="text-sm font-semibold">{label}</span>
          {version && (
            <span className="text-xs text-muted-foreground">v{version}</span>
          )}
          {description && (
            <span className="truncate text-xs text-muted-foreground">
              · {description}
            </span>
          )}
        </div>

        {/* 新窗口按钮 */}
        <a
          href={uiUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ExternalLink className="size-3.5" />
          新窗口
        </a>
      </div>

      {/* ── 插件 iframe（占满剩余高度） ── */}
      <iframe
        src={uiUrl}
        title={`${label} UI`}
        className="min-h-0 flex-1 border-0 w-full"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  )
}

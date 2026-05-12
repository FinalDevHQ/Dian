import { useCallback, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { navGroups } from "@/components/layout/nav-config"
import { AnalyticsPage } from "@/pages/analytics"
import { BotManagePage } from "@/pages/bot-manage"
import { ConfigFilesPage } from "@/pages/config-files"
import { DashboardPage } from "@/pages/dashboard"
import { DatabasePage } from "@/pages/database"
import { LogsPage } from "@/pages/logs"
import { PluginsPage } from "@/pages/plugins"
import { PlaceholderPage } from "@/pages/placeholder"
import { PluginUiPage, type PluginNavItem } from "@/pages/plugin-ui"
import { MarketPage } from "@/pages/market"
import { MessagesPage } from "@/pages/messages"
import { LoginPage } from "@/pages/login"
import { AuthProvider, useAuth } from "@/contexts/auth-context"
import { api } from "@/lib/api"

/** 从 URL hash 读取初始页，fallback 到 dashboard */
function getHashPage(): string {
  const hash = window.location.hash.slice(1) // 去掉 '#'
  return hash || "dashboard"
}

function AppContent() {
  const { isAuthenticated, needAuth, loading, login } = useAuth()

  // 正在检查认证状态时显示加载
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    )
  }

  // 需要认证但未登录时显示登录页
  if (needAuth && !isAuthenticated) {
    return <LoginPage onLogin={login} />
  }

  return <MainApp />
}

function MainApp() {
  const { logout } = useAuth()
  const [active, setActive] = useState(getHashPage)

  // 当 active 变化时同步到 hash
  useEffect(() => {
    const hash = `#${active}`
    if (window.location.hash !== hash) {
      window.history.pushState(null, "", hash)
    }
  }, [active])

  // 监听浏览器前进/后退
  useEffect(() => {
    const onPopState = () => { setActive(getHashPage()) }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  // ── 插件导航条目（已启用 + 有 UI）────────────────────────────────────────
  const [pluginNavItems, setPluginNavItems] = useState<PluginNavItem[]>([])

  const refreshPlugins = useCallback(async () => {
    try {
      const { plugins } = await api.listPlugins()
      const items: PluginNavItem[] = plugins
        .filter((p) => p.enabled && p.hasUI && p.uiUrl)
        .map((p) => ({
          key:         `plugin:${p.name}`,
          name:        p.name,
          label:       p.name,
          icon:        p.icon,
          uiUrl:       p.uiUrl!,
          description: p.description,
          version:     p.version,
        }))
      setPluginNavItems(items)

      // 如果当前正停留在一个已被移除的插件页，跳回仪表盘
      setActive((prev) => {
        if (prev.startsWith("plugin:")) {
          const stillExists = items.some((it) => it.key === prev)
          return stillExists ? prev : "dashboard"
        }
        return prev
      })
    } catch {
      // 拉取失败时保持现状
    }
  }, [])

  useEffect(() => { void refreshPlugins() }, [refreshPlugins])

  // ── 当前页标题 ───────────────────────────────────────────────────────────
  const title = useMemo(() => {
    if (active.startsWith("plugin:")) {
      const hit = pluginNavItems.find((it) => it.key === active)
      return hit?.label ?? active.slice(7)
    }
    for (const g of navGroups) {
      const hit = g.items.find((i) => i.key === active)
      if (hit) return hit.label
    }
    return "Dian"
  }, [active, pluginNavItems])

  // ── 当前插件页对象 ────────────────────────────────────────────────────────
  const activePlugin = useMemo(
    () => active.startsWith("plugin:") ? pluginNavItems.find((it) => it.key === active) ?? null : null,
    [active, pluginNavItems]
  )

  // ── 页面路由映射 ──────────────────────────────────────────────────────────
  const pages: Record<string, ReactNode> = useMemo(() => ({
    dashboard: <DashboardPage />,
    bots:      <BotManagePage />,
    logs:      <LogsPage />,
    plugins:   <PluginsPage onPluginsChange={refreshPlugins} />,
    database:  <DatabasePage />,
    config:    <ConfigFilesPage />,
    analytics: <AnalyticsPage />,
    messages:  <MessagesPage />,
    market:    <MarketPage onPluginsChange={refreshPlugins} />,
  }), [refreshPlugins])

  const content = activePlugin
    ? <PluginUiPage plugin={activePlugin} />
    : pages[active] ?? <PlaceholderPage title={title} />

  return (
    <AppLayout
      active={active}
      onNavigate={setActive}
      title={title}
      pluginNavItems={pluginNavItems}
      bare={activePlugin !== null}
      onLogout={logout}
    >
      {content}
    </AppLayout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

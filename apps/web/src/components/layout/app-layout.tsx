import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { LogOut } from "lucide-react"
import { useBotScope } from "@/contexts/bot-scope-context"
import { BotScopeProvider } from "@/contexts/bot-scope"
import { AppSidebar } from "./app-sidebar"
import type { PluginNavItem } from "@/pages/plugin-ui"

interface AppLayoutProps {
  active: string
  onNavigate: (key: string) => void
  title: string
  actions?: ReactNode
  children: ReactNode
  pluginNavItems?: PluginNavItem[]
  /**
   * bare=true 时内容区无内边距、overflow-hidden（给 iframe 全屏页用）
   */
  bare?: boolean
  /** 登出回调 */
  onLogout?: () => void
}

function ScopeBadge() {
  const { scope } = useBotScope()
  if (scope === "all") {
    return <Badge variant="secondary">全部机器人</Badge>
  }
  return (
    <Badge variant="default" className="font-mono">
      {scope}
    </Badge>
  )
}

export function AppLayout({
  active,
  onNavigate,
  title,
  actions,
  children,
  pluginNavItems,
  bare = false,
  onLogout,
}: AppLayoutProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <BotScopeProvider>
        <SidebarProvider>
          <AppSidebar
            active={active}
            onNavigate={onNavigate}
            pluginNavItems={pluginNavItems}
          />
          <SidebarInset>
            <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
              <SidebarTrigger />
              <Separator orientation="vertical" className="mr-1 h-5" />
              <h1 className="text-base font-semibold">{title}</h1>
              <ScopeBadge />
              <div className="ml-auto flex items-center gap-2">
                {actions}
                {onLogout && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onLogout}
                    title="退出登录"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </header>
            {bare ? (
              // 插件 iframe 全高，无内边距，overflow-hidden 防滚动条
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {children}
              </div>
            ) : (
              <div className="flex-1 p-6">{children}</div>
            )}
          </SidebarInset>
        </SidebarProvider>
      </BotScopeProvider>
    </TooltipProvider>
  )
}

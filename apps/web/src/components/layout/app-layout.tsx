import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useBotScope } from "@/contexts/bot-scope-context"
import { BotScopeProvider } from "@/contexts/bot-scope"
import { AppSidebar } from "./app-sidebar"

interface AppLayoutProps {
  active: string
  onNavigate: (key: string) => void
  title: string
  actions?: ReactNode
  children: ReactNode
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
}: AppLayoutProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <BotScopeProvider>
        <SidebarProvider>
          <AppSidebar active={active} onNavigate={onNavigate} />
          <SidebarInset>
            <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
              <SidebarTrigger />
              <Separator orientation="vertical" className="mr-1 h-5" />
              <h1 className="text-base font-semibold">{title}</h1>
              <ScopeBadge />
              <div className="ml-auto flex items-center gap-2">{actions}</div>
            </header>
            <div className="flex-1 p-6">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </BotScopeProvider>
    </TooltipProvider>
  )
}

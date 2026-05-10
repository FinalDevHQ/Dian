import { Check, ChevronsUpDown, Puzzle, RefreshCw } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useBotScope } from "@/contexts/bot-scope-context"
import { navGroups } from "./nav-config"
import type { PluginNavItem } from "@/pages/plugin-ui"

interface AppSidebarProps {
  active: string
  onNavigate: (key: string) => void
  /** 已启用且有 UI 的插件，动态追加到"扩展页面"组 */
  pluginNavItems?: PluginNavItem[]
}

function BotScopeSwitcher() {
  const { scope, setScope, bots, loadingBots, botsError, refreshBots } =
    useBotScope()

  const label = scope === "all" ? "全部机器人" : scope
  const dotColor = botsError ? "bg-destructive" : "bg-emerald-500"

  return (
    <DropdownMenu onOpenChange={(open) => open && refreshBots()}>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="group-data-[collapsible=icon]:hidden"
        >
          <span
            className={`flex size-2 shrink-0 rounded-full ${dotColor}`}
            aria-hidden
          />
          <span className="flex-1 truncate text-left text-sm">{label}</span>
          <ChevronsUpDown className="ml-auto size-4 opacity-60" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56"
      >
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>选择作用域</span>
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              refreshBots()
            }}
            disabled={loadingBots}
            aria-label="刷新机器人列表"
          >
            <RefreshCw
              className={`size-3 ${loadingBots ? "animate-spin" : ""}`}
            />
          </button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setScope("all")}>
          <Check
            className={`size-4 ${scope === "all" ? "opacity-100" : "opacity-0"}`}
            aria-hidden
          />
          <span className="flex-1">全部机器人</span>
          <span className="text-xs text-muted-foreground">{bots.length}</span>
        </DropdownMenuItem>
        {bots.length > 0 && <DropdownMenuSeparator />}
        {bots.map((b) => (
          <DropdownMenuItem
            key={b.botId}
            onClick={() => setScope(b.botId)}
          >
            <Check
              className={`size-4 ${scope === b.botId ? "opacity-100" : "opacity-0"}`}
              aria-hidden
            />
            <span className="flex-1 truncate font-mono text-xs">
              {b.botId}
            </span>
          </DropdownMenuItem>
        ))}
        {botsError && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-destructive">
              加载失败：{botsError}
            </div>
          </>
        )}
        {!botsError && bots.length === 0 && !loadingBots && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              暂无在线机器人
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** 插件图标：emoji / 图片 URL / 默认 Puzzle */
function PluginNavIcon({ icon }: { icon?: string }) {
  if (!icon) return <Puzzle className="size-4" />
  const isImg = icon.startsWith("http") || icon.startsWith("/")
  if (isImg) {
    return (
      <img
        src={icon}
        alt=""
        className="size-4 rounded object-cover"
      />
    )
  }
  // emoji / 文字图标
  return <span className="text-base leading-none">{icon}</span>
}

export function AppSidebar({ active, onNavigate, pluginNavItems = [] }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3">
        <div className="flex items-center gap-2 px-1 py-1">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-sm font-semibold">D</span>
          </div>
          <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-semibold">Dian</span>
            <span className="truncate text-xs text-muted-foreground">
              OneBot 框架
            </span>
          </div>
        </div>

        <BotScopeSwitcher />
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group, gi) => {
          const isExtGroup = group.label === "扩展页面"
          // 扩展页面组：无静态项且无插件时整组隐藏
          if (isExtGroup && group.items.length === 0 && pluginNavItems.length === 0) return null
          return (
            <SidebarGroup key={group.label ?? `g-${gi}`}>
              {group.label && (
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {/* 静态导航项 */}
                  {group.items.map((item) => {
                    const Icon = item.icon
                    return (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton
                          tooltip={item.label}
                          isActive={active === item.key}
                          onClick={() => onNavigate(item.key)}
                        >
                          <Icon />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}

                  {/* 动态插件项（只在"扩展页面"组追加） */}
                  {isExtGroup && pluginNavItems.map((plugin) => (
                    <SidebarMenuItem key={plugin.key}>
                      <SidebarMenuButton
                        tooltip={plugin.label}
                        isActive={active === plugin.key}
                        onClick={() => onNavigate(plugin.key)}
                        className="gap-2"
                      >
                        <PluginNavIcon icon={plugin.icon} />
                        <span className="truncate">{plugin.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

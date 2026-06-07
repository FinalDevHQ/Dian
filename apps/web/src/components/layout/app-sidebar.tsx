import { Puzzle } from "lucide-react"
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
  SidebarFooter,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { navGroups } from "./nav-config"
import type { PluginNavItem } from "@/pages/plugin-ui"

interface AppSidebarProps {
  active: string
  onNavigate: (key: string) => void
  pluginNavItems?: PluginNavItem[]
}

function PluginNavIcon({ icon }: { icon?: string }) {
  if (!icon) return <Puzzle className="size-4" strokeWidth={1.5} />
  const isImg = icon.startsWith("http") || icon.startsWith("/")
  if (isImg) {
    return <img src={icon} alt="" className="size-4 rounded-sm object-cover opacity-70" />
  }
  return <span className="text-base leading-none opacity-70">{icon}</span>
}

export function AppSidebar({ active, onNavigate, pluginNavItems = [] }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3 pb-1">
        <div className="flex items-center gap-2.5 px-1 py-1.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-400 via-violet-400 to-indigo-400 text-white shadow-md shadow-violet-400/20">
            <span className="text-sm font-bold">D</span>
          </div>
          <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-bold tracking-tight text-gray-800 dark:text-gray-100">
              Dian
            </span>
            <span className="truncate text-xs font-medium tracking-wider text-gray-400 dark:text-gray-500">
              OneBot Framework
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-1">
        {navGroups.map((group, gi) => {
          const isExtGroup = group.label === "扩展页面"
          if (isExtGroup && group.items.length === 0 && pluginNavItems.length === 0) return null
          return (
            <SidebarGroup key={group.label ?? `g-${gi}`} className="py-1">
              {group.label && (
                <SidebarGroupLabel className="mt-2 px-2 text-xs font-semibold uppercase tracking-[0.1em] text-gray-400/70">
                  {group.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const isActive = active === item.key
                    return (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton
                          tooltip={item.label}
                          isActive={isActive}
                          onClick={() => onNavigate(item.key)}
                          className={cn(
                            "group/item relative gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-all duration-200",
                            isActive
                              ? "!bg-violet-50/80 !text-violet-700 shadow-sm shadow-violet-100/50 dark:!bg-violet-900/30 dark:!text-violet-300 dark:shadow-violet-900/20"
                              : "text-gray-500 hover:bg-gray-50/80 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-gray-200",
                          )}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 size-1 rounded-full bg-violet-400 opacity-80 dark:bg-violet-500" />
                          )}
                          <Icon
                            strokeWidth={isActive ? 1.8 : 1.5}
                            className={cn(
                              "transition-colors duration-200",
                              isActive ? "text-violet-500" : "text-gray-400 group-hover/item:text-gray-500",
                            )}
                          />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}

                  {isExtGroup && pluginNavItems.map((plugin) => (
                    <SidebarMenuItem key={plugin.key}>
                      <SidebarMenuButton
                        tooltip={plugin.label}
                        isActive={active === plugin.key}
                        onClick={() => onNavigate(plugin.key)}
                        className={cn(
                          "group/item relative gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-all duration-200",
                          active === plugin.key
                            ? "!bg-violet-50/80 !text-violet-700 shadow-sm shadow-violet-100/50 dark:!bg-violet-900/30 dark:!text-violet-300 dark:shadow-violet-900/20"
                            : "text-gray-500 hover:bg-gray-50/80 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-gray-200",
                        )}
                      >
                        {active === plugin.key && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 size-1 rounded-full bg-violet-400 opacity-80 dark:bg-violet-500" />
                        )}
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

      <SidebarFooter className="mt-auto border-t border-gray-200/40 dark:border-gray-700/40 py-3 group-data-[collapsible=icon]:hidden">
        <div className="flex flex-col gap-0.5 px-2">
          <a
            href="https://github.com/FinalDevHQ/Dian"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs text-gray-400 transition-all duration-200 hover:bg-gray-50/80 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800/50 dark:hover:text-gray-300"
          >
            <svg viewBox="0 0 24 24" className="size-4 shrink-0 opacity-50" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            <span className="font-medium">GitHub</span>
          </a>
          <a
            href="http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=wVN1MdMGWhIqrw8KJL6xXvwQc9FHd8D6&authKey=H3pqqcY2rIiPpLGa%2BaoeAbHEzTR5vRXpSh1rYG795FJiTPzF9iDGPGLxHZ1aVplv&noverify=0&group_code=1072957415"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs text-gray-400 transition-all duration-200 hover:bg-gray-50/80 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800/50 dark:hover:text-gray-300"
          >
            <svg viewBox="0 0 24 24" className="size-4 shrink-0 opacity-50" fill="currentColor">
              <path d="M21.395 15.035a39.548 39.548 0 0 0-1.277-3.407c.196-.734.268-1.543.268-2.378 0-4.768-3.976-8.635-8.878-8.635H6.484C1.608 0.615-2.368 4.482-2.368 9.25c0 2.383.965 4.546 2.527 6.164a39.548 39.548 0 0 0-1.277 3.407c-.236.891-.47 1.712-.47 2.378 0 1.176 1.466 2.128 3.274 2.128 1.541 0 2.813-.646 3.479-1.175.724.236 1.537.415 2.435.415.898 0 1.711-.179 2.435-.415.666.529 1.938 1.175 3.479 1.175 1.808 0 3.274-.952 3.274-2.128 0-.666-.234-1.487-.47-2.378zM8.327 6.97c-.72 0-1.304-.584-1.304-1.304S7.607 4.362 8.327 4.362s1.304.584 1.304 1.304-.584 1.304-1.304 1.304zm7.346 0c-.72 0-1.304-.584-1.304-1.304s.584-1.304 1.304-1.304 1.304.584 1.304 1.304-.584 1.304-1.304 1.304z"/>
            </svg>
            <span className="font-medium">加入 QQ 群</span>
          </a>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

import {
  BarChart3,
  Blocks,
  Database,
  Download,
  FileText,
  Globe,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Store,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface NavItem {
  key: string
  label: string
  icon: LucideIcon
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    items: [
      { key: "dashboard", label: "仪表盘", icon: LayoutDashboard },
      { key: "logs", label: "全局日志", icon: FileText },
      { key: "plugins", label: "插件模块", icon: Blocks },
      { key: "database", label: "数据库", icon: Database },
      { key: "platform", label: "开放平台", icon: Globe },
      { key: "messages", label: "消息记录", icon: MessageSquare },
      { key: "analytics", label: "可视化", icon: BarChart3 },
      { key: "market", label: "插件市场", icon: Store },
      { key: "config", label: "框架配置", icon: Settings },
      { key: "update", label: "框架更新", icon: Download },
    ],
  },
  {
    label: "扩展页面",
    items: [],
  },
]

import { createContext, useContext } from "react"
import type { BotInfo } from "@/lib/api"

export type BotScope = "all" | string

export interface BotScopeContextValue {
  /** 当前作用域：'all' 表示全部机器人，否则为 botId */
  scope: BotScope
  /** 切换作用域 */
  setScope: (scope: BotScope) => void
  /** 从 /status 拉取的 bot 列表 */
  bots: BotInfo[]
  /** 列表是否正在加载 */
  loadingBots: boolean
  /** 拉取错误（若有） */
  botsError: string | null
  /** 手动刷新 bot 列表 */
  refreshBots: () => Promise<void>
}

export const BotScopeContext = createContext<BotScopeContextValue | null>(null)

export function useBotScope(): BotScopeContextValue {
  const ctx = useContext(BotScopeContext)
  if (!ctx) {
    throw new Error("useBotScope must be used within <BotScopeProvider>")
  }
  return ctx
}

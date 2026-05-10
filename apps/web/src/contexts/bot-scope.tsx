import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { api, type BotInfo } from "@/lib/api"
import {
  BotScopeContext,
  type BotScope,
  type BotScopeContextValue,
} from "./bot-scope-context"

export function BotScopeProvider({ children }: { children: ReactNode }) {
  const [scope, setScope] = useState<BotScope>("all")
  const [bots, setBots] = useState<BotInfo[]>([])
  const [loadingBots, setLoadingBots] = useState(false)
  const [botsError, setBotsError] = useState<string | null>(null)

  const refreshBots = useCallback(async () => {
    setLoadingBots(true)
    setBotsError(null)
    try {
      const r = await api.status()
      setBots(r.bots)
      // 若当前选中的 bot 已不存在，回退到 "all"
      setScope((prev) =>
        prev === "all" || r.bots.some((b: BotInfo) => b.botId === prev)
          ? prev
          : "all"
      )
    } catch (err) {
      setBotsError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingBots(false)
    }
  }, [])

  useEffect(() => {
    const t = window.setTimeout(refreshBots, 0)
    return () => window.clearTimeout(t)
  }, [refreshBots])

  const value = useMemo<BotScopeContextValue>(
    () => ({ scope, setScope, bots, loadingBots, botsError, refreshBots }),
    [scope, bots, loadingBots, botsError, refreshBots]
  )

  return (
    <BotScopeContext.Provider value={value}>
      {children}
    </BotScopeContext.Provider>
  )
}

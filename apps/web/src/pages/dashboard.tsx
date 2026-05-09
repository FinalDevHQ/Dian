import { useCallback, useEffect, useMemo, useState } from "react"
import { Activity, Bot, CheckCircle2, RefreshCw, XCircle } from "lucide-react"
import { api, type BotInfo, type HealthResponse } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useBotScope } from "@/contexts/bot-scope-context"

const POLL_INTERVAL = 5000

function formatTs(ts: number): string {
  return new Date(ts).toLocaleString()
}

export function DashboardPage() {
  const { scope } = useBotScope()
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [bots, setBots] = useState<BotInfo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  const visibleBots = useMemo(() => {
    if (!bots) return null
    if (scope === "all") return bots
    return bots.filter((b) => b.botId === scope)
  }, [bots, scope])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [h, s] = await Promise.all([api.health(), api.status()])
      setHealth(h)
      setBots(s.bots)
      setLastUpdated(Date.now())
    } catch (err) {
      setHealth(null)
      setBots(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // 首次加载放入微任务，避免 effect 中同步 setState 触发级联渲染告警
    const t = window.setTimeout(refresh, 0)
    const id = window.setInterval(refresh, POLL_INTERVAL)
    return () => {
      window.clearTimeout(t)
      window.clearInterval(id)
    }
  }, [refresh])

  const online = health?.status === "ok"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          连接到 <code className="font-mono">/api</code>（dev 代理 →
          <span className="ml-1 font-mono">localhost:3000</span>）
        </p>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              更新于 {formatTs(lastUpdated)}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw
              className={loading ? "animate-spin" : undefined}
              aria-hidden
            />
            刷新
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <XCircle className="size-4 text-destructive" aria-hidden />
            <CardTitle className="text-destructive">无法连接到服务器</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              请确认 <code className="font-mono">apps/server</code> 已启动
              （默认监听 <code className="font-mono">:3000</code>）。
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-muted-foreground" aria-hidden />
                <CardTitle>服务器状态</CardTitle>
              </div>
              {health ? (
                <Badge variant={online ? "default" : "destructive"}>
                  {online ? (
                    <CheckCircle2 className="size-3" aria-hidden />
                  ) : (
                    <XCircle className="size-3" aria-hidden />
                  )}
                  {online ? "在线" : "异常"}
                </Badge>
              ) : loading ? (
                <Skeleton className="h-5 w-14" />
              ) : (
                <Badge variant="destructive">离线</Badge>
              )}
            </div>
            <CardDescription>GET /health</CardDescription>
          </CardHeader>
          <CardContent>
            {health ? (
              <dl className="grid grid-cols-[6rem_1fr] gap-y-2 text-sm">
                <dt className="text-muted-foreground">status</dt>
                <dd className="font-mono">{health.status}</dd>
                <dt className="text-muted-foreground">ts</dt>
                <dd className="font-mono">{formatTs(health.ts)}</dd>
              </dl>
            ) : loading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">暂无数据</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="size-4 text-muted-foreground" aria-hidden />
                <CardTitle>
                  {scope === "all" ? "Bot 列表" : "当前 Bot"}
                </CardTitle>
              </div>
              {visibleBots ? (
                <Badge variant="secondary">{visibleBots.length}</Badge>
              ) : loading ? (
                <Skeleton className="h-5 w-8" />
              ) : null}
            </div>
            <CardDescription>
              GET /status{scope !== "all" && ` · 过滤: ${scope}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {visibleBots ? (
              visibleBots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {scope === "all"
                    ? "没有正在运行的 Bot。"
                    : `Bot "${scope}" 不在线。`}
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {visibleBots.map((b) => (
                    <li
                      key={b.botId}
                      className="flex items-center justify-between py-2 text-sm"
                    >
                      <span className="font-mono">{b.botId}</span>
                      <Badge variant="outline">running</Badge>
                    </li>
                  ))}
                </ul>
              )
            ) : loading ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-2/3" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">暂无数据</p>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        每 {POLL_INTERVAL / 1000}s 自动刷新
      </p>
    </div>
  )
}

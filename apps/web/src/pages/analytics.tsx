import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts"
import {
  Users,
  MessageSquare,
  Hash,
  Bot,
  RefreshCw,
  Loader2,
  CalendarDays,
} from "lucide-react"
import {
  statsApi,
  type OverviewStats,
  type GroupStat,
  type UserStat,
  type TrendPoint,
  type StatsFilter,
} from "@/lib/api"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useBotScope } from "@/contexts/bot-scope-context"
import { cn } from "@/lib/utils"

// ─── 时间范围选项 ─────────────────────────────────────────────────────────────

const RANGES = [
  { label: "今天",   days: 1 },
  { label: "7 天",   days: 7 },
  { label: "30 天",  days: 30 },
  { label: "全部",   days: 0 },
] as const

function rangeToFilter(days: number): Pick<StatsFilter, "from" | "to"> {
  if (days === 0) return {}
  const now = Math.floor(Date.now() / 1000)
  return { from: now - days * 86400, to: now }
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  if (n >= 1000)  return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })
}

// ─── 卡片骨架 ─────────────────────────────────────────────────────────────────

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-20 mb-1" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  )
}

// ─── Tooltip 自定义 ──────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number; name?: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow-md">
      <p className="mb-1 font-medium text-card-foreground">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-muted-foreground">
          消息数：<span className="font-semibold text-foreground">{p.value.toLocaleString()}</span>
        </p>
      ))}
    </div>
  )
}

// ─── 主页面 ──────────────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const { scope } = useBotScope()

  const [rangeDays, setRangeDays]       = useState<number>(7)
  const [loading, setLoading]           = useState(false)
  const [overview, setOverview]         = useState<OverviewStats | null>(null)
  const [groups, setGroups]             = useState<GroupStat[]>([])
  const [users, setUsers]               = useState<UserStat[]>([])
  const [trend, setTrend]               = useState<TrendPoint[]>([])
  const [error, setError]               = useState<string | null>(null)

  // 构建 filter
  const filter = useMemo<StatsFilter>(() => ({
    ...(scope !== "all" ? { botId: scope } : {}),
    ...rangeToFilter(rangeDays),
  }), [scope, rangeDays])

  // 拉取所有 stats
  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ov, gr, us, tr] = await Promise.all([
        statsApi.overview(filter),
        statsApi.byGroup({ ...filter, limit: 15 }),
        statsApi.byUser({ ...filter, limit: 15 }),
        statsApi.trend(filter),
      ])
      setOverview(ov)
      setGroups(gr.groups)
      setUsers(us.users)
      setTrend(tr.trend)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { void refresh() }, [refresh])

  // 趋势图：若范围 <= 7 天，补全所有日期（避免缺口）
  const trendFilled = useMemo(() => {
    if (rangeDays === 0 || rangeDays > 7) return trend
    const map = new Map(trend.map((p) => [p.date, p.count]))
    const now = Date.now()
    const filled: TrendPoint[] = []
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(now - i * 86400_000).toISOString().slice(0, 10)
      filled.push({ date: d, count: map.get(d) ?? 0 })
    }
    return filled
  }, [trend, rangeDays])

  // 为群组/用户柱状图截断长 ID 显示
  function shortId(id: string, maxLen = 8): string {
    return id.length <= maxLen ? id : `…${id.slice(-maxLen + 1)}`
  }

  return (
    <div className="flex flex-col gap-6 p-6">

      {/* ── 顶部：标题 + 操作栏 ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">消息统计</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {scope === "all" ? "全部机器人" : scope}
            {" · "}
            {RANGES.find((r) => r.days === rangeDays)?.label ?? "自定义"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* 时间范围选择器 */}
          <div className="flex rounded-md border overflow-hidden text-sm">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setRangeDays(r.days)}
                className={cn(
                  "px-3 py-1.5 transition-colors",
                  rangeDays === r.days
                    ? "bg-primary text-primary-foreground font-medium"
                    : "hover:bg-muted text-muted-foreground"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── 概览卡片 ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {!overview ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <OverviewCard
              icon={<MessageSquare className="h-4 w-4" />}
              label="消息总量"
              value={fmtNum(overview.total)}
              sub={`${overview.total.toLocaleString()} 条`}
              color="text-blue-500"
            />
            <OverviewCard
              icon={<Hash className="h-4 w-4" />}
              label="活跃群聊"
              value={fmtNum(overview.groups)}
              sub={`共 ${overview.groups} 个群`}
              color="text-emerald-500"
            />
            <OverviewCard
              icon={<Users className="h-4 w-4" />}
              label="活跃用户"
              value={fmtNum(overview.users)}
              sub={`共 ${overview.users} 人`}
              color="text-violet-500"
            />
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <Bot className="h-4 w-4 text-amber-500" />
                  机器人分布
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                {overview.byBot.length === 0 ? (
                  <p className="text-xs text-muted-foreground">暂无数据</p>
                ) : (
                  overview.byBot.map((b) => (
                    <div key={b.botId} className="flex items-center justify-between text-sm">
                      <span className="truncate max-w-[7rem] text-muted-foreground">{b.botId}</span>
                      <Badge variant="secondary">{fmtNum(b.count)}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ── 趋势图 ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            消息趋势（按天）
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!overview ? (
            <Skeleton className="h-48 w-full" />
          ) : trendFilled.length === 0 ? (
            <EmptyState text="该时间范围内暂无数据" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendFilled} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#trendGrad)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── 群组 + 用户并排 ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Top 群聊 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Hash className="h-4 w-4 text-emerald-500" />
              最活跃群聊 Top 15
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!overview ? (
              <Skeleton className="h-64 w-full" />
            ) : groups.length === 0 ? (
              <EmptyState text="暂无群消息数据" />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(groups.length * 28 + 20, 160)}>
                <BarChart
                  layout="vertical"
                  data={groups.map((g) => ({ name: g.groupId, count: g.count, lastAt: g.lastAt }))}
                  margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
                >
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={90}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v: string) => shortId(v, 10)}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload as { name: string; count: number; lastAt: number }
                      return (
                        <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow-md">
                          <p className="font-medium">群 {d.name}</p>
                          <p className="text-muted-foreground">消息数：<span className="font-semibold text-foreground">{d.count.toLocaleString()}</span></p>
                          <p className="text-muted-foreground">最近：{fmtDate(d.lastAt)}</p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(142 72% 45%)" radius={[0, 3, 3, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top 用户 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4 text-violet-500" />
              最活跃用户 Top 15
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!overview ? (
              <Skeleton className="h-64 w-full" />
            ) : users.length === 0 ? (
              <EmptyState text="暂无用户消息数据" />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(users.length * 28 + 20, 160)}>
                <BarChart
                  layout="vertical"
                  data={users.map((u) => ({
                    name: u.senderName || u.userId,
                    uid:  u.userId,
                    count: u.count,
                    lastAt: u.lastAt,
                  }))}
                  margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
                >
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={90}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v: string) => shortId(v, 10)}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload as { name: string; uid: string; count: number; lastAt: number }
                      return (
                        <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow-md">
                          <p className="font-medium">{d.name}</p>
                          {d.uid !== d.name && <p className="text-xs text-muted-foreground">QQ: {d.uid}</p>}
                          <p className="text-muted-foreground">消息数：<span className="font-semibold text-foreground">{d.count.toLocaleString()}</span></p>
                          <p className="text-muted-foreground">最近：{fmtDate(d.lastAt)}</p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(270 70% 60%)" radius={[0, 3, 3, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 机器人详细分布（仅全局视图下展示） ── */}
      {scope === "all" && overview && overview.byBot.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Bot className="h-4 w-4 text-amber-500" />
              机器人消息量对比
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={overview.byBot} margin={{ top: 4, right: 16, bottom: 4, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="botId"
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" fill="hsl(38 92% 50%)" radius={[3, 3, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── 底部提示 ── */}
      <p className="text-xs text-muted-foreground text-center pb-2">
        统计范围：仅 message 类型事件（不含 notice / request）· 数据实时写入，重启后仍保留
      </p>
    </div>
  )
}

// ─── 子组件 ──────────────────────────────────────────────────────────────────

function OverviewCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  color: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={cn("flex items-center gap-1.5 text-sm font-medium text-muted-foreground", color)}>
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
      {text}
    </div>
  )
}

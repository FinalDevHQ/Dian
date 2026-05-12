import { useCallback, useEffect, useRef, useState } from "react"
import {
  MessageSquare,
  Search,
  RefreshCw,
  Loader2,
  Users,
  Hash,
  Clock,
  Filter,
} from "lucide-react"
import { messagesApi, statsApi, type MessageEntry, type GroupNameMap } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Pagination } from "@/components/ui/pagination"
import { useBotScope } from "@/contexts/bot-scope-context"
import { cn } from "@/lib/utils"

function fmtTime(ts: number): string {
  const ms = ts > 1e12 ? ts : ts * 1000
  return new Date(ms).toLocaleString("zh-CN", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  })
}

function SubtypeBadge({ subtype }: { subtype: string }) {
  return subtype === "group" ? (
    <Badge variant="secondary" className="text-xs px-1.5 py-0 shrink-0">群聊</Badge>
  ) : (
    <Badge variant="outline" className="text-xs px-1.5 py-0 shrink-0">私聊</Badge>
  )
}

function Highlight({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword) return <span>{text}</span>
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase())
  if (idx < 0) return <span>{text}</span>
  return (
    <span>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-800 rounded-sm px-0.5">
        {text.slice(idx, idx + keyword.length)}
      </mark>
      {text.slice(idx + keyword.length)}
    </span>
  )
}

export function MessagesPage() {
  const { scope } = useBotScope()

  const [keyword, setKeyword]     = useState("")
  const [groupId, setGroupId]     = useState("")
  const [userId, setUserId]       = useState("")
  const [subtype, setSubtype]     = useState<"" | "group" | "private">("")
  const [page, setPage]           = useState(0)
  const [pageSize, setPageSize]   = useState(50)

  const [loading, setLoading]     = useState(false)
  const [items, setItems]         = useState<MessageEntry[]>([])
  const [total, setTotal]         = useState(0)
  const [groupNames, setGroupNames] = useState<GroupNameMap>({})

  // 实际提交的过滤条件（点搜索/回车后才更新）
  const [committed, setCommitted] = useState({ keyword: "", groupId: "", userId: "", subtype: "" })

  const fetchRef = useRef(0)

  const load = useCallback(async (pg: number, filters: typeof committed, sc: string) => {
    const seq = ++fetchRef.current
    setLoading(true)
    try {
      const [result, names] = await Promise.all([
        messagesApi.query({
          ...(sc !== "all" ? { botId: sc } : {}),
          ...(filters.groupId  ? { groupId: filters.groupId }   : {}),
          ...(filters.userId   ? { userId:  filters.userId }    : {}),
          ...(filters.subtype  ? { subtype: filters.subtype }   : {}),
          ...(filters.keyword  ? { keyword: filters.keyword }   : {}),
          limit:  pageSize,
          offset: pg * pageSize,
        }),
        statsApi.groupNames(),
      ])
      if (seq !== fetchRef.current) return
      setItems(result.items)
      setTotal(result.total)
      setGroupNames(names)
    } catch {
      // ignore
    } finally {
      if (seq === fetchRef.current) setLoading(false)
    }
  }, [pageSize])

  useEffect(() => {
    setPage(0)
    load(0, committed, scope)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, committed, pageSize])

  useEffect(() => {
    load(page, committed, scope)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  function handleSearch() {
    const next = { keyword, groupId, userId, subtype }
    setPage(0)
    setCommitted(next)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSearch()
  }

  function groupLabel(id: string) {
    return groupNames[id] ? `${groupNames[id]}` : id
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">消息记录</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {scope === "all" ? "全部机器人" : scope}
            {total > 0 && <span className="ml-2">共 {total.toLocaleString()} 条</span>}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(page, committed, scope)} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-1.5">刷新</span>
        </Button>
      </div>

      {/* 过滤栏 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Filter className="h-4 w-4 text-muted-foreground" />
            筛选条件
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {/* 关键词 */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="搜索消息内容…"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-8 h-9 text-sm"
              />
            </div>
            {/* 群号 */}
            <div className="relative min-w-[140px]">
              <Hash className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="群号…"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-8 h-9 text-sm"
              />
            </div>
            {/* QQ号 */}
            <div className="relative min-w-[140px]">
              <Users className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="QQ 号…"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-8 h-9 text-sm"
              />
            </div>
            {/* 类型切换 */}
            <div className="flex rounded-md border overflow-hidden text-sm h-9">
              {(["", "group", "private"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setSubtype(v)}
                  className={cn(
                    "px-3 transition-colors",
                    subtype === v
                      ? "bg-primary text-primary-foreground font-medium"
                      : "hover:bg-muted text-muted-foreground"
                  )}
                >
                  {v === "" ? "全部" : v === "group" ? "群聊" : "私聊"}
                </button>
              ))}
            </div>
            <Button size="sm" className="h-9" onClick={handleSearch}>
              <Search className="h-4 w-4 mr-1" />
              搜索
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 消息列表 */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-0 divide-y">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex gap-3 px-4 py-3">
                  <Skeleton className="h-4 w-12 shrink-0 mt-0.5" />
                  <Skeleton className="h-4 w-24 shrink-0 mt-0.5" />
                  <Skeleton className="h-4 flex-1 mt-0.5" />
                  <Skeleton className="h-4 w-28 shrink-0 mt-0.5" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">暂无消息记录</p>
            </div>
          ) : (
            <div className="divide-y">
              {items.map((msg) => (
                <div
                  key={msg.eventId}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-sm"
                >
                  {/* 类型 */}
                  <SubtypeBadge subtype={msg.subtype} />

                  {/* 发送者 */}
                  <span className="w-24 shrink-0 truncate text-foreground font-medium" title={msg.senderName}>
                    {msg.senderName || msg.userId || "—"}
                  </span>

                  {/* 群/来源 */}
                  {msg.subtype === "group" && msg.groupId ? (
                    <span className="w-32 shrink-0 truncate text-muted-foreground text-xs mt-0.5" title={groupLabel(msg.groupId)}>
                      <Hash className="inline h-3 w-3 mr-0.5 opacity-60" />
                      {groupLabel(msg.groupId)}
                    </span>
                  ) : (
                    <span className="w-32 shrink-0 text-muted-foreground text-xs mt-0.5">私聊</span>
                  )}

                  {/* 消息内容 */}
                  <span className="flex-1 min-w-0 break-all text-foreground/90 leading-relaxed">
                    {msg.text
                      ? <Highlight text={msg.text} keyword={committed.keyword} />
                      : <span className="text-muted-foreground italic">[非文本消息]</span>
                    }
                  </span>

                  {/* 时间 */}
                  <span className="w-36 shrink-0 text-right text-xs text-muted-foreground flex items-center justify-end gap-1">
                    <Clock className="h-3 w-3 opacity-50" />
                    {fmtTime(msg.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 分页 */}
      {total > 0 && (
        <Pagination
          page={page}
          total={total}
          pageSize={pageSize}
          loading={loading}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(0)
          }}
        />
      )}
    </div>
  )
}

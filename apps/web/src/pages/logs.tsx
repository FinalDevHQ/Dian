import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  AlertCircle,
  Eraser,
  Loader2,
  Pause,
  Play,
  Wifi,
  WifiOff,
} from "lucide-react"
import { api, eventStreamUrl, type BotEvent } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useBotScope } from "@/contexts/bot-scope-context"
import { cn } from "@/lib/utils"

/** 日志页 tab 定义 */
type TabKey = "all" | "message" | "notice" | "request" | "meta"

interface TabDef {
  key: TabKey
  label: string
  /** 返回 true 表示该事件归此 tab */
  match: (e: BotEvent) => boolean
}

const TABS: TabDef[] = [
  { key: "all", label: "全部", match: () => true },
  {
    key: "message",
    label: "消息",
    match: (e) => e.type === "message" || e.type === "message_sent",
  },
  { key: "notice", label: "事件", match: (e) => e.type === "notice" },
  { key: "request", label: "请求", match: (e) => e.type === "request" },
  { key: "meta", label: "登录日志", match: (e) => e.type === "meta_event" },
]

const MAX_BUFFER = 500

function formatTime(timestamp: number): string {
  // BotEvent.timestamp 是秒级（兼容 OneBot），如果数值像毫秒就直接用
  const ms = timestamp > 1e12 ? timestamp : timestamp * 1000
  const d = new Date(ms)
  return d.toLocaleTimeString(undefined, { hour12: false }) +
    "." + String(d.getMilliseconds()).padStart(3, "0")
}

/** OneBot 消息段（inline 显示用） */
interface OneBotSegment {
  type: string
  data: Record<string, string>
}

/** OneBot 原始字段的部分类型——只取这里要用的几个字段 */
interface OneBotRawLike {
  notice_type?: string
  request_type?: string
  sub_type?: string
  user_id?: number | string
  group_id?: number | string
  operator_id?: number | string
  target_id?: number | string
  sender_id?: number | string
  message_id?: number | string
  message?: string | OneBotSegment[]
  comment?: string
  flag?: string
  duration?: number
  file?: { name?: string; size?: number }
}

/** 渲染单个消息段为 inline React 节点 */
function SegmentView({ seg }: { seg: OneBotSegment }) {
  const { type, data } = seg
  switch (type) {
    case "text":
      // 文本里允许出现换行；用 whitespace-pre-wrap
      return <span className="whitespace-pre-wrap">{data.text ?? ""}</span>
    case "face":
      return (
        <span
          title={`QQ 表情 id=${data.id}`}
          className="mx-0.5 inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1 py-0.5 text-[10px] text-amber-700"
        >
          😀 {data.id}
        </span>
      )
    case "image": {
      const src = data.url || data.file
      if (!src || !/^https?:\/\//.test(src)) {
        return (
          <span className="mx-0.5 inline-flex items-center gap-1 rounded bg-blue-500/15 px-1 py-0.5 text-[10px] text-blue-700">
            🖼 image
          </span>
        )
      }
      return (
        <a
          href={src}
          target="_blank"
          rel="noreferrer noopener"
          className="mx-0.5 inline-block align-middle"
          title={data.file ?? src}
        >
          <img
            src={src}
            alt="image"
            loading="lazy"
            className="inline-block max-h-16 max-w-32 rounded border align-middle"
            referrerPolicy="no-referrer"
          />
        </a>
      )
    }
    case "at":
      return (
        <span className="mx-0.5 inline-flex items-center rounded bg-violet-500/15 px-1 py-0.5 text-[10px] text-violet-700">
          @{data.qq === "all" ? "全体成员" : data.qq}
        </span>
      )
    case "reply":
      return (
        <span
          title={`引用消息 id=${data.id}`}
          className="mx-0.5 inline-flex items-center rounded bg-slate-500/15 px-1 py-0.5 text-[10px] text-slate-600"
        >
          ↳ {data.id}
        </span>
      )
    case "record":
      return (
        <span className="mx-0.5 inline-flex items-center rounded bg-emerald-500/15 px-1 py-0.5 text-[10px] text-emerald-700">
          🎤 语音
        </span>
      )
    case "video":
      return (
        <span className="mx-0.5 inline-flex items-center rounded bg-rose-500/15 px-1 py-0.5 text-[10px] text-rose-700">
          🎬 视频
        </span>
      )
    case "file":
      return (
        <span className="mx-0.5 inline-flex items-center rounded bg-sky-500/15 px-1 py-0.5 text-[10px] text-sky-700">
          📎 {data.name ?? "文件"}
        </span>
      )
    case "rps":
      return <span className="mx-0.5 text-[10px] text-muted-foreground">[猜拳]</span>
    case "dice":
      return <span className="mx-0.5 text-[10px] text-muted-foreground">[骰子 {data.value ?? ""}]</span>
    case "share":
      return (
        <span
          title={data.url}
          className="mx-0.5 inline-flex items-center rounded bg-teal-500/15 px-1 py-0.5 text-[10px] text-teal-700"
        >
          🔗 {data.title ?? "分享"}
        </span>
      )
    case "json":
    case "xml":
      return (
        <span className="mx-0.5 inline-flex items-center rounded bg-zinc-500/15 px-1 py-0.5 text-[10px] text-zinc-600">
          [{type}]
        </span>
      )
    default:
      return (
        <span className="mx-0.5 inline-flex items-center rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
          [{type}]
        </span>
      )
  }
}

/** 把 raw.message 渲染成 inline 富文本 */
function MessageContent({ message }: { message: OneBotRawLike["message"] }) {
  if (!message) return null
  if (typeof message === "string") {
    // 字符串格式（CQ 码）：暂不解析，直接显示原文
    return <span className="whitespace-pre-wrap">{message}</span>
  }
  return (
    <>
      {message.map((seg, i) => (
        <Fragment key={i}>
          <SegmentView seg={seg} />
        </Fragment>
      ))}
    </>
  )
}

function describeEvent(e: BotEvent): ReactNode {
  const { type, payload } = e
  const raw = (e.raw as OneBotRawLike | undefined) ?? {}

  // ── 消息 ─────────────────────────────────────────────────────────────
  if (type === "message" || type === "message_sent") {
    const who = payload.senderName ?? payload.userId ?? "?"
    const where = payload.groupId
      ? `群 ${payload.groupId}`
      : payload.userId
        ? `私聊 ${payload.userId}`
        : ""
    const arrow = type === "message_sent" ? "→" : "←"
    return (
      <span className="inline">
        {arrow} [{where}] {who}: <MessageContent message={raw.message} />
      </span>
    )
  }

  // ── 通知（notice） ────────────────────────────────────────────────────
  if (type === "notice") {
    const nt = raw.notice_type
    const sub = raw.sub_type
    const u = raw.user_id
    const g = raw.group_id
    const op = raw.operator_id
    const target = raw.target_id

    switch (nt) {
      case "group_increase":
        return `[群 ${g}] 成员 ${u} 进群${op && op !== u ? ` (由 ${op} 邀请)` : ""}${sub === "approve" ? "（管理员同意）" : sub === "invite" ? "（邀请）" : ""}`
      case "group_decrease": {
        const reason =
          sub === "leave" ? "主动退群"
          : sub === "kick" ? `被 ${op} 踢出`
          : sub === "kick_me" ? "Bot 被踢出群"
          : sub ?? ""
        return `[群 ${g}] 成员 ${u} 离开（${reason}）`
      }
      case "group_admin":
        return `[群 ${g}] ${u} ${sub === "set" ? "被设为管理员" : "被取消管理员"}`
      case "group_ban":
        return `[群 ${g}] ${op} ${sub === "ban" ? `禁言 ${u} ${raw.duration ?? 0}s` : `解除禁言 ${u}`}`
      case "group_recall":
        return `[群 ${g}] ${op ?? u} 撤回了消息 ${raw.message_id}`
      case "friend_recall":
        return `[私聊] ${u} 撤回了消息 ${raw.message_id}`
      case "group_upload":
        return `[群 ${g}] ${u} 上传文件 ${raw.file?.name ?? ""}${raw.file?.size ? ` (${raw.file.size}B)` : ""}`
      case "friend_add":
        return `新好友：${u}`
      case "notify":
        if (sub === "poke") {
          return g
            ? `[群 ${g}] ${u} 戳了戳 ${target}`
            : `[私聊] ${u} 戳了戳 ${target ?? "你"}`
        }
        if (sub === "lucky_king") return `[群 ${g}] ${target} 成为运气王（${u} 发的红包）`
        if (sub === "honor") return `[群 ${g}] ${u} 获得头衔变化`
        return `[群 ${g ?? "?"}] notify.${sub}`
      default:
        return `notice.${nt ?? "?"}${sub ? `.${sub}` : ""}${u ? ` user=${u}` : ""}${g ? ` group=${g}` : ""}`
    }
  }

  // ── 请求（request） ───────────────────────────────────────────────────
  if (type === "request") {
    const rt = raw.request_type
    const sub = raw.sub_type
    const u = raw.user_id
    const g = raw.group_id
    const comment = raw.comment ? ` 留言="${raw.comment}"` : ""
    if (rt === "friend") return `加好友请求：${u}${comment}`
    if (rt === "group") {
      const kind = sub === "add" ? "申请加群" : sub === "invite" ? "邀请 Bot 入群" : sub
      return `[群 ${g}] ${u} ${kind}${comment}`
    }
    return `request.${rt}${sub ? `.${sub}` : ""}`
  }

  // ── 元事件（meta_event） ─────────────────────────────────────────────
  if (type === "meta_event") {
    return `meta.${e.subtype}`
  }

  return `${type}.${e.subtype}`
}

function eventTypeBadge(e: BotEvent) {
  switch (e.type) {
    case "message":
      return <Badge variant="default">收</Badge>
    case "message_sent":
      return <Badge variant="secondary">发</Badge>
    case "notice":
      return (
        <Badge variant="outline" className="border-amber-500/40 text-amber-600">
          通知
        </Badge>
      )
    case "request":
      return (
        <Badge variant="outline" className="border-blue-500/40 text-blue-600">
          请求
        </Badge>
      )
    default:
      return <Badge variant="outline">{e.type}</Badge>
  }
}

type ConnState = "connecting" | "open" | "closed" | "error"

export function LogsPage() {
  const { scope } = useBotScope()
  const [tab, setTab] = useState<TabKey>("all")
  const [events, setEvents] = useState<BotEvent[]>([])
  const [autoScroll, setAutoScroll] = useState(true)
  const [paused, setPaused] = useState(false)
  const [conn, setConn] = useState<ConnState>("connecting")
  const [error, setError] = useState<string | null>(null)

  // 暂停时缓存到达的事件，恢复时再合并入主列表
  const pausedBuffer = useRef<BotEvent[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  const seenRef = useRef<Set<string>>(new Set())

  const botIdFilter = scope === "all" ? undefined : scope

  const pushEvents = useCallback((incoming: BotEvent[]) => {
    if (incoming.length === 0) return
    setEvents((prev) => {
      const merged = prev.slice()
      for (const e of incoming) {
        if (seenRef.current.has(e.eventId)) continue
        seenRef.current.add(e.eventId)
        merged.push(e)
      }
      // 限制内存
      if (merged.length > MAX_BUFFER) {
        const drop = merged.length - MAX_BUFFER
        for (let i = 0; i < drop; i++) {
          seenRef.current.delete(merged[i].eventId)
        }
        return merged.slice(drop)
      }
      return merged
    })
  }, [])

  // 拉取历史 + 建立 SSE
  useEffect(() => {
    let cancelled = false
    let es: EventSource | null = null

    // 用 setTimeout(0) 推迟首次 setState，避免 effect 同步 setState 的级联渲染告警
    const initTimer = window.setTimeout(() => {
      setConn("connecting")
      setError(null)
      setEvents([])
      seenRef.current = new Set()
      pausedBuffer.current = []
    }, 0)

    ;(async () => {
      try {
        const r = await api.recentEvents({ limit: 100, botId: botIdFilter })
        if (cancelled) return
        pushEvents(r.events)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      }

      if (cancelled) return

      es = new EventSource(eventStreamUrl({ botId: botIdFilter }))
      es.onopen = () => setConn("open")
      es.onerror = () => setConn("error")
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as
            | { kind: "hello"; ts: number }
            | { kind: "event"; event: BotEvent }
          if (data.kind !== "event") return
          if (paused) {
            pausedBuffer.current.push(data.event)
            if (pausedBuffer.current.length > MAX_BUFFER) {
              pausedBuffer.current = pausedBuffer.current.slice(-MAX_BUFFER)
            }
          } else {
            pushEvents([data.event])
          }
        } catch {
          /* ignore malformed */
        }
      }
    })()

    return () => {
      cancelled = true
      window.clearTimeout(initTimer)
      es?.close()
      setConn("closed")
    }
    // botIdFilter 改变时重连；paused/pushEvents 不参与依赖以避免重连
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botIdFilter])

  // 切换暂停状态时，从暂停状态恢复需要把缓冲事件合并
  useEffect(() => {
    if (!paused && pausedBuffer.current.length > 0) {
      pushEvents(pausedBuffer.current)
      pausedBuffer.current = []
    }
  }, [paused, pushEvents])

  // 自动滚到底部
  useEffect(() => {
    if (!autoScroll) return
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [events, autoScroll])

  const filtered = useMemo(() => {
    const def = TABS.find((t) => t.key === tab) ?? TABS[0]
    return events.filter(def.match)
  }, [events, tab])

  const clear = () => {
    setEvents([])
    seenRef.current = new Set()
    pausedBuffer.current = []
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-3">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <ConnIndicator state={conn} />

          <label className="flex cursor-pointer items-center gap-2">
            <Switch checked={autoScroll} onCheckedChange={setAutoScroll} />
            <span>自动滚动</span>
          </label>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? (
              <>
                <Play /> 继续
              </>
            ) : (
              <>
                <Pause /> 暂停
              </>
            )}
          </Button>

          <Button variant="ghost" size="sm" onClick={clear}>
            <Eraser /> 清空
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="size-3.5" aria-hidden />
          {error}
        </div>
      )}

      {/* 事件流 */}
      <div
        ref={listRef}
        className={cn(
          "flex-1 overflow-y-auto rounded-md border bg-muted/30 font-mono text-xs",
          paused && "border-amber-400/50"
        )}
      >
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
            {conn === "connecting" ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                正在连接事件流…
              </>
            ) : (
              "等等日志 …"
            )}
          </div>
        ) : (
          <ul className="flex flex-col">
            {filtered.map((e) => (
              <li
                key={e.eventId}
                className="flex items-start gap-2 border-b border-border/40 px-3 py-1.5 hover:bg-muted/50"
              >
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {formatTime(e.timestamp)}
                </span>
                <span className="shrink-0">{eventTypeBadge(e)}</span>
                <span className="shrink-0 text-muted-foreground">
                  [{e.botId}]
                </span>
                <span className="break-all whitespace-pre-wrap">
                  {describeEvent(e)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        显示最近 {MAX_BUFFER} 条 ·
        {scope === "all" ? "全部机器人" : ` 仅 ${scope}`} ·
        {paused ? " 已暂停" : " 实时"}
      </p>
    </div>
  )
}

function ConnIndicator({ state }: { state: ConnState }) {
  switch (state) {
    case "open":
      return (
        <span className="flex items-center gap-1 text-emerald-600">
          <Wifi className="size-3.5" aria-hidden />
          已连接
        </span>
      )
    case "connecting":
      return (
        <span className="flex items-center gap-1">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          连接中
        </span>
      )
    case "error":
      return (
        <span className="flex items-center gap-1 text-destructive">
          <WifiOff className="size-3.5" aria-hidden />
          连接异常
        </span>
      )
    default:
      return (
        <span className="flex items-center gap-1 text-muted-foreground">
          <WifiOff className="size-3.5" aria-hidden />
          未连接
        </span>
      )
  }
}

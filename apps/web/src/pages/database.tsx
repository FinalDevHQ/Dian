import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  AlertCircle,
  Clock3,
  Database,
  KeyRound,
  Loader2,
  Play,
  Table as TableIcon,
} from "lucide-react"
import {
  api,
  type ColumnInfo,
  type DataSourceMeta,
  type QueryResult,
  type TableInfo,
} from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const SQL_PLACEHOLDER = "在此输入 SQL，点击执行或按 Ctrl+Enter"

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return ""
  if (typeof v === "object") return JSON.stringify(v)
  return String(v)
}

function quoteIdent(id: string): string {
  return `"${id.replace(/"/g, '""')}"`
}

export function DatabasePage() {
  const [sources, setSources] = useState<DataSourceMeta[] | null>(null)
  const [activeSource, setActiveSource] = useState<string | null>(null)

  const [tables, setTables] = useState<TableInfo[] | null>(null)
  const [activeTable, setActiveTable] = useState<string | null>(null)

  const [schema, setSchema] = useState<ColumnInfo[] | null>(null)

  const [sql, setSql] = useState("")
  const [readOnly, setReadOnly] = useState(true)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sqlRef = useRef<HTMLTextAreaElement>(null)

  // ── 加载数据源 ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = window.setTimeout(async () => {
      try {
        const r = await api.listDbSources()
        setSources(r.sources)
        setActiveSource((prev) => prev ?? r.sources[0]?.name ?? null)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }, 0)
    return () => window.clearTimeout(t)
  }, [])

  // ── 加载表 ────────────────────────────────────────────────────────────────
  const loadTables = useCallback(async (src: string) => {
    setTables(null)
    try {
      const r = await api.listDbTables(src)
      setTables(r.tables)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setTables([])
    }
  }, [])

  useEffect(() => {
    if (!activeSource) return
    const t = window.setTimeout(() => {
      setActiveTable(null)
      setSchema(null)
      loadTables(activeSource)
    }, 0)
    return () => window.clearTimeout(t)
  }, [activeSource, loadTables])

  // ── 加载 schema ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    const t = window.setTimeout(async () => {
      if (!activeSource || !activeTable) {
        setSchema(null)
        return
      }
      try {
        const r = await api.getDbSchema(activeSource, activeTable)
        if (!cancelled) setSchema(r.columns)
      } catch (err) {
        if (!cancelled) {
          setSchema([])
          setError(err instanceof Error ? err.message : String(err))
        }
      }
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [activeSource, activeTable])

  // ── 执行 SQL ─────────────────────────────────────────────────────────────
  const runQuery = useCallback(async () => {
    if (!activeSource || !sql.trim() || running) return
    setRunning(true)
    setError(null)
    try {
      const r = await api.runDbQuery(activeSource, sql, { readOnly })
      setResult(r)
      // 如果是 DML（写入），自动刷新表行数
      if (!readOnly && r.rowsAffected !== undefined) {
        loadTables(activeSource)
      }
    } catch (err) {
      setResult(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  }, [activeSource, sql, readOnly, running, loadTables])

  // 全局 Ctrl/Cmd + Enter 运行（在 textarea 也生效）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault()
        runQuery()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [runQuery])

  /** 选中某表 → 自动填入查询并立即执行 */
  const pickTable = useCallback(
    (name: string) => {
      setActiveTable(name)
      const q = `SELECT * FROM ${quoteIdent(name)} ORDER BY rowid DESC LIMIT 50`
      setSql(q)
      // 等下一帧让 sql 生效，然后触发执行
      requestAnimationFrame(() => {
        if (!activeSource) return
        ;(async () => {
          setRunning(true)
          setError(null)
          try {
            const r = await api.runDbQuery(activeSource, q, { readOnly: true })
            setResult(r)
          } catch (err) {
            setResult(null)
            setError(err instanceof Error ? err.message : String(err))
          } finally {
            setRunning(false)
          }
        })()
      })
    },
    [activeSource]
  )

  const exportCsv = useCallback(() => {
    if (!result || result.rows.length === 0) return
    const escape = (v: unknown) => {
      const s = formatCell(v)
      if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }
    const header = result.columns.map((c) => escape(c.name)).join(",")
    const body = result.rows.map((row) => row.map(escape).join(",")).join("\n")
    const blob = new Blob([header + "\n" + body], {
      type: "text/csv;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${activeTable ?? "result"}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [result, activeTable])

  const meta = useMemo(
    () => sources?.find((s) => s.name === activeSource),
    [sources, activeSource]
  )

  return (
    <div className="grid h-[calc(100vh-8rem)] grid-cols-[18rem_1fr] gap-4">
      {/* ── 左：数据库 / 表 / 表结构 ── */}
      <div className="flex min-h-0 flex-col gap-3">
        <Card className="shrink-0">
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Database className="size-4 text-muted-foreground" />
              数据源
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            {sources === null ? (
              <Skeleton className="h-7 w-full" />
            ) : sources.length === 0 ? (
              <p className="px-2 text-xs text-muted-foreground">
                未配置存储。请在 settings.yaml 中设置 storage.sqlite。
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {sources.map((s) => (
                  <li key={s.name}>
                    <button
                      type="button"
                      onClick={() => setActiveSource(s.name)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                        activeSource === s.name
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "hover:bg-muted"
                      )}
                      title={s.location}
                    >
                      <Badge variant="outline" className="text-[10px]">
                        {s.kind}
                      </Badge>
                      <span className="flex-1 truncate font-mono text-xs">
                        {s.name}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-1 flex-col">
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TableIcon className="size-4 text-muted-foreground" />
              表
              {tables && (
                <Badge variant="secondary" className="ml-auto">
                  {tables.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto px-2 pb-2">
            {tables === null ? (
              <div className="space-y-1 px-1">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-3/4" />
              </div>
            ) : tables.length === 0 ? (
              <p className="px-2 text-xs text-muted-foreground">空数据库</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {tables.map((t) => (
                  <li key={t.name}>
                    <button
                      type="button"
                      onClick={() => pickTable(t.name)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left",
                        activeTable === t.name
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "hover:bg-muted"
                      )}
                    >
                      <span className="flex-1 truncate font-mono text-xs">
                        {t.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {t.rowCount}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="shrink-0 max-h-64 overflow-hidden">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">
              表结构
              {activeTable && (
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  {activeTable}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto px-3 pb-3 text-xs">
            {!activeTable ? (
              <p className="text-muted-foreground">选择一张表查看字段</p>
            ) : schema === null ? (
              <Skeleton className="h-4 w-2/3" />
            ) : schema.length === 0 ? (
              <p className="text-muted-foreground">无字段</p>
            ) : (
              <ul className="flex flex-col gap-0.5 font-mono">
                {schema.map((c) => (
                  <li key={c.name} className="flex items-center gap-2">
                    {c.pk && (
                      <KeyRound
                        className="size-3 text-amber-500"
                        aria-hidden
                      />
                    )}
                    <span className="truncate">{c.name}</span>
                    <span className="text-muted-foreground">{c.type}</span>
                    {c.notNull && (
                      <span className="text-[10px] text-muted-foreground">
                        NOT NULL
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 右：SQL 编辑器 + 结果 ── */}
      <div className="flex min-h-0 flex-col gap-3">
        <Card className="shrink-0">
          <CardContent className="flex flex-col gap-2 p-3">
            <Textarea
              ref={sqlRef}
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              spellCheck={false}
              placeholder={SQL_PLACEHOLDER}
              className="min-h-24 resize-y rounded-md border bg-muted/40 p-2 font-mono text-xs"
            />
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[11px] text-muted-foreground">
                {meta ? (
                  <>
                    {meta.kind} · <code>{meta.location}</code>
                  </>
                ) : (
                  "请选择一个数据源"
                )}
              </span>

              <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs">
                <Switch checked={readOnly} onCheckedChange={setReadOnly} />
                <span className={cn(!readOnly && "text-destructive font-medium")}>
                  {readOnly ? "只读模式" : "⚠ 允许写入"}
                </span>
              </label>

              <Button
                size="sm"
                onClick={runQuery}
                disabled={running || !activeSource || !sql.trim()}
                className={cn(!readOnly && "bg-destructive hover:bg-destructive/90")}
              >
                {running ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Play />
                )}
                执行
                <span className="ml-1 text-[10px] opacity-60">⌘↩</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span className="break-all">{error}</span>
          </div>
        )}

        <Card className="flex min-h-0 flex-1 flex-col">
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 py-3">
            <CardTitle className="flex items-center gap-3 text-sm">
              <span>结果</span>
              {result && (
                <>
                  <Badge variant="secondary">
                    {result.columns.length > 0
                      ? `${result.rowCount} 行`
                      : `影响 ${result.rowsAffected ?? 0} 行`}
                  </Badge>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="size-3" aria-hidden />
                    {result.durationMs.toFixed(2)} ms
                  </span>
                  {result.truncated && (
                    <Badge variant="outline" className="text-amber-600 border-amber-500/40">
                      已截断
                    </Badge>
                  )}
                </>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={exportCsv}
              disabled={!result || result.rows.length === 0}
            >
              导出 CSV
            </Button>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            {!result ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {running ? "执行中…" : "执行 SQL 查看结果"}
              </div>
            ) : result.columns.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                语句已执行。
                {result.rowsAffected !== undefined && (
                  <> 影响 <strong>{result.rowsAffected}</strong> 行。</>
                )}
                {result.lastInsertRowid !== undefined && (
                  <> 新行 ID: <code>{String(result.lastInsertRowid)}</code></>
                )}
              </div>
            ) : (
              <div className="h-full overflow-auto">
                <table className="w-full border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                    <tr>
                      <th className="w-10 border-b px-2 py-1.5 text-right text-muted-foreground">
                        #
                      </th>
                      {result.columns.map((c) => (
                        <th
                          key={c.name}
                          className="border-b border-l px-2 py-1.5 text-left font-medium"
                        >
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {result.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-muted/40">
                        <td className="border-b px-2 py-1 text-right text-muted-foreground tabular-nums">
                          {i + 1}
                        </td>
                        {row.map((cell, j) => (
                          <td
                            key={j}
                            className="max-w-xs truncate border-b border-l px-2 py-1"
                            title={formatCell(cell)}
                          >
                            {cell === null ? (
                              <span className="text-muted-foreground italic">
                                NULL
                              </span>
                            ) : (
                              formatCell(cell)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

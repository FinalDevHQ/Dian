import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  FileCode,
  RefreshCw,
  Save,
} from "lucide-react"
import {
  api,
  type ConfigFileContent,
  type ConfigFileMeta,
} from "@/lib/api"
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
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

function formatTs(ms: number): string {
  return new Date(ms).toLocaleString()
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "ok"; at: number }
  | { kind: "error"; message: string }

export function ConfigFilesPage() {
  const [files, setFiles] = useState<ConfigFileMeta[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [activeName, setActiveName] = useState<string | null>(null)

  const [current, setCurrent] = useState<ConfigFileContent | null>(null)
  const [draft, setDraft] = useState("")
  const [loadingFile, setLoadingFile] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: "idle" })

  const dirty = current !== null && draft !== current.content

  const loadList = useCallback(async () => {
    setListError(null)
    try {
      const r = await api.listConfigFiles()
      setFiles(r.files)
      setActiveName((prev) => prev ?? r.files[0]?.name ?? null)
    } catch (err) {
      setListError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  const loadFile = useCallback(async (name: string) => {
    setLoadingFile(true)
    setFileError(null)
    try {
      const r = await api.getConfigFile(name)
      setCurrent(r)
      setDraft(r.content)
      setSaveStatus({ kind: "idle" })
    } catch (err) {
      setCurrent(null)
      setDraft("")
      setFileError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingFile(false)
    }
  }, [])

  useEffect(() => {
    const t = window.setTimeout(loadList, 0)
    return () => window.clearTimeout(t)
  }, [loadList])

  useEffect(() => {
    if (!activeName) return
    const t = window.setTimeout(() => loadFile(activeName), 0)
    return () => window.clearTimeout(t)
  }, [activeName, loadFile])

  const save = useCallback(async () => {
    if (!current) return
    setSaveStatus({ kind: "saving" })
    try {
      const meta = await api.saveConfigFile(current.name, draft)
      setCurrent({ ...current, ...meta, content: draft })
      setSaveStatus({ kind: "ok", at: Date.now() })
      setFiles((list) =>
        list
          ? list.map((f) => (f.name === meta.name ? { ...f, ...meta } : f))
          : list
      )
    } catch (err) {
      setSaveStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }, [current, draft])

  const reset = useCallback(() => {
    if (!current) return
    setDraft(current.content)
    setSaveStatus({ kind: "idle" })
  }, [current])

  const saveBadge = useMemo(() => {
    switch (saveStatus.kind) {
      case "saving":
        return <Badge variant="secondary">保存中…</Badge>
      case "ok":
        return (
          <Badge variant="default" className="bg-emerald-600 text-white">
            <CheckCircle2 className="size-3" aria-hidden />
            已保存 {formatTs(saveStatus.at)}
          </Badge>
        )
      case "error":
        return (
          <Badge variant="destructive">
            <AlertCircle className="size-3" aria-hidden />
            保存失败
          </Badge>
        )
      default:
        return dirty ? (
          <Badge variant="outline">未保存</Badge>
        ) : (
          <Badge variant="secondary">无改动</Badge>
        )
    }
  }, [saveStatus, dirty])

  // Ctrl/Cmd + S 保存
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        if (dirty) {
          e.preventDefault()
          save()
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [dirty, save])

  return (
    <div className="grid h-[calc(100vh-8rem)] grid-cols-[16rem_1fr] gap-6">
      {/* 文件列表 */}
      <Card className="flex flex-col">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">配置文件</CardTitle>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={loadList}
            aria-label="刷新"
          >
            <RefreshCw />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto px-2 pb-2">
          {listError ? (
            <p className="px-2 text-xs text-destructive">{listError}</p>
          ) : files === null ? (
            <div className="space-y-1 px-2">
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-3/4" />
            </div>
          ) : files.length === 0 ? (
            <p className="px-2 text-xs text-muted-foreground">
              目录下没有 YAML 文件。
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {files.map((f) => (
                <li key={f.name}>
                  <button
                    type="button"
                    onClick={() => setActiveName(f.name)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                      activeName === f.name
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <FileCode className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate font-mono text-xs">
                      {f.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatSize(f.size)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 编辑器 */}
      <Card className="flex min-w-0 flex-col">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate font-mono text-sm">
              {activeName ?? "未选中文件"}
            </CardTitle>
            <CardDescription>
              {current ? (
                <>
                  {formatSize(current.size)} · 修改于 {formatTs(current.modifiedMs)}
                </>
              ) : (
                "选择左侧文件进行编辑"
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {saveBadge}
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={!dirty || saveStatus.kind === "saving"}
            >
              重置
            </Button>
            <Button
              size="sm"
              onClick={save}
              disabled={!dirty || saveStatus.kind === "saving"}
            >
              <Save />
              保存
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-2">
          {fileError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {fileError}
            </p>
          )}
          {saveStatus.kind === "error" && (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {saveStatus.message}
            </p>
          )}
          {loadingFile ? (
            <Skeleton className="flex-1" />
          ) : current ? (
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              className="flex-1 resize-none rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed whitespace-pre"
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              选择左侧文件进行编辑
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            保存后，后端会自动热重载。快捷键：Ctrl/Cmd + S
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

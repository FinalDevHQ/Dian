"use client"

import { useState, useCallback } from "react"
import { Loader2, Trash2, Database, AlertTriangle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

interface UninstallDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pluginName: string
  tables: string[]
  loading: boolean
  onConfirm: (deleteData: boolean) => void
  onCancel: () => void
}

export function UninstallDialog({
  open,
  onOpenChange,
  pluginName,
  tables,
  loading,
  onConfirm,
  onCancel,
}: UninstallDialogProps) {
  const [deleteData, setDeleteData] = useState(false)

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      setDeleteData(false)
    }
    onOpenChange(isOpen)
  }, [onOpenChange])

  const handleCancel = useCallback(() => {
    setDeleteData(false)
    onCancel()
  }, [onCancel])

  const hasTables = tables.length > 0

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleCancel}
      />

      {/* 弹窗内容 */}
      <div className="relative w-full max-w-md rounded-xl border bg-background shadow-2xl mx-4">
        {/* 头部 */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Trash2 className="size-5 text-destructive" />
            <span className="font-semibold">卸载插件</span>
          </div>
          <button
            onClick={handleCancel}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 内容 */}
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            确定要卸载插件 <span className="font-medium text-foreground">{pluginName}</span> 吗？
            此操作将删除插件文件且不可撤销。
          </p>

          {hasTables ? (
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Database className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">插件数据表</span>
                <span className="text-xs text-muted-foreground">
                  ({tables.length} 个表)
                </span>
              </div>

              <div className="max-h-40 overflow-auto rounded-md border bg-background p-2 mb-4">
                {tables.map((table) => (
                  <div
                    key={table}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm font-mono"
                  >
                    <span className="size-1.5 rounded-full bg-muted-foreground/30" />
                    {table}
                  </div>
                ))}
              </div>

              <label
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                  deleteData
                    ? "border-destructive/50 bg-destructive/5"
                    : "hover:bg-muted/80"
                )}
              >
                <Switch
                  checked={deleteData}
                  onCheckedChange={setDeleteData}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5 text-destructive" />
                    同时删除插件数据
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    删除上述 {tables.length} 个数据表及其所有数据。如果不删除，数据将残留在数据库中。
                  </p>
                </div>
              </label>
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
              <Database className="size-4 mb-2 opacity-50" />
              该插件没有关联的数据表。
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex gap-3 border-t px-5 py-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleCancel}
            disabled={loading}
          >
            取消
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={() => onConfirm(deleteData)}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                卸载中...
              </>
            ) : (
              <>
                <Trash2 className="size-4" />
                确认卸载
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "./button"
import { Input } from "./input"
import { cn } from "@/lib/utils"

const DEFAULT_PAGE_SIZE_OPTIONS = [20, 50, 100, 200]

interface PaginationProps {
  page: number
  total: number
  pageSize: number
  pageSizeOptions?: number[]
  loading?: boolean
  className?: string
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

export function Pagination({
  page,
  total,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  loading = false,
  className,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const [jumpValue, setJumpValue] = useState("")
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  function handleJump() {
    const num = parseInt(jumpValue, 10)
    if (num >= 1 && num <= totalPages) {
      onPageChange(num - 1)
      setJumpValue("")
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleJump()
  }

  return (
    <div className={cn("flex items-center justify-between text-sm text-muted-foreground", className)}>
      <div className="flex items-center gap-4">
        <span>
          第 {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} 条，共 {total.toLocaleString()} 条
        </span>
        <div className="flex items-center gap-1.5">
          <span>每页</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-7 rounded border bg-background px-1.5 text-sm"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span>条</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline" size="icon" className="h-8 w-8"
            disabled={page === 0 || loading}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2">{page + 1} / {totalPages}</span>
          <Button
            variant="outline" size="icon" className="h-8 w-8"
            disabled={page >= totalPages - 1 || loading}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1.5 ml-2">
          <span>跳至</span>
          <Input
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-7 w-14 text-center text-sm"
            placeholder={String(page + 1)}
          />
          <span>页</span>
          <Button
            variant="outline" size="sm" className="h-7 px-2"
            disabled={loading}
            onClick={handleJump}
          >
            确定
          </Button>
        </div>
      </div>
    </div>
  )
}
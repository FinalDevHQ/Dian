import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * 简易 Label 组件——shadcn 默认依赖 @radix-ui/react-label，
 * 这里采用直接渲染原生 <label> 的极简实现，足够支撑当前表单需求。
 */
function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      data-slot="label"
      className={cn(
        "text-xs font-medium leading-none text-muted-foreground select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

export { Label }

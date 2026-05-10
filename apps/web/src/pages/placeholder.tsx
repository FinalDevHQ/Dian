import { Construction } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface PlaceholderPageProps {
  title: string
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Construction className="size-8 text-muted-foreground" aria-hidden />
        <div className="text-base font-medium">{title}</div>
        <p className="text-sm text-muted-foreground">
          此页面功能正在开发中，敬请期待。
        </p>
      </CardContent>
    </Card>
  )
}

import { useMemo, useState } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { navGroups } from "@/components/layout/nav-config"
import { ConfigFilesPage } from "@/pages/config-files"
import { DashboardPage } from "@/pages/dashboard"
import { PlaceholderPage } from "@/pages/placeholder"

function App() {
  const [active, setActive] = useState("dashboard")

  const title = useMemo(() => {
    for (const g of navGroups) {
      const hit = g.items.find((i) => i.key === active)
      if (hit) return hit.label
    }
    return "Dian"
  }, [active])

  return (
    <AppLayout active={active} onNavigate={setActive} title={title}>
      {active === "dashboard" ? (
        <DashboardPage />
      ) : active === "config" ? (
        <ConfigFilesPage />
      ) : (
        <PlaceholderPage title={title} />
      )}
    </AppLayout>
  )
}

export default App

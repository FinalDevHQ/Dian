import { useMemo, useState } from "react"
import { AppLayout } from "@/components/layout/app-layout"
import { navGroups } from "@/components/layout/nav-config"
import { AnalyticsPage } from "@/pages/analytics"
import { ConfigFilesPage } from "@/pages/config-files"
import { DashboardPage } from "@/pages/dashboard"
import { DatabasePage } from "@/pages/database"
import { LogsPage } from "@/pages/logs"
import { PluginsPage } from "@/pages/plugins"
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
      ) : active === "logs" ? (
        <LogsPage />
      ) : active === "plugins" ? (
        <PluginsPage />
      ) : active === "database" ? (
        <DatabasePage />
      ) : active === "config" ? (
        <ConfigFilesPage />
      ) : active === "analytics" ? (
        <AnalyticsPage />
      ) : (
        <PlaceholderPage title={title} />
      )}
    </AppLayout>
  )
}

export default App

import { useCallback, useEffect, useState } from "react"

type Theme = "light" | "dark" | "system"

const STORAGE_KEY = "dian-theme"

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function resolveTheme(theme: Theme): "light" | "dark" {
  return theme === "system" ? getSystemTheme() : theme
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    return stored ?? "system"
  })

  const resolved = resolveTheme(theme)

  // 应用 .dark class 到 <html>
  useEffect(() => {
    const root = document.documentElement
    if (resolved === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }
  }, [resolved])

  // 监听系统主题变化（当 theme=system 时生效）
  useEffect(() => {
    if (theme !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => {
      const root = document.documentElement
      if (getSystemTheme() === "dark") {
        root.classList.add("dark")
      } else {
        root.classList.remove("dark")
      }
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [theme])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    localStorage.setItem(STORAGE_KEY, t)
  }, [])

  const cycleTheme = useCallback(() => {
    setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light")
  }, [theme, setTheme])

  return { theme, resolved, setTheme, cycleTheme }
}

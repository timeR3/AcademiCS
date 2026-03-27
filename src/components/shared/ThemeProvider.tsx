"use client"

import * as React from "react"

type ThemeMode = "light" | "dark" | "system"

type ThemeContextValue = {
  theme: ThemeMode
  resolvedTheme: "light" | "dark"
  setTheme: (theme: ThemeMode) => void
}

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: ThemeMode
  enableSystem?: boolean
  attribute?: "class"
  disableTransitionOnChange?: boolean
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

function systemTheme(): "light" | "dark" {
  if (typeof window === "undefined") {
    return "light"
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function normalizeTheme(value: string | null | undefined): ThemeMode {
  if (value === "light" || value === "dark" || value === "system") {
    return value
  }
  return "system"
}

export function ThemeProvider({ children, defaultTheme = "system", enableSystem = true }: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return defaultTheme
    }
    const saved = normalizeTheme(window.localStorage.getItem("theme"))
    return saved || defaultTheme
  })
  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">(() => {
    if (typeof window === "undefined") {
      return defaultTheme === "dark" ? "dark" : "light"
    }
    if (theme === "system") {
      return enableSystem ? systemTheme() : "light"
    }
    return theme
  })

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    const root = document.documentElement
    const nextResolved = theme === "system" ? (enableSystem ? systemTheme() : "light") : theme
    setResolvedTheme(nextResolved)
    root.classList.remove("light", "dark")
    root.classList.add(nextResolved)
    window.localStorage.setItem("theme", theme)
  }, [theme, enableSystem])

  React.useEffect(() => {
    if (!enableSystem || typeof window === "undefined") {
      return
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => {
      if (theme === "system") {
        const nextResolved = media.matches ? "dark" : "light"
        setResolvedTheme(nextResolved)
        const root = document.documentElement
        root.classList.remove("light", "dark")
        root.classList.add(nextResolved)
      }
    }
    media.addEventListener("change", handleChange)
    return () => {
      media.removeEventListener("change", handleChange)
    }
  }, [theme, enableSystem])

  const setTheme = React.useCallback((nextTheme: ThemeMode) => {
    setThemeState(nextTheme)
  }, [])

  const value = React.useMemo<ThemeContextValue>(() => ({
    theme,
    resolvedTheme,
    setTheme,
  }), [theme, resolvedTheme, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme debe usarse dentro de ThemeProvider.")
  }
  return context
}

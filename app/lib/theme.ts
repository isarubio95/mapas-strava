import { useSyncExternalStore } from "react"

export type Theme = "light" | "dark"

export const THEME_KEY = "trazo-theme"

// Runs in <head> before first paint so the page never flashes the wrong theme.
export const themeScript = `(()=>{try{var t=localStorage.getItem("${THEME_KEY}");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}})()`

const listeners = new Set<() => void>()
let media: MediaQueryList | null = null

function onSystemChange() {
  if (!localStorage.getItem(THEME_KEY)) {
    applyTheme(media?.matches ? "dark" : "light", { persist: false })
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!media) {
    media = window.matchMedia("(prefers-color-scheme: dark)")
    media.addEventListener("change", onSystemChange)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && media) {
      media.removeEventListener("change", onSystemChange)
      media = null
    }
  }
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

let transitionTimer: ReturnType<typeof setTimeout> | undefined

export function applyTheme(theme: Theme, { persist = true } = {}) {
  const root = document.documentElement
  // Colors cross-fade only while switching, so hovers stay instant otherwise.
  root.classList.add("theme-transition")
  clearTimeout(transitionTimer)
  transitionTimer = setTimeout(
    () => root.classList.remove("theme-transition"),
    600
  )

  root.classList.toggle("dark", theme === "dark")
  if (persist) localStorage.setItem(THEME_KEY, theme)
  listeners.forEach((listener) => listener())
}

/** `theme` is null during SSR, when the stored preference is unknown. */
export function useTheme() {
  const theme = useSyncExternalStore<Theme | null>(
    subscribe,
    getSnapshot,
    () => null
  )
  return { theme, setTheme: applyTheme }
}

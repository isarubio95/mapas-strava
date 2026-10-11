import { useEffect, useRef, useState } from "react"

import { Logo } from "~/components/logo"
import { useMediaQuery } from "~/lib/use-media-query"
import { useTheme, type Theme } from "~/lib/theme"
import { cn } from "~/lib/utils"

import type { LoaderScene } from "./loader-scene"

const currentTheme = (): Theme =>
  document.documentElement.classList.contains("dark") ? "dark" : "light"

/**
 * Full-screen loading state while the activities arrive: a 3D city that
 * fills up with routes. three.js loads on demand, so until it is ready (or
 * without WebGL) the screen is just the message on the map background.
 */
export function RoutesLoader({ label = "Cargando tus rutas…" }: { label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<LoaderScene | null>(null)
  const [ready, setReady] = useState(false)
  const { theme } = useTheme()
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)")

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    void import("./loader-scene").then(({ createLoaderScene }) => {
      if (cancelled) return
      try {
        sceneRef.current = createLoaderScene(canvas, {
          theme: currentTheme(),
          reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        })
        setReady(true)
      } catch {
        // No WebGL: the message alone still says what is going on.
      }
    })
    return () => {
      cancelled = true
      sceneRef.current?.dispose()
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    if (theme) sceneRef.current?.setTheme(theme)
  }, [theme, ready])

  useEffect(() => {
    sceneRef.current?.setReducedMotion(reducedMotion)
  }, [reducedMotion, ready])

  return (
    <main className="relative h-svh overflow-hidden bg-background">
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={cn(
          "absolute inset-0 size-full opacity-0 transition-opacity duration-1000",
          ready && "opacity-100"
        )}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,color-mix(in_oklab,var(--background)_70%,transparent)_80%,var(--background)_100%)]" />

      <header className="absolute top-0 left-0 p-5 md:px-8 md:py-6">
        <Logo />
      </header>

      <div className="absolute inset-x-0 bottom-[max(2.5rem,10svh)] flex justify-center px-5">
        <p
          role="status"
          className="panel flex items-center gap-2.5 rounded-full py-2 pr-4 pl-3 text-sm font-medium"
        >
          <span className="relative flex size-2.5" aria-hidden="true">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
            <span className="relative size-2.5 rounded-full bg-primary" />
          </span>
          {label}
        </p>
      </div>
    </main>
  )
}

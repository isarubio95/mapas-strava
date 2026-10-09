import {
  FireIcon,
  ImageIcon,
  MagnifyingGlassIcon,
  SidebarSimpleIcon,
  SquaresFourIcon,
  RowsIcon,
} from "@phosphor-icons/react"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { Link, useSearchParams } from "react-router"

import { MapCanvas } from "~/components/map/map-canvas"
import type { MapMode } from "~/components/map/route-map"
import { AccountMenu, type Account } from "~/components/shell/account-menu"
import { DetailPanel } from "~/components/shell/detail-panel"
import { FiltersForm } from "~/components/shell/filters-form"
import { SportsRail } from "~/components/shell/sports-rail"
import { Stats } from "~/components/shell/stats"
import { Timeline } from "~/components/shell/timeline"
import { ThemeSwitch } from "~/components/theme-switch"
import { Button } from "~/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer"
import { ScrollArea } from "~/components/ui/scroll-area"
import { filtersFromSearch, filtersToSearch } from "~/lib/filters-url"
import type { Filters, NearPoint } from "~/lib/filters"
import type { DatasetMeta, Histogram, Summary } from "~/lib/map/engine"
import { useMediaQuery } from "~/lib/use-media-query"
import { useTheme } from "~/lib/theme"
import type { Activity, ActivityProfile } from "~/lib/activities"
import type { SportColors } from "~/lib/sports"

const LAYOUT_KEY = "trazo-layout"

export type LayoutId = "hud" | "sidebar" | "dock"

const LAYOUTS: {
  id: LayoutId
  label: string
  hint: string
  icon: typeof SquaresFourIcon
}[] = [
  {
    id: "hud",
    label: "HUD",
    hint: "Paneles sobre el mapa",
    icon: SquaresFourIcon,
  },
  {
    id: "sidebar",
    label: "Barra",
    hint: "Filtros a un lado",
    icon: SidebarSimpleIcon,
  },
  { id: "dock", label: "Dock", hint: "Mapa y poco más", icon: RowsIcon },
]

function readLayout(): LayoutId {
  if (typeof window === "undefined") return "hud"
  const stored = window.localStorage.getItem(LAYOUT_KEY)
  return stored === "sidebar" || stored === "dock" ? stored : "hud"
}

/**
 * The whole map screen. Shared by `/` (real activities) and `/prototipos`
 * (synthetic ones). It lives outside app/routes because React Router wraps a
 * route's default export and drops any props passed to it.
 */
export function MapApp({
  activities,
  banner = null,
  sportColors,
  loadProfile,
  account = null,
}: {
  activities: Activity[]
  banner?: ReactNode
  sportColors?: SportColors
  loadProfile: (activity: Activity) => Promise<ActivityProfile | null>
  account?: Account | null
}) {
  const { theme } = useTheme()
  const resolved = theme ?? "light"
  const mobile = useMediaQuery("(max-width: 767px)")
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => filtersFromSearch(params), [params])
  const mode: MapMode =
    params.get("vista") === "calor"
      ? "heatmap"
      : params.get("vista") === "tiempo"
        ? "playback"
        : "routes"
  const selectedId = params.get("ruta") ? Number(params.get("ruta")) : null
  const [layout, setLayout] = useState<LayoutId>("hud")
  const [summary, setSummary] = useState<Summary | null>(null)
  const [meta, setMeta] = useState<DatasetMeta | null>(null)
  const [timeline, setTimeline] = useState<Histogram | null>(null)
  const [pickingPoint, setPickingPoint] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [overlapped, setOverlapped] = useState<number[]>([])
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(4)
  const [playDay, setPlayDay] = useState<number | null>(null)
  const [heatRadius, setHeatRadius] = useState(28)
  const [profile, setProfile] = useState<{
    id: number
    data: ActivityProfile | null
  } | null>(null)

  const setFilters = useCallback(
    (next: Filters) => {
      setParams((prev) => filtersToSearch(next, prev), {
        replace: true,
        preventScrollReset: true,
      })
    },
    [setParams]
  )

  const setMode = useCallback(
    (next: MapMode) => {
      setPlaying(false)
      setParams(
        (prev) => {
          const copy = new URLSearchParams(prev)
          if (next === "routes") copy.delete("vista")
          else copy.set("vista", next === "heatmap" ? "calor" : "tiempo")
          return copy
        },
        { replace: true, preventScrollReset: true }
      )
    },
    [setParams]
  )

  const selectRoute = useCallback(
    (id: number | null, ids: number[] = id == null ? [] : [id]) => {
      setOverlapped(ids)
      setParams(
        (prev) => {
          const copy = new URLSearchParams(prev)
          if (id == null) copy.delete("ruta")
          else copy.set("ruta", String(id))
          return copy
        },
        { replace: true, preventScrollReset: true }
      )
    },
    [setParams]
  )

  useEffect(() => {
    setLayout(readLayout())
  }, [])

  const onSummary = useCallback(
    (next: Summary, nextMeta: DatasetMeta, nextTimeline: Histogram | null) => {
      setSummary(next)
      setMeta(nextMeta)
      setTimeline(nextTimeline)
    },
    []
  )

  useEffect(() => {
    if (!playing || meta?.firstDay == null || meta.lastDay == null) return
    let frame = 0
    let last = performance.now()
    const end = meta.lastDay + 1
    const tick = (now: number) => {
      const step = ((now - last) / 1000) * speed * 7
      last = now
      setPlayDay((current) => {
        const next = (current ?? meta.firstDay!) + step
        if (next >= end) {
          setPlaying(false)
          return end
        }
        return next
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, speed, meta])

  const selected =
    activities.find((activity) => activity.id === selectedId) ?? null

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    void loadProfile(selected)
      .catch(() => null)
      .then((data) => {
        if (!cancelled) setProfile({ id: selected.id, data })
      })
    return () => {
      cancelled = true
    }
  }, [selected, loadProfile])
  const overlappedActivities = overlapped
    .map((id) => activities.find((activity) => activity.id === id))
    .filter((activity): activity is NonNullable<typeof activity> =>
      Boolean(activity)
    )

  const choose = (id: LayoutId) => {
    setLayout(id)
    window.localStorage.setItem(LAYOUT_KEY, id)
  }

  const onPickPoint = (point: { lng: number; lat: number }) => {
    const previous: NearPoint | null = filters.near
    setFilters({
      ...filters,
      near: { lng: point.lng, lat: point.lat, radius: previous?.radius ?? 500 },
    })
    setPickingPoint(false)
  }

  const accountMenu = account ? <AccountMenu account={account} /> : null

  const chrome = {
    filters,
    onChange: setFilters,
    pickingPoint,
    onPickPoint: () => setPickingPoint((value) => !value),
    maxKm: meta?.maxKm ?? 200,
  }

  return (
    <main className="relative h-svh overflow-hidden bg-background">
      <h1 className="sr-only">Mapa de Trazo</h1>
      {banner}
      <div className="flex h-full">
        {layout === "sidebar" && !mobile && (
          <aside className="panel z-10 m-3 flex w-[22rem] shrink-0 flex-col rounded-4xl">
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              {accountMenu ?? <span />}
              <ThemeSwitch />
            </div>
            <ScrollArea className="min-h-0 flex-1 px-4 pb-4">
              <SportsRail
                filters={filters}
                onChange={setFilters}
                theme={resolved}
                orientation="horizontal"
              />
              <div className="mt-5">
                <FiltersForm {...chrome} />
              </div>
            </ScrollArea>
            <div className="border-t border-panel-border px-4 py-3">
              <Stats summary={summary} />
            </div>
          </aside>
        )}

        <div className="relative min-h-0 min-w-0 flex-1">
          <MapCanvas
            activities={activities}
            filters={filters}
            theme={resolved}
            sportColors={sportColors}
            mode={mode}
            selectedId={selectedId}
            onSelect={selectRoute}
            pickingPoint={pickingPoint}
            onPickPoint={onPickPoint}
            onSummary={onSummary}
            playbackTime={playDay ?? meta?.firstDay ?? 0}
            heatmapRadius={heatRadius}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-36 z-30 flex flex-col items-end gap-3 px-4 md:bottom-28">
            {mode === "heatmap" && (
              <label className="panel pointer-events-auto flex items-center gap-3 rounded-4xl px-4 py-2 text-sm">
                Radio
                <input
                  type="range"
                  min={8}
                  max={80}
                  value={heatRadius}
                  aria-label="Radio del mapa de calor"
                  onChange={(event) =>
                    setHeatRadius(Number(event.target.value))
                  }
                />
              </label>
            )}
            {mode === "playback" && (
              <Timeline
                histogram={timeline}
                day={playDay ?? meta?.firstDay ?? 0}
                playing={playing}
                speed={speed}
                onDay={(day) => {
                  setPlaying(false)
                  setPlayDay(day)
                }}
                onPlaying={setPlaying}
                onSpeed={setSpeed}
              />
            )}
            {selected && (
              <DetailPanel
                activity={selected}
                overlapped={overlappedActivities}
                profile={profile?.id === selected.id ? profile.data : null}
                theme={resolved}
                onSelect={(id) => selectRoute(id, overlapped)}
                onClose={() => selectRoute(null)}
              />
            )}
          </div>

          {layout === "hud" && !mobile && (
            <HudChrome
              {...chrome}
              theme={resolved}
              summary={summary}
              mode={mode}
              onMode={setMode}
              accountMenu={accountMenu}
            />
          )}

          {layout === "dock" && !mobile && (
            <DockChrome
              {...chrome}
              theme={resolved}
              summary={summary}
              mode={mode}
              onMode={setMode}
              filtersOpen={filtersOpen}
              onFiltersOpen={setFiltersOpen}
              accountMenu={accountMenu}
            />
          )}

          {mobile && (
            <MobileChrome
              {...chrome}
              theme={resolved}
              summary={summary}
              mode={mode}
              onMode={setMode}
              accountMenu={accountMenu}
            />
          )}
        </div>
      </div>

      {!mobile && (
        <nav
          aria-label="Distribución"
          className="pointer-events-auto absolute top-4 left-1/2 z-20 -translate-x-1/2"
        >
          <div className="panel flex items-center gap-1 rounded-4xl p-1">
            {LAYOUTS.map((item) => {
              const Icon = item.icon
              const on = layout === item.id
              return (
                <Button
                  key={item.id}
                  type="button"
                  size="sm"
                  variant={on ? "default" : "ghost"}
                  aria-pressed={on}
                  title={item.hint}
                  className="rounded-4xl"
                  onClick={() => choose(item.id)}
                >
                  <Icon data-icon="inline-start" weight="fill" />
                  {item.label}
                </Button>
              )
            })}
          </div>
        </nav>
      )}
    </main>
  )
}

function HudChrome({
  filters,
  onChange,
  theme,
  summary,
  mode,
  onMode,
  pickingPoint,
  onPickPoint,
  maxKm,
  accountMenu,
}: {
  filters: Filters
  onChange: (filters: Filters) => void
  theme: "light" | "dark"
  summary: Summary | null
  mode: MapMode
  onMode: (mode: MapMode) => void
  pickingPoint: boolean
  onPickPoint: () => void
  maxKm: number
  accountMenu: ReactNode
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 hidden md:flex">
      <div className="flex w-full flex-col justify-between p-4 pt-16">
        <div className="flex items-start justify-between gap-3">
          <div className="pointer-events-auto flex flex-col items-start gap-2">
            {accountMenu}
            <div className="panel rounded-4xl p-2">
              <SportsRail
                filters={filters}
                onChange={onChange}
                theme={theme}
                orientation="vertical"
              />
            </div>
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            <ModeToggle mode={mode} onMode={onMode} />
            <ThemeSwitch />
          </div>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="panel pointer-events-auto max-h-[46vh] w-[22rem] overflow-auto rounded-4xl p-4">
            <FiltersForm
              filters={filters}
              onChange={onChange}
              pickingPoint={pickingPoint}
              onPickPoint={onPickPoint}
              maxKm={maxKm}
            />
          </div>
          <div className="panel pointer-events-auto rounded-4xl px-4 py-3">
            <Stats summary={summary} />
          </div>
        </div>
      </div>
    </div>
  )
}

function DockChrome({
  filters,
  onChange,
  theme,
  summary,
  mode,
  onMode,
  pickingPoint,
  onPickPoint,
  maxKm,
  filtersOpen,
  onFiltersOpen,
  accountMenu,
}: {
  filters: Filters
  onChange: (filters: Filters) => void
  theme: "light" | "dark"
  summary: Summary | null
  mode: MapMode
  onMode: (mode: MapMode) => void
  pickingPoint: boolean
  onPickPoint: () => void
  maxKm: number
  filtersOpen: boolean
  onFiltersOpen: (open: boolean) => void
  accountMenu: ReactNode
}) {
  const chips: string[] = []
  if (filters.sports?.length) chips.push(`${filters.sports.length} deportes`)
  if (filters.from) chips.push(filters.from.slice(0, 4))
  if (filters.zone) chips.push("lugar")
  if (filters.near) chips.push("cerca")

  return (
    <div className="pointer-events-none absolute inset-0 z-10 hidden flex-col justify-between p-4 pt-16 md:flex">
      <div className="flex items-start justify-between gap-3">
        <div className="pointer-events-auto flex items-center gap-2">
          {accountMenu}
          {chips.length > 0 && (
            <p className="panel rounded-4xl px-3 py-2 text-xs text-muted-foreground">
              {chips.join(" · ")}
            </p>
          )}
        </div>
        <div className="pointer-events-auto">
          <ThemeSwitch />
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        {filtersOpen && (
          <div className="panel pointer-events-auto max-h-[50vh] w-[24rem] overflow-auto rounded-4xl p-4">
            <SportsRail
              filters={filters}
              onChange={onChange}
              theme={theme}
              orientation="horizontal"
            />
            <div className="mt-4">
              <FiltersForm
                filters={filters}
                onChange={onChange}
                pickingPoint={pickingPoint}
                onPickPoint={onPickPoint}
                maxKm={maxKm}
              />
            </div>
          </div>
        )}
        <div className="panel pointer-events-auto flex items-center gap-1 rounded-4xl p-1.5">
          <Button
            type="button"
            size="icon-lg"
            variant="ghost"
            aria-label="Buscar"
            className="rounded-4xl"
          >
            <MagnifyingGlassIcon weight="fill" />
          </Button>
          <Button
            type="button"
            size="icon-lg"
            variant={filtersOpen ? "default" : "ghost"}
            aria-expanded={filtersOpen}
            aria-label="Filtros"
            className="rounded-4xl"
            onClick={() => onFiltersOpen(!filtersOpen)}
          >
            <SquaresFourIcon weight="fill" />
          </Button>
          <Button
            type="button"
            size="icon-lg"
            variant={mode === "heatmap" ? "default" : "ghost"}
            aria-label="Mapa de calor"
            className="rounded-4xl"
            onClick={() => onMode(mode === "heatmap" ? "routes" : "heatmap")}
          >
            <FireIcon weight="fill" />
          </Button>
          <Link
            to="/poster"
            aria-label="Póster"
            className="inline-flex size-10 items-center justify-center rounded-4xl hover:bg-muted"
          >
            <ImageIcon weight="fill" className="size-5" />
          </Link>
          <div className="px-3">
            <Stats summary={summary} compact />
          </div>
        </div>
      </div>
    </div>
  )
}

function MobileChrome({
  filters,
  onChange,
  theme,
  summary,
  pickingPoint,
  onPickPoint,
  maxKm,
  mode,
  onMode,
  accountMenu,
}: {
  filters: Filters
  onChange: (filters: Filters) => void
  theme: "light" | "dark"
  summary: Summary | null
  pickingPoint: boolean
  onPickPoint: () => void
  maxKm: number
  mode: MapMode
  onMode: (mode: MapMode) => void
  accountMenu: ReactNode
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 md:hidden">
      <div className="flex items-start justify-between">
        <div className="pointer-events-auto">{accountMenu}</div>
        <div className="pointer-events-auto">
          <ThemeSwitch />
        </div>
      </div>
      <Drawer>
        <DrawerTrigger
          render={
            <button
              type="button"
              className="panel pointer-events-auto mx-auto flex w-full max-w-lg items-center justify-between rounded-4xl px-4 py-3 text-left"
            />
          }
        >
          <Stats summary={summary} compact />
          <span className="text-xs text-muted-foreground">Filtros</span>
        </DrawerTrigger>
        <DrawerContent className="px-4 pb-6">
          <DrawerHeader>
            <DrawerTitle>Filtros</DrawerTitle>
            <DrawerDescription>Lo que ves en el mapa.</DrawerDescription>
          </DrawerHeader>
          <SportsRail
            filters={filters}
            onChange={onChange}
            theme={theme}
            orientation="horizontal"
          />
          <div className="mt-4">
            <FiltersForm
              filters={filters}
              onChange={onChange}
              pickingPoint={pickingPoint}
              onPickPoint={onPickPoint}
              maxKm={maxKm}
            />
          </div>
          <div className="mt-4">
            <ModeToggle mode={mode} onMode={onMode} />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

function ModeToggle({
  mode,
  onMode,
}: {
  mode: MapMode
  onMode: (mode: MapMode) => void
}) {
  return (
    <div className="panel flex gap-1 rounded-4xl p-1">
      <Button
        type="button"
        size="sm"
        variant={mode === "routes" ? "default" : "ghost"}
        className="rounded-4xl"
        onClick={() => onMode("routes")}
      >
        Rutas
      </Button>
      <Button
        type="button"
        size="sm"
        variant={mode === "heatmap" ? "default" : "ghost"}
        className="rounded-4xl"
        onClick={() => onMode("heatmap")}
      >
        Calor
      </Button>
      <Button
        type="button"
        size="sm"
        variant={mode === "playback" ? "default" : "ghost"}
        className="rounded-4xl"
        onClick={() => onMode("playback")}
      >
        Tiempo
      </Button>
    </div>
  )
}

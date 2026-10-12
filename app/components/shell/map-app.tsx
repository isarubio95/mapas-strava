import {
  ImageIcon,
  SidebarSimpleIcon,
  SlidersHorizontalIcon,
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

import { Logo } from "~/components/logo"
import { FlyoverHud } from "~/components/map/flyover-hud"
import { MapCanvas } from "~/components/map/map-canvas"
import type { MapMode, Padding } from "~/components/map/route-map"
import { AccountMenu, type Account } from "~/components/shell/account-menu"
import { DetailPanel } from "~/components/shell/detail-panel"
import { FiltersForm } from "~/components/shell/filters-form"
import { RouteSearch, RouteSearchButton } from "~/components/shell/route-search"
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
import { Segmented, type SegmentedItem } from "~/components/ui/segmented"
import { filtersFromSearch, filtersToSearch } from "~/lib/filters-url"
import type { Filters, NearPoint } from "~/lib/filters"
import type { BBox } from "~/lib/geo"
import type { DatasetMeta, Histogram, Summary } from "~/lib/map/engine"
import { createFlyoverProgress } from "~/lib/map/flyover"
import { formatBBox } from "~/lib/poster"
import { useMediaQuery } from "~/lib/use-media-query"
import { useTheme } from "~/lib/theme"
import {
  visitedZones,
  type Activity,
  type ActivityProfile,
  type VisitedZone,
  type Zone,
} from "~/lib/activities"
import { sportColor, sportsByUse, type SportColors } from "~/lib/sports"
import { cn } from "~/lib/utils"

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

/** Room around a route shown alone, clear of the panels of each layout. */
const FOCUS_PADDING: Record<"desktop" | "mobile", Padding> = {
  // The detail panel sits bottom right.
  desktop: { top: 112, bottom: 96, left: 112, right: 420 },
  // The detail panel covers the lower half.
  mobile: { top: 88, bottom: 470, left: 32, right: 32 },
}

/** `?vista=` values for each map mode; the route view has none. */
const VIEW_PARAM: Record<Exclude<MapMode, "routes">, string> = {
  heatmap: "calor",
  playback: "tiempo",
  relief: "3d",
}

function modeFromParam(value: string | null): MapMode {
  const found = Object.entries(VIEW_PARAM).find(([, param]) => param === value)
  return found ? (found[0] as MapMode) : "routes"
}

/** Modes that show routes one by one, where a lone route makes sense. */
const showsRoutes = (mode: MapMode) => mode === "routes" || mode === "relief"

/** Panels step aside while the camera flies along a route in 3D. */
const HIDE_WHILE_FLYING =
  "transition-[opacity,visibility] duration-500 group-data-flying/app:invisible group-data-flying/app:opacity-0"

const NO_ZONES: Zone[] = []

/** Whether a key press happened while typing, so shortcuts stay out of the way. */
function typing(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  )
}

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
  zones = NO_ZONES,
}: {
  activities: Activity[]
  /** Catalog of places the activities may be tagged with. */
  zones?: Zone[]
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
  const mode = modeFromParam(params.get("vista"))
  const selectedId = params.get("ruta") ? Number(params.get("ruta")) : null
  const focused = selectedId != null && params.get("solo") === "1"
  const [searchOpen, setSearchOpen] = useState(false)
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
  const [flying, setFlying] = useState(false)
  const [flyoverProgress] = useState(createFlyoverProgress)
  const [view, setView] = useState<BBox | null>(null)
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
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
          else copy.set("vista", VIEW_PARAM[next])
          // A lone route only makes sense over the routes, flat or in 3D.
          if (!showsRoutes(next)) copy.delete("solo")
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
          if (id == null) {
            copy.delete("ruta")
            copy.delete("solo")
          } else copy.set("ruta", String(id))
          return copy
        },
        { replace: true, preventScrollReset: true }
      )
    },
    [setParams]
  )

  /** Shows the selected route alone, over the route view, or every route again. */
  const setFocused = useCallback(
    (on: boolean, id?: number) => {
      if (on) setPlaying(false)
      setParams(
        (prev) => {
          const copy = new URLSearchParams(prev)
          if (id != null) copy.set("ruta", String(id))
          if (on) {
            copy.set("solo", "1")
            if (!showsRoutes(modeFromParam(copy.get("vista"))))
              copy.delete("vista")
          } else copy.delete("solo")
          return copy
        },
        { replace: true, preventScrollReset: true }
      )
    },
    [setParams]
  )

  const pickRoute = useCallback(
    (id: number) => {
      setOverlapped([id])
      setFocused(true, id)
      setSearchOpen(false)
    },
    [setFocused]
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const command =
        event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)
      const slash = event.key === "/" && !typing(event.target)
      if (!command && !slash) return
      event.preventDefault()
      setSearchOpen(true)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    setLayout(readLayout())
  }, [])

  // The flight follows the selected route in 3D; anything else ends it.
  useEffect(() => {
    setFlying(false)
  }, [mode, selectedId])

  useEffect(() => {
    if (!flying) return
    flyoverProgress.set(0)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFlying(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [flying, flyoverProgress])

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

  const sports = useMemo(
    () => sportsByUse(activities.map((activity) => activity.sportType)),
    [activities]
  )

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

  // The poster opens on what the map shows: the selected route, or the
  // filtered routes framed like the map.
  const posterHref = useMemo(() => {
    const search = filtersToSearch(filters, new URLSearchParams())
    if (selectedId != null) search.set("ruta", String(selectedId))
    else if (view) search.set("encuadre", formatBBox(view))
    const query = search.toString()
    return query ? `/poster?${query}` : "/poster"
  }, [filters, selectedId, view])

  const openSearch = () => setSearchOpen(true)

  const stopFlying = useCallback(() => setFlying(false), [])

  const places = useMemo(
    () => visitedZones(zones, meta?.zones ?? [], meta?.startZones ?? []),
    [zones, meta]
  )

  const chrome = {
    filters,
    onChange: setFilters,
    pickingPoint,
    onPickPoint: () => setPickingPoint((value) => !value),
    maxKm: meta?.maxKm ?? 200,
    places,
    onSearch: openSearch,
  }

  return (
    <main
      className="group/app relative h-svh overflow-hidden bg-background"
      data-flying={flying || undefined}
    >
      <h1 className="sr-only">Mapa de Trazo</h1>
      {banner}
      <div className="flex h-full">
        {layout === "sidebar" && !mobile && (
          <aside
            className={cn(
              "panel z-10 m-3 mt-34 flex w-[22rem] shrink-0 flex-col rounded-4xl lg:mt-20",
              HIDE_WHILE_FLYING
            )}
          >
            <ScrollArea className="min-h-0 flex-1 p-4">
              <SportsRail
                sports={sports}
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
            labels
            selectedId={selectedId}
            focused={focused}
            focusPadding={FOCUS_PADDING[mobile ? "mobile" : "desktop"]}
            onSelect={selectRoute}
            pickingPoint={pickingPoint}
            onPickPoint={onPickPoint}
            onSummary={onSummary}
            playbackTime={playDay ?? meta?.firstDay ?? 0}
            heatmapRadius={heatRadius}
            flyover={flying}
            onFlyoverProgress={flyoverProgress.set}
            onFlyoverEnd={stopFlying}
            onViewChange={setView}
          />
          {flying && selected && (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex animate-in justify-center px-3 duration-500 fade-in-0 slide-in-from-bottom-4 md:bottom-6">
              <FlyoverHud
                activity={selected}
                color={sportColor(selected.sportType, resolved, sportColors)}
                profile={profile?.id === selected.id ? profile.data : null}
                progress={flyoverProgress}
                onStop={stopFlying}
              />
            </div>
          )}
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-36 z-30 flex flex-col items-end gap-3 px-4 md:bottom-28",
              HIDE_WHILE_FLYING
            )}
          >
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
                profileLoading={profile?.id !== selected.id}
                theme={resolved}
                focused={focused}
                onFocus={(on) => setFocused(on)}
                onFlyover={
                  mode === "relief" && !reducedMotion
                    ? () => setFlying(true)
                    : undefined
                }
                onSelect={(id) => selectRoute(id, overlapped)}
                onClose={() => selectRoute(null)}
              />
            )}
          </div>

          {layout === "hud" && !mobile && (
            <HudChrome
              {...chrome}
              sports={sports}
              theme={resolved}
              summary={summary}
            />
          )}

          {layout === "dock" && !mobile && (
            <DockChrome
              {...chrome}
              sports={sports}
              theme={resolved}
              summary={summary}
              filtersOpen={filtersOpen}
              onFiltersOpen={setFiltersOpen}
            />
          )}

          {mobile && (
            <MobileChrome
              {...chrome}
              sports={sports}
              theme={resolved}
              summary={summary}
              mode={mode}
              onMode={setMode}
              accountMenu={accountMenu}
              posterHref={posterHref}
            />
          )}
        </div>
      </div>

      {!mobile && (
        <TopBar
          layout={layout}
          onLayout={choose}
          mode={mode}
          onMode={setMode}
          onSearch={openSearch}
          accountMenu={accountMenu}
          posterHref={posterHref}
        />
      )}

      <RouteSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        activities={activities}
        selectedId={selectedId}
        theme={resolved}
        sportColors={sportColors}
        onPick={pickRoute}
      />
    </main>
  )
}

function HudChrome({
  sports,
  filters,
  onChange,
  theme,
  summary,
  pickingPoint,
  onPickPoint,
  maxKm,
  places,
}: {
  sports: string[]
  filters: Filters
  onChange: (filters: Filters) => void
  theme: "light" | "dark"
  summary: Summary | null
  pickingPoint: boolean
  onPickPoint: () => void
  maxKm: number
  places: VisitedZone[]
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-10 hidden md:flex",
        HIDE_WHILE_FLYING
      )}
    >
      <div className="flex w-full flex-col justify-between p-4 pt-20">
        <div className="flex items-start">
          {sports.length > 0 && (
            <div className="panel pointer-events-auto rounded-4xl p-2">
              <SportsRail
                sports={sports}
                filters={filters}
                onChange={onChange}
                theme={theme}
                orientation="vertical"
              />
            </div>
          )}
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="panel pointer-events-auto max-h-[46vh] w-[22rem] overflow-auto rounded-4xl p-4">
            <FiltersForm
              filters={filters}
              onChange={onChange}
              pickingPoint={pickingPoint}
              onPickPoint={onPickPoint}
              maxKm={maxKm}
              places={places}
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
  sports,
  filters,
  onChange,
  theme,
  summary,
  pickingPoint,
  onPickPoint,
  maxKm,
  places,
  filtersOpen,
  onFiltersOpen,
}: {
  sports: string[]
  filters: Filters
  onChange: (filters: Filters) => void
  theme: "light" | "dark"
  summary: Summary | null
  pickingPoint: boolean
  onPickPoint: () => void
  maxKm: number
  places: VisitedZone[]
  filtersOpen: boolean
  onFiltersOpen: (open: boolean) => void
}) {
  const chips: string[] = []
  if (filters.sports?.length) chips.push(`${filters.sports.length} deportes`)
  if (filters.from) chips.push(filters.from.slice(0, 4))
  if (filters.zone) chips.push("lugar")
  if (filters.near) chips.push("cerca")

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-10 hidden flex-col justify-end p-4 pt-20 md:flex",
        HIDE_WHILE_FLYING
      )}
    >
      <div className="flex flex-col items-center gap-3">
        {filtersOpen && (
          <div className="panel pointer-events-auto max-h-[50vh] w-[24rem] overflow-auto rounded-4xl p-4">
            <SportsRail
              sports={sports}
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
                places={places}
              />
            </div>
          </div>
        )}
        <div className="panel pointer-events-auto flex items-center gap-1 rounded-4xl p-1.5">
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
          {chips.length > 0 && (
            <p className="pl-2 text-xs text-muted-foreground">
              {chips.join(" · ")}
            </p>
          )}
          <div className="px-3">
            <Stats summary={summary} compact />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Desktop top bar shared by every layout: brand and layout picker on the left,
 * the map's main actions in the middle, theme and account on the right. Below
 * `lg` the middle group drops to a second row.
 */
function TopBar({
  layout,
  onLayout,
  mode,
  onMode,
  onSearch,
  accountMenu,
  posterHref,
}: {
  layout: LayoutId
  onLayout: (layout: LayoutId) => void
  mode: MapMode
  onMode: (mode: MapMode) => void
  onSearch: () => void
  accountMenu: ReactNode
  posterHref: string
}) {
  return (
    <header
      className={cn(
        "pointer-events-none absolute inset-x-4 top-4 z-20 grid grid-cols-2 items-center gap-x-3 gap-y-2 lg:grid-cols-[1fr_auto_1fr]",
        HIDE_WHILE_FLYING
      )}
    >
      <div className="pointer-events-auto flex items-center gap-2 justify-self-start">
        <Logo className="px-1" />
        <nav aria-label="Distribución">
          <Segmented
            items={LAYOUTS.map((item) => ({
              value: item.id,
              label: item.label,
              title: item.hint,
              icon: item.icon,
            }))}
            value={layout}
            onChange={onLayout}
            labelClassName="sr-only xl:not-sr-only"
          />
        </nav>
      </div>
      <div className="pointer-events-auto col-span-2 row-start-2 flex items-center gap-2 justify-self-center lg:col-span-1 lg:col-start-2 lg:row-start-1">
        <RouteSearchButton onClick={onSearch} />
        <PosterLink to={posterHref} />
        <ModeToggle mode={mode} onMode={onMode} />
      </div>
      <div className="pointer-events-auto col-start-2 row-start-1 flex items-center gap-2 justify-self-end lg:col-start-3">
        <ThemeSwitch className="h-12.5" />
        {accountMenu}
      </div>
    </header>
  )
}

function MobileChrome({
  sports,
  filters,
  onChange,
  theme,
  summary,
  pickingPoint,
  onPickPoint,
  maxKm,
  places,
  mode,
  onMode,
  onSearch,
  accountMenu,
  posterHref,
}: {
  sports: string[]
  filters: Filters
  onChange: (filters: Filters) => void
  theme: "light" | "dark"
  summary: Summary | null
  pickingPoint: boolean
  onPickPoint: () => void
  maxKm: number
  places: VisitedZone[]
  mode: MapMode
  onMode: (mode: MapMode) => void
  onSearch: () => void
  accountMenu: ReactNode
  posterHref: string
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 md:hidden",
        HIDE_WHILE_FLYING
      )}
    >
      <div className="flex items-start justify-between">
        <Logo className="pointer-events-auto h-12.5 px-1" />
        <div className="pointer-events-auto flex items-center gap-3">
          <RouteSearchButton variant="icon" onClick={onSearch} />
          <ThemeSwitch className="h-12.5" />
          {accountMenu}
        </div>
      </div>
      {/* Stats + filters and the poster button share one row. Below 384px
          of row the poster button collapses to its icon, and if the stats
          still don't fit, the last figure wraps out of sight. */}
      <div className="@container mx-auto flex w-full max-w-lg items-center gap-2">
        <Drawer>
          <DrawerTrigger
            render={
              <button
                type="button"
                className="panel pointer-events-auto flex min-w-0 flex-1 items-center justify-between gap-2 rounded-4xl py-3 pr-3.5 pl-4 text-left"
              />
            }
          >
            <Stats
              summary={summary}
              compact
              className="h-7 min-w-0 flex-wrap gap-x-2.5 overflow-hidden [&_dd]:text-base"
            />
            <SlidersHorizontalIcon
              weight="bold"
              className="size-4 shrink-0 text-muted-foreground"
            />
            <span className="sr-only">Filtros</span>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Filtros</DrawerTitle>
              <DrawerDescription>Lo que ves en el mapa.</DrawerDescription>
            </DrawerHeader>
            {/* Long sport lists outgrow the drawer, so its body scrolls. */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-6">
              <SportsRail
                sports={sports}
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
                  places={places}
                />
              </div>
              <div className="mt-4">
                <ModeToggle mode={mode} onMode={onMode} />
              </div>
            </div>
          </DrawerContent>
        </Drawer>
        <PosterLink
          to={posterHref}
          className="pointer-events-auto @max-[24rem]:w-12.5 @max-[24rem]:px-0"
          labelClassName="@max-[24rem]:sr-only"
        />
      </div>
    </div>
  )
}

/** Way into the poster editor: the app's main call to action. */
function PosterLink({
  to,
  className,
  labelClassName,
}: {
  to: string
  className?: string
  labelClassName?: string
}) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex h-12.5 shrink-0 items-center justify-center gap-2 rounded-4xl bg-primary px-5 text-sm font-semibold whitespace-nowrap text-primary-foreground shadow-lg transition-colors outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px",
        className
      )}
    >
      <ImageIcon weight="fill" className="size-5" />
      <span className={labelClassName}>Póster</span>
    </Link>
  )
}

const MODES: SegmentedItem<MapMode>[] = [
  { value: "routes", label: "Rutas" },
  { value: "heatmap", label: "Calor" },
  { value: "playback", label: "Tiempo" },
  { value: "relief", label: "3D", title: "Relieve en 3D" },
]

function ModeToggle({
  mode,
  onMode,
}: {
  mode: MapMode
  onMode: (mode: MapMode) => void
}) {
  return <Segmented items={MODES} value={mode} onChange={onMode} />
}

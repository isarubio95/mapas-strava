import {
  CaretUpIcon,
  ClockCountdownIcon,
  FireIcon,
  ImageIcon,
  MountainsIcon,
  PathIcon,
  SlidersHorizontalIcon,
} from "@phosphor-icons/react"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react"
import { Link, useSearchParams } from "react-router"

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
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import type { SegmentedItem } from "~/components/ui/segmented"
import { filtersFromSearch, filtersToSearch } from "~/lib/filters-url"
import { activeFilterCount, type Filters, type NearPoint } from "~/lib/filters"
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

/** Room around a route shown alone, clear of the panels of each layout. */
const FOCUS_PADDING: Record<"desktop" | "mobile", Padding> = {
  // The detail panel sits bottom right, above the control bar.
  desktop: { top: 96, bottom: 112, left: 112, right: 420 },
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

/** Timeline days that go by per second of playback at 1×. */
const PLAYBACK_DAYS = 7
/** Seconds each route takes to trace itself during playback, at any speed. */
const PLAYBACK_DRAW = 1.6

/** Whether a key press happened while typing, so shortcuts stay out of the way. */
function typing(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  )
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
  const smallPhone = useMediaQuery("(max-width: 375px)")
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => filtersFromSearch(params), [params])
  const mode = modeFromParam(params.get("vista"))
  const selectedId = params.get("ruta") ? Number(params.get("ruta")) : null
  const focused = selectedId != null && params.get("solo") === "1"
  const [searchOpen, setSearchOpen] = useState(false)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [meta, setMeta] = useState<DatasetMeta | null>(null)
  const [timeline, setTimeline] = useState<Histogram | null>(null)
  const [pickingPoint, setPickingPoint] = useState(false)
  const [overlapped, setOverlapped] = useState<number[]>([])
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(4)
  const [playDay, setPlayDay] = useState<number | null>(null)
  const playbackDrawDays = speed * PLAYBACK_DAYS * PLAYBACK_DRAW
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
    // Runs on past the last day so the latest routes finish tracing.
    const end = meta.lastDay + 1 + playbackDrawDays
    const tick = (now: number) => {
      const step = ((now - last) / 1000) * speed * PLAYBACK_DAYS
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
  }, [playing, speed, playbackDrawDays, meta])

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

  const onPickPoint = (point: { lng: number; lat: number }) => {
    const previous: NearPoint | null = filters.near
    setFilters({
      ...filters,
      near: { lng: point.lng, lat: point.lat, radius: previous?.radius ?? 500 },
    })
    setPickingPoint(false)
  }

  // On small phones the theme moves into the account menu, and the figures
  // fill the room it leaves with their icons.
  const themeInMenu = smallPhone && account != null
  const accountMenu = account ? (
    <AccountMenu account={account} themeToggle={themeInMenu} />
  ) : null

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
      <div className="relative h-full">
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
          playbackDrawDays={playbackDrawDays}
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
            "pointer-events-none absolute inset-x-0 bottom-36 z-30 flex flex-col items-end gap-3 px-3 md:bottom-28 md:px-4",
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
                onChange={(event) => setHeatRadius(Number(event.target.value))}
              />
            </label>
          )}
          {mode === "playback" && (
            <Timeline
              histogram={timeline}
              day={Math.min(
                playDay ?? meta?.firstDay ?? 0,
                (meta?.lastDay ?? Infinity) + 1
              )}
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

        {mobile ? (
          <MobileChrome
            {...chrome}
            sports={sports}
            theme={resolved}
            summary={summary}
            mode={mode}
            onMode={setMode}
            accountMenu={accountMenu}
            themeInMenu={themeInMenu}
            posterHref={posterHref}
          />
        ) : (
          <>
            <TopBar summary={summary} accountMenu={accountMenu} />
            <ControlBar
              {...chrome}
              sports={sports}
              theme={resolved}
              mode={mode}
              onMode={setMode}
              posterHref={posterHref}
            />
          </>
        )}
      </div>

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

/**
 * Desktop top bar: theme on the left, what the map shows, in figures, in the
 * middle, and the account on the right.
 */
function TopBar({
  summary,
  accountMenu,
}: {
  summary: Summary | null
  accountMenu: ReactNode
}) {
  return (
    <header
      className={cn(
        "pointer-events-none absolute inset-x-4 top-4 z-20 grid grid-cols-[1fr_auto_1fr] items-center gap-3",
        HIDE_WHILE_FLYING
      )}
    >
      <ThemeSwitch className="pointer-events-auto h-12.5 justify-self-start" />
      <div className="panel flex h-12.5 items-center rounded-4xl px-5">
        <Stats summary={summary} compact />
      </div>
      <div className="pointer-events-auto flex items-center justify-self-end">
        {accountMenu}
      </div>
    </header>
  )
}

/**
 * Desktop control bar along the bottom: filters, search, map mode and the
 * poster. The filters open in a panel above it that stays put while a point
 * is picked on the map.
 */
function ControlBar({
  sports,
  filters,
  onChange,
  theme,
  pickingPoint,
  onPickPoint,
  maxKm,
  places,
  onSearch,
  mode,
  onMode,
  posterHref,
}: {
  sports: string[]
  filters: Filters
  onChange: (filters: Filters) => void
  theme: "light" | "dark"
  pickingPoint: boolean
  onPickPoint: () => void
  maxKm: number
  places: VisitedZone[]
  onSearch: () => void
  mode: MapMode
  onMode: (mode: MapMode) => void
  posterHref: string
}) {
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    if (!filtersOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [filtersOpen])

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-4 bottom-4 z-20 flex justify-center",
        HIDE_WHILE_FLYING
      )}
    >
      <div className="flex flex-col items-start gap-3">
        {filtersOpen && (
          <div
            id="filtros"
            className="panel pointer-events-auto max-h-[50vh] w-[24rem] animate-in overflow-auto rounded-4xl p-4 duration-200 fade-in-0 slide-in-from-bottom-2"
          >
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
        <div className="pointer-events-auto flex items-center gap-2">
          <FiltersButton
            filters={filters}
            aria-expanded={filtersOpen}
            aria-controls="filtros"
            onClick={() => setFiltersOpen((open) => !open)}
          />
          <RouteSearchButton onClick={onSearch} />
          <ModeMenu mode={mode} onMode={onMode} />
          <PosterLink to={posterHref} />
        </div>
      </div>
    </div>
  )
}

/** Opens the filters, with how many are narrowing the map. */
function FiltersButton({
  filters,
  className,
  labelClassName,
  ...props
}: ComponentProps<"button"> & {
  filters: Filters
  labelClassName?: string
}) {
  const count = activeFilterCount(filters)
  return (
    <button
      type="button"
      className={cn(
        "group/filters panel inline-flex h-12.5 shrink-0 items-center justify-center gap-2 rounded-4xl px-4 text-sm font-medium transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-primary aria-expanded:text-primary-foreground",
        className
      )}
      {...props}
    >
      <SlidersHorizontalIcon weight="bold" className="size-5" />
      <span className={labelClassName}>Filtros</span>
      {count > 0 && (
        <span className="grid size-5 place-items-center rounded-full bg-primary text-[0.6875rem] font-semibold text-primary-foreground tabular-nums group-aria-expanded/filters:bg-primary-foreground group-aria-expanded/filters:text-primary">
          {count}
          <span className="sr-only"> activos</span>
        </span>
      )}
    </button>
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
  themeInMenu,
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
  /** The theme lives in the account menu, so the figures take its room. */
  themeInMenu: boolean
  posterHref: string
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 md:hidden",
        HIDE_WHILE_FLYING
      )}
    >
      {/* Theme, figures and account, as on desktop. On small phones the theme
          moves into the account menu and the figures, now with icons, take
          its room. If they still don't fit, the last one wraps out of sight. */}
      <div className="flex items-center gap-2">
        {!themeInMenu && <ThemeSwitch className="pointer-events-auto h-12.5" />}
        <div className="panel @container flex h-12.5 min-w-0 flex-1 items-center justify-center rounded-4xl px-4">
          <Stats
            summary={summary}
            compact
            icons={themeInMenu}
            className={cn(
              "h-7 min-w-0 flex-wrap gap-x-2.5 overflow-hidden [&_dd]:text-base",
              themeInMenu && "gap-x-2"
            )}
          />
        </div>
        {accountMenu && (
          <div className="pointer-events-auto shrink-0">{accountMenu}</div>
        )}
      </div>
      {/* Controls share one row. Below 384px of row the poster button
          collapses to its icon, and below 320px so does Filtros. */}
      <div className="@container pointer-events-none mx-auto flex w-full max-w-lg items-center justify-center gap-2">
        <Drawer>
          <DrawerTrigger
            render={
              <FiltersButton
                filters={filters}
                className="pointer-events-auto @max-[20rem]:px-3"
                labelClassName="@max-[20rem]:sr-only"
              />
            }
          />
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
            </div>
          </DrawerContent>
        </Drawer>
        <RouteSearchButton
          variant="icon"
          onClick={onSearch}
          className="pointer-events-auto shrink-0"
        />
        <ModeMenu mode={mode} onMode={onMode} />
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
  { value: "routes", label: "Rutas", icon: PathIcon },
  { value: "heatmap", label: "Calor", icon: FireIcon },
  { value: "playback", label: "Tiempo", icon: ClockCountdownIcon },
  { value: "relief", label: "3D", title: "Relieve en 3D", icon: MountainsIcon },
]

/** Delay between the menu's options as they slide in one after another. */
const MENU_STAGGER_MS = 30

/**
 * The map modes as a menu that opens upwards. The caret flips while it is
 * open, the panel rises into place and the options slide in staggered.
 */
function ModeMenu({
  mode,
  onMode,
}: {
  mode: MapMode
  onMode: (mode: MapMode) => void
}) {
  const current = MODES.find((item) => item.value === mode) ?? MODES[0]
  const CurrentIcon = current.icon
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Modo de mapa: ${current.label}`}
        className="group/mode panel pointer-events-auto inline-flex h-12.5 shrink-0 items-center gap-1.5 rounded-4xl pr-3 pl-4 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {CurrentIcon && <CurrentIcon weight="fill" className="size-4" />}
        {current.label}
        <CaretUpIcon
          weight="bold"
          className="size-4 text-muted-foreground group-aria-expanded/mode:rotate-180 motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-in-out"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        sideOffset={8}
        className="w-48 data-[side=bottom]:[--menu-from:-10px] motion-safe:data-open:animate-menu-in! motion-safe:data-closed:animate-menu-out!"
      >
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={(value) => onMode(value as MapMode)}
        >
          {MODES.map(({ value, label, title, icon: ItemIcon }, index) => (
            <DropdownMenuRadioItem
              key={value}
              value={value}
              className="motion-safe:animate-menu-item-in"
              style={{ animationDelay: `${index * MENU_STAGGER_MS}ms` }}
            >
              {ItemIcon && <ItemIcon weight="fill" />}
              {title ?? label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

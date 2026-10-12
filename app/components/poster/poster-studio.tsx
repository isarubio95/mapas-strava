import {
  ArrowCounterClockwiseIcon,
  ArrowLeftIcon,
  CrosshairSimpleIcon,
  DownloadSimpleIcon,
  FilePdfIcon,
} from "@phosphor-icons/react"
import { jsPDF } from "jspdf"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"

import { MapSkeleton } from "~/components/map/map-skeleton"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Slider } from "~/components/ui/slider"
import { Spinner } from "~/components/ui/spinner"
import { Switch } from "~/components/ui/switch"
import type { Activity } from "~/lib/activities"
import { dayNumber, type Filters } from "~/lib/filters"
import type { BBox } from "~/lib/geo"
import {
  adjustPalette,
  createPosterStyle,
  isDarkPalette,
  POSTER_MAP_DEFAULTS,
  POSTER_ROUTE_DEFAULTS,
  POSTER_THEMES,
  textForLand,
  type PosterPalette,
  type PosterThemeId,
} from "~/lib/map/poster-style"
import { useRouteEngine } from "~/lib/map/use-engine"
import {
  CITY_MIN_ZOOM,
  drawPosterOverlay,
  exportSize,
  focusedPlace,
  formatCoordinates,
  localFrame,
  POSTER_FONTS,
  POSTER_FORMATS,
  posterRoutes,
  posterSize,
  routesBounds,
  routesFrame,
  type PosterText,
} from "~/lib/poster"
import { sportColor, type SportColors } from "~/lib/sports"
import { createClient } from "~/lib/supabase/client"
import { cn } from "~/lib/utils"

import type { PosterMap, PosterMapHandle, PosterView } from "./poster-map"

type FormatId = (typeof POSTER_FORMATS)[number]["id"]
type Download = "png" | "pdf"

/** Room around the paper in the preview, in CSS pixels. */
const STAGE_PADDING = 32

const CUSTOM_COLORS = [
  { key: "land", label: "Fondo" },
  { key: "water", label: "Agua" },
  { key: "park", label: "Parques" },
  { key: "roads", label: "Calles" },
  { key: "highway", label: "Autovías" },
  { key: "route", label: "Rutas" },
  { key: "text", label: "Texto" },
] as const satisfies readonly { key: keyof PosterPalette; label: string }[]

const percent = (value: number) =>
  value.toLocaleString("es-ES", { style: "percent" })
const signedPercent = (value: number) =>
  value.toLocaleString("es-ES", { style: "percent", signDisplay: "exceptZero" })

const sameValues = <T extends object>(a: T, b: T) =>
  (Object.keys(a) as (keyof T)[]).every((key) => a[key] === b[key])

/** Region and country that contain a point, when the catalog has them. */
async function zonesAt({ lng, lat }: { lng: number; lat: number }) {
  const { data } = await createClient().rpc("zones_at", { lng, lat })
  const zones = (data ?? []) as { name: string; level: string }[]
  const named = (level: string) =>
    zones.find((item) => item.level === level)?.name ?? null
  return { region: named("region"), country: named("country") }
}

function slug(text: string) {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "poster"
  )
}

function useFontsReady() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let cancelled = false
    void Promise.all(POSTER_FONTS.map((font) => document.fonts.load(font)))
      .catch(() => undefined)
      .then(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])
  return ready
}

/** Loads MapLibre only in the browser, like MapCanvas. */
function usePosterMapComponent() {
  const [component, setComponent] = useState<typeof PosterMap | null>(null)
  useEffect(() => {
    let cancelled = false
    void import("./poster-map").then((module) => {
      if (!cancelled) setComponent(() => module.PosterMap)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return component
}

/** Measures the stage and the screen's pixel density. */
function useStage() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0, dpr: 1 })
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
        dpr: window.devicePixelRatio || 1,
      })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, size] as const
}

export function PosterStudio({
  activities,
  filters,
  routeId = null,
  view = null,
  sportColors,
}: {
  activities: Activity[]
  filters: Filters
  /** A single route, whatever the filters. */
  routeId?: number | null
  /** Where the map was when the poster was opened. */
  view?: BBox | null
  sportColors?: SportColors
}) {
  const PosterMapView = usePosterMapComponent()
  const fontsReady = useFontsReady()
  const { geometry, meta, query } = useRouteEngine(activities, filters)
  const mapHandle = useRef<PosterMapHandle>(null)
  const overlay = useRef<HTMLCanvasElement>(null)
  const [stageRef, stage] = useStage()

  const [formatId, setFormatId] = useState<FormatId>("a4")
  const [themeId, setThemeId] = useState<PosterThemeId>("ambar")
  const [custom, setCustom] = useState(false)
  // The own palette starts from the theme on show the first time it opens.
  const [colors, setColors] = useState<PosterPalette | null>(null)
  const [bySport, setBySport] = useState(false)
  const [routeLook, setRouteLook] = useState(POSTER_ROUTE_DEFAULTS)
  const [mapLook, setMapLook] = useState(POSTER_MAP_DEFAULTS)
  // The title names what the map frames until the user writes their own.
  const [placeName, setPlaceName] = useState("")
  const [customTitle, setCustomTitle] = useState<string | null>(null)
  const title = customTitle ?? placeName
  const naming = useRef(0)
  // Same for the subtitle and the country.
  const [country, setCountry] = useState("")
  const [customSubtitle, setCustomSubtitle] = useState<string | null>(null)
  const subtitle = customSubtitle ?? country
  const lastView = useRef<PosterView | null>(null)
  const [center, setCenter] = useState<{ lng: number; lat: number } | null>(
    null
  )
  const [downloading, setDownloading] = useState<Download | null>(null)
  const [mapReady, setMapReady] = useState(false)

  const format =
    POSTER_FORMATS.find((item) => item.id === formatId) ?? POSTER_FORMATS[0]
  const { width, height } = posterSize(format)
  const output = exportSize(format)

  const themePalette: PosterPalette =
    POSTER_THEMES.find((item) => item.id === themeId)?.palette ??
    POSTER_THEMES[0].palette
  const ownPalette = colors ?? themePalette
  const palette = useMemo(
    () => adjustPalette(custom ? ownPalette : themePalette, mapLook),
    [custom, ownPalette, themePalette, mapLook]
  )
  const dark = isDarkPalette(palette)

  function setColor(key: keyof PosterPalette, value: string) {
    const next = { ...ownPalette, [key]: value }
    // Keeps the title readable when the ground goes from dark to light.
    if (key === "land" && isDarkPalette(next) !== isDarkPalette(ownPalette))
      next.text = textForLand(value)
    setColors(next)
  }

  const dayRange = useMemo((): [number, number] => {
    const from = filters.from ? dayNumber(filters.from) : (meta?.firstDay ?? 0)
    const to = filters.to ? dayNumber(filters.to) : (meta?.lastDay ?? 1e6)
    return [from, to]
  }, [filters.from, filters.to, meta])

  const routeIndex = useMemo(() => {
    const index = activities.findIndex((activity) => activity.id === routeId)
    return index < 0 ? null : index
  }, [activities, routeId])
  const route = routeIndex == null ? null : activities[routeIndex]

  const routes = useMemo(() => {
    if (!geometry || (routeIndex == null && !query)) return null
    const theme = dark ? "dark" : "light"
    const cache = new Map<string, string>()
    const [mask, days]: [Uint8Array, [number, number]] =
      routeIndex == null
        ? [query!.mask, dayRange]
        : [
            Uint8Array.from(geometry.pathActivity, (owner) =>
              owner === routeIndex ? 1 : 0
            ),
            [-Infinity, Infinity],
          ]
    return posterRoutes(geometry, mask, days, (path) => {
      const type = activities[geometry.pathActivity[path]].sportType
      let color = cache.get(type)
      if (!color) {
        color = sportColor(type, theme, sportColors)
        cache.set(type, color)
      }
      return color
    })
  }, [geometry, query, dayRange, routeIndex, activities, sportColors, dark])

  // With a single sport there is nothing to tell apart by color.
  const multiSport = useMemo(
    () =>
      new Set(routes?.features.map((feature) => feature.properties.color))
        .size > 1,
    [routes]
  )
  const colorBySport = bySport && multiSport

  const mapStyle = useMemo(
    () =>
      createPosterStyle(
        palette,
        { ...routeLook, color: colorBySport ? null : palette.route },
        mapLook.streets
      ),
    [palette, colorBySport, routeLook, mapLook.streets]
  )

  /** The route whole, else the view the map had, else where the routes are dense. */
  const initialFrame = useMemo(() => {
    if (!routes) return null
    return (
      (route && routesBounds(routes)) ??
      view ??
      routesFrame(routes, geometry?.home ?? null)
    )
  }, [routes, route, view, geometry])

  /** Back to the route, or to the routes of the place the poster shows. */
  function recenter() {
    if (!routes) return
    const frame = route
      ? routesBounds(routes)
      : lastView.current
        ? localFrame(routes, lastView.current.bounds)
        : initialFrame
    if (frame) mapHandle.current?.fit(frame)
  }

  const text: PosterText = useMemo(
    () => ({
      title,
      subtitle,
      coordinates: center ? formatCoordinates(center.lng, center.lat) : "",
    }),
    [title, subtitle, center]
  )

  const scale =
    stage.width > 0
      ? Math.min(
          (stage.width - STAGE_PADDING * 2) / width,
          (stage.height - STAGE_PADDING * 2) / height
        )
      : 0
  // Twice the screen's pixels: the browser's downscale then matches how the
  // export's fine streets look once printed. Capped to keep WebGL cheap.
  const previewRatio =
    Math.round(
      Math.min(scale * stage.dpr * 2, 4096 / Math.max(width, height)) * 100
    ) / 100
  const overlayRatio = scale * stage.dpr

  /** A city when the map is close enough to frame one, else its region. */
  async function nameView(view: PosterView) {
    lastView.current = view
    if (customTitle !== null && customSubtitle !== null) return
    const id = ++naming.current
    const place = focusedPlace(view.places, view.bounds)
    const zones = await zonesAt(view.center)
    if (id !== naming.current) return
    const name =
      (view.zoom >= CITY_MIN_ZOOM && place?.name) ||
      zones.region ||
      zones.country ||
      place?.name
    if (name) setPlaceName(name)
    // Outside the catalog's countries, better no country than a wrong one.
    setCountry(zones.country ?? "")
  }

  useEffect(() => {
    const canvas = overlay.current
    if (!canvas || overlayRatio <= 0 || !fontsReady) return
    canvas.width = Math.round(width * overlayRatio)
    canvas.height = Math.round(height * overlayRatio)
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0)
    drawPosterOverlay(ctx, { width, height, palette, text })
  }, [width, height, overlayRatio, palette, text, fontsReady])

  async function render() {
    const map = mapHandle.current
    if (!map) return null
    await Promise.all(POSTER_FONTS.map((font) => document.fonts.load(font)))
    const canvas = document.createElement("canvas")
    canvas.width = output.width
    canvas.height = output.height
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.fillStyle = palette.land
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await map.capture(output.width / width, (source) => {
      // Some GPUs cap the canvas below the export size; MapLibre then renders
      // smaller and the map is scaled up here.
      if (source.width < canvas.width - 2) {
        toast.warning(
          `Tu tarjeta gráfica limita el mapa a ${source.width.toLocaleString("es-ES")} px de ancho; se verá algo menos nítido.`
        )
      }
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
    })
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0)
    drawPosterOverlay(ctx, { width, height, palette, text })
    return canvas
  }

  async function download(kind: Download) {
    if (downloading) return
    setDownloading(kind)
    try {
      const canvas = await render()
      if (!canvas) return
      const name = `trazo-${slug(title)}-${format.id}`
      if (kind === "png") {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/png")
        )
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `${name}.png`
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
      } else {
        const pdf = new jsPDF({
          orientation: format.w > format.h ? "landscape" : "portrait",
          unit: "mm",
          format: [format.w, format.h],
        })
        pdf.addImage(
          canvas.toDataURL("image/jpeg", 0.95),
          "JPEG",
          0,
          0,
          format.w,
          format.h
        )
        pdf.save(`${name}.pdf`)
      }
      canvas.width = 0
      canvas.height = 0
    } catch {
      toast.error(
        "No se ha podido generar el póster. Prueba con un formato más pequeño."
      )
    } finally {
      setDownloading(null)
    }
  }

  const routeCount = routes?.features.length ?? 0

  return (
    <main className="grid h-svh grid-rows-[auto_minmax(0,1fr)] bg-background md:grid-cols-[22rem_minmax(0,1fr)] md:grid-rows-1">
      <aside className="flex max-h-[45svh] flex-col gap-6 overflow-y-auto border-b p-5 md:max-h-none md:border-r md:border-b-0">
        <div className="flex flex-col gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" />
            Volver al mapa
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Póster</h1>
          <p className="text-sm text-muted-foreground">
            {!geometry
              ? "Cargando tus rutas…"
              : `${route ? route.name : `${routeCount.toLocaleString("es-ES")} ${routeCount === 1 ? "ruta" : "rutas"}`}. Arrastra y haz zoom en el póster para encuadrarlo.`}
          </p>
        </div>

        <Section title="Formato">
          <div className="grid grid-cols-5 gap-1.5">
            {POSTER_FORMATS.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant={formatId === item.id ? "default" : "outline"}
                aria-pressed={formatId === item.id}
                onClick={() => setFormatId(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </Section>

        <Section title="Estilo">
          <div className="grid grid-cols-5 gap-2">
            {POSTER_THEMES.map((item) => (
              <ThemeSwatch
                key={item.id}
                label={item.label}
                palette={item.palette}
                selected={!custom && themeId === item.id}
                onClick={() => {
                  setCustom(false)
                  setThemeId(item.id)
                }}
              />
            ))}
            <ThemeSwatch
              label="Propio"
              palette={ownPalette}
              selected={custom}
              onClick={() => {
                setColors(ownPalette)
                setCustom(true)
              }}
            />
          </div>
          {custom && (
            <div className="grid grid-cols-2 gap-2">
              {CUSTOM_COLORS.map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-sm"
                >
                  <input
                    type="color"
                    value={ownPalette[key]}
                    onChange={(event) => setColor(key, event.target.value)}
                    className="size-6 cursor-pointer rounded-md border-0 bg-transparent p-0"
                  />
                  {label}
                </label>
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Rutas"
          onReset={
            sameValues(routeLook, POSTER_ROUTE_DEFAULTS)
              ? undefined
              : () => setRouteLook(POSTER_ROUTE_DEFAULTS)
          }
        >
          {multiSport && (
            <label className="flex items-center justify-between gap-3 text-sm">
              Un color por deporte
              <Switch checked={bySport} onCheckedChange={setBySport} />
            </label>
          )}
          <SliderField
            label="Grosor"
            min={0.4}
            max={3}
            step={0.1}
            value={routeLook.weight}
            format={(value) =>
              `${value.toLocaleString("es-ES", { maximumFractionDigits: 1 })}×`
            }
            onChange={(weight) => setRouteLook({ ...routeLook, weight })}
          />
          <SliderField
            label="Opacidad"
            min={0.2}
            max={1}
            step={0.05}
            value={routeLook.opacity}
            format={percent}
            onChange={(opacity) => setRouteLook({ ...routeLook, opacity })}
          />
          {dark && (
            <SliderField
              label="Resplandor"
              min={0}
              max={2}
              step={0.1}
              value={routeLook.glow}
              format={percent}
              onChange={(glow) => setRouteLook({ ...routeLook, glow })}
            />
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            disabled={!routeCount}
            onClick={recenter}
          >
            <CrosshairSimpleIcon data-icon="inline-start" />
            {route ? "Centrar la ruta" : "Centrar"}
          </Button>
        </Section>

        <Section
          title="Mapa"
          onReset={
            sameValues(mapLook, POSTER_MAP_DEFAULTS)
              ? undefined
              : () => setMapLook(POSTER_MAP_DEFAULTS)
          }
        >
          <SliderField
            label="Calles"
            min={0.1}
            max={1}
            step={0.05}
            value={mapLook.streets}
            format={percent}
            onChange={(streets) => setMapLook({ ...mapLook, streets })}
          />
          <SliderField
            label="Brillo"
            min={-0.4}
            max={0.4}
            step={0.05}
            value={mapLook.brightness}
            format={signedPercent}
            onChange={(brightness) => setMapLook({ ...mapLook, brightness })}
          />
          <SliderField
            label="Saturación"
            min={0}
            max={2}
            step={0.05}
            value={mapLook.saturation}
            format={percent}
            onChange={(saturation) => setMapLook({ ...mapLook, saturation })}
          />
        </Section>

        <Section title="Texto">
          <label className="flex flex-col gap-1.5 text-sm">
            Título
            <Input
              value={title}
              onChange={(e) => setCustomTitle(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            Lugar
            <Input
              value={subtitle}
              onChange={(e) => setCustomSubtitle(e.target.value)}
            />
          </label>
        </Section>

        <div className="mt-auto flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              disabled={!geometry || downloading != null}
              onClick={() => void download("png")}
            >
              {downloading === "png" ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <DownloadSimpleIcon data-icon="inline-start" />
              )}
              PNG
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!geometry || downloading != null}
              onClick={() => void download("pdf")}
            >
              {downloading === "pdf" ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <FilePdfIcon data-icon="inline-start" />
              )}
              PDF
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {format.w / 10} × {format.h / 10} cm ·{" "}
            {output.width.toLocaleString("es-ES")} ×{" "}
            {output.height.toLocaleString("es-ES")} px · {output.dpi} ppp
          </p>
        </div>
      </aside>

      <section
        ref={stageRef}
        aria-label="Vista previa del póster"
        className="relative min-h-0 overflow-hidden bg-muted/50"
      >
        {scale > 0 && (
          <div
            className="absolute top-1/2 left-1/2 overflow-hidden shadow-[0_24px_60px_-20px_rgb(0_0_0/0.55)] ring-1 ring-black/10 dark:ring-white/10"
            style={{
              width: width * scale,
              height: height * scale,
              transform: "translate(-50%, -50%)",
              background: palette.land,
            }}
          >
            <div
              className="relative origin-top-left"
              style={{ width, height, transform: `scale(${scale})` }}
            >
              {PosterMapView && routes ? (
                <PosterMapView
                  ref={mapHandle}
                  width={width}
                  height={height}
                  pixelRatio={previewRatio}
                  mapStyle={mapStyle}
                  routes={routes}
                  initialBounds={initialFrame}
                  onMoveEnd={setCenter}
                  onReady={() => setMapReady(true)}
                  onSettle={nameView}
                />
              ) : (
                <MapSkeleton className="absolute inset-0" />
              )}
              <canvas
                ref={overlay}
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{ width, height }}
              />
            </div>
            <PosterSkeleton
              width={width * scale}
              hidden={mapReady && fontsReady}
            />
          </div>
        )}
      </section>
    </main>
  )
}

/**
 * Covers the paper until the map's first tiles and the title fonts are in,
 * hinting at the title block so the layout doesn't change when it lifts.
 */
function PosterSkeleton({ width, hidden }: { width: number; hidden: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 bg-muted transition-opacity duration-500",
        hidden ? "opacity-0" : "animate-pulse"
      )}
    >
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-full bg-foreground/10"
        style={{
          bottom: width * 0.217,
          width: width * 0.6,
          height: width * 0.05,
        }}
      />
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-full bg-foreground/10"
        style={{
          bottom: width * 0.146,
          width: width * 0.3,
          height: width * 0.02,
        }}
      />
    </div>
  )
}

function Section({
  title,
  onReset,
  children,
}: {
  title: string
  /** Shows a reset button in the header while the section has changes. */
  onReset?: () => void
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </h2>
        {onReset && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="-mr-2.5 text-muted-foreground"
            onClick={onReset}
          >
            <ArrowCounterClockwiseIcon data-icon="inline-start" />
            Restablecer
          </Button>
        )}
      </div>
      {children}
    </section>
  )
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (value: number) => string
  onChange: (value: number) => void
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2.5 text-sm">
      <div className="flex items-center justify-between">
        <span id={id}>{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {format(value)}
        </span>
      </div>
      <Slider
        aria-labelledby={id}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(next) => onChange(Array.isArray(next) ? next[0] : next)}
      />
    </div>
  )
}

/** Small picture of a theme: its ground, two streets, a motorway and a route. */
function ThemeSwatch({
  label,
  palette,
  selected,
  onClick,
}: {
  label: string
  palette: PosterPalette
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="group flex flex-col items-center gap-1.5 text-xs outline-none"
    >
      <svg
        viewBox="0 0 40 52"
        aria-hidden
        className={cn(
          "w-full rounded-md ring-1 ring-border transition-shadow group-focus-visible:ring-3 group-focus-visible:ring-ring/50",
          selected && "ring-2 ring-primary"
        )}
      >
        <rect width="40" height="52" fill={palette.land} />
        <path d="M0 40 C 14 34, 22 44, 40 30 V52 H0Z" fill={palette.water} />
        <path
          d="M6 0 V52 M0 14 H40 M24 0 L30 52"
          stroke={palette.roads}
          strokeOpacity="0.6"
          strokeWidth="0.8"
          fill="none"
        />
        <path
          d="M0 26 C 12 20, 26 30, 40 18"
          stroke={palette.highway}
          strokeWidth="1.6"
          fill="none"
        />
        <path
          d="M10 46 L12 8 L32 12 L28 34 Z"
          stroke={palette.route}
          strokeWidth="1.4"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      <span
        className={cn(
          "text-muted-foreground",
          selected && "font-medium text-foreground"
        )}
      >
        {label}
      </span>
    </button>
  )
}

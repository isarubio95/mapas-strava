import { jsPDF } from "jspdf"
import { useMemo, useState } from "react"
import { data, Link, useSearchParams } from "react-router"

import { MapCanvas } from "~/components/map/map-canvas"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { useActivities } from "~/lib/activities-api"
import { filtersFromSearch } from "~/lib/filters-url"
import { POSTER_THEMES, type MapPalette } from "~/lib/map/style"
import { SPORTS, type SportColors } from "~/lib/sports"
import { requireStravaAccount } from "~/lib/supabase/server"
import { useTheme } from "~/lib/theme"

import type { Route } from "./+types/poster"

export const meta: Route.MetaFunction = () => [{ title: "Póster · Trazo" }]

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireStravaAccount(request)
  return data({}, { headers })
}

const FORMATS = [
  { id: "a4", label: "A4", w: 210, h: 297 },
  { id: "a3", label: "A3", w: 297, h: 420 },
  { id: "50x70", label: "50×70", w: 500, h: 700 },
  { id: "2:3", label: "2:3", w: 400, h: 600 },
  { id: "1:1", label: "1:1", w: 500, h: 500 },
] as const

export default function Poster() {
  const { theme } = useTheme()
  const { activities, failed } = useActivities()
  const [params] = useSearchParams()
  const filters = useMemo(() => filtersFromSearch(params), [params])
  const [format, setFormat] = useState<(typeof FORMATS)[number]["id"]>("a4")
  const [themeId, setThemeId] =
    useState<(typeof POSTER_THEMES)[number]["id"]>("noche")
  const [title, setTitle] = useState("MADRID")
  const [subtitle, setSubtitle] = useState("ESPAÑA")
  const [custom, setCustom] = useState(false)
  const [land, setLand] = useState("#100800")
  const [water, setWater] = useState("#1a0c04")
  const [roads, setRoads] = useState("#e07a1a")
  const [route, setRoute] = useState("#ffffff")

  const base =
    POSTER_THEMES.find((item) => item.id === themeId)?.palette ??
    POSTER_THEMES[0].palette
  const palette: MapPalette = custom
    ? {
        ...base,
        land,
        water,
        park: land,
        building: land,
        roadMinor: roads,
        roadMajor: roads,
        roadHighway: roads,
      }
    : base
  const sportColors: SportColors | undefined = custom
    ? Object.fromEntries(SPORTS.map((sport) => [sport.type, route]))
    : undefined
  const paper = FORMATS.find((item) => item.id === format) ?? FORMATS[0]

  function paint(scale: number) {
    const source = document.querySelector(
      "#poster-map canvas"
    ) as HTMLCanvasElement | null
    if (!source) return null
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(paper.w * scale)
    canvas.height = Math.round(paper.h * scale)
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.fillStyle = palette.land
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
    ctx.fillStyle = palette.label
    ctx.textAlign = "center"
    ctx.font = `${Math.round(canvas.width * 0.055)}px Inter, sans-serif`
    ctx.letterSpacing = `${Math.round(canvas.width * 0.012)}px`
    ctx.fillText(
      title.toUpperCase(),
      canvas.width / 2,
      canvas.height - canvas.width * 0.12
    )
    ctx.font = `${Math.round(canvas.width * 0.02)}px Inter, sans-serif`
    ctx.fillText(
      subtitle.toUpperCase(),
      canvas.width / 2,
      canvas.height - canvas.width * 0.07
    )
    ctx.font = `${Math.round(canvas.width * 0.012)}px Inter, sans-serif`
    ctx.fillText(
      "© OpenStreetMap · OpenFreeMap",
      canvas.width / 2,
      canvas.height - canvas.width * 0.03
    )
    return canvas
  }

  function downloadPng() {
    const canvas = paint(3)
    if (!canvas) return
    const link = document.createElement("a")
    link.href = canvas.toDataURL("image/png")
    link.download = "trazo.png"
    link.click()
  }

  function downloadPdf() {
    const canvas = paint(3)
    if (!canvas) return
    const pdf = new jsPDF({
      orientation: paper.w > paper.h ? "landscape" : "portrait",
      unit: "mm",
      format: [paper.w, paper.h],
    })
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, paper.w, paper.h)
    pdf.save("trazo.pdf")
  }

  return (
    <main className="grid h-svh grid-cols-1 bg-background md:grid-cols-[22rem_1fr]">
      <aside className="flex flex-col gap-4 overflow-auto p-5">
        <Link to="/" className="text-sm underline">
          Volver al mapa
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Póster</h1>
        <div className="flex flex-wrap gap-1.5">
          {FORMATS.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={format === item.id ? "default" : "outline"}
              onClick={() => setFormat(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {POSTER_THEMES.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={!custom && themeId === item.id ? "default" : "outline"}
              onClick={() => {
                setCustom(false)
                setThemeId(item.id)
              }}
            >
              {item.label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant={custom ? "default" : "outline"}
            onClick={() => setCustom(true)}
          >
            Propios
          </Button>
        </div>
        {custom && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <label>
              Fondo{" "}
              <input
                type="color"
                value={land}
                onChange={(e) => setLand(e.target.value)}
              />
            </label>
            <label>
              Agua{" "}
              <input
                type="color"
                value={water}
                onChange={(e) => setWater(e.target.value)}
              />
            </label>
            <label>
              Calles{" "}
              <input
                type="color"
                value={roads}
                onChange={(e) => setRoads(e.target.value)}
              />
            </label>
            <label>
              Rutas{" "}
              <input
                type="color"
                value={route}
                onChange={(e) => setRoute(e.target.value)}
              />
            </label>
          </div>
        )}
        <label className="text-sm">
          Título
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1"
          />
        </label>
        <label className="text-sm">
          Lugar
          <Input
            value={subtitle}
            onChange={(event) => setSubtitle(event.target.value)}
            className="mt-1"
          />
        </label>
        <div className="flex gap-2">
          <Button type="button" onClick={downloadPng}>
            PNG
          </Button>
          <Button type="button" variant="outline" onClick={downloadPdf}>
            PDF
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          El PNG y el PDF salen a tres veces la resolución de la vista.
        </p>
      </aside>
      <div id="poster-map" className="relative min-h-[50vh]">
        {activities ? (
          <MapCanvas
            activities={activities}
            filters={filters}
            theme={theme ?? "dark"}
            palette={palette}
            sportColors={sportColors}
            preserveDrawingBuffer
            labels
          />
        ) : (
          <p className="flex h-full items-center justify-center text-muted-foreground">
            {failed
              ? "No se han podido cargar tus rutas. Recarga la página."
              : "Cargando tus rutas…"}
          </p>
        )}
      </div>
    </main>
  )
}

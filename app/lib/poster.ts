import { hexToRgb } from "~/lib/color"
import type { BBox } from "~/lib/geo"
import type { RouteGeometry } from "~/lib/map/engine"
import type { PosterPalette } from "~/lib/map/poster-style"

/**
 * Logical width of every poster, in map pixels. The map is laid out at this
 * size whatever the screen, so a whole city sits around zoom 12, where the
 * tiles start carrying residential streets. The preview shows it scaled down
 * and the export renders the same layout at a higher pixel ratio.
 */
export const POSTER_WIDTH = 3000

export const POSTER_FORMATS = [
  { id: "a4", label: "A4", w: 210, h: 297 },
  { id: "a3", label: "A3", w: 297, h: 420 },
  { id: "50x70", label: "50×70", w: 500, h: 700 },
  { id: "40x60", label: "40×60", w: 400, h: 600 },
  { id: "50x50", label: "50×50", w: 500, h: 500 },
] as const

export type PosterFormat = (typeof POSTER_FORMATS)[number]

/** Logical size of the poster map for a paper format. */
export function posterSize(format: Pick<PosterFormat, "w" | "h">) {
  return {
    width: POSTER_WIDTH,
    height: Math.round((POSTER_WIDTH * format.h) / format.w),
  }
}

const TARGET_DPI = 300
/** Longest side of an export. Larger WebGL canvases fail on many GPUs. */
export const MAX_EXPORT_SIDE = 6000

/** Pixel size of the PNG/PDF: 300 ppp, capped at MAX_EXPORT_SIDE. */
export function exportSize(format: Pick<PosterFormat, "w" | "h">) {
  const longMm = Math.max(format.w, format.h)
  const dpi = Math.min(TARGET_DPI, (MAX_EXPORT_SIDE * 25.4) / longMm)
  return {
    width: Math.round((format.w / 25.4) * dpi),
    height: Math.round((format.h / 25.4) * dpi),
    dpi: Math.round(dpi),
  }
}

export function formatCoordinates(lng: number, lat: number) {
  const ns = lat >= 0 ? "N" : "S"
  const eo = lng >= 0 ? "E" : "O"
  return `${Math.abs(lat).toFixed(4)}° ${ns} / ${Math.abs(lng).toFixed(4)}° ${eo}`
}

export type PosterRoutes = GeoJSON.FeatureCollection<
  GeoJSON.LineString,
  { color: string }
>

/**
 * Routes that pass the filters, as GeoJSON lines for the poster map, oldest
 * first so recent routes draw on top.
 */
export function posterRoutes(
  geometry: RouteGeometry,
  mask: Uint8Array,
  [fromDay, toDay]: [number, number],
  colorOf: (path: number) => string
): PosterRoutes {
  const features: PosterRoutes["features"] = []
  const { positions, startIndices, pathDay } = geometry
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p] || pathDay[p] < fromDay || pathDay[p] > toDay) continue
    const coordinates: [number, number][] = []
    for (let v = startIndices[p]; v < startIndices[p + 1]; v++) {
      coordinates.push([positions[v * 2], positions[v * 2 + 1]])
    }
    features.push({
      type: "Feature",
      properties: { color: colorOf(p) },
      geometry: { type: "LineString", coordinates },
    })
  }
  return { type: "FeatureCollection", features }
}

const FRAME_SAMPLES = 40_000
/** Share of route points left out on each side when framing. */
const FRAME_TRIM = 0.04

/**
 * Where the routes are dense: the 4–96 % range of their points inside the
 * home area. Framing the whole home area zooms out too far for the tiles to
 * carry residential streets.
 */
export function routesFrame(routes: PosterRoutes, home: BBox | null) {
  let total = 0
  for (const feature of routes.features)
    total += feature.geometry.coordinates.length
  const step = Math.max(1, Math.floor(total / FRAME_SAMPLES))
  const lngs: number[] = []
  const lats: number[] = []
  let index = 0
  for (const feature of routes.features) {
    for (const [lng, lat] of feature.geometry.coordinates) {
      if (index++ % step) continue
      if (
        home &&
        (lng < home[0] || lat < home[1] || lng > home[2] || lat > home[3])
      )
        continue
      lngs.push(lng)
      lats.push(lat)
    }
  }
  if (lngs.length < 2) return home
  lngs.sort((a, b) => a - b)
  lats.sort((a, b) => a - b)
  const at = (values: number[], share: number) =>
    values[Math.round(share * (values.length - 1))]
  return [
    at(lngs, FRAME_TRIM),
    at(lats, FRAME_TRIM),
    at(lngs, 1 - FRAME_TRIM),
    at(lats, 1 - FRAME_TRIM),
  ] satisfies BBox
}

export interface PosterText {
  title: string
  subtitle: string
  coordinates: string
}

const SANS = '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif'
const MONO =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, "DejaVu Sans Mono", monospace'

/** Fonts the overlay uses; the canvas only draws them once they are loaded. */
export const POSTER_FONTS = [`700 64px ${SANS}`, `400 64px ${SANS}`]

const CREDIT = "TRAZO"
const ATTRIBUTION = "© OpenStreetMap · OpenMapTiles · OpenFreeMap"

function rgba(hex: string, alpha: number) {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function spacedWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  spacing: number
) {
  let total = 0
  for (const char of text) total += ctx.measureText(char).width + spacing
  return total - spacing
}

/** Centered text with letter spacing, drawn glyph by glyph so every browser matches. */
function drawSpaced(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number
) {
  let cursor = x - spacedWidth(ctx, text, spacing) / 2
  ctx.textAlign = "left"
  for (const char of text) {
    ctx.fillText(char, cursor, y)
    cursor += ctx.measureText(char).width + spacing
  }
}

/**
 * Fades, title block and credits, laid out after poster.png. Sizes are
 * fractions of the width and positions are measured from the bottom, so every
 * format gets the same block. Works in logical units: the caller scales `ctx`.
 * The preview and the export both call this, so they always match.
 */
export function drawPosterOverlay(
  ctx: CanvasRenderingContext2D,
  {
    width: w,
    height: h,
    palette,
    text,
  }: {
    width: number
    height: number
    palette: Pick<PosterPalette, "land" | "text">
    text: PosterText
  }
) {
  const top = ctx.createLinearGradient(0, 0, 0, w * 0.14)
  top.addColorStop(0, rgba(palette.land, 0.6))
  top.addColorStop(1, rgba(palette.land, 0))
  ctx.fillStyle = top
  ctx.fillRect(0, 0, w, w * 0.14)

  const fadeTop = h - w * 0.46
  const bottom = ctx.createLinearGradient(0, fadeTop, 0, h)
  bottom.addColorStop(0, rgba(palette.land, 0))
  bottom.addColorStop(0.5, rgba(palette.land, 0.72))
  bottom.addColorStop(1, rgba(palette.land, 0.92))
  ctx.fillStyle = bottom
  ctx.fillRect(0, fadeTop, w, h - fadeTop)

  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = palette.text
  const title = text.title.trim().toUpperCase()
  const subtitle = text.subtitle.trim().toUpperCase()

  if (title) {
    let size = w * 0.065
    ctx.font = `700 ${size}px ${SANS}`
    let spacing = size * 0.6
    const natural = spacedWidth(ctx, title, spacing)
    const fit = Math.min(1, (w * 0.84) / natural)
    size *= fit
    spacing *= fit
    ctx.font = `700 ${size}px ${SANS}`
    drawSpaced(ctx, title, w / 2, h - w * 0.217, spacing)

    ctx.fillStyle = rgba(palette.text, 0.55)
    ctx.fillRect(w * 0.4, h - w * 0.188, w * 0.2, Math.max(1, w * 0.0012))
    ctx.fillStyle = palette.text
  }

  if (subtitle) {
    let size = w * 0.023
    ctx.font = `400 ${size}px ${SANS}`
    let spacing = size * 0.12
    const fit = Math.min(1, (w * 0.84) / spacedWidth(ctx, subtitle, spacing))
    size *= fit
    spacing *= fit
    ctx.font = `400 ${size}px ${SANS}`
    drawSpaced(ctx, subtitle, w / 2, h - w * 0.146, spacing)
  }

  if (text.coordinates) {
    const size = w * 0.0135
    ctx.font = `400 ${size}px ${MONO}`
    ctx.fillStyle = rgba(palette.text, 0.75)
    drawSpaced(ctx, text.coordinates, w / 2, h - w * 0.106, size * 0.04)
  }

  const footer = w * 0.0078
  ctx.font = `400 ${footer}px ${MONO}`
  ctx.fillStyle = rgba(palette.text, 0.55)
  ctx.textAlign = "left"
  ctx.fillText(CREDIT, w * 0.022, h - w * 0.026)
  ctx.textAlign = "right"
  ctx.fillText(ATTRIBUTION, w - w * 0.022, h - w * 0.026)
}

import type {
  ExpressionSpecification,
  LayerSpecification,
  Map as MapLibreMap,
  StyleSpecification,
} from "maplibre-gl"

import { hexToRgb, rgbToHex } from "~/lib/color"
import { sportColor, type SportColors } from "~/lib/sports"
import type { Theme } from "~/lib/theme"

import { BUILDING_3D_LAYER_ID, LABEL_LAYER_ID } from "./style"

/**
 * In 3D the routes are MapLibre line layers rather than deck.gl ones:
 * MapLibre drapes its lines over the terrain, so they follow every slope and
 * hide behind the ridges like the streets do.
 *
 * Both themes' layers are always in the style and the theme only sets their
 * opacity: MapLibre fades opacity along with the basemap, while colors picked
 * per feature or along the line would jump at once.
 */
export const ROUTES_3D_SOURCE = "routes-3d"
export const SELECTION_3D_SOURCE = "selection-3d"
export const FLYOVER_SOURCE = "flyover"

/** Layer that answers clicks and hovers in 3D, whatever the theme. */
export const ROUTES_3D_PICK_LAYER = "routes-3d-core-light"

const THEMES: Theme[] = ["dark", "light"]

const PAPER: Record<Theme, string> = { dark: "#0b1716", light: "#fbf8f1" }

/** Ids of the selected route's layers in one theme. */
const selectionIds = (theme: Theme) => ({
  halo: `selection-3d-halo-${theme}`,
  core: `selection-3d-core-${theme}`,
  ends: `selection-3d-ends-${theme}`,
})

type Stops = [zoom: number, value: number][]

const byZoom = (stops: Stops): ExpressionSpecification => [
  "interpolate",
  ["exponential", 1.5],
  ["zoom"],
  ...stops.flat(),
]

const scaled = (stops: Stops, factor: number): Stops =>
  stops.map(([zoom, value]) => [zoom, value * factor])

function whiten(hex: string, amount: number) {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex([
    r + (255 - r) * amount,
    g + (255 - g) * amount,
    b + (255 - b) * amount,
  ])
}

/** Color of each line by its sport (`s` property), as the 2D map paints it. */
export function sportColorExpression(
  sports: string[],
  theme: Theme,
  overrides?: SportColors,
  whitenBy = 0
): ExpressionSpecification | string {
  const fallback = whiten(sportColor("Other", theme, overrides), whitenBy)
  if (sports.length === 0) return fallback
  const pairs = sports.flatMap((type) => [
    type,
    whiten(sportColor(type, theme, overrides), whitenBy),
  ])
  return [
    "match",
    ["get", "s"],
    ...pairs,
    fallback,
  ] as unknown as ExpressionSpecification
}

/**
 * Gradient along a line that is drawn up to `share` of its length and shows
 * `rest` after that. MapLibre needs `line-gradient` to light part of a line.
 */
export function progressGradient(
  color: string,
  share: number,
  rest = "rgba(0, 0, 0, 0)"
): ExpressionSpecification {
  if (share >= 1) {
    return ["interpolate", ["linear"], ["line-progress"], 0, color, 1, color]
  }
  return ["step", ["line-progress"], color, Math.max(share, 1e-6), rest]
}

/** Colors of the selected route in 3D, shared with its animations. */
function selectionColors(color: string, theme: Theme) {
  const dark = theme === "dark"
  const core = dark ? "#ffffff" : color
  const [r, g, b] = hexToRgb(core)
  return {
    halo: dark ? color : PAPER.light,
    core,
    /** The stretch still ahead during a flyover. */
    ahead: `rgba(${r}, ${g}, ${b}, ${dark ? 0.3 : 0.35})`,
    paper: PAPER[theme],
  }
}

export interface Routes3dInput {
  /** URL of the visible routes as GeoJSON, or null while it builds. */
  routes: string | null
  /** Sport types present, to color the lines. */
  sports: string[]
  theme: Theme
  sportColors?: SportColors
  /** Show the selected route alone. */
  hidden?: boolean
  /** Opacity of every route but the selection, from 0 to 1. */
  fade?: number
  selection?: {
    coords: Float64Array
    /** The route's sport color in each theme. */
    colors: Record<Theme, string>
    /** Share of the route drawn so far while it draws itself in. */
    drawn?: number
  } | null
  /** Where the flyover head starts, while the camera follows the selection. */
  flyoverStart?: [number, number] | null
}

const ROUND = { "line-cap": "round", "line-join": "round" } as const

function routeLayers({
  sports,
  theme,
  sportColors,
  hidden = false,
  fade: dim = 1,
}: Routes3dInput): LayerSpecification[] {
  const layout = { ...ROUND, visibility: hidden ? "none" : "visible" } as const
  /** Opacity of a layer that belongs to `owner`: none in the other theme. */
  const shown = (owner: Theme, opacity: number) =>
    owner === theme ? opacity * dim : 0
  const line = (
    id: string,
    paint: NonNullable<Extract<LayerSpecification, { type: "line" }>["paint"]>
  ): LayerSpecification => ({
    id,
    type: "line",
    source: ROUTES_3D_SOURCE,
    layout,
    paint,
  })
  const glow: Stops = [
    [8, 1.6],
    [12, 3],
    [15, 8],
    [18, 20],
  ]

  return [
    // Night: a soft glow under thin, whitened lines.
    line("routes-3d-glow", {
      "line-color": sportColorExpression(sports, "dark", sportColors),
      "line-width": byZoom(glow),
      "line-blur": byZoom(scaled(glow, 0.7)),
      "line-opacity": shown("dark", 0.22),
    }),
    // Day: a paper casing under the sport color.
    line("routes-3d-casing", {
      "line-color": PAPER.light,
      "line-width": byZoom([
        [8, 1.8],
        [12, 2.8],
        [15, 4.6],
        [18, 9],
      ]),
      "line-opacity": shown("light", 0.85),
    }),
    line(ROUTES_3D_PICK_LAYER, {
      "line-color": sportColorExpression(sports, "light", sportColors),
      "line-width": byZoom([
        [8, 0.8],
        [12, 1.3],
        [15, 2.2],
        [18, 4.4],
      ]),
      "line-opacity": shown("light", 0.92),
    }),
    line("routes-3d-core-dark", {
      "line-color": sportColorExpression(sports, "dark", sportColors, 0.35),
      "line-width": byZoom([
        [8, 0.5],
        [12, 0.9],
        [15, 1.7],
        [18, 3.6],
      ]),
      "line-opacity": shown("dark", 0.9),
    }),
  ]
}

/** The selected route as one theme paints it, faded out in the other. */
function selectionLayers(
  color: string,
  owner: Theme,
  theme: Theme,
  drawn = 1
): LayerSpecification[] {
  const dark = owner === "dark"
  const on = owner === theme
  const colors = selectionColors(color, owner)
  const ids = selectionIds(owner)
  const halo: Stops = dark
    ? [
        [10, 10],
        [14, 16],
        [18, 30],
      ]
    : [
        [10, 6.5],
        [14, 9],
        [18, 16],
      ]
  const lines = [
    "==",
    ["geometry-type"],
    "LineString",
  ] as ExpressionSpecification
  return [
    {
      id: ids.halo,
      type: "line",
      source: SELECTION_3D_SOURCE,
      filter: lines,
      layout: ROUND,
      paint: {
        "line-gradient": progressGradient(colors.halo, drawn),
        "line-width": byZoom(halo),
        "line-blur": dark ? byZoom(scaled(halo, 0.6)) : 0,
        "line-opacity": on ? (dark ? 0.5 : 1) : 0,
      },
    },
    {
      id: ids.core,
      type: "line",
      source: SELECTION_3D_SOURCE,
      filter: lines,
      layout: ROUND,
      paint: {
        "line-gradient": progressGradient(colors.core, drawn),
        "line-width": byZoom([
          [10, 2.4],
          [14, 3.5],
          [18, 7],
        ]),
        "line-opacity": on ? 1 : 0,
      },
    },
    {
      id: ids.ends,
      type: "circle",
      source: SELECTION_3D_SOURCE,
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-radius": 5.5,
        "circle-color": ["case", ["get", "start"], color, colors.paper],
        "circle-opacity": on ? 1 : 0,
        "circle-stroke-width": 2,
        "circle-stroke-color": dark ? "#ffffff" : color,
        "circle-stroke-opacity": on ? 1 : 0,
      },
    },
  ]
}

/**
 * Lights the selected route up to `share` of its length, in both themes'
 * layers. `ahead` keeps the stretch still to fly faintly visible.
 */
export function paintSelection(
  map: MapLibreMap,
  colors: Record<Theme, string>,
  share: number,
  ahead = false
) {
  for (const theme of THEMES) {
    const ids = selectionIds(theme)
    if (!map.getLayer(ids.core)) continue
    const tint = selectionColors(colors[theme], theme)
    map.setPaintProperty(
      ids.halo,
      "line-gradient",
      progressGradient(tint.halo, share)
    )
    map.setPaintProperty(
      ids.core,
      "line-gradient",
      progressGradient(tint.core, share, ahead ? tint.ahead : undefined)
    )
  }
}

function flyoverLayers(color: string, theme: Theme): LayerSpecification[] {
  const dark = theme === "dark"
  return [
    {
      id: "flyover-glow",
      type: "circle",
      source: FLYOVER_SOURCE,
      paint: {
        "circle-radius": 26,
        "circle-color": color,
        "circle-blur": 1,
        "circle-opacity": dark ? 0.7 : 0.45,
      },
    },
    {
      id: "flyover-head",
      type: "circle",
      source: FLYOVER_SOURCE,
      paint: {
        "circle-radius": 6.5,
        "circle-color": dark ? "#ffffff" : color,
        "circle-stroke-width": 2.5,
        "circle-stroke-color": dark ? color : PAPER.light,
      },
    },
  ]
}

const selectionData = new WeakMap<Float64Array, GeoJSON.FeatureCollection>()

/** The selected route and its two ends, cached so style diffs stay cheap. */
function selectionGeoJSON(coords: Float64Array) {
  let data = selectionData.get(coords)
  if (!data) {
    const line: [number, number][] = []
    for (let i = 0; i < coords.length; i += 2)
      line.push([coords[i], coords[i + 1]])
    const point = (at: [number, number], start: boolean): GeoJSON.Feature => ({
      type: "Feature",
      properties: { start },
      geometry: { type: "Point", coordinates: at },
    })
    data = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: line },
        },
        point(line[0], true),
        point(line[line.length - 1], false),
      ],
    }
    selectionData.set(coords, data)
  }
  return data
}

/** A single point, for the flyover head. */
export function pointGeoJSON([lng, lat]: [
  number,
  number,
]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [lng, lat] },
      },
    ],
  }
}

/**
 * Adds the routes, the selection and the flyover head to a 3D style, under
 * the extruded buildings and the place names.
 */
export function withRoutes3d(
  style: StyleSpecification,
  input: Routes3dInput
): StyleSpecification {
  const sources = { ...style.sources }
  const added: LayerSpecification[] = []

  if (input.routes) {
    sources[ROUTES_3D_SOURCE] = { type: "geojson", data: input.routes }
    added.push(...routeLayers(input))
  }
  if (input.selection) {
    sources[SELECTION_3D_SOURCE] = {
      type: "geojson",
      data: selectionGeoJSON(input.selection.coords),
      lineMetrics: true,
    }
    const { colors, drawn } = input.selection
    // Halos first, so neither theme's halo covers the other's line mid-fade.
    const [night, day] = THEMES.map((owner) =>
      selectionLayers(colors[owner], owner, input.theme, drawn)
    )
    added.push(night[0], day[0], day[1], night[1], day[2], night[2])
    if (input.flyoverStart) {
      sources[FLYOVER_SOURCE] = {
        type: "geojson",
        data: pointGeoJSON(input.flyoverStart),
      }
      added.push(...flyoverLayers(colors[input.theme], input.theme))
    }
  }

  const layers = [...style.layers]
  const anchor = layers.findIndex(
    (layer) => layer.id === BUILDING_3D_LAYER_ID || layer.id === LABEL_LAYER_ID
  )
  layers.splice(anchor < 0 ? layers.length : anchor, 0, ...added)
  return { ...style, sources, layers }
}

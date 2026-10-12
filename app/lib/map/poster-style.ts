import type {
  ExpressionSpecification,
  LayerSpecification,
  StyleSpecification,
} from "maplibre-gl"

import { hexToOklch, oklchToHex } from "~/lib/color"

import { OPENFREEMAP_ATTRIBUTION } from "./style"

/**
 * Poster colors. Streets share one color and get their hierarchy from
 * opacity, as in poster.png; motorways take the accent and glow.
 */
export interface PosterPalette {
  land: string
  water: string
  park: string
  roads: string
  highway: string
  route: string
  text: string
}

/** Ámbar follows poster.png: black ground, orange streets. */
export const POSTER_THEMES = [
  {
    id: "ambar",
    label: "Ámbar",
    palette: {
      land: "#0b0704",
      water: "#030201",
      park: "#1a0d07",
      roads: "#c4652a",
      highway: "#ff6f1e",
      route: "#fff1d6",
      text: "#f6dca6",
    },
  },
  {
    id: "noche",
    label: "Noche",
    palette: {
      land: "#0b1716",
      water: "#050d0c",
      park: "#0f201d",
      roads: "#4f8a80",
      highway: "#7cc4b6",
      route: "#5effc0",
      text: "#d4efe6",
    },
  },
  {
    id: "arena",
    label: "Arena",
    palette: {
      land: "#f4eee2",
      water: "#cddbd4",
      park: "#e5e4cf",
      roads: "#9c8058",
      highway: "#8a6a3c",
      route: "#d9441c",
      text: "#3b3428",
    },
  },
  {
    id: "tinta",
    label: "Tinta",
    palette: {
      land: "#f7f5f0",
      water: "#dfe3e8",
      park: "#eceee7",
      roads: "#57534c",
      highway: "#1f1e1b",
      route: "#e0301e",
      text: "#1c1b19",
    },
  },
] as const satisfies readonly {
  id: string
  label: string
  palette: PosterPalette
}[]

export type PosterThemeId = (typeof POSTER_THEMES)[number]["id"]

/** Dark grounds get light text and glowing lines. */
export function isDarkPalette(palette: Pick<PosterPalette, "land">) {
  return hexToOklch(palette.land).l < 0.55
}

/** Text that reads on any custom ground: cream on dark, ink on light. */
export function textForLand(land: string) {
  return isDarkPalette({ land }) ? "#f3ead8" : "#1f1d1a"
}

export interface PosterRouteStyle {
  /** One color for every route; `null` colors each by its `color` property. */
  color: string | null
  /** Multiplies the default line width. */
  weight: number
  /** Opacity of the lines, 0–1. */
  opacity: number
  /** Multiplies the glow routes get on dark grounds; 0 turns it off. */
  glow: number
}

export const POSTER_ROUTE_DEFAULTS = {
  weight: 1,
  opacity: 0.9,
  glow: 1,
} satisfies Omit<PosterRouteStyle, "color">

/** How the basemap under the routes looks. */
export interface PosterMapStyle {
  /** Multiplies the opacity of streets, motorways and railways. */
  streets: number
  /** Scales the lightness of the map's colors: −0.4 darker, 0.4 brighter. */
  brightness: number
  /** Multiplies the chroma of the map's colors; 0 is greyscale. */
  saturation: number
}

/** Streets a little dimmed, so the routes lead. */
export const POSTER_MAP_DEFAULTS: PosterMapStyle = {
  streets: 0.7,
  brightness: 0,
  saturation: 1,
}

/** Palette colors that belong to the basemap, not the routes or the title. */
const MAP_COLORS = ["land", "water", "park", "roads", "highway"] as const

/**
 * The palette with the basemap colors made brighter or darker and more or
 * less vivid. Lightness scales instead of shifting, so near-black grounds
 * stay near black while the streets on them light up.
 */
export function adjustPalette(
  palette: PosterPalette,
  { brightness, saturation }: Pick<PosterMapStyle, "brightness" | "saturation">
): PosterPalette {
  if (brightness === 0 && saturation === 1) return palette
  const adjusted = { ...palette }
  for (const key of MAP_COLORS) {
    const color = hexToOklch(palette[key])
    adjusted[key] = oklchToHex({
      l: Math.min(1, color.l * (1 + brightness)),
      c: color.c * saturation,
      h: color.h,
    })
  }
  return adjusted
}

export const POSTER_TILES_SOURCE = "openmaptiles"
export const POSTER_ROUTES_SOURCE = "routes"

/** Zoom where the widths below apply: a whole city on the poster. */
const BASE_ZOOM = 12

/**
 * Width in logical pixels of the 3 000 px wide poster (see POSTER_WIDTH) at
 * BASE_ZOOM, growing by `base` per zoom level: slower than the map itself, so
 * zooming out keeps lines visible and zooming in does not bloat them.
 */
const width = (px: number, base = 1.6): ExpressionSpecification => [
  "interpolate",
  ["exponential", base],
  ["zoom"],
  BASE_ZOOM - 8,
  px * base ** -8,
  BASE_ZOOM,
  px,
  BASE_ZOOM + 8,
  px * base ** 8,
]

const lines: ExpressionSpecification = [
  "match",
  ["geometry-type"],
  ["LineString", "MultiLineString"],
  true,
  false,
]

function road(
  id: string,
  classes: string[],
  color: string,
  opacity: number,
  px: number,
  blur = 0
): LayerSpecification {
  return {
    id,
    type: "line",
    source: POSTER_TILES_SOURCE,
    "source-layer": "transportation",
    // Tunnels too: a poster reads better with every road continuous.
    filter: ["all", lines, ["match", ["get", "class"], classes, true, false]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": color,
      "line-opacity": opacity,
      "line-width": width(px),
      ...(blur ? { "line-blur": width(blur) } : {}),
    },
  }
}

/** Routes shrink less than streets when zooming out, so they keep the image. */
const ROUTE_BASE = 1.4
/** Route width at BASE_ZOOM: wider than primary roads, so routes lead. */
const ROUTE_WIDTH = 5.5

/**
 * Basemap and routes for the poster. Unlike the app map, every street class
 * is drawn and visible, there are no labels or borders, and motorways glow.
 * Routes come from the `routes` GeoJSON source, filled in by the poster map.
 * `streets` multiplies the opacity of every road, to let the routes lead.
 */
export function createPosterStyle(
  palette: PosterPalette,
  route: PosterRouteStyle,
  streets = 1
): StyleSpecification {
  const dark = isDarkPalette(palette)
  const glow = dark ? 1 : 0
  const street = (opacity: number) => opacity * streets

  const layers: LayerSpecification[] = [
    {
      id: "background",
      type: "background",
      paint: { "background-color": palette.land },
    },
    {
      id: "landcover",
      type: "fill",
      source: POSTER_TILES_SOURCE,
      "source-layer": "landcover",
      filter: [
        "match",
        ["get", "class"],
        ["wood", "grass", "farmland"],
        true,
        false,
      ],
      paint: { "fill-color": palette.park, "fill-opacity": 0.6 },
    },
    {
      id: "park",
      type: "fill",
      source: POSTER_TILES_SOURCE,
      "source-layer": "park",
      paint: { "fill-color": palette.park, "fill-opacity": 0.9 },
    },
    {
      id: "water",
      type: "fill",
      source: POSTER_TILES_SOURCE,
      "source-layer": "water",
      filter: ["!=", ["get", "brunnel"], "tunnel"],
      paint: { "fill-color": palette.water },
    },
    {
      id: "waterway",
      type: "line",
      source: POSTER_TILES_SOURCE,
      "source-layer": "waterway",
      paint: {
        "line-color": palette.water,
        "line-width": width(2.4),
      },
    },
    road("road-path", ["path", "track"], palette.roads, street(0.3), 1.1),
    road("road-minor", ["minor", "service"], palette.roads, street(0.48), 1.8),
    road("road-tertiary", ["tertiary"], palette.roads, street(0.68), 2.8),
    road("road-secondary", ["secondary"], palette.roads, street(0.8), 3.4),
    road("road-primary", ["primary", "trunk"], palette.roads, street(1), 4.6),
    road(
      "road-motorway-glow",
      ["motorway"],
      palette.highway,
      street(0.3 * glow),
      26,
      18
    ),
    road("road-motorway", ["motorway"], palette.highway, street(1), 8),
    {
      id: "rail",
      type: "line",
      source: POSTER_TILES_SOURCE,
      "source-layer": "transportation",
      filter: [
        "all",
        ["match", ["get", "class"], ["rail"], true, false],
        ["!=", ["get", "brunnel"], "tunnel"],
      ],
      paint: {
        "line-color": palette.roads,
        "line-opacity": street(0.35),
        "line-width": width(1.6),
      },
    },
  ]

  const color: ExpressionSpecification | string = route.color ?? [
    "get",
    "color",
  ]
  const core = ROUTE_WIDTH * route.weight
  layers.push(
    {
      // A soft band of ground under each route keeps streets from running
      // through it, so the route reads on top of a busy city.
      id: "routes-halo",
      type: "line",
      source: POSTER_ROUTES_SOURCE,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": palette.land,
        "line-opacity": 0.75 * route.opacity,
        "line-width": width(core + 7, ROUTE_BASE),
        "line-blur": width(4, ROUTE_BASE),
      },
    },
    {
      id: "routes-glow",
      type: "line",
      source: POSTER_ROUTES_SOURCE,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": color,
        "line-opacity": Math.min(1, 0.16 * glow * route.glow),
        "line-width": width(core * 3.5, ROUTE_BASE),
        "line-blur": width(core * 2.5, ROUTE_BASE),
      },
    },
    {
      id: "routes-core",
      type: "line",
      source: POSTER_ROUTES_SOURCE,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": color,
        "line-opacity": route.opacity,
        "line-width": width(core, ROUTE_BASE),
      },
    }
  )

  return {
    version: 8,
    name: "trazo-poster",
    sources: {
      [POSTER_TILES_SOURCE]: {
        type: "vector",
        url: "https://tiles.openfreemap.org/planet",
        attribution: OPENFREEMAP_ATTRIBUTION,
      },
      [POSTER_ROUTES_SOURCE]: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        maxzoom: 16,
      },
    },
    transition: { duration: 300, delay: 0 },
    layers,
  }
}

import type {
  ExpressionSpecification,
  FilterSpecification,
  LayerSpecification,
  SourceSpecification,
  StyleSpecification,
} from "maplibre-gl"

import type { Theme } from "~/lib/theme"

export interface MapPalette {
  land: string
  water: string
  park: string
  building: string
  path: string
  roadMinor: string
  roadMajor: string
  roadHighway: string
  rail: string
  boundary: string
  label: string
  labelHalo: string
}

/** Night map from design.png: dark teal, fine streets, no labels. */
export const NIGHT: MapPalette = {
  land: "#0b1716",
  water: "#06100f",
  park: "#0d1d1a",
  building: "#0f1f1d",
  path: "#18302d",
  roadMinor: "#1f3936",
  roadMajor: "#2a4643",
  roadHighway: "#34605a",
  rail: "#1d3532",
  boundary: "#3b6660",
  label: "#7fa59a",
  labelHalo: "#0b1716",
}

/** Day map: cream land, sand streets, sage water. */
export const DAY: MapPalette = {
  land: "#f6f1e6",
  water: "#d3e2da",
  park: "#e9e9d6",
  building: "#eee6d5",
  path: "#e9e0cc",
  roadMinor: "#e4d9c2",
  roadMajor: "#dccfb4",
  roadHighway: "#d1bf98",
  rail: "#ddd2bc",
  boundary: "#c4b28c",
  label: "#6b776f",
  labelHalo: "#f6f1e6",
}

export function paletteForTheme(theme: Theme) {
  return theme === "dark" ? NIGHT : DAY
}

/** Colors of the 3D view: relief shading, extruded buildings and the sky. */
export interface ReliefPalette {
  shadow: string
  highlight: string
  accent: string
  building: string
  sky: string
  horizon: string
  fog: string
}

/** Night relief: moonlit ridges in teal, black valleys, a faint glow on the horizon. */
export const NIGHT_RELIEF: ReliefPalette = {
  shadow: "rgba(0, 5, 5, 0.82)",
  highlight: "rgba(122, 196, 178, 0.28)",
  accent: "rgba(0, 0, 0, 0.3)",
  building: "#16302d",
  sky: "#020707",
  horizon: "#1d4a43",
  fog: "#0b1716",
}

/** Day relief: warm umber shadows on cream, a pale sage sky and a sandy haze. */
export const DAY_RELIEF: ReliefPalette = {
  shadow: "rgba(92, 72, 38, 0.42)",
  highlight: "rgba(255, 253, 244, 0.6)",
  accent: "rgba(120, 98, 58, 0.16)",
  building: "#e9dfca",
  sky: "#bfd6d3",
  horizon: "#f6f1e6",
  fog: "#efe7d5",
}

export function reliefForTheme(theme: Theme) {
  return theme === "dark" ? NIGHT_RELIEF : DAY_RELIEF
}

/** Height of the relief relative to the real one: enough for hills to read. */
export const TERRAIN_EXAGGERATION = 1.5

export const OPENFREEMAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">© OpenMapTiles</a> Datos de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'

const MAPTERHORN_ATTRIBUTION =
  '<a href="https://mapterhorn.com/attribution" target="_blank" rel="noreferrer">© Mapterhorn</a>'

/**
 * Elevation tiles from Mapterhorn (Terrarium encoding). Zoom 12 covers the
 * whole world; deeper zooms only exist in some countries.
 */
const elevation = (): SourceSpecification => ({
  type: "raster-dem",
  tiles: ["https://tiles.mapterhorn.com/{z}/{x}/{y}.webp"],
  encoding: "terrarium",
  tileSize: 512,
  maxzoom: 12,
  attribution: MAPTERHORN_ATTRIBUTION,
})

/** Terrain and hillshade read separate sources, as MapLibre recommends. */
export const TERRAIN_SOURCE = "terrain"
const SHADE_SOURCE = "terrain-shade"

const SOURCE = "openmaptiles"

const width = (stops: [zoom: number, px: number][]): ExpressionSpecification => [
  "interpolate",
  ["exponential", 1.5],
  ["zoom"],
  ...stops.flat(),
]

const roadClass = (...classes: string[]): FilterSpecification => [
  "all",
  ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
  ["match", ["get", "class"], classes, true, false],
]

function road(
  id: string,
  color: string,
  classes: string[],
  minzoom: number,
  stops: [number, number][]
): LayerSpecification {
  return {
    id,
    type: "line",
    source: SOURCE,
    "source-layer": "transportation",
    minzoom,
    filter: roadClass(...classes),
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": color, "line-width": width(stops) },
  }
}

export interface MapStyleOptions {
  labels?: boolean
  buildings?: boolean
  /** Turns the map 3D: terrain, relief shading, extruded buildings and sky. */
  relief?: ReliefPalette
}

/** Id of the layer the 3D routes go under, so buildings stand over them. */
export const BUILDING_3D_LAYER_ID = "building-3d"

/**
 * Builds the basemap style from a palette. Streets are fine lines with no
 * labels by default, so the routes drawn on top carry the image.
 */
export function createMapStyle(
  palette: MapPalette,
  { labels = false, buildings = true, relief }: MapStyleOptions = {}
): StyleSpecification {
  const layers: LayerSpecification[] = [
    {
      id: "background",
      type: "background",
      paint: { "background-color": palette.land },
    },
    {
      id: "landcover",
      type: "fill",
      source: SOURCE,
      "source-layer": "landcover",
      filter: ["match", ["get", "class"], ["wood", "grass", "farmland"], true, false],
      paint: { "fill-color": palette.park, "fill-opacity": 0.55 },
    },
    {
      id: "park",
      type: "fill",
      source: SOURCE,
      "source-layer": "park",
      paint: { "fill-color": palette.park, "fill-opacity": 0.85 },
    },
  ]

  if (relief) {
    layers.push({
      id: "hillshade",
      type: "hillshade",
      source: SHADE_SOURCE,
      paint: {
        // Igor's method keeps flat ground clear, so cities do not turn gray.
        "hillshade-method": "igor",
        "hillshade-exaggeration": 0.7,
        "hillshade-shadow-color": relief.shadow,
        "hillshade-highlight-color": relief.highlight,
        "hillshade-accent-color": relief.accent,
      },
    })
  }

  layers.push(
    {
      id: "water",
      type: "fill",
      source: SOURCE,
      "source-layer": "water",
      filter: ["!=", ["get", "brunnel"], "tunnel"],
      paint: { "fill-color": palette.water },
    },
    {
      id: "waterway",
      type: "line",
      source: SOURCE,
      "source-layer": "waterway",
      minzoom: 8,
      paint: {
        "line-color": palette.water,
        "line-width": width([
          [8, 0.5],
          [14, 2],
          [18, 6],
        ]),
      },
    }
  )

  // In 3D the buildings rise instead, see below.
  if (buildings && !relief) {
    layers.push({
      id: "building",
      type: "fill",
      source: SOURCE,
      "source-layer": "building",
      minzoom: 14,
      paint: {
        "fill-color": palette.building,
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 1],
      },
    })
  }

  layers.push(
    road("road-path", palette.path, ["path", "track"], 13, [
      [13, 0.3],
      [18, 1.6],
    ]),
    road("road-minor", palette.roadMinor, ["minor", "service"], 11, [
      [11, 0.2],
      [14, 0.7],
      [18, 4],
    ]),
    road("road-secondary", palette.roadMajor, ["secondary", "tertiary"], 8, [
      [8, 0.25],
      [12, 0.9],
      [18, 7],
    ]),
    road("road-primary", palette.roadMajor, ["primary", "trunk"], 6, [
      [6, 0.3],
      [12, 1.3],
      [18, 9],
    ]),
    road("road-motorway", palette.roadHighway, ["motorway"], 5, [
      [5, 0.35],
      [10, 1.2],
      [18, 11],
    ]),
    {
      id: "rail",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 10,
      filter: ["match", ["get", "class"], ["rail", "transit"], true, false],
      paint: {
        "line-color": palette.rail,
        "line-width": width([
          [10, 0.4],
          [18, 2],
        ]),
        "line-dasharray": [3, 2],
      },
    },
    {
      id: "boundary",
      type: "line",
      source: SOURCE,
      "source-layer": "boundary",
      filter: [
        "all",
        ["<=", ["get", "admin_level"], 4],
        ["!=", ["get", "maritime"], 1],
      ],
      paint: {
        "line-color": palette.boundary,
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3,
          ["match", ["get", "admin_level"], 2, 0.6, 0.3],
          10,
          ["match", ["get", "admin_level"], 2, 1.4, 0.8],
        ],
        "line-dasharray": [2, 2],
        "line-opacity": 0.7,
      },
    }
  )

  // After every flat layer, so the terrain drapes them in a single pass.
  if (buildings && relief) {
    const height: ExpressionSpecification = [
      "coalesce",
      ["get", "render_height"],
      6,
    ]
    layers.push({
      id: BUILDING_3D_LAYER_ID,
      type: "fill-extrusion",
      source: SOURCE,
      "source-layer": "building",
      minzoom: 14,
      paint: {
        "fill-extrusion-color": relief.building,
        // Buildings rise out of the ground as the map zooms in.
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14,
          0,
          15.5,
          height,
        ],
        "fill-extrusion-base": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14,
          0,
          15.5,
          ["coalesce", ["get", "render_min_height"], 0],
        ],
        "fill-extrusion-opacity": 0.92,
        "fill-extrusion-vertical-gradient": true,
      },
    })
  }

  if (labels) {
    // Tilted, the far tiles would fill the horizon with tiny village names.
    const places = relief ? ["city", "town"] : ["city", "town", "village"]
    layers.push({
      id: "place-label",
      type: "symbol",
      source: SOURCE,
      "source-layer": "place",
      filter: ["match", ["get", "class"], places, true, false],
      layout: {
        "text-field": ["coalesce", ["get", "name:es"], ["get", "name"]],
        "text-font": ["Noto Sans Regular"],
        // MapLibre allows a single zoom curve, so the class picks each stop.
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          ["match", ["get", "class"], "city", 11, "town", 9, 8],
          10,
          ["match", ["get", "class"], "city", 16, "town", 11.5, 9],
          15,
          ["match", ["get", "class"], "city", 19, "town", 15, 13],
        ],
        "text-max-width": 8,
        "text-padding": 4,
        // Cities win collisions over towns, towns over villages.
        "symbol-sort-key": [
          "+",
          ["match", ["get", "class"], "city", 0, "town", 1000, 2000],
          ["coalesce", ["get", "rank"], 999],
        ],
      },
      paint: {
        "text-color": palette.label,
        "text-halo-color": palette.labelHalo,
        "text-halo-width": 2,
      },
    })
  }

  const style: StyleSpecification = {
    version: 8,
    name: "trazo",
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      [SOURCE]: {
        type: "vector",
        url: "https://tiles.openfreemap.org/planet",
        attribution: OPENFREEMAP_ATTRIBUTION,
      },
    },
    transition: { duration: 450, delay: 0 },
    layers,
  }

  if (relief) {
    style.sources[TERRAIN_SOURCE] = elevation()
    style.sources[SHADE_SOURCE] = elevation()
    style.terrain = {
      source: TERRAIN_SOURCE,
      exaggeration: TERRAIN_EXAGGERATION,
    }
    style.sky = {
      "sky-color": relief.sky,
      "horizon-color": relief.horizon,
      "fog-color": relief.fog,
      // Fog starts halfway to the horizon and swallows the far ridges.
      "fog-ground-blend": 0.45,
      "horizon-fog-blend": 0.75,
      "sky-horizon-blend": 0.6,
      "atmosphere-blend": 0,
    }
  }

  return style
}

/** Id of the first label layer, so routes can be drawn underneath it. */
export const LABEL_LAYER_ID = "place-label"

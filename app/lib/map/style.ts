import type {
  ExpressionSpecification,
  FilterSpecification,
  LayerSpecification,
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

export const OPENFREEMAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">© OpenMapTiles</a> Datos de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'

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
}

/**
 * Builds the basemap style from a palette. Streets are fine lines with no
 * labels by default, so the routes drawn on top carry the image.
 */
export function createMapStyle(
  palette: MapPalette,
  { labels = false, buildings = true }: MapStyleOptions = {}
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
    },
  ]

  if (buildings) {
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

  if (labels) {
    layers.push({
      id: "place-label",
      type: "symbol",
      source: SOURCE,
      "source-layer": "place",
      filter: ["match", ["get", "class"], ["city", "town", "village"], true, false],
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

  return {
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
}

/** Id of the first label layer, so routes can be drawn underneath it. */
export const LABEL_LAYER_ID = "place-label"

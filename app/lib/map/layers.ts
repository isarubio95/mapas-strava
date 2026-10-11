import type { Color, Layer } from "@deck.gl/core"
import { HeatmapLayer } from "@deck.gl/aggregation-layers"
import { DataFilterExtension } from "@deck.gl/extensions"
import { TripsLayer } from "@deck.gl/geo-layers"
import { ScatterplotLayer } from "@deck.gl/layers"
import type { Parameters } from "@luma.gl/core"

import type { Activity } from "~/lib/activities"
import { hexToRgb } from "~/lib/color"
import { sportColor, type SportColors } from "~/lib/sports"
import type { Theme } from "~/lib/theme"

import type { RouteGeometry } from "./engine"
import { drawTimes, REVEAL_HEAD, SELECTION_DRAW } from "./reveal"

type Rgba = [number, number, number, number]

interface BinaryPaths {
  length: number
  startIndices: Uint32Array
  attributes: {
    getPath: { value: Float64Array; size: 2 }
    getTimestamps?: { value: Float32Array; size: 1 }
  }
}

const ADDITIVE: Parameters = {
  blend: true,
  blendColorOperation: "add",
  blendColorSrcFactor: "src-alpha",
  blendColorDstFactor: "one",
  blendAlphaOperation: "add",
  blendAlphaSrcFactor: "one",
  blendAlphaDstFactor: "one-minus-src-alpha",
  depthWriteEnabled: false,
  depthCompare: "always",
}

const OVER: Parameters = {
  blend: true,
  blendColorOperation: "add",
  blendColorSrcFactor: "src-alpha",
  blendColorDstFactor: "one-minus-src-alpha",
  blendAlphaOperation: "add",
  blendAlphaSrcFactor: "one",
  blendAlphaDstFactor: "one-minus-src-alpha",
  depthWriteEnabled: false,
  depthCompare: "always",
}

const filterExtension = new DataFilterExtension({ filterSize: 2 })

const PAPER: Record<Theme, Rgba> = {
  dark: [11, 23, 22, 255],
  light: [251, 248, 241, 255],
}

export interface PathColors {
  base: Uint8Array
  core: Uint8Array
}

/** RGBA per path for the base halo and the brighter core line. */
export function buildPathColors(
  geometry: RouteGeometry,
  activities: Activity[],
  theme: Theme,
  overrides?: SportColors
): PathColors {
  const n = geometry.pathActivity.length
  const base = new Uint8Array(n * 4)
  const core = new Uint8Array(n * 4)
  const cache = new Map<string, [number, number, number]>()
  const whiten = theme === "dark" ? 0.35 : 0

  for (let p = 0; p < n; p++) {
    const type = activities[geometry.pathActivity[p]].sportType
    let rgb = cache.get(type)
    if (!rgb) {
      rgb = hexToRgb(sportColor(type, theme, overrides))
      cache.set(type, rgb)
    }
    base.set([rgb[0], rgb[1], rgb[2], 255], p * 4)
    core.set(
      [
        Math.round(rgb[0] + (255 - rgb[0]) * whiten),
        Math.round(rgb[1] + (255 - rgb[1]) * whiten),
        Math.round(rgb[2] + (255 - rgb[2]) * whiten),
        255,
      ],
      p * 4
    )
  }
  return { base, core }
}

const binaryCache = new WeakMap<RouteGeometry, BinaryPaths>()

/** deck.gl binary path data; cached so layers keep the same `data` object. */
export function binaryPaths(geometry: RouteGeometry) {
  let data = binaryCache.get(geometry)
  if (!data) {
    data = {
      length: geometry.pathActivity.length,
      startIndices: geometry.startIndices,
      attributes: { getPath: { value: geometry.positions, size: 2 } },
    }
    binaryCache.set(geometry, data)
  }
  return data
}

type Accessor<T> = (object: unknown, info: { index: number; target: number[] }) => T

/** Per-path slices of a per-vertex array, for accessors deck.gl expands per vertex. */
const vertexAccessor =
  (values: Float32Array, startIndices: Uint32Array): Accessor<Float32Array> =>
  (_, { index }) =>
    values.subarray(startIndices[index], startIndices[index + 1])

const colorAccessor =
  (colors: Uint8Array): Accessor<Rgba> =>
  (_, { index, target }) => {
    target[0] = colors[index * 4]
    target[1] = colors[index * 4 + 1]
    target[2] = colors[index * 4 + 2]
    target[3] = colors[index * 4 + 3]
    return target as Rgba
  }

/** Where routes stand in their draw-in animation (see RouteReveal). */
export interface RevealFrame {
  /** Seconds on the reveal clock when each vertex gets drawn. */
  times: Float32Array
  /** Bumped whenever `times` changes. */
  version: number
  currentTime: number
  /** Some route is drawing right now. */
  drawing: boolean
  /** Routes animate when they appear, so the head layer stays ready. */
  animated: boolean
}

export interface RouteLayersInput {
  geometry: RouteGeometry
  colors: PathColors
  /** Per path, 1 when it passes the non-date filters. */
  mask: Uint8Array
  /** Inclusive local day range. */
  dayRange: [number, number]
  theme: Theme
  reveal: RevealFrame
  /** Fade everything but the selection. */
  dimmed?: boolean
  beforeId?: string
  pickable?: boolean
}

/**
 * All filtered routes, drawn as a neon glow (dark) or ink line (light).
 * Routes that appear draw themselves from start to finish behind a soft head.
 */
export function routeLayers({
  geometry,
  colors,
  mask,
  dayRange,
  theme,
  reveal,
  dimmed = false,
  beforeId,
  pickable = true,
}: RouteLayersInput): Layer[] {
  const data = binaryPaths(geometry)
  const { pathDay } = geometry
  const dark = theme === "dark"
  const dim = dimmed ? 0.3 : 1
  const shared = {
    data,
    _pathType: "open" as const,
    beforeId,
    widthUnits: "meters" as const,
    getWidth: 1,
    capRounded: true,
    jointRounded: true,
    getTimestamps: vertexAccessor(reveal.times, geometry.startIndices),
    currentTime: reveal.currentTime,
    fadeTrail: false,
    getFilterValue: ((_: unknown, { index }: { index: number }) => [
      mask[index],
      pathDay[index],
    ]) as unknown as (d: unknown) => [number, number],
    filterRange: [
      [0.5, 1],
      [dayRange[0] - 0.01, dayRange[1] + 0.01],
    ] as [number, number][],
    extensions: [filterExtension],
    updateTriggers: {
      getFilterValue: [mask],
      getTimestamps: [reveal.times, reveal.version],
    },
  }
  const head = reveal.animated
    ? [
        new TripsLayer({
          ...shared,
          id: "routes-head",
          getColor: colorAccessor(colors.core),
          updateTriggers: { ...shared.updateTriggers, getColor: [colors.core] },
          fadeTrail: true,
          trailLength: REVEAL_HEAD,
          widthScale: dark ? 7 : 6,
          widthMinPixels: dark ? 2 : 2.2,
          widthMaxPixels: dark ? 4.5 : 4.2,
          opacity: (dark ? 0.35 : 0.3) * dim,
          parameters: dark ? ADDITIVE : OVER,
          visible: reveal.drawing,
        }),
      ]
    : []

  if (dark) {
    return [
      new TripsLayer({
        ...shared,
        id: "routes-halo",
        getColor: colorAccessor(colors.base),
        updateTriggers: { ...shared.updateTriggers, getColor: [colors.base] },
        // Additive, so repeated routes stack: keep it barely wider than the
        // core or overlapping tracks saturate into a fat band. Hairline when
        // zoomed out, growing with the street map from zoom ~13.
        widthScale: 20,
        widthMinPixels: 1.1,
        widthMaxPixels: 4,
        opacity: 0.06 * dim,
        parameters: ADDITIVE,
      }),
      new TripsLayer({
        ...shared,
        id: "routes-core",
        getColor: colorAccessor(colors.core),
        updateTriggers: { ...shared.updateTriggers, getColor: [colors.core] },
        widthScale: 8,
        widthMinPixels: 0.55,
        widthMaxPixels: 1.6,
        opacity: 0.9 * dim,
        parameters: OVER,
        pickable,
        autoHighlight: pickable,
        highlightColor: [255, 255, 255, 230],
      }),
      ...head,
    ]
  }

  return [
    new TripsLayer({
      ...shared,
      id: "routes-casing",
      getColor: PAPER.light,
      widthScale: 8,
      widthMinPixels: 3,
      widthMaxPixels: 5.2,
      opacity: 0.85 * dim,
      parameters: OVER,
    }),
    new TripsLayer({
      ...shared,
      id: "routes-core",
      getColor: colorAccessor(colors.core),
      updateTriggers: { ...shared.updateTriggers, getColor: [colors.core] },
      widthScale: 3,
      widthMinPixels: 1.3,
      widthMaxPixels: 2.2,
      opacity: 0.92 * dim,
      parameters: OVER,
      pickable,
      autoHighlight: pickable,
      highlightColor: [20, 32, 30, 230],
    }),
    ...head,
  ]
}

export interface SelectionInput {
  coords: Float64Array
  color: string
  theme: Theme
  /** Seconds since the selection appeared; it draws itself in over SELECTION_DRAW. */
  elapsed: number
  beforeId?: string
}

/** Seconds the end dots take to grow in. */
const DOT_GROW = 0.25

const selectionCache = new WeakMap<Float64Array, BinaryPaths>()

const easeOut = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3

/** The selected route on top of everything, with start and end dots. */
export function selectionLayers({
  coords,
  color,
  theme,
  elapsed,
  beforeId,
}: SelectionInput): Layer[] {
  const rgb = hexToRgb(color)
  const dark = theme === "dark"
  let data = selectionCache.get(coords)
  if (!data) {
    data = {
      length: 1,
      startIndices: new Uint32Array([0, coords.length / 2]),
      attributes: {
        getPath: { value: coords, size: 2 },
        getTimestamps: { value: drawTimes(coords, SELECTION_DRAW), size: 1 },
      },
    }
    selectionCache.set(coords, data)
  }
  const ends = [
    { position: [coords[0], coords[1]], start: true },
    { position: [coords[coords.length - 2], coords[coords.length - 1]], start: false },
  ]
  const startScale = easeOut(elapsed / DOT_GROW)
  const endScale = easeOut((elapsed - SELECTION_DRAW) / DOT_GROW)
  const path = {
    data,
    _pathType: "open" as const,
    beforeId,
    widthUnits: "pixels" as const,
    capRounded: true,
    jointRounded: true,
    currentTime: Math.min(elapsed, SELECTION_DRAW + 1),
    fadeTrail: false,
  }

  return [
    new TripsLayer({
      ...path,
      id: "selection-halo",
      getColor: (dark ? [rgb[0], rgb[1], rgb[2], 90] : PAPER.light) as Color,
      getWidth: dark ? 16 : 9,
      parameters: dark ? ADDITIVE : OVER,
    }),
    new TripsLayer({
      ...path,
      id: "selection-core",
      getColor: (dark ? [255, 255, 255, 245] : [rgb[0], rgb[1], rgb[2], 255]) as Color,
      getWidth: dark ? 3 : 3.5,
      parameters: OVER,
    }),
    new ScatterplotLayer({
      id: "selection-ends",
      data: ends,
      beforeId,
      getPosition: (d: { position: number[] }) => d.position as [number, number],
      radiusUnits: "pixels",
      getRadius: (d: { start: boolean }) => 5 * (d.start ? startScale : endScale),
      stroked: true,
      lineWidthUnits: "pixels",
      getLineWidth: (d: { start: boolean }) => 2 * (d.start ? startScale : endScale),
      updateTriggers: {
        getRadius: [startScale, endScale],
        getLineWidth: [startScale, endScale],
      },
      getFillColor: (d: { start: boolean }): Color =>
        d.start ? [rgb[0], rgb[1], rgb[2], 255] : PAPER[theme],
      getLineColor: (dark ? [255, 255, 255, 240] : [rgb[0], rgb[1], rgb[2], 255]) as Color,
      parameters: OVER,
    }),
  ]
}

export interface PlaybackInput {
  geometry: RouteGeometry
  colors: PathColors
  mask: Uint8Array
  dayRange: [number, number]
  timestamps: Float32Array
  currentTime: number
  /** Days a route takes to draw itself; the flash trails behind it. */
  drawDays: number
  theme: Theme
  beforeId?: string
}

const tripsCache = new WeakMap<Float32Array, BinaryPaths>()

/** Routes appear in chronological order, each with a short bright flash. */
export function playbackLayers({
  geometry,
  colors,
  mask,
  dayRange,
  timestamps,
  currentTime,
  drawDays,
  theme,
  beforeId,
}: PlaybackInput): Layer[] {
  let data = tripsCache.get(timestamps)
  if (!data) {
    data = {
      length: geometry.pathActivity.length,
      startIndices: geometry.startIndices,
      attributes: {
        getPath: { value: geometry.positions, size: 2 },
        getTimestamps: { value: timestamps, size: 1 },
      },
    }
    tripsCache.set(timestamps, data)
  }
  const { pathDay } = geometry
  const dark = theme === "dark"
  const shared = {
    data,
    _pathType: "open" as const,
    beforeId,
    currentTime,
    capRounded: true,
    jointRounded: true,
    widthUnits: "meters" as const,
    getWidth: 1,
    getFilterValue: ((_: unknown, { index }: { index: number }) => [
      mask[index],
      pathDay[index],
    ]) as unknown as (d: unknown) => [number, number],
    filterRange: [
      [0.5, 1],
      [dayRange[0] - 0.01, dayRange[1] + 0.01],
    ] as [number, number][],
    extensions: [filterExtension],
    updateTriggers: { getFilterValue: [mask] },
  }

  return [
    new TripsLayer({
      ...shared,
      id: "playback-core",
      getColor: colorAccessor(colors.core),
      updateTriggers: { ...shared.updateTriggers, getColor: [colors.core] },
      fadeTrail: false,
      trailLength: 1e6,
      widthScale: dark ? 8 : 3,
      widthMinPixels: dark ? 0.55 : 1.3,
      widthMaxPixels: dark ? 1.6 : 2.2,
      opacity: 0.9,
      parameters: OVER,
    }),
    new TripsLayer({
      ...shared,
      id: "playback-flash",
      getColor: dark
        ? ([255, 255, 255, 255] as Color)
        : colorAccessor(colors.core),
      updateTriggers: { ...shared.updateTriggers, getColor: [dark, colors.core] },
      fadeTrail: true,
      trailLength: drawDays * 1.6,
      widthScale: 14,
      widthMinPixels: 2.5,
      widthMaxPixels: 7,
      opacity: dark ? 0.55 : 0.4,
      parameters: dark ? ADDITIVE : OVER,
    }),
  ]
}

export const HEAT_RAMPS: Record<Theme, string[]> = {
  dark: ["#0f3a35", "#11705c", "#18a777", "#5ef2a6", "#c9ffe0", "#ffffff"],
  light: ["#efe4c9", "#d8c58f", "#a6c79a", "#4d9f72", "#1d7a51", "#0b4a31"],
}

export interface HeatmapInput {
  points: Float32Array
  theme: Theme
  radius: number
  intensity: number
  beforeId?: string
}

export function heatmapLayer({ points, theme, radius, intensity, beforeId }: HeatmapInput) {
  return new HeatmapLayer({
    id: "heatmap",
    beforeId,
    data: {
      length: points.length / 2,
      attributes: { getPosition: { value: points, size: 2 } },
    },
    getWeight: 1,
    radiusPixels: radius,
    intensity,
    threshold: 0.04,
    colorRange: HEAT_RAMPS[theme].map((hex) => hexToRgb(hex)),
    aggregation: "SUM",
    debounceTimeout: 120,
  })
}

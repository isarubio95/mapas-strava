import { describe, expect, it } from "vitest"

import type { LayerSpecification } from "maplibre-gl"

import { hexToOklch } from "~/lib/color"

import {
  adjustPalette,
  createPosterStyle,
  isDarkPalette,
  POSTER_ROUTE_DEFAULTS,
  POSTER_ROUTES_SOURCE,
  POSTER_THEMES,
  textForLand,
  type PosterPalette,
} from "./poster-style"

const amber: PosterPalette = POSTER_THEMES[0].palette
const solid = { ...POSTER_ROUTE_DEFAULTS, color: amber.route }
const bySport = { ...POSTER_ROUTE_DEFAULTS, color: null }

const paintOf = (layers: LayerSpecification[], id: string) =>
  (
    layers.find((layer) => layer.id === id) as {
      paint: Record<string, unknown>
    }
  ).paint
/** Width at the base zoom, the middle stop of the zoom curve. */
const baseWidth = (layers: LayerSpecification[], id: string) =>
  (paintOf(layers, id)["line-width"] as number[])[6]

describe("createPosterStyle", () => {
  it("draws every street class with no labels or borders", () => {
    const style = createPosterStyle(amber, solid)
    const ids = style.layers.map((layer) => layer.id)
    for (const id of [
      "road-path",
      "road-minor",
      "road-tertiary",
      "road-secondary",
      "road-primary",
      "road-motorway",
      "water",
    ])
      expect(ids).toContain(id)
    expect(style.layers.some((layer) => layer.type === "symbol")).toBe(false)
    expect(ids).not.toContain("boundary")
    expect(style.glyphs).toBeUndefined()
  })

  it("draws routes on top, from an empty GeoJSON source", () => {
    const style = createPosterStyle(amber, solid)
    expect(style.layers.at(-1)).toMatchObject({
      id: "routes-core",
      source: POSTER_ROUTES_SOURCE,
      paint: { "line-color": amber.route },
    })
    expect(style.sources[POSTER_ROUTES_SOURCE]).toMatchObject({
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    })
  })

  it("colors routes by sport when there is no single color", () => {
    const style = createPosterStyle(amber, bySport)
    expect(style.layers.at(-1)).toMatchObject({
      paint: { "line-color": ["get", "color"] },
    })
  })

  it("keeps the same layers across themes, so the map only updates paint", () => {
    const ids = (index: number) =>
      createPosterStyle(POSTER_THEMES[index].palette, bySport).layers.map(
        (layer) => layer.id
      )
    for (let index = 1; index < POSTER_THEMES.length; index++)
      expect(ids(index)).toEqual(ids(0))
  })
})

describe("route emphasis", () => {
  const { layers } = createPosterStyle(amber, solid)

  it("draws routes wider than any street but motorways", () => {
    expect(baseWidth(layers, "routes-core")).toBeGreaterThan(
      baseWidth(layers, "road-primary")
    )
  })

  it("clears the streets under each route with a band of ground", () => {
    expect(paintOf(layers, "routes-halo")["line-color"]).toBe(amber.land)
    expect(baseWidth(layers, "routes-halo")).toBeGreaterThan(
      baseWidth(layers, "routes-core")
    )
  })

  it("dims every road by the streets factor", () => {
    const dimmed = createPosterStyle(amber, solid, 0.5).layers
    for (const id of ["road-primary", "road-motorway", "rail"])
      expect(paintOf(dimmed, id)["line-opacity"]).toBeCloseTo(
        (paintOf(layers, id)["line-opacity"] as number) * 0.5
      )
  })

  it("only glows on dark grounds, as much as asked", () => {
    const glow = (palette: PosterPalette, amount: number) =>
      paintOf(
        createPosterStyle(palette, { ...solid, glow: amount }).layers,
        "routes-glow"
      )["line-opacity"]
    expect(glow(amber, 2)).toBeGreaterThan(glow(amber, 1) as number)
    expect(glow(amber, 0)).toBe(0)
    expect(glow(POSTER_THEMES[2].palette, 1)).toBe(0)
  })
})

describe("adjustPalette", () => {
  const lightness = (hex: string) => hexToOklch(hex).l
  const chroma = (hex: string) => hexToOklch(hex).c

  it("leaves the palette alone at the defaults", () => {
    expect(adjustPalette(amber, { brightness: 0, saturation: 1 })).toBe(amber)
  })

  it("brightens and darkens the map, not the routes or the title", () => {
    const brighter = adjustPalette(amber, { brightness: 0.3, saturation: 1 })
    const darker = adjustPalette(amber, { brightness: -0.3, saturation: 1 })
    expect(lightness(brighter.roads)).toBeGreaterThan(lightness(amber.roads))
    expect(lightness(darker.roads)).toBeLessThan(lightness(amber.roads))
    expect(brighter.route).toBe(amber.route)
    expect(brighter.text).toBe(amber.text)
  })

  it("keeps a near-black ground near black", () => {
    const brighter = adjustPalette(amber, { brightness: 0.4, saturation: 1 })
    expect(isDarkPalette(brighter)).toBe(true)
  })

  it("turns the map grey at zero saturation", () => {
    const grey = adjustPalette(amber, { brightness: 0, saturation: 0 })
    expect(chroma(grey.roads)).toBeLessThan(0.01)
    expect(grey.route).toBe(amber.route)
  })
})

describe("poster palettes", () => {
  it("tells dark grounds from light ones", () => {
    expect(isDarkPalette({ land: "#0b0704" })).toBe(true)
    expect(isDarkPalette({ land: "#f4eee2" })).toBe(false)
  })

  it("picks readable text for a custom ground", () => {
    expect(isDarkPalette({ land: textForLand("#000000") })).toBe(false)
    expect(isDarkPalette({ land: textForLand("#ffffff") })).toBe(true)
  })
})

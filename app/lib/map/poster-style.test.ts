import { describe, expect, it } from "vitest"

import {
  createPosterStyle,
  isDarkPalette,
  POSTER_ROUTES_SOURCE,
  POSTER_THEMES,
  textForLand,
} from "./poster-style"

const amber = POSTER_THEMES[0].palette

describe("createPosterStyle", () => {
  it("draws every street class with no labels or borders", () => {
    const style = createPosterStyle(amber, { color: amber.route, weight: 1 })
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
    const style = createPosterStyle(amber, { color: amber.route, weight: 1 })
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
    const style = createPosterStyle(amber, { color: null, weight: 1 })
    expect(style.layers.at(-1)).toMatchObject({
      paint: { "line-color": ["get", "color"] },
    })
  })

  it("keeps the same layers across themes, so the map only updates paint", () => {
    const ids = (index: number) =>
      createPosterStyle(POSTER_THEMES[index].palette, {
        color: null,
        weight: 1,
      }).layers.map((layer) => layer.id)
    for (let index = 1; index < POSTER_THEMES.length; index++)
      expect(ids(index)).toEqual(ids(0))
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

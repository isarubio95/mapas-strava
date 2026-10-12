import { describe, expect, it } from "vitest"

import {
  BUILDING_3D_LAYER_ID,
  createMapStyle,
  DAY,
  DAY_RELIEF,
  NIGHT,
  NIGHT_RELIEF,
  TERRAIN_EXAGGERATION,
  TERRAIN_SOURCE,
} from "./style"

describe("createMapStyle", () => {
  it("builds a MapLibre style with OpenFreeMap tiles and no labels by default", () => {
    const style = createMapStyle(NIGHT)
    expect(style.version).toBe(8)
    expect(style.glyphs).toContain("openfreemap.org/fonts")
    expect(style.sources.openmaptiles).toMatchObject({
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
    })
    const ids = style.layers.map((layer) => layer.id)
    expect(ids).toContain("road-minor")
    expect(ids).toContain("water")
    expect(ids).not.toContain("place-label")
  })

  it("adds city, town and village names on top when labels are on", () => {
    const style = createMapStyle(NIGHT, { labels: true })
    const label = style.layers.at(-1)
    expect(label).toMatchObject({
      id: "place-label",
      type: "symbol",
      "source-layer": "place",
      filter: ["match", ["get", "class"], ["city", "town", "village"], true, false],
      paint: { "text-color": NIGHT.label },
    })
  })

  it("stays flat unless asked for relief", () => {
    const style = createMapStyle(NIGHT, { labels: true })
    expect(style.terrain).toBeUndefined()
    expect(style.sky).toBeUndefined()
    expect(style.layers.map((layer) => layer.id)).toContain("building")
  })

  it("adds terrain, relief shading, sky and rising buildings in 3D", () => {
    const style = createMapStyle(NIGHT, { labels: true, relief: NIGHT_RELIEF })
    expect(style.terrain).toEqual({
      source: TERRAIN_SOURCE,
      exaggeration: TERRAIN_EXAGGERATION,
    })
    expect(style.sources[TERRAIN_SOURCE]).toMatchObject({
      type: "raster-dem",
      encoding: "terrarium",
    })
    expect(style.sky).toMatchObject({ "sky-color": NIGHT_RELIEF.sky })

    const ids = style.layers.map((layer) => layer.id)
    // Shading under the water and streets; buildings over every flat layer.
    expect(ids.indexOf("hillshade")).toBeLessThan(ids.indexOf("water"))
    expect(ids).not.toContain("building")
    expect(ids.at(-2)).toBe(BUILDING_3D_LAYER_ID)
    expect(ids.at(-1)).toBe("place-label")
  })

  it("leaves village names out of the tilted view", () => {
    const style = createMapStyle(DAY, { labels: true, relief: DAY_RELIEF })
    expect(style.layers.at(-1)).toMatchObject({
      filter: ["match", ["get", "class"], ["city", "town"], true, false],
    })
  })

  it("uses cream land by day and teal land by night", () => {
    expect(createMapStyle(DAY).layers[0]).toMatchObject({
      paint: { "background-color": DAY.land },
    })
    expect(createMapStyle(NIGHT).layers[0]).toMatchObject({
      paint: { "background-color": NIGHT.land },
    })
  })
})

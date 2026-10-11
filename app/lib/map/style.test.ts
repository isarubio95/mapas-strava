import { describe, expect, it } from "vitest"

import { createMapStyle, DAY, NIGHT } from "./style"

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

  it("uses cream land by day and teal land by night", () => {
    expect(createMapStyle(DAY).layers[0]).toMatchObject({
      paint: { "background-color": DAY.land },
    })
    expect(createMapStyle(NIGHT).layers[0]).toMatchObject({
      paint: { "background-color": NIGHT.land },
    })
  })
})

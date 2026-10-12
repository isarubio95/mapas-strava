import { describe, expect, it } from "vitest"

import {
  FLYOVER_SOURCE,
  progressGradient,
  ROUTES_3D_PICK_LAYER,
  ROUTES_3D_SOURCE,
  SELECTION_3D_SOURCE,
  sportColorExpression,
  withRoutes3d,
} from "./routes-3d"
import {
  BUILDING_3D_LAYER_ID,
  createMapStyle,
  NIGHT,
  NIGHT_RELIEF,
} from "./style"

const relief = () =>
  createMapStyle(NIGHT, { labels: true, relief: NIGHT_RELIEF })

const coords = new Float64Array([-3.7, 40.4, -3.69, 40.41, -3.68, 40.42])

describe("withRoutes3d", () => {
  it("drapes the routes under the buildings and the names", () => {
    const style = withRoutes3d(relief(), {
      routes: "blob:routes",
      sports: ["Run"],
      theme: "dark",
    })
    expect(style.sources[ROUTES_3D_SOURCE]).toEqual({
      type: "geojson",
      data: "blob:routes",
    })
    const ids = style.layers.map((layer) => layer.id)
    expect(ids.indexOf(ROUTES_3D_PICK_LAYER)).toBeLessThan(
      ids.indexOf(BUILDING_3D_LAYER_ID)
    )
    expect(ids.at(-1)).toBe("place-label")
  })

  it("waits for the routes before adding their layers", () => {
    const style = withRoutes3d(relief(), {
      routes: null,
      sports: [],
      theme: "dark",
    })
    expect(style.sources[ROUTES_3D_SOURCE]).toBeUndefined()
    expect(
      style.layers.some((layer) => layer.id === ROUTES_3D_PICK_LAYER)
    ).toBe(false)
  })

  it("hides the other routes when the selection is shown alone", () => {
    const style = withRoutes3d(relief(), {
      routes: "blob:routes",
      sports: ["Run"],
      theme: "light",
      hidden: true,
      selection: { coords, color: "#0f7a4f" },
    })
    const core = style.layers.find((layer) => layer.id === ROUTES_3D_PICK_LAYER)
    expect(core?.layout).toMatchObject({ visibility: "none" })
    // line-progress needs line metrics on the source.
    expect(style.sources[SELECTION_3D_SOURCE]).toMatchObject({
      type: "geojson",
      lineMetrics: true,
    })
    expect(style.sources[FLYOVER_SOURCE]).toBeUndefined()
  })

  it("adds the flyover head only while flying", () => {
    const style = withRoutes3d(relief(), {
      routes: "blob:routes",
      sports: ["Run"],
      theme: "dark",
      selection: { coords, color: "#5ef2a6" },
      flyoverStart: [-3.7, 40.4],
    })
    expect(style.sources[FLYOVER_SOURCE]).toMatchObject({ type: "geojson" })
    expect(style.layers.map((layer) => layer.id)).toContain("flyover-head")
  })
})

describe("sportColorExpression", () => {
  it("matches each sport and falls back to a plain color", () => {
    const expression = sportColorExpression(["Run", "Ride"], "dark")
    expect(Array.isArray(expression)).toBe(true)
    expect((expression as unknown[]).slice(0, 2)).toEqual([
      "match",
      ["get", "s"],
    ])
    expect((expression as unknown[]).length).toBe(7)
    expect(typeof sportColorExpression([], "light")).toBe("string")
  })
})

describe("progressGradient", () => {
  it("lights the line up to the share and shows the rest after it", () => {
    expect(progressGradient("#fff", 0.4, "#000")).toEqual([
      "step",
      ["line-progress"],
      "#fff",
      0.4,
      "#000",
    ])
  })

  it("lights the whole line once complete", () => {
    expect(progressGradient("#fff", 1)).toEqual([
      "interpolate",
      ["linear"],
      ["line-progress"],
      0,
      "#fff",
      1,
      "#fff",
    ])
  })
})

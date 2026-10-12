import { describe, expect, it } from "vitest"

import type { RouteGeometry } from "~/lib/map/engine"

import {
  exportSize,
  focusedPlace,
  formatBBox,
  formatCoordinates,
  localFrame,
  MAX_EXPORT_SIDE,
  parseBBox,
  POSTER_FORMATS,
  POSTER_WIDTH,
  posterRoutes,
  posterSize,
  routesBounds,
  routesFrame,
  type PlaceLabel,
  type PosterRoutes,
} from "./poster"

const format = (id: string) => POSTER_FORMATS.find((item) => item.id === id)!

function geometry(paths: number[][], days: number[]): RouteGeometry {
  const startIndices = [0]
  for (const path of paths)
    startIndices.push(startIndices.at(-1)! + path.length / 2)
  return {
    positions: Float64Array.from(paths.flat()),
    startIndices: Uint32Array.from(startIndices),
    pathActivity: Uint32Array.from(paths.map((_, index) => index)),
    pathDay: Float32Array.from(days),
    progress: new Float32Array(startIndices.at(-1)!),
    bounds: null,
    home: null,
  }
}

function lines(...paths: [number, number][][]): PosterRoutes {
  return {
    type: "FeatureCollection",
    features: paths.map((coordinates) => ({
      type: "Feature",
      properties: { color: "#fff" },
      geometry: { type: "LineString", coordinates },
    })),
  }
}

describe("poster sizes", () => {
  it("keeps the paper's proportions at a fixed logical width", () => {
    const a4 = posterSize(format("a4"))
    expect(a4.width).toBe(POSTER_WIDTH)
    expect(a4.height / a4.width).toBeCloseTo(297 / 210, 3)
    expect(posterSize(format("50x50"))).toEqual({
      width: POSTER_WIDTH,
      height: POSTER_WIDTH,
    })
  })

  it("exports A4 at 300 ppp", () => {
    expect(exportSize(format("a4"))).toEqual({
      width: 2480,
      height: 3508,
      dpi: 300,
    })
  })

  it("lowers the resolution of large formats to stay within WebGL limits", () => {
    const big = exportSize(format("50x70"))
    expect(big.height).toBe(MAX_EXPORT_SIDE)
    expect(big.dpi).toBeLessThan(300)
    expect(big.width / big.height).toBeCloseTo(500 / 700, 3)
  })
})

describe("formatCoordinates", () => {
  it("uses N/S and E/O", () => {
    expect(formatCoordinates(-3.7038, 40.4168)).toBe("40.4168° N / 3.7038° O")
    expect(formatCoordinates(151.2093, -33.8688)).toBe(
      "33.8688° S / 151.2093° E"
    )
  })
})

describe("posterRoutes", () => {
  it("keeps the routes that pass the filters and the date range", () => {
    const routes = posterRoutes(
      geometry(
        [
          [0, 0, 1, 1],
          [2, 2, 3, 3],
          [4, 4, 5, 5],
        ],
        [10, 20, 30]
      ),
      Uint8Array.from([1, 0, 1]),
      [0, 25],
      (path) => `#${path}`
    )
    expect(routes.features).toHaveLength(1)
    expect(routes.features[0].geometry.coordinates).toEqual([
      [0, 0],
      [1, 1],
    ])
    expect(routes.features[0].properties.color).toBe("#0")
  })
})

describe("routesFrame", () => {
  it("frames where the routes are dense, not a stray point", () => {
    const dense = Array.from({ length: 200 }, (_, index): [number, number] => [
      index / 200,
      index / 400,
    ])
    const frame = routesFrame(lines(dense, [[0.5, 3]]), null)!
    expect(frame[0]).toBeGreaterThan(0)
    expect(frame[2]).toBeLessThan(1)
    expect(frame[3]).toBeLessThan(1)
  })

  it("ignores routes outside the home area", () => {
    const home: [number, number, number, number] = [0, 0, 1, 1]
    const frame = routesFrame(
      lines(
        [
          [0.2, 0.2],
          [0.8, 0.8],
        ],
        [
          [20, 20],
          [21, 21],
        ]
      ),
      home
    )
    expect(frame).toEqual([0.2, 0.2, 0.8, 0.8])
  })

  it("falls back to the home area without routes", () => {
    expect(routesFrame(lines(), [1, 2, 3, 4])).toEqual([1, 2, 3, 4])
  })
})

describe("routesBounds", () => {
  it("keeps every point, ends included", () => {
    expect(
      routesBounds(
        lines([
          [1, 2],
          [3, 1],
          [2, 4],
        ])
      )
    ).toEqual([1, 1, 3, 4])
  })
})

describe("localFrame", () => {
  // Two towns about 900 km apart: one near the view, one far from it.
  const rome = Array.from({ length: 100 }, (_, index): [number, number] => [
    12.45 + index / 1000,
    41.85 + index / 1000,
  ])
  const madrid = Array.from({ length: 300 }, (_, index): [number, number] => [
    -3.75 + index / 3000,
    40.4 + index / 3000,
  ])
  const routes = lines(rome, madrid)

  it("frames the routes around the view, not all of them", () => {
    const frame = localFrame(routes, [12.4, 41.8, 12.6, 42])!
    expect(frame[0]).toBeGreaterThan(12)
    expect(frame[2]).toBeLessThan(13)
  })

  it("looks a town across even when zoomed into a street", () => {
    const frame = localFrame(routes, [12.5, 41.9, 12.501, 41.901])!
    expect(frame[2] - frame[0]).toBeGreaterThan(0.05)
  })

  it("goes to the nearest routes when none pass through the view", () => {
    const frame = localFrame(routes, [9, 45, 9.2, 45.2])!
    expect(frame[0]).toBeGreaterThan(12)
    expect(frame[3]).toBeLessThan(42)
  })

  it("has nothing to frame without routes", () => {
    expect(localFrame(lines(), [0, 0, 1, 1])).toBeNull()
  })
})

describe("parseBBox", () => {
  it("reads back what formatBBox writes", () => {
    expect(parseBBox(formatBBox([12.4, 41.8, 12.6, 42]))).toEqual([
      12.4, 41.8, 12.6, 42,
    ])
  })

  it("rejects broken or empty boxes", () => {
    expect(parseBBox(null)).toBeNull()
    expect(parseBBox("1,2,3")).toBeNull()
    expect(parseBBox("1,2,x,4")).toBeNull()
    expect(parseBBox("3,2,1,4")).toBeNull()
  })
})

describe("focusedPlace", () => {
  const place = (
    name: string,
    kind: string,
    rank: number,
    lng: number,
    lat: number
  ): PlaceLabel => ({ name, kind, rank, lng, lat })
  const view: [number, number, number, number] = [-4, 40, -3, 41]

  it("prefers the biggest place in the middle of the view", () => {
    const places = [
      place("Pozuelo", "town", 11, -3.5, 40.5),
      place("Madrid", "city", 2, -3.6, 40.4),
      place("Toledo", "city", 1, -3.9, 40.05),
    ]
    expect(focusedPlace(places, view)?.name).toBe("Madrid")
  })

  it("breaks ties by distance to the center", () => {
    const places = [
      place("Lejos", "town", 11, -3.3, 40.3),
      place("Cerca", "town", 11, -3.45, 40.55),
    ]
    expect(focusedPlace(places, view)?.name).toBe("Cerca")
  })

  it("looks at the whole view when the middle is empty", () => {
    const places = [
      place("Fuera", "city", 1, -5, 40.5),
      place("Borde", "village", 30, -3.95, 40.95),
    ]
    expect(focusedPlace(places, view)?.name).toBe("Borde")
  })

  it("ignores labels that are not settlements", () => {
    const places = [place("Castilla", "state", 3, -3.5, 40.5)]
    expect(focusedPlace(places, view)).toBeNull()
  })
})

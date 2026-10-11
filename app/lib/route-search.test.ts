import { describe, expect, it } from "vitest"

import type { Activity } from "~/lib/activities"
import {
  EMPTY_ROUTE_QUERY,
  indexRoutes,
  normalize,
  routeFacets,
  searchRoutes,
  type RouteQuery,
} from "~/lib/route-search"

function activity(overrides: Partial<Activity>): Activity {
  return {
    id: 1,
    name: "Prueba",
    sportType: "Run",
    startDate: "2025-05-01T07:00:00Z",
    startDateLocal: "2025-05-01T09:00:00",
    distance: 10_000,
    movingTime: 3000,
    elapsedTime: 3200,
    elevationGain: 50,
    polyline: "_p~iF~ps|U_ulLnnqC",
    zones: [],
    startZones: [],
    ...overrides,
  }
}

const entries = indexRoutes([
  activity({
    id: 1,
    name: "Subida a la Peña",
    sportType: "Ride",
    startDate: "2025-06-01T07:00:00Z",
    startDateLocal: "2025-06-01T09:00:00",
    distance: 62_000,
  }),
  activity({
    id: 2,
    name: "Rodaje por el Río",
    startDate: "2026-02-10T07:00:00Z",
    startDateLocal: "2026-02-10T08:00:00",
    distance: 8_000,
  }),
  activity({
    id: 3,
    name: "Carrera por el río Manzanares",
    startDate: "2024-09-03T17:00:00Z",
    startDateLocal: "2024-09-03T19:00:00",
    distance: 12_000,
  }),
  activity({ id: 4, name: "Cinta en el gimnasio", polyline: null }),
])

const ids = (query: Partial<RouteQuery>) =>
  searchRoutes(entries, { ...EMPTY_ROUTE_QUERY, ...query }).map((a) => a.id)

describe("route search", () => {
  it("ignores case and accents", () => {
    expect(normalize("Peña del Río")).toBe("pena del rio")
    expect(ids({ text: "PENA" })).toEqual([1])
  })

  it("needs every word, in any order", () => {
    expect(ids({ text: "rio por" })).toEqual([2, 3])
    expect(ids({ text: "manzanares rodaje" })).toEqual([])
  })

  it("leaves out activities without a route", () => {
    expect(ids({ text: "gimnasio" })).toEqual([])
    expect(ids({})).toHaveLength(3)
  })

  it("filters by sport and year", () => {
    expect(ids({ sport: "Run" })).toEqual([2, 3])
    expect(ids({ year: "2024" })).toEqual([3])
    expect(ids({ sport: "Ride", year: "2024" })).toEqual([])
  })

  it("sorts newest, oldest or longest first", () => {
    expect(ids({})).toEqual([2, 1, 3])
    expect(ids({ order: "oldest" })).toEqual([3, 1, 2])
    expect(ids({ order: "longest" })).toEqual([1, 3, 2])
  })

  it("counts each chip against the rest of the query", () => {
    const facets = routeFacets(entries, {
      ...EMPTY_ROUTE_QUERY,
      text: "rio",
      sport: "Run",
    })
    expect(facets.sports).toEqual([
      { type: "Run", count: 2 },
      { type: "Ride", count: 0 },
    ])
    expect(facets.years).toEqual([
      { year: "2026", count: 1 },
      { year: "2025", count: 0 },
      { year: "2024", count: 1 },
    ])
  })
})

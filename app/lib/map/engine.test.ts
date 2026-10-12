import { describe, expect, it } from "vitest"

import { generateActivities } from "../../../tests/fixtures/synthetic"
import type { Activity } from "~/lib/activities"
import { EMPTY_FILTERS } from "~/lib/filters"
import { encodePolyline } from "~/lib/polyline"

import { RouteEngine } from "./engine"

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
    polyline: null,
    zones: [],
    startZones: [],
    ...overrides,
  }
}

// A route crossing Madrid west to east along latitude 40.42, starting far
// from Puerta del Sol: it passes 0.5 km from it but starts 4 km away.
const crossing = encodePolyline([-3.75, 40.42, -3.72, 40.42, -3.66, 40.42])
const elsewhere = encodePolyline([2.15, 41.38, 2.17, 41.39])

const fixture = [
  activity({
    id: 1,
    polyline: crossing,
    zones: ["city:28079"],
    startZones: ["city:28079"],
  }),
  activity({
    id: 2,
    sportType: "Ride",
    distance: 60_000,
    polyline: elsewhere,
    startDateLocal: "2024-02-10T10:00:00",
    zones: ["city:08019"],
    startZones: ["city:08019"],
  }),
  activity({
    id: 3,
    sportType: "WeightTraining",
    distance: 0,
    startDateLocal: "2025-06-01T19:00:00",
  }),
]

describe("RouteEngine", () => {
  it("only builds paths for activities with GPS", () => {
    const engine = new RouteEngine()
    const { geometry, meta } = engine.load(fixture)
    expect(geometry.pathActivity.length).toBe(2)
    expect(Array.from(geometry.startIndices)).toEqual([0, 3, 5])
    expect(geometry.positions.length).toBe(10)
    expect(meta.total).toBe(3)
    expect(meta.sports.map((s) => s.type).sort()).toEqual([
      "Ride",
      "Run",
      "WeightTraining",
    ])
  })

  it("counts where activities start apart from where they pass", () => {
    const engine = new RouteEngine()
    const { meta } = engine.load([
      activity({
        id: 1,
        zones: ["region:ES-MD", "region:ES-CM"],
        startZones: ["region:ES-MD"],
      }),
      activity({
        id: 2,
        zones: ["region:ES-MD"],
        startZones: ["region:ES-MD"],
      }),
    ])
    expect(meta.zones).toEqual([
      { id: "region:ES-MD", count: 2 },
      { id: "region:ES-CM", count: 1 },
    ])
    expect(meta.startZones).toEqual([{ id: "region:ES-MD", count: 2 }])
  })

  it("opens on the home area, not on every trip", () => {
    const madrid = encodePolyline([-3.71, 40.41, -3.69, 40.43])
    const newYork = encodePolyline([-74.0, 40.71, -73.97, 40.78])
    const engine = new RouteEngine()
    const { geometry } = engine.load([
      activity({ id: 1, polyline: madrid }),
      activity({ id: 2, polyline: crossing }),
      activity({ id: 3, polyline: newYork }),
    ])
    expect(geometry.bounds?.[0]).toBeCloseTo(-74.0)
    expect(geometry.home).toEqual([-3.75, 40.41, -3.66, 40.43])
  })

  it("finds routes that pass near a point, not only those starting there", () => {
    const engine = new RouteEngine()
    engine.load(fixture)
    const sol = { lng: -3.7038, lat: 40.4168, radius: 500 }
    const { mask, summary } = engine.query({ ...EMPTY_FILTERS, near: sol })
    expect(Array.from(mask)).toEqual([1, 0])
    expect(summary.count).toBe(1)

    const tight = engine.query({
      ...EMPTY_FILTERS,
      near: { ...sol, radius: 100 },
    })
    expect(tight.summary.count).toBe(0)
  })

  it("applies dates to the summary but leaves them out of the GPU mask", () => {
    const engine = new RouteEngine()
    engine.load(fixture)
    const { mask, summary } = engine.query({
      ...EMPTY_FILTERS,
      from: "2025-01-01",
    })
    expect(Array.from(mask)).toEqual([1, 1])
    expect(summary.count).toBe(2)
    expect(summary.mapped).toBe(1)
    expect(summary.bySport.map((s) => s.type)).toEqual([
      "Run",
      "WeightTraining",
    ])
  })

  it("filters by sport, distance and zone", () => {
    const engine = new RouteEngine()
    engine.load(fixture)
    expect(
      engine.query({ ...EMPTY_FILTERS, sports: ["Ride"] }).summary.count
    ).toBe(1)
    expect(engine.query({ ...EMPTY_FILTERS, minKm: 20 }).summary.count).toBe(1)
    expect(
      engine.query({ ...EMPTY_FILTERS, zone: "city:28079" }).summary.count
    ).toBe(1)
  })

  it("resamples heatmap points along the route", () => {
    const engine = new RouteEngine()
    engine.load([fixture[0]])
    const points = engine.heatPoints(EMPTY_FILTERS, 100)
    // About 7.6 km of route, one point every 100 m.
    expect(points.length / 2).toBeGreaterThan(70)
    expect(points.length / 2).toBeLessThan(80)
  })

  it("timestamps each vertex from its day to its day plus the draw span", () => {
    const engine = new RouteEngine()
    const { geometry } = engine.load([fixture[0]])
    const stamps = engine.timestamps(2)
    expect(stamps[0]).toBe(geometry.pathDay[0])
    expect(stamps[2]).toBeCloseTo(geometry.pathDay[0] + 2)
  })

  it("writes the filtered routes as GeoJSON lines for the 3D view", () => {
    const engine = new RouteEngine()
    engine.load(fixture)
    const all = JSON.parse(engine.routesGeoJSON(EMPTY_FILTERS))
    expect(all.type).toBe("FeatureCollection")
    expect(all.features).toHaveLength(2)
    expect(all.features[0]).toEqual({
      type: "Feature",
      properties: { a: 1, s: "Run" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-3.75, 40.42],
          [-3.72, 40.42],
          [-3.66, 40.42],
        ],
      },
    })

    const rides = JSON.parse(
      engine.routesGeoJSON({ ...EMPTY_FILTERS, sports: ["Ride"] })
    )
    expect(
      rides.features.map((f: { properties: { a: number } }) => f.properties.a)
    ).toEqual([2])
    // Unlike the GPU mask, the dates apply here too.
    const recent = JSON.parse(
      engine.routesGeoJSON({ ...EMPTY_FILTERS, from: "2025-01-01" })
    )
    expect(recent.features).toHaveLength(1)
  })

  it("handles thousands of synthetic activities quickly", () => {
    const activities = generateActivities({ count: 5000, seed: 3 })
    const engine = new RouteEngine()
    const t0 = performance.now()
    const { geometry } = engine.load(activities)
    const t1 = performance.now()
    const result = engine.query({
      ...EMPTY_FILTERS,
      near: { lng: -3.7038, lat: 40.4168, radius: 500 },
      sports: ["Run", "Ride", "Walk"],
    })
    const t2 = performance.now()
    expect(geometry.pathActivity.length).toBeGreaterThan(3500)
    expect(result.summary.count).toBeGreaterThan(0)
    expect(t1 - t0).toBeLessThan(3000)
    expect(t2 - t1).toBeLessThan(100)
  })
})

import { describe, expect, it } from "vitest"

import { circleBBox, distanceToPolyline, haversine, viewBounds } from "./geo"

describe("geo", () => {
  it("measures Madrid to Barcelona at about 505 km", () => {
    const d = haversine(-3.7038, 40.4168, 2.1686, 41.3874)
    expect(d / 1000).toBeGreaterThan(500)
    expect(d / 1000).toBeLessThan(510)
  })

  it("finds the distance to the middle of a segment, not just its vertices", () => {
    // A 2 km east-west segment; the point is 300 m north of its midpoint.
    const lat = 40.4
    const dLng = 1000 / (111_320 * Math.cos((lat * Math.PI) / 180))
    const segment = [-3.7 - dLng, lat, -3.7 + dLng, lat]
    const north = lat + 300 / 111_195
    const d = distanceToPolyline(-3.7, north, segment)
    expect(d).toBeGreaterThan(295)
    expect(d).toBeLessThan(305)
  })

  it("respects the vertex range of a packed buffer", () => {
    const packed = [0, 0, 0.01, 0, 5, 5, 5.01, 5]
    expect(distanceToPolyline(5.005, 5, packed, 2, 4)).toBeLessThan(1)
    expect(distanceToPolyline(5.005, 5, packed, 0, 2)).toBeGreaterThan(100_000)
  })

  it("builds a bbox that contains the circle", () => {
    const [minX, minY, maxX, maxY] = circleBBox(-3.7, 40.4, 1000)
    expect(haversine(-3.7, 40.4, maxX, 40.4)).toBeCloseTo(1000, -1)
    expect(haversine(-3.7, 40.4, -3.7, minY)).toBeCloseTo(1000, -1)
    expect(minX).toBeLessThan(-3.7)
    expect(maxY).toBeGreaterThan(40.4)
  })
})

describe("viewBounds", () => {
  it("covers the whole world at zoom 0 with a 512 px square", () => {
    const [west, south, east, north] = viewBounds(0, 0, 0, 512, 512)
    expect(west).toBeCloseTo(-180)
    expect(east).toBeCloseTo(180)
    expect(south).toBeCloseTo(-85.0511, 3)
    expect(north).toBeCloseTo(85.0511, 3)
  })

  it("is centered on the view and halves with each zoom level", () => {
    const at12 = viewBounds(-3.7, 40.4, 12, 1600, 900)
    const at13 = viewBounds(-3.7, 40.4, 13, 1600, 900)
    expect((at12[0] + at12[2]) / 2).toBeCloseTo(-3.7)
    expect(at12[2] - at12[0]).toBeCloseTo((at13[2] - at13[0]) * 2)
    expect(at12[1]).toBeLessThan(40.4)
    expect(at12[3]).toBeGreaterThan(40.4)
  })
})

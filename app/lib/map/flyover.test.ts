import { describe, expect, it } from "vitest"

import { haversine } from "~/lib/geo"

import {
  bearingBetween,
  destination,
  flyoverSeconds,
  flyoverZoom,
  measureTrack,
  paceAt,
  pointAlong,
  turn,
} from "./flyover"

// About 1.7 km east along the equator, then 1.1 km north.
const coords = new Float64Array([0, 0, 0.01, 0, 0.015, 0, 0.015, 0.01])

describe("measureTrack and pointAlong", () => {
  it("measures each vertex from the start", () => {
    const track = measureTrack(coords)
    expect(track.along[0]).toBe(0)
    expect(track.length).toBeCloseTo(
      haversine(0, 0, 0.015, 0) + haversine(0.015, 0, 0.015, 0.01)
    )
  })

  it("finds points between vertices and clamps past the ends", () => {
    const track = measureTrack(coords)
    const [lng, lat] = pointAlong(track, track.along[1] / 2)
    expect(lng).toBeCloseTo(0.005)
    expect(lat).toBeCloseTo(0)
    expect(pointAlong(track, -10)).toEqual([0, 0])
    expect(pointAlong(track, track.length + 10)).toEqual([0.015, 0.01])
  })
})

describe("bearings", () => {
  it("measures compass bearings", () => {
    expect(bearingBetween([0, 0], [0, 1])).toBeCloseTo(0)
    expect(bearingBetween([0, 0], [1, 0])).toBeCloseTo(90)
    expect(bearingBetween([0, 0], [-1, 0])).toBeCloseTo(-90)
  })

  it("turns the short way round", () => {
    expect(turn(170, -170)).toBeCloseTo(20)
    expect(turn(-170, 170)).toBeCloseTo(-20)
    expect(turn(10, 30)).toBeCloseTo(20)
  })

  it("lands where the bearing and distance say", () => {
    const [lng, lat] = destination([-3.7, 40.4], 90, 1000)
    expect(haversine(-3.7, 40.4, lng, lat)).toBeCloseTo(1000, 0)
    expect(lat).toBeCloseTo(40.4, 3)
  })
})

describe("paceAt", () => {
  it("starts and ends still and never goes back", () => {
    expect(paceAt(0)).toBe(0)
    expect(paceAt(1)).toBeCloseTo(1)
    let previous = 0
    for (let s = 0.01; s <= 1; s += 0.01) {
      const covered = paceAt(s)
      expect(covered).toBeGreaterThanOrEqual(previous)
      previous = covered
    }
    // Steady in the middle: equal time, equal distance.
    expect(paceAt(0.6) - paceAt(0.5)).toBeCloseTo(paceAt(0.4) - paceAt(0.3))
  })
})

describe("flight plan", () => {
  it("keeps flights watchable whatever the route length", () => {
    expect(flyoverSeconds(500)).toBe(14)
    expect(flyoverSeconds(200_000)).toBe(50)
    expect(flyoverZoom(2_000)).toBeGreaterThan(flyoverZoom(60_000))
    expect(flyoverZoom(100)).toBeLessThanOrEqual(15.2)
  })
})

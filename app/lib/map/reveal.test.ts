import { describe, expect, it } from "vitest"

import {
  drawTimes,
  REVEAL_DRAW,
  REVEAL_HEAD,
  RouteReveal,
  visiblePaths,
} from "./reveal"

// Two paths: three vertices, then two.
const starts = new Uint32Array([0, 3, 5])
const progress = new Float32Array([0, 0.5, 1, 0, 1])

describe("route reveal", () => {
  it("draws new routes from start to end, easing out", () => {
    const reveal = new RouteReveal(starts, progress)
    expect(reveal.update(new Uint8Array([1, 1]), 10, true)).toBe(true)

    const t = reveal.times
    const start = t[0]
    expect(start).toBeGreaterThan(0)
    expect(t[2] - start).toBeCloseTo(REVEAL_DRAW)
    // Halfway along the route comes before halfway through the draw.
    expect(t[1] - start).toBeLessThan(REVEAL_DRAW / 2)
    expect(reveal.time(10)).toBe(0)
    expect(reveal.drawing(10)).toBe(true)
  })

  it("leaves routes already on screen alone", () => {
    const reveal = new RouteReveal(starts, progress)
    reveal.update(new Uint8Array([1, 0]), 10, true)
    const version = reveal.version
    expect(reveal.update(new Uint8Array([1, 0]), 10.1, true)).toBe(false)
    expect(reveal.version).toBe(version)
  })

  it("only animates the newcomers once the map is at rest", () => {
    const reveal = new RouteReveal(starts, progress)
    reveal.update(new Uint8Array([1, 0]), 10, true)
    const later = reveal.finishesAt + 5
    expect(reveal.drawing(later)).toBe(false)

    reveal.update(new Uint8Array([1, 1]), later, true)
    expect(Array.from(reveal.times.slice(0, 3))).toEqual([-1, -1, -1])
    expect(reveal.times[3]).toBeGreaterThan(reveal.time(later))
    expect(reveal.finishesAt).toBeGreaterThan(later + REVEAL_DRAW)
  })

  it("redraws a route that left and came back", () => {
    const reveal = new RouteReveal(starts, progress)
    reveal.update(new Uint8Array([1, 1]), 10, true)
    reveal.update(new Uint8Array([1, 0]), 20, true)
    expect(reveal.update(new Uint8Array([1, 1]), 30, true)).toBe(true)
    expect(reveal.times[3]).toBeGreaterThan(reveal.time(30))
  })

  it("shows routes at once when animation is off", () => {
    const reveal = new RouteReveal(starts, progress)
    reveal.update(new Uint8Array([1, 1]), 10, false)
    expect(Array.from(reveal.times)).toEqual([-1, -1, -1, -1, -1])
    expect(reveal.drawing(10)).toBe(false)
    expect(reveal.time(10)).toBe(0)
  })

  it("holds the clock still once everything is drawn", () => {
    const reveal = new RouteReveal(starts, progress)
    reveal.update(new Uint8Array([1, 1]), 10, true)
    const end = reveal.time(reveal.finishesAt)
    expect(reveal.time(reveal.finishesAt + 60)).toBe(end)
    expect(end).toBeGreaterThan(REVEAL_DRAW + REVEAL_HEAD - 0.01)
  })
})

describe("visible paths", () => {
  it("needs the filters and the date range", () => {
    const visible = visiblePaths(
      new Uint8Array([1, 1, 0]),
      new Float32Array([5, 9, 6]),
      [4, 8]
    )
    expect(Array.from(visible)).toEqual([1, 0, 0])
  })
})

describe("draw times", () => {
  it("runs from zero to the duration along the route", () => {
    const times = drawTimes(new Float64Array([0, 0, 0.01, 0, 0.02, 0]), 2)
    expect(times[0]).toBe(0)
    expect(times[2]).toBeCloseTo(2)
    expect(times[1]).toBeLessThan(1)
  })
})

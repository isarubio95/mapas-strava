import { describe, expect, it } from "vitest"

import { generateCity } from "./city"

describe("generateCity", () => {
  const city = generateCity(7, 200)

  it("is deterministic for a seed", () => {
    const again = generateCity(7, 200)
    expect(again.routes.map((route) => route.points)).toEqual(
      city.routes.map((route) => route.points)
    )
  })

  it("builds a street grid with a river and parks", () => {
    expect(city.streets.length).toBeGreaterThan(500)
    expect(city.streets.some((street) => street.kind === "major")).toBe(true)
    expect(city.streets.some((street) => street.kind === "path")).toBe(true)
    expect(city.parks).toHaveLength(2)
    expect(city.river.length).toBeGreaterThan(20)
  })

  it("schedules routes in order, starting right away and speeding up", () => {
    const starts = city.routes.map((route) => route.start)
    expect(starts).toEqual([...starts].sort((a, b) => a - b))
    expect(starts[0]).toBeLessThan(0.5)
    const gap = (from: number, to: number) =>
      (starts[to] - starts[from]) / (to - from)
    const n = starts.length
    expect(gap(n - 20, n - 1)).toBeLessThan(gap(0, 19))
  })

  it("keeps every route on the map with sane distances", () => {
    const [ex, ey] = city.extent
    for (const route of city.routes) {
      expect(route.points.length / 2).toBe(route.distances.length)
      expect(route.duration).toBeGreaterThanOrEqual(1.1)
      expect(route.duration).toBeLessThanOrEqual(4.2)
      for (let i = 0; i < route.points.length; i += 2) {
        expect(Math.abs(route.points[i])).toBeLessThan(ex + 8)
        expect(Math.abs(route.points[i + 1])).toBeLessThan(ey + 8)
      }
      for (let i = 1; i < route.distances.length; i++) {
        expect(route.distances[i]).toBeGreaterThanOrEqual(
          route.distances[i - 1]
        )
      }
    }
  })

  it("sends routes across the river", () => {
    const riverYAt = (x: number) => {
      let best = 0
      for (let i = 2; i < city.river.length; i += 2) {
        if (Math.abs(city.river[i] - x) < Math.abs(city.river[best] - x))
          best = i
      }
      return city.river[best + 1]
    }
    const crossing = city.routes.filter((route) => {
      const sides = new Set<boolean>()
      for (let i = 0; i < route.points.length; i += 2) {
        sides.add(route.points[i + 1] > riverYAt(route.points[i]))
      }
      return sides.size === 2
    })
    expect(crossing.length / city.routes.length).toBeGreaterThan(0.15)
  })

  it("starts most routes from home", () => {
    const [hx, hy] = city.home
    const fromHome = city.routes.filter(
      (route) => Math.hypot(route.points[0] - hx, route.points[1] - hy) < 1
    )
    expect(fromHome.length / city.routes.length).toBeGreaterThan(0.45)
  })
})

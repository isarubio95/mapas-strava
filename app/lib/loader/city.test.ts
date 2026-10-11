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
    const early = starts.filter((start) => start < 5).length
    const later = starts.filter((start) => start >= 20 && start < 25).length
    expect(later).toBeGreaterThan(early)
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
        expect(route.distances[i]).toBeGreaterThanOrEqual(route.distances[i - 1])
      }
    }
  })

  it("starts most routes from home", () => {
    const [hx, hy] = city.home
    const fromHome = city.routes.filter(
      (route) => Math.hypot(route.points[0] - hx, route.points[1] - hy) < 1
    )
    expect(fromHome.length / city.routes.length).toBeGreaterThan(0.45)
  })
})

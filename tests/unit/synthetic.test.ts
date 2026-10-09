import { describe, expect, it } from "vitest"

import { decodePolyline } from "~/lib/polyline"
import { SPORTS } from "~/lib/sports"
import { generateActivities, SYNTHETIC_ZONES } from "../fixtures/synthetic"

describe("synthetic activities", () => {
  it("covers every sport in the first 56 activities", () => {
    const activities = generateActivities({ count: 56, seed: 1 })
    expect(new Set(activities.map((a) => a.sportType))).toEqual(
      new Set(SPORTS.map((s) => s.type))
    )
  })

  it("encodes valid polylines and always tags a country, region and city", () => {
    const activities = generateActivities({ count: 200, seed: 2 })
    const mapped = activities.filter((a) => a.polyline)
    expect(mapped.length).toBeGreaterThan(120)
    for (const activity of mapped) {
      const coords = decodePolyline(activity.polyline!)
      expect(coords.length).toBeGreaterThanOrEqual(4)
      expect(coords.length % 2).toBe(0)
      expect(activity.zones.some((id) => id.startsWith("country:"))).toBe(true)
      expect(activity.zones.some((id) => id.startsWith("region:"))).toBe(true)
      expect(activity.zones.some((id) => id.startsWith("city:"))).toBe(true)
    }
    const gym = activities.filter((a) => a.sportType === "WeightTraining")
    expect(gym.length).toBeGreaterThan(0)
    expect(gym.every((a) => a.polyline == null)).toBe(true)
  })

  it("ships a dictionary of Spanish, Portuguese and French places", () => {
    const levels = new Set(SYNTHETIC_ZONES.map((z) => z.level))
    expect(levels).toEqual(new Set(["country", "region", "city"]))
    expect(SYNTHETIC_ZONES.some((z) => z.id === "city:28079")).toBe(true)
    expect(SYNTHETIC_ZONES.some((z) => z.id === "country:PT")).toBe(true)
  })
})

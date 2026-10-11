import { describe, expect, it } from "vitest"

import { adaptToTheme, hexToOklch, isHexColor } from "~/lib/color"
import {
  CATEGORIES,
  SPORTS,
  getSport,
  sportColor,
  sportsByUse,
} from "~/lib/sports"

describe("sports registry", () => {
  it("covers the 56 Strava sport types once each", () => {
    const types = SPORTS.map((sport) => sport.type)
    expect(types).toHaveLength(56)
    expect(new Set(types).size).toBe(56)
  })

  it("assigns every sport to a declared category", () => {
    const ids = new Set(CATEGORIES.map((category) => category.id))
    for (const sport of SPORTS) expect(ids.has(sport.category)).toBe(true)
  })

  it("falls back to a readable label for unknown types", () => {
    const sport = getSport("UnderwaterHockey")
    expect(sport.category).toBe("otros")
    expect(sport.label).toBe("Underwater hockey")
  })
})

describe("sportsByUse", () => {
  it("lists each sport once, most frequent first", () => {
    expect(sportsByUse(["Ride", "Run", "Run", "Swim", "Run", "Ride"])).toEqual([
      "Run",
      "Ride",
      "Swim",
    ])
  })

  it("is empty without activities", () => {
    expect(sportsByUse([])).toEqual([])
  })
})

describe("sportColor", () => {
  it("is bright on the night map and deep on the day map", () => {
    for (const sport of SPORTS) {
      const night = sportColor(sport.type, "dark")
      const day = sportColor(sport.type, "light")
      expect(isHexColor(night) && isHexColor(day)).toBe(true)
      expect(hexToOklch(night).l).toBeGreaterThanOrEqual(0.75)
      expect(hexToOklch(day).l).toBeLessThanOrEqual(0.61)
    }
  })

  it("honours user overrides, adapted to the theme like the defaults", () => {
    const overrides = { Run: "#5ab8ff" }
    expect(sportColor("Run", "dark", overrides)).toBe(
      adaptToTheme("#5ab8ff", "dark")
    )
    expect(sportColor("Run", "dark", overrides)).not.toBe(
      sportColor("Run", "dark")
    )
  })
})

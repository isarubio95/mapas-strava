import { describe, expect, it } from "vitest"

import { activeFilterCount, EMPTY_FILTERS } from "./filters"

describe("activeFilterCount", () => {
  it("is zero with no filters", () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0)
  })

  it("counts each kind of filter once", () => {
    expect(
      activeFilterCount({
        ...EMPTY_FILTERS,
        sports: ["Run", "Ride"],
        from: "2025-01-01",
        to: "2025-12-31",
        minKm: 5,
        maxKm: 40,
        zone: "city:28079",
        zoneMode: "starts",
        near: { lng: -3.7038, lat: 40.4168, radius: 500 },
      })
    ).toBe(5)
  })

  it("counts a range with only one end", () => {
    expect(activeFilterCount({ ...EMPTY_FILTERS, to: "2025-12-31" })).toBe(1)
    expect(activeFilterCount({ ...EMPTY_FILTERS, minKm: 10 })).toBe(1)
  })
})

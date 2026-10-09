import { describe, expect, it } from "vitest"

import { EMPTY_FILTERS } from "./filters"
import { filtersFromSearch, filtersToSearch } from "./filters-url"

describe("filters in the URL", () => {
  it("round-trips a full selection", () => {
    const filters = {
      ...EMPTY_FILTERS,
      sports: ["Run", "Ride"],
      from: "2025-01-01",
      to: "2025-12-31",
      minKm: 5,
      maxKm: 40,
      zone: "city:28079",
      zoneMode: "starts" as const,
      near: { lng: -3.7038, lat: 40.4168, radius: 500 },
    }
    const params = filtersToSearch(filters, new URLSearchParams("modo=calor"))
    expect(params.get("modo")).toBe("calor")
    expect(filtersFromSearch(params)).toEqual(filters)
  })

  it("treats a missing query as no filters", () => {
    expect(filtersFromSearch(new URLSearchParams())).toEqual(EMPTY_FILTERS)
  })
})

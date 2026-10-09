import { describe, expect, it } from "vitest"

import { decodePolyline, encodePolyline } from "./polyline"

describe("polyline", () => {
  it("decodes the reference example from the algorithm docs", () => {
    // https://developers.google.com/maps/documentation/utilities/polylinealgorithm
    const coords = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")
    expect(Array.from(coords)).toEqual([
      -120.2, 38.5, -120.95, 40.7, -126.453, 43.252,
    ])
  })

  it("round-trips coordinates at 5 decimal precision", () => {
    const coords = [-3.70379, 40.41678, -3.6883, 40.4153, 2.16992, 41.38879]
    expect(Array.from(decodePolyline(encodePolyline(coords)))).toEqual(coords)
  })

  it("returns an empty array for an empty string", () => {
    expect(decodePolyline("").length).toBe(0)
  })
})

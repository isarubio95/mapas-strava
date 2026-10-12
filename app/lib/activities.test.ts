import { describe, expect, it } from "vitest"

import { visitedZones, type Zone } from "~/lib/activities"

const CATALOG: Zone[] = [
  { id: "country:ES", name: "España", level: "country", parent: null },
  { id: "country:FR", name: "Francia", level: "country", parent: null },
  {
    id: "region:ES-MD",
    name: "Comunidad de Madrid",
    level: "region",
    parent: "country:ES",
  },
  {
    id: "region:ES-CM",
    name: "Castilla-La Mancha",
    level: "region",
    parent: "country:ES",
  },
  { id: "city:28079", name: "Madrid", level: "city", parent: "region:ES-MD" },
  {
    id: "city:08019",
    name: "Barcelona",
    level: "city",
    parent: "region:ES-CT",
  },
]

describe("visitedZones", () => {
  it("keeps only zones with activities, most visited first", () => {
    const zones = visitedZones(CATALOG, [
      { id: "city:28079", count: 3 },
      { id: "country:ES", count: 5 },
      { id: "city:08019", count: 0 },
    ])
    expect(zones.map((zone) => [zone.name, zone.count])).toEqual([
      ["España", 5],
      ["Madrid", 3],
    ])
  })

  it("ignores ids missing from the catalog", () => {
    expect(visitedZones(CATALOG, [{ id: "city:99999", count: 2 }])).toEqual([])
  })

  it("lists regions only where routes start, counted by starts", () => {
    const zones = visitedZones(
      CATALOG,
      [
        { id: "region:ES-MD", count: 4 },
        { id: "region:ES-CM", count: 2 },
      ],
      [{ id: "region:ES-MD", count: 3 }]
    )
    expect(zones.map((zone) => [zone.name, zone.count])).toEqual([
      ["Comunidad de Madrid", 3],
    ])
  })
})

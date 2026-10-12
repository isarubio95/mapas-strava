/** An activity as the map needs it, whatever its source (database or demo). */
export interface Activity {
  /** Strava activity id. */
  id: number
  name: string
  sportType: string
  /** ISO timestamp in UTC. */
  startDate: string
  /** ISO timestamp in the activity's local time, without offset. */
  startDateLocal: string
  /** Meters. */
  distance: number
  /** Seconds. */
  movingTime: number
  /** Seconds. */
  elapsedTime: number
  /** Meters. */
  elevationGain: number
  /** Strava `map.summary_polyline`; null for activities without GPS. */
  polyline: string | null
  /** Zones the route passes through (country, region and city ids). */
  zones: string[]
  /** Zones where the route starts. */
  startZones: string[]
}

export type ZoneLevel = "country" | "region" | "city"

/** A place used by the place filter: country, region or municipality. */
export interface Zone {
  id: string
  name: string
  level: ZoneLevel
  /** Id of the containing zone (region for a city, country for a region). */
  parent: string | null
}

export const ZONE_LEVEL_LABEL: Record<ZoneLevel, string> = {
  country: "País",
  region: "Comunidad o región",
  city: "Ciudad",
}

/** A zone the user has activities in, with how many pass through it. */
export interface VisitedZone extends Zone {
  count: number
}

/**
 * Joins the zone catalog with per-zone activity counts, keeping only zones
 * with at least one activity, most visited first. Regions count the routes
 * that start in them, so a region only crossed on the way is left out.
 */
export function visitedZones(
  catalog: Zone[],
  counts: { id: string; count: number }[],
  startCounts: { id: string; count: number }[] = []
): VisitedZone[] {
  const passes = new Map(counts.map(({ id, count }) => [id, count]))
  const starts = new Map(startCounts.map(({ id, count }) => [id, count]))
  return catalog
    .flatMap((zone) => {
      const count =
        (zone.level === "region" ? starts : passes).get(zone.id) ?? 0
      return count > 0 ? [{ ...zone, count }] : []
    })
    .sort((a, b) => b.count - a.count)
}

/** Distance and altitude streams of one activity, for the elevation profile. */
export interface ActivityProfile {
  /** Meters from the start, one per point. */
  distance: number[]
  /** Meters above sea level, one per point. */
  altitude: number[]
}

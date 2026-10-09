export type ZoneMode = "passes" | "starts"

export interface NearPoint {
  lng: number
  lat: number
  /** Meters. */
  radius: number
}

/** What the map shows. `null` always means "no restriction". */
export interface Filters {
  /** Strava sport types to show; null shows them all. */
  sports: string[] | null
  /** Local dates, inclusive, as YYYY-MM-DD. */
  from: string | null
  to: string | null
  minKm: number | null
  maxKm: number | null
  zone: string | null
  zoneMode: ZoneMode
  near: NearPoint | null
}

export const EMPTY_FILTERS: Filters = {
  sports: null,
  from: null,
  to: null,
  minKm: null,
  maxKm: null,
  zone: null,
  zoneMode: "passes",
  near: null,
}

export const NEAR_RADII = [100, 250, 500, 1000, 2000] as const

const DAY_MS = 86_400_000

/** Days since 1970-01-01 for a local date or local timestamp string. */
export function dayNumber(local: string) {
  const y = Number(local.slice(0, 4))
  const m = Number(local.slice(5, 7))
  const d = Number(local.slice(8, 10))
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS)
}

export function dayToDate(day: number) {
  return new Date(day * DAY_MS).toISOString().slice(0, 10)
}

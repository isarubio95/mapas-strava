import type { Activity } from "~/lib/activities"

export type RouteOrder = "recent" | "oldest" | "longest"

/** What the route finder is looking for. `null` means "any". */
export interface RouteQuery {
  /** Words that must all appear in the title, in any order. */
  text: string
  sport: string | null
  /** Four-digit local year. */
  year: string | null
  order: RouteOrder
}

export const EMPTY_ROUTE_QUERY: RouteQuery = {
  text: "",
  sport: null,
  year: null,
  order: "recent",
}

export const ROUTE_ORDERS: { value: RouteOrder; label: string }[] = [
  { value: "recent", label: "Más recientes" },
  { value: "oldest", label: "Más antiguas" },
  { value: "longest", label: "Más largas" },
]

/** An activity the finder can offer, with its title ready to compare. */
export interface RouteEntry {
  activity: Activity
  title: string
  year: string
}

/** Lowercase and without accents, so "rio" finds "Río" and "pena" finds "Peña". */
export function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

/** Activities that have a route to draw, ready to search. */
export function indexRoutes(activities: Activity[]): RouteEntry[] {
  const entries: RouteEntry[] = []
  for (const activity of activities) {
    if (!activity.polyline) continue
    entries.push({
      activity,
      title: normalize(activity.name),
      year: activity.startDateLocal.slice(0, 4),
    })
  }
  return entries
}

function words(text: string) {
  return normalize(text).split(/\s+/).filter(Boolean)
}

function matches(
  entry: RouteEntry,
  query: RouteQuery,
  terms: string[],
  ignore?: "sport" | "year"
) {
  if (
    ignore !== "sport" &&
    query.sport &&
    entry.activity.sportType !== query.sport
  )
    return false
  if (ignore !== "year" && query.year && entry.year !== query.year) return false
  return terms.every((term) => entry.title.includes(term))
}

const ORDERS: Record<RouteOrder, (a: Activity, b: Activity) => number> = {
  recent: (a, b) => b.startDate.localeCompare(a.startDate),
  oldest: (a, b) => a.startDate.localeCompare(b.startDate),
  longest: (a, b) => b.distance - a.distance,
}

/** Routes that match the query, in its order. */
export function searchRoutes(entries: RouteEntry[], query: RouteQuery) {
  const terms = words(query.text)
  return entries
    .filter((entry) => matches(entry, query, terms))
    .map((entry) => entry.activity)
    .sort(ORDERS[query.order])
}

export interface RouteFacets {
  /** Per sport, routes that match everything else; most used first. */
  sports: { type: string; count: number }[]
  /** Per year, routes that match everything else; newest first. */
  years: { year: string; count: number }[]
}

/**
 * Options for the sport and year chips. Every sport and year with routes is
 * listed, so chips stay put while typing; counts follow the rest of the query.
 */
export function routeFacets(
  entries: RouteEntry[],
  query: RouteQuery
): RouteFacets {
  const terms = words(query.text)
  const sports = new Map<string, { total: number; count: number }>()
  const years = new Map<string, number>()
  for (const entry of entries) {
    const type = entry.activity.sportType
    const sport = sports.get(type) ?? { total: 0, count: 0 }
    sport.total++
    if (matches(entry, query, terms, "sport")) sport.count++
    sports.set(type, sport)
    const year = years.get(entry.year) ?? 0
    years.set(entry.year, year + (matches(entry, query, terms, "year") ? 1 : 0))
  }
  return {
    sports: [...sports]
      .sort((a, b) => b[1].total - a[1].total)
      .map(([type, { count }]) => ({ type, count })),
    years: [...years]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([year, count]) => ({ year, count })),
  }
}

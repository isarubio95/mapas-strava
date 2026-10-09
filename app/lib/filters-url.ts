import { EMPTY_FILTERS, type Filters, type ZoneMode } from "./filters"

function numberOrNull(value: string | null) {
  if (value == null || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function filtersFromSearch(params: URLSearchParams): Filters {
  const sports = params.get("deportes")
  const near = params.get("cerca")
  const parts = near?.split(",").map(Number) ?? []
  const [lng, lat, radius] = parts
  const mode = params.get("lugarModo")

  return {
    sports: sports ? sports.split(",").filter(Boolean) : null,
    from: params.get("desde"),
    to: params.get("hasta"),
    minKm: numberOrNull(params.get("min")),
    maxKm: numberOrNull(params.get("max")),
    zone: params.get("lugar"),
    zoneMode: mode === "empieza" ? "starts" : "passes",
    near:
      parts.length >= 2 && Number.isFinite(lng) && Number.isFinite(lat)
        ? { lng, lat, radius: Number.isFinite(radius) ? radius : 500 }
        : null,
  }
}

export function filtersToSearch(filters: Filters, current: URLSearchParams) {
  const next = new URLSearchParams(current)
  const set = (key: string, value: string | null) => {
    if (value) next.set(key, value)
    else next.delete(key)
  }
  set("deportes", filters.sports?.join(",") ?? null)
  set("desde", filters.from)
  set("hasta", filters.to)
  set("min", filters.minKm != null ? String(filters.minKm) : null)
  set("max", filters.maxKm != null ? String(filters.maxKm) : null)
  set("lugar", filters.zone)
  set("lugarModo", filters.zoneMode === "starts" ? "empieza" : null)
  set(
    "cerca",
    filters.near
      ? `${filters.near.lng.toFixed(5)},${filters.near.lat.toFixed(5)},${filters.near.radius}`
      : null
  )
  return next
}

export function sameFilters(a: Filters, b: Filters) {
  return JSON.stringify(a) === JSON.stringify({ ...EMPTY_FILTERS, ...b })
}

export type { ZoneMode }

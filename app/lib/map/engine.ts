import Flatbush from "flatbush"

import type { Activity } from "~/lib/activities"
import { dayNumber, type Filters } from "~/lib/filters"
import { circleBBox, distanceToPolyline, haversine, type BBox } from "~/lib/geo"
import { decodePolyline } from "~/lib/polyline"

/**
 * Route geometry in deck.gl's binary path layout. Paths are only the
 * activities with GPS; `pathActivity` maps each path back to its activity.
 */
export interface RouteGeometry {
  /** Interleaved [lng, lat] for every vertex of every path. */
  positions: Float64Array
  /** Vertex index where each path starts, plus the total at the end. */
  startIndices: Uint32Array
  pathActivity: Uint32Array
  /** Local day number of each path, for the GPU date filter. */
  pathDay: Float32Array
  /** Share of its route's length covered at each vertex, from 0 to 1. */
  progress: Float32Array
  bounds: BBox | null
  /** Routes around the place most of them start: where the map opens. */
  home: BBox | null
}

export interface DatasetMeta {
  total: number
  firstDay: number | null
  lastDay: number | null
  sports: { type: string; count: number }[]
  /** Activities passing through each zone. */
  zones: { id: string; count: number }[]
  /** Activities starting in each zone. */
  startZones: { id: string; count: number }[]
  maxKm: number
}

export interface SportTotal {
  type: string
  count: number
  distance: number
  movingTime: number
}

export interface Summary {
  count: number
  /** Activities in the selection that have a route on the map. */
  mapped: number
  distance: number
  movingTime: number
  elevationGain: number
  bySport: SportTotal[]
  firstDay: number | null
  lastDay: number | null
}

export interface Histogram {
  startDay: number
  binDays: number
  counts: Uint32Array
}

export interface QueryResult {
  /** Per path: 1 when it passes every filter except dates, else 0. */
  mask: Uint8Array
  summary: Summary
  /** Weekly activity counts for the timeline, ignoring the date filter. */
  timeline: Histogram | null
}

const WEEK = 7
/** Grid cell for finding the home area, in degrees (about 25 km). */
const HOME_CELL = 0.25

/**
 * Bounds of the routes that start in the busiest grid cell or its neighbours,
 * so one trip abroad does not zoom the map out to a continent.
 */
function homeBounds(starts: Float64Array, boxes: Float64Array): BBox | null {
  const count = starts.length / 2
  if (count === 0) return null
  const cells = new Map<string, number>()
  let best = ""
  let bestCount = 0
  for (let p = 0; p < count; p++) {
    const key = `${Math.floor(starts[p * 2] / HOME_CELL)}:${Math.floor(starts[p * 2 + 1] / HOME_CELL)}`
    const seen = (cells.get(key) ?? 0) + 1
    cells.set(key, seen)
    if (seen > bestCount) {
      best = key
      bestCount = seen
    }
  }
  const [cx, cy] = best.split(":").map(Number)
  const home: BBox = [Infinity, Infinity, -Infinity, -Infinity]
  for (let p = 0; p < count; p++) {
    const x = Math.floor(starts[p * 2] / HOME_CELL)
    const y = Math.floor(starts[p * 2 + 1] / HOME_CELL)
    if (Math.abs(x - cx) > 1 || Math.abs(y - cy) > 1) continue
    home[0] = Math.min(home[0], boxes[p * 4])
    home[1] = Math.min(home[1], boxes[p * 4 + 1])
    home[2] = Math.max(home[2], boxes[p * 4 + 2])
    home[3] = Math.max(home[3], boxes[p * 4 + 3])
  }
  return home
}

export class RouteEngine {
  private activities: Activity[] = []
  private days = new Int32Array(0)
  private positions = new Float64Array(0)
  private startIndices = new Uint32Array(1)
  private pathActivity = new Uint32Array(0)
  private activityPath = new Int32Array(0)
  private vertexFraction = new Float32Array(0)
  private index: Flatbush | null = null
  private meta: DatasetMeta = {
    total: 0,
    firstDay: null,
    lastDay: null,
    sports: [],
    zones: [],
    startZones: [],
    maxKm: 0,
  }

  load(activities: Activity[]) {
    this.activities = activities
    const n = activities.length
    this.days = new Int32Array(n)
    this.activityPath = new Int32Array(n).fill(-1)

    const decoded: Float64Array[] = []
    const owners: number[] = []
    let vertexCount = 0
    let firstDay = Infinity
    let lastDay = -Infinity
    let maxKm = 0
    const sports = new Map<string, number>()
    const zones = new Map<string, number>()
    const startZones = new Map<string, number>()

    for (let i = 0; i < n; i++) {
      const activity = activities[i]
      const day = dayNumber(activity.startDateLocal)
      this.days[i] = day
      firstDay = Math.min(firstDay, day)
      lastDay = Math.max(lastDay, day)
      maxKm = Math.max(maxKm, activity.distance / 1000)
      sports.set(activity.sportType, (sports.get(activity.sportType) ?? 0) + 1)
      for (const zone of activity.zones)
        zones.set(zone, (zones.get(zone) ?? 0) + 1)
      for (const zone of activity.startZones)
        startZones.set(zone, (startZones.get(zone) ?? 0) + 1)

      if (!activity.polyline) continue
      const coords = decodePolyline(activity.polyline)
      if (coords.length < 4) continue
      this.activityPath[i] = decoded.length
      decoded.push(coords)
      owners.push(i)
      vertexCount += coords.length / 2
    }

    const pathCount = decoded.length
    this.positions = new Float64Array(vertexCount * 2)
    this.startIndices = new Uint32Array(pathCount + 1)
    this.pathActivity = Uint32Array.from(owners)
    this.vertexFraction = new Float32Array(vertexCount)
    const pathDay = new Float32Array(pathCount)
    const starts = new Float64Array(pathCount * 2)
    const boxes = new Float64Array(pathCount * 4)
    let bounds: BBox | null = null

    if (pathCount > 0) {
      this.index = new Flatbush(pathCount)
      bounds = [Infinity, Infinity, -Infinity, -Infinity]
    } else {
      this.index = null
    }

    let vertex = 0
    for (let p = 0; p < pathCount; p++) {
      const coords = decoded[p]
      this.startIndices[p] = vertex
      this.positions.set(coords, vertex * 2)
      pathDay[p] = this.days[owners[p]]

      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      const points = coords.length / 2
      const lengths = new Float64Array(points)
      for (let v = 0; v < points; v++) {
        const x = coords[v * 2]
        const y = coords[v * 2 + 1]
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
        if (v > 0) {
          lengths[v] =
            lengths[v - 1] +
            haversine(coords[v * 2 - 2], coords[v * 2 - 1], x, y)
        }
      }
      const total = lengths[points - 1] || 1
      for (let v = 0; v < points; v++) {
        this.vertexFraction[vertex + v] = lengths[v] / total
      }
      this.index!.add(minX, minY, maxX, maxY)
      starts.set([coords[0], coords[1]], p * 2)
      boxes.set([minX, minY, maxX, maxY], p * 4)
      bounds![0] = Math.min(bounds![0], minX)
      bounds![1] = Math.min(bounds![1], minY)
      bounds![2] = Math.max(bounds![2], maxX)
      bounds![3] = Math.max(bounds![3], maxY)
      vertex += points
    }
    this.startIndices[pathCount] = vertex
    this.index?.finish()

    const byCount = (a: [string, number], b: [string, number]) => b[1] - a[1]
    this.meta = {
      total: n,
      firstDay: n ? firstDay : null,
      lastDay: n ? lastDay : null,
      sports: [...sports]
        .sort(byCount)
        .map(([type, count]) => ({ type, count })),
      zones: [...zones].sort(byCount).map(([id, count]) => ({ id, count })),
      startZones: [...startZones]
        .sort(byCount)
        .map(([id, count]) => ({ id, count })),
      maxKm: Math.ceil(maxKm),
    }

    const geometry: RouteGeometry = {
      positions: this.positions.slice(),
      startIndices: this.startIndices.slice(),
      pathActivity: this.pathActivity.slice(),
      pathDay,
      progress: this.vertexFraction.slice(),
      bounds,
      home: homeBounds(starts, boxes),
    }
    return { geometry, meta: this.meta }
  }

  /** Activities matching every filter except dates. */
  private matchStatic(filters: Filters) {
    const n = this.activities.length
    const match = new Uint8Array(n)
    const sports = filters.sports ? new Set(filters.sports) : null
    const minM = filters.minKm != null ? filters.minKm * 1000 : -Infinity
    const maxM = filters.maxKm != null ? filters.maxKm * 1000 : Infinity

    let nearPaths: Set<number> | null = null
    if (filters.near) {
      nearPaths = new Set()
      const { lng, lat, radius } = filters.near
      if (this.index) {
        const [minX, minY, maxX, maxY] = circleBBox(lng, lat, radius)
        for (const p of this.index.search(minX, minY, maxX, maxY)) {
          const d = distanceToPolyline(
            lng,
            lat,
            this.positions,
            this.startIndices[p],
            this.startIndices[p + 1],
            radius
          )
          if (d <= radius) nearPaths.add(p)
        }
      }
    }

    for (let i = 0; i < n; i++) {
      const activity = this.activities[i]
      if (sports && !sports.has(activity.sportType)) continue
      if (activity.distance < minM || activity.distance > maxM) continue
      if (filters.zone) {
        const zones =
          filters.zoneMode === "starts" ? activity.startZones : activity.zones
        if (!zones.includes(filters.zone)) continue
      }
      if (nearPaths && !nearPaths.has(this.activityPath[i])) continue
      match[i] = 1
    }
    return match
  }

  query(filters: Filters): QueryResult {
    const match = this.matchStatic(filters)
    const from = filters.from ? dayNumber(filters.from) : -Infinity
    const to = filters.to ? dayNumber(filters.to) : Infinity

    const mask = new Uint8Array(this.pathActivity.length)
    for (let p = 0; p < mask.length; p++) mask[p] = match[this.pathActivity[p]]

    const summary: Summary = {
      count: 0,
      mapped: 0,
      distance: 0,
      movingTime: 0,
      elevationGain: 0,
      bySport: [],
      firstDay: null,
      lastDay: null,
    }
    const bySport = new Map<string, SportTotal>()
    let timeline: Histogram | null = null
    const { firstDay, lastDay } = this.meta
    if (firstDay != null && lastDay != null) {
      timeline = {
        startDay: firstDay,
        binDays: WEEK,
        counts: new Uint32Array(Math.floor((lastDay - firstDay) / WEEK) + 1),
      }
    }

    for (let i = 0; i < match.length; i++) {
      if (!match[i]) continue
      const day = this.days[i]
      if (timeline)
        timeline.counts[Math.floor((day - timeline.startDay) / WEEK)]++
      if (day < from || day > to) continue

      const activity = this.activities[i]
      summary.count++
      if (this.activityPath[i] >= 0) summary.mapped++
      summary.distance += activity.distance
      summary.movingTime += activity.movingTime
      summary.elevationGain += activity.elevationGain
      summary.firstDay = Math.min(summary.firstDay ?? day, day)
      summary.lastDay = Math.max(summary.lastDay ?? day, day)

      const total = bySport.get(activity.sportType) ?? {
        type: activity.sportType,
        count: 0,
        distance: 0,
        movingTime: 0,
      }
      total.count++
      total.distance += activity.distance
      total.movingTime += activity.movingTime
      bySport.set(activity.sportType, total)
    }

    summary.bySport = [...bySport.values()].sort(
      (a, b) => b.distance - a.distance || b.count - a.count
    )
    return { mask, summary, timeline }
  }

  /**
   * Points every `spacing` meters along the routes that pass the filters,
   * dates included, so the heatmap weighs distance rather than GPS density.
   */
  heatPoints(filters: Filters, spacing = 80) {
    const match = this.matchStatic(filters)
    const from = filters.from ? dayNumber(filters.from) : -Infinity
    const to = filters.to ? dayNumber(filters.to) : Infinity
    const out: number[] = []
    const pos = this.positions

    for (let p = 0; p < this.pathActivity.length; p++) {
      const i = this.pathActivity[p]
      if (!match[i] || this.days[i] < from || this.days[i] > to) continue
      const start = this.startIndices[p]
      const end = this.startIndices[p + 1]
      let carry = 0
      out.push(pos[start * 2], pos[start * 2 + 1])
      for (let v = start; v < end - 1; v++) {
        const x0 = pos[v * 2]
        const y0 = pos[v * 2 + 1]
        const x1 = pos[v * 2 + 2]
        const y1 = pos[v * 2 + 3]
        const length = haversine(x0, y0, x1, y1)
        let along = spacing - carry
        while (along <= length) {
          const t = along / length
          out.push(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)
          along += spacing
        }
        carry = length - (along - spacing)
      }
    }
    return Float32Array.from(out)
  }

  /**
   * The routes that pass the filters, dates included, as GeoJSON text for
   * MapLibre to drape over the 3D terrain. Each line carries its activity id
   * (`a`) and sport (`s`).
   */
  routesGeoJSON(filters: Filters) {
    const match = this.matchStatic(filters)
    const from = filters.from ? dayNumber(filters.from) : -Infinity
    const to = filters.to ? dayNumber(filters.to) : Infinity
    const pos = this.positions
    // Polylines carry five decimals; more would only bloat the text.
    const round = (value: number) => Math.round(value * 1e5) / 1e5
    const features: string[] = []

    for (let p = 0; p < this.pathActivity.length; p++) {
      const i = this.pathActivity[p]
      if (!match[i] || this.days[i] < from || this.days[i] > to) continue
      const activity = this.activities[i]
      const coords: string[] = []
      for (let v = this.startIndices[p]; v < this.startIndices[p + 1]; v++) {
        coords.push(`[${round(pos[v * 2])},${round(pos[v * 2 + 1])}]`)
      }
      features.push(
        `{"type":"Feature","properties":{"a":${activity.id},"s":${JSON.stringify(activity.sportType)}},"geometry":{"type":"LineString","coordinates":[${coords.join(",")}]}}`
      )
    }
    return `{"type":"FeatureCollection","features":[${features.join(",")}]}`
  }

  /**
   * Per-vertex timestamps for chronological playback: each route draws
   * itself over `drawDays` of timeline, starting on its own day.
   */
  timestamps(drawDays: number) {
    const out = new Float32Array(this.vertexFraction.length)
    for (let p = 0; p < this.pathActivity.length; p++) {
      const day = this.days[this.pathActivity[p]]
      for (let v = this.startIndices[p]; v < this.startIndices[p + 1]; v++) {
        out[v] = day + this.vertexFraction[v] * drawDays
      }
    }
    return out
  }

  /** Coordinates of one activity's route, or null if it has no GPS. */
  route(activityIndex: number) {
    const p = this.activityPath[activityIndex]
    if (p == null || p < 0) return null
    return this.positions.slice(
      this.startIndices[p] * 2,
      this.startIndices[p + 1] * 2
    )
  }
}

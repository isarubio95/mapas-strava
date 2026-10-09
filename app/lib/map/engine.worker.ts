import { expose, transfer } from "comlink"

import type { Activity } from "~/lib/activities"
import type { Filters } from "~/lib/filters"

import { RouteEngine } from "./engine"

const engine = new RouteEngine()

const api = {
  load(activities: Activity[]) {
    const result = engine.load(activities)
    const { positions, startIndices, pathActivity, pathDay } = result.geometry
    return transfer(result, [
      positions.buffer,
      startIndices.buffer,
      pathActivity.buffer,
      pathDay.buffer,
    ])
  },
  query(filters: Filters) {
    const result = engine.query(filters)
    const buffers: ArrayBuffer[] = [result.mask.buffer as ArrayBuffer]
    if (result.timeline) buffers.push(result.timeline.counts.buffer as ArrayBuffer)
    return transfer(result, buffers)
  },
  heatPoints(filters: Filters, spacing?: number) {
    const points = engine.heatPoints(filters, spacing)
    return transfer(points, [points.buffer])
  },
  timestamps(drawDays: number) {
    const values = engine.timestamps(drawDays)
    return transfer(values, [values.buffer])
  },
  route(activityIndex: number) {
    const coords = engine.route(activityIndex)
    return coords ? transfer(coords, [coords.buffer]) : null
  },
}

export type EngineApi = typeof api

expose(api)

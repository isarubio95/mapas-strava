import { haversine } from "~/lib/geo"

/** Seconds a route takes to draw itself from start to finish. */
export const REVEAL_DRAW = 1.3
/** Seconds the bright head trails behind the tip of a drawing route. */
export const REVEAL_HEAD = 0.14
/** Seconds the selected route takes to draw itself. */
export const SELECTION_DRAW = 0.9
/** Routes start within this many seconds of each other, so they flow rather than march. */
const REVEAL_SPREAD = 0.35
/** Head start for the GPU upload, so the first frames are not lost. */
const REVEAL_LEAD = 0.06
const GOLDEN = 0.618033988749895

/** Seconds on a monotonic clock. */
export function clock() {
  return performance.now() / 1000
}

/** Share of the draw time at which a line reaches `share` of its length, easing out. */
function easedTime(share: number) {
  return (2 / Math.PI) * Math.asin(Math.min(1, share))
}

/** Per path, 1 when it is on screen: passes the filters and falls in the date range. */
export function visiblePaths(
  mask: Uint8Array,
  pathDay: Float32Array,
  [from, to]: [number, number]
) {
  const out = new Uint8Array(mask.length)
  for (let p = 0; p < mask.length; p++) {
    out[p] = mask[p] && pathDay[p] >= from && pathDay[p] <= to ? 1 : 0
  }
  return out
}

/** Eased draw time of each vertex of one route, from 0 to `duration`. */
export function drawTimes(coords: Float64Array, duration: number) {
  const points = coords.length / 2
  const lengths = new Float64Array(points)
  for (let v = 1; v < points; v++) {
    lengths[v] =
      lengths[v - 1] +
      haversine(
        coords[v * 2 - 2],
        coords[v * 2 - 1],
        coords[v * 2],
        coords[v * 2 + 1]
      )
  }
  const total = lengths[points - 1] || 1
  const out = new Float32Array(points)
  for (let v = 0; v < points; v++)
    out[v] = easedTime(lengths[v] / total) * duration
  return out
}

/**
 * Per-vertex draw times for routes as they appear. Routes already on screen
 * keep a time in the past, so only the new ones animate. Times count seconds
 * from `origin`, which moves forward whenever the map is at rest.
 */
export class RouteReveal {
  /** Seconds after `origin` when each vertex gets drawn. */
  readonly times: Float32Array
  /** Bumped whenever `times` changes. */
  version = 0
  private shown: Uint8Array
  private origin = 0
  private end = -Infinity

  constructor(
    private readonly startIndices: Uint32Array,
    private readonly progress: Float32Array
  ) {
    this.times = new Float32Array(progress.length).fill(-1)
    this.shown = new Uint8Array(startIndices.length - 1)
  }

  /** Clock time when the last route has finished drawing. */
  get finishesAt() {
    return this.origin + this.end + REVEAL_HEAD
  }

  /** Seconds on the reveal clock, held still once everything is drawn. */
  time(now: number) {
    return Math.min(now - this.origin, Math.max(this.end + REVEAL_HEAD, 0))
  }

  drawing(now: number) {
    return now < this.finishesAt
  }

  /** Starts drawing the routes in `visible` that were hidden last time. */
  update(visible: Uint8Array, now: number, animate: boolean) {
    let changed = false
    let start = 0
    for (let p = 0; p < this.shown.length; p++) {
      if (!visible[p]) {
        this.shown[p] = 0
        continue
      }
      if (this.shown[p]) continue
      this.shown[p] = 1
      if (!changed) {
        changed = true
        if (animate && !this.drawing(now)) {
          this.times.fill(-1)
          this.origin = now
          this.end = -Infinity
        }
        start = now - this.origin + REVEAL_LEAD
      }

      const from = this.startIndices[p]
      const to = this.startIndices[p + 1]
      if (!animate) {
        this.times.fill(-1, from, to)
        continue
      }
      const delay = start + ((p * GOLDEN) % 1) * REVEAL_SPREAD
      for (let v = from; v < to; v++) {
        this.times[v] = delay + easedTime(this.progress[v]) * REVEAL_DRAW
      }
      this.end = Math.max(this.end, delay + REVEAL_DRAW)
    }
    if (changed) this.version++
    return changed
  }
}

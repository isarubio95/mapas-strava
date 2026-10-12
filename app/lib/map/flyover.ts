import type { Map as MapLibreMap } from "maplibre-gl"

import { haversine, type LngLat } from "~/lib/geo"

/** A route measured for the camera to fly along it. */
export interface Track {
  coords: Float64Array
  /** Meters from the start at each vertex. */
  along: Float64Array
  /** Meters. */
  length: number
}

export function measureTrack(coords: Float64Array): Track {
  const points = coords.length / 2
  const along = new Float64Array(points)
  for (let v = 1; v < points; v++) {
    along[v] =
      along[v - 1] +
      haversine(
        coords[v * 2 - 2],
        coords[v * 2 - 1],
        coords[v * 2],
        coords[v * 2 + 1]
      )
  }
  return { coords, along, length: along[points - 1] ?? 0 }
}

/** The point `meters` from the start, between the two vertices around it. */
export function pointAlong(
  { coords, along, length }: Track,
  meters: number
): LngLat {
  const target = Math.min(Math.max(meters, 0), length)
  let low = 0
  let high = along.length - 1
  while (high - low > 1) {
    const mid = (low + high) >> 1
    if (along[mid] <= target) low = mid
    else high = mid
  }
  const span = along[high] - along[low]
  const t = span > 0 ? (target - along[low]) / span : 0
  return [
    coords[low * 2] + (coords[high * 2] - coords[low * 2]) * t,
    coords[low * 2 + 1] + (coords[high * 2 + 1] - coords[low * 2 + 1]) * t,
  ]
}

const RAD = Math.PI / 180

/** Compass bearing from `a` to `b`, in degrees. */
export function bearingBetween([lng1, lat1]: LngLat, [lng2, lat2]: LngLat) {
  const y = Math.sin((lng2 - lng1) * RAD) * Math.cos(lat2 * RAD)
  const x =
    Math.cos(lat1 * RAD) * Math.sin(lat2 * RAD) -
    Math.sin(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.cos((lng2 - lng1) * RAD)
  return Math.atan2(y, x) / RAD
}

const EARTH_RADIUS = 6_371_008.8

/** The point `meters` from `from` heading along `bearing`. */
export function destination(
  [lng, lat]: LngLat,
  bearing: number,
  meters: number
): LngLat {
  const d = meters / EARTH_RADIUS
  const b = bearing * RAD
  const lat1 = lat * RAD
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b)
  )
  const lng2 =
    lng * RAD +
    Math.atan2(
      Math.sin(b) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    )
  return [lng2 / RAD, lat2 / RAD]
}

/** Shortest signed turn from one bearing to another, from -180 to 180. */
export function turn(from: number, to: number) {
  return ((((to - from) % 360) + 540) % 360) - 180
}

/**
 * Share of the route covered at `share` of the flight: a steady pace that
 * eases in and out over the first and last `ramp` of the time.
 */
export function paceAt(share: number, ramp = 0.08) {
  const s = Math.min(Math.max(share, 0), 1)
  const peak = 1 / (1 - ramp)
  if (s < ramp) return (peak * s * s) / (2 * ramp)
  if (s > 1 - ramp) return 1 - (peak * (1 - s) ** 2) / (2 * ramp)
  return peak * (s - ramp / 2)
}

/** Seconds of flight: long enough to follow, short enough to watch whole. */
export function flyoverSeconds(meters: number) {
  return Math.min(50, Math.max(14, 10 + (meters / 1000) * 1.2))
}

/** Longer routes fly higher, so the ground does not rush past. */
export function flyoverZoom(meters: number) {
  const km = Math.max(meters / 1000, 0.5)
  return Math.min(15.2, Math.max(12.6, 15.6 - 0.55 * Math.log2(km)))
}

const PITCH = 62
/** Seconds the camera takes to swing in behind the start. */
const APPROACH = 2

export interface FlyoverFrame {
  /** Share of the route covered, from 0 to 1. */
  share: number
  at: LngLat
}

/**
 * Flies the camera along a route like a drone following the athlete: it
 * swings in behind the start, then keeps the head in the lower third of the
 * screen and turns smoothly ahead of the bends.
 */
export class Flyover {
  private frame = 0
  private stopped = false
  private readonly track: Track

  constructor(
    private readonly map: MapLibreMap,
    coords: Float64Array,
    private readonly onFrame: (frame: FlyoverFrame) => void,
    private readonly onDone: () => void
  ) {
    this.track = measureTrack(coords)
  }

  start() {
    const { map, track } = this
    if (track.length <= 0) {
      this.onDone()
      return
    }
    const look = Math.min(600, Math.max(120, track.length * 0.04))
    const zoom = flyoverZoom(track.length)
    const seconds = flyoverSeconds(track.length)
    const start = pointAlong(track, 0)
    let heading = bearingBetween(start, pointAlong(track, look))
    // The camera aims a little ahead of the head, which then sits low on the
    // screen with the way ahead in view.
    const metersPerPixel = (78271.517 * Math.cos(start[1] * RAD)) / 2 ** zoom
    const lead = map.getContainer().clientHeight * 0.24 * metersPerPixel
    const aim = (at: LngLat) => destination(at, heading, lead)

    this.onFrame({ share: 0, at: start })
    map.easeTo({
      center: aim(start),
      zoom,
      pitch: PITCH,
      bearing: heading,
      duration: APPROACH * 1000,
      easing: (t) => 1 - (1 - t) ** 3,
    })

    let began = 0
    let last = 0
    const step = (now: number) => {
      if (this.stopped) return
      if (!began) {
        // Wait for the approach to land before setting off.
        if (map.isMoving()) {
          this.frame = requestAnimationFrame(step)
          return
        }
        began = now
        last = now
      }
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const share = paceAt((now - began) / 1000 / seconds)
      const meters = share * track.length
      const at = pointAlong(track, meters)
      const ahead = pointAlong(track, meters + look)
      if (haversine(at[0], at[1], ahead[0], ahead[1]) > look * 0.25) {
        const target = bearingBetween(at, ahead)
        heading += turn(heading, target) * (1 - Math.exp(-dt * 1.6))
      }
      map.jumpTo({ center: aim(at), bearing: heading, pitch: PITCH, zoom })
      this.onFrame({ share, at })
      if (share < 1) this.frame = requestAnimationFrame(step)
      else this.finish()
    }
    this.frame = requestAnimationFrame(step)
  }

  /** Leaves the camera where it is. */
  stop() {
    if (this.stopped) return
    this.stopped = true
    cancelAnimationFrame(this.frame)
    this.map.stop()
  }

  private finish() {
    this.stopped = true
    this.onDone()
  }
}

/** Latest flyover progress, so only the HUD re-renders on every frame. */
export function createFlyoverProgress() {
  let share = 0
  const listeners = new Set<() => void>()
  return {
    get: () => share,
    set(next: number) {
      share = next
      listeners.forEach((listener) => listener())
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export type FlyoverProgress = ReturnType<typeof createFlyoverProgress>

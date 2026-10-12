const EARTH_RADIUS = 6_371_008.8
const RAD = Math.PI / 180

export type LngLat = [number, number]
export type BBox = [
  minLng: number,
  minLat: number,
  maxLng: number,
  maxLat: number,
]

/**
 * What a flat, north-up map of `width`×`height` pixels shows around a center
 * at a MapLibre zoom (512 px tiles). Unlike the map's own bounds, it ignores
 * tilt and rotation, so a 3D view gives the ground under it, not the horizon.
 */
export function viewBounds(
  lng: number,
  lat: number,
  zoom: number,
  width: number,
  height: number
): BBox {
  const world = 512 * 2 ** zoom
  const x = ((lng + 180) / 360) * world
  const y =
    ((1 - Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)) / Math.PI) / 2) *
    world
  const toLng = (px: number) => (px / world) * 360 - 180
  const toLat = (py: number) =>
    Math.atan(Math.sinh(Math.PI * (1 - (2 * py) / world))) / RAD
  return [
    toLng(x - width / 2),
    toLat(Math.min(world, y + height / 2)),
    toLng(x + width / 2),
    toLat(Math.max(0, y - height / 2)),
  ]
}

export function haversine(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number
) {
  const dLat = (lat2 - lat1) * RAD
  const dLng = (lng2 - lng1) * RAD
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(a)))
}

/**
 * Shortest distance in meters from a point to a polyline given as
 * interleaved [lng, lat, ...] coordinates between vertex `start` (inclusive)
 * and `end` (exclusive). Uses a local equirectangular projection, accurate
 * to well under 1% at the scales of a "near this point" search (≤ 10 km).
 * Stops early once a distance under `stopBelow` is found.
 */
export function distanceToPolyline(
  lng: number,
  lat: number,
  coords: ArrayLike<number>,
  start = 0,
  end = coords.length / 2,
  stopBelow = 0
) {
  const kx = Math.cos(lat * RAD) * RAD * EARTH_RADIUS
  const ky = RAD * EARTH_RADIUS
  let best = Infinity

  if (end - start === 1) {
    const dx = (coords[start * 2] - lng) * kx
    const dy = (coords[start * 2 + 1] - lat) * ky
    return Math.hypot(dx, dy)
  }

  for (let i = start; i < end - 1; i++) {
    const ax = (coords[i * 2] - lng) * kx
    const ay = (coords[i * 2 + 1] - lat) * ky
    const bx = (coords[i * 2 + 2] - lng) * kx
    const by = (coords[i * 2 + 3] - lat) * ky
    const abx = bx - ax
    const aby = by - ay
    const lengthSq = abx * abx + aby * aby
    const t =
      lengthSq === 0
        ? 0
        : Math.max(0, Math.min(1, -(ax * abx + ay * aby) / lengthSq))
    const d = Math.hypot(ax + t * abx, ay + t * aby)
    if (d < best) {
      best = d
      if (best <= stopBelow) return best
    }
  }
  return best
}

/** Bounding box of a circle of `radius` meters around a point. */
export function circleBBox(lng: number, lat: number, radius: number): BBox {
  const dLat = radius / (RAD * EARTH_RADIUS)
  const dLng = radius / (RAD * EARTH_RADIUS * Math.cos(lat * RAD))
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat]
}

export function polylineLength(coords: ArrayLike<number>) {
  let total = 0
  for (let i = 0; i < coords.length - 2; i += 2) {
    total += haversine(coords[i], coords[i + 1], coords[i + 2], coords[i + 3])
  }
  return total
}

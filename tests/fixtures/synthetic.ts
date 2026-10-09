/**
 * Deterministic synthetic activities for development, demos and tests.
 * Strava data never goes through this repository (API policy 5.3), so every
 * screen is built and tested against these instead.
 */
import type { Activity, Zone } from "../../app/lib/activities"
import { haversine, polylineLength } from "../../app/lib/geo"
import { decodePolyline, encodePolyline } from "../../app/lib/polyline"
import { SPORTS } from "../../app/lib/sports"

// ---------------------------------------------------------------- places

interface Place {
  id: string
  name: string
  region: string
  country: string
  lng: number
  lat: number
  /** Rough municipality radius in meters, for "passes through" zones. */
  radius: number
  /** Street grid orientation in degrees, so city routes follow "streets". */
  grid: number
  hilly?: boolean
}

const COUNTRIES: Zone[] = [
  { id: "country:ES", name: "España", level: "country", parent: null },
  { id: "country:PT", name: "Portugal", level: "country", parent: null },
  { id: "country:FR", name: "Francia", level: "country", parent: null },
]

const REGIONS: Zone[] = [
  { id: "region:ES-MD", name: "Comunidad de Madrid", level: "region", parent: "country:ES" },
  { id: "region:ES-CT", name: "Cataluña", level: "region", parent: "country:ES" },
  { id: "region:ES-VC", name: "Comunitat Valenciana", level: "region", parent: "country:ES" },
  { id: "region:ES-AN", name: "Andalucía", level: "region", parent: "country:ES" },
  { id: "region:ES-PV", name: "País Vasco", level: "region", parent: "country:ES" },
  { id: "region:ES-AR", name: "Aragón", level: "region", parent: "country:ES" },
  { id: "region:ES-CB", name: "Cantabria", level: "region", parent: "country:ES" },
  { id: "region:ES-AS", name: "Principado de Asturias", level: "region", parent: "country:ES" },
  { id: "region:ES-IB", name: "Illes Balears", level: "region", parent: "country:ES" },
  { id: "region:ES-NC", name: "Comunidad Foral de Navarra", level: "region", parent: "country:ES" },
  { id: "region:ES-CL", name: "Castilla y León", level: "region", parent: "country:ES" },
  { id: "region:ES-GA", name: "Galicia", level: "region", parent: "country:ES" },
  { id: "region:PT-11", name: "Lisboa", level: "region", parent: "country:PT" },
  { id: "region:FR-ARA", name: "Auvergne-Rhône-Alpes", level: "region", parent: "country:FR" },
]

const PLACES: Place[] = [
  { id: "city:28079", name: "Madrid", region: "region:ES-MD", country: "country:ES", lng: -3.7038, lat: 40.4168, radius: 9000, grid: 12 },
  { id: "city:28006", name: "Alcobendas", region: "region:ES-MD", country: "country:ES", lng: -3.6413, lat: 40.5475, radius: 4000, grid: 30 },
  { id: "city:28115", name: "Pozuelo de Alarcón", region: "region:ES-MD", country: "country:ES", lng: -3.8136, lat: 40.4351, radius: 4000, grid: 20 },
  { id: "city:28127", name: "Las Rozas de Madrid", region: "region:ES-MD", country: "country:ES", lng: -3.8738, lat: 40.4929, radius: 4500, grid: 40 },
  { id: "city:28065", name: "Getafe", region: "region:ES-MD", country: "country:ES", lng: -3.7327, lat: 40.3083, radius: 4000, grid: 5 },
  { id: "city:28123", name: "Rivas-Vaciamadrid", region: "region:ES-MD", country: "country:ES", lng: -3.5182, lat: 40.3534, radius: 4000, grid: 35 },
  { id: "city:28903", name: "Tres Cantos", region: "region:ES-MD", country: "country:ES", lng: -3.7134, lat: 40.6009, radius: 3500, grid: 15 },
  { id: "city:28045", name: "Colmenar Viejo", region: "region:ES-MD", country: "country:ES", lng: -3.7656, lat: 40.6590, radius: 6000, grid: 25, hilly: true },
  { id: "city:28082", name: "Manzanares el Real", region: "region:ES-MD", country: "country:ES", lng: -3.8617, lat: 40.7272, radius: 5000, grid: 0, hilly: true },
  { id: "city:28038", name: "Cercedilla", region: "region:ES-MD", country: "country:ES", lng: -4.0573, lat: 40.7409, radius: 5000, grid: 0, hilly: true },
  { id: "city:08019", name: "Barcelona", region: "region:ES-CT", country: "country:ES", lng: 2.1686, lat: 41.3874, radius: 7000, grid: 45 },
  { id: "city:46250", name: "València", region: "region:ES-VC", country: "country:ES", lng: -0.3763, lat: 39.4699, radius: 7000, grid: 10 },
  { id: "city:41091", name: "Sevilla", region: "region:ES-AN", country: "country:ES", lng: -5.9845, lat: 37.3891, radius: 7000, grid: 18 },
  { id: "city:29067", name: "Málaga", region: "region:ES-AN", country: "country:ES", lng: -4.4214, lat: 36.7213, radius: 7000, grid: 28 },
  { id: "city:18134", name: "Monachil", region: "region:ES-AN", country: "country:ES", lng: -3.3986, lat: 37.0952, radius: 7000, grid: 0, hilly: true },
  { id: "city:48020", name: "Bilbao", region: "region:ES-PV", country: "country:ES", lng: -2.9349, lat: 43.263, radius: 5000, grid: 33, hilly: true },
  { id: "city:20069", name: "Donostia / San Sebastián", region: "region:ES-PV", country: "country:ES", lng: -1.9812, lat: 43.3183, radius: 5000, grid: 8, hilly: true },
  { id: "city:50297", name: "Zaragoza", region: "region:ES-AR", country: "country:ES", lng: -0.8891, lat: 41.6488, radius: 7000, grid: 22 },
  { id: "city:22199", name: "Sallent de Gállego", region: "region:ES-AR", country: "country:ES", lng: -0.3313, lat: 42.7739, radius: 7000, grid: 0, hilly: true },
  { id: "city:39075", name: "Santander", region: "region:ES-CB", country: "country:ES", lng: -3.8044, lat: 43.4623, radius: 5000, grid: 14 },
  { id: "city:33044", name: "Oviedo", region: "region:ES-AS", country: "country:ES", lng: -5.8494, lat: 43.3603, radius: 5000, grid: 26, hilly: true },
  { id: "city:07040", name: "Palma", region: "region:ES-IB", country: "country:ES", lng: 2.6502, lat: 39.5696, radius: 6000, grid: 38 },
  { id: "city:31201", name: "Pamplona / Iruña", region: "region:ES-NC", country: "country:ES", lng: -1.6432, lat: 42.8125, radius: 4500, grid: 16 },
  { id: "city:37274", name: "Salamanca", region: "region:ES-CL", country: "country:ES", lng: -5.6635, lat: 40.9701, radius: 4500, grid: 6 },
  { id: "city:15030", name: "A Coruña", region: "region:ES-GA", country: "country:ES", lng: -8.4115, lat: 43.3623, radius: 4500, grid: 42 },
  { id: "city:PT-1106", name: "Lisboa", region: "region:PT-11", country: "country:PT", lng: -9.1393, lat: 38.7223, radius: 6000, grid: 30, hilly: true },
  { id: "city:FR-74056", name: "Chamonix-Mont-Blanc", region: "region:FR-ARA", country: "country:FR", lng: 6.8694, lat: 45.9237, radius: 7000, grid: 0, hilly: true },
]

/** Where trips start: mostly home (Madrid), sometimes away. */
const HOME_WEIGHTS: [string, number][] = [
  ["city:28079", 46],
  ["city:28006", 4],
  ["city:28115", 3],
  ["city:28127", 4],
  ["city:28123", 3],
  ["city:28903", 3],
  ["city:28082", 4],
  ["city:28038", 3],
  ["city:08019", 4],
  ["city:46250", 3],
  ["city:41091", 2],
  ["city:29067", 2],
  ["city:18134", 2],
  ["city:48020", 2],
  ["city:20069", 2],
  ["city:50297", 2],
  ["city:22199", 2],
  ["city:39075", 1],
  ["city:33044", 1],
  ["city:07040", 2],
  ["city:31201", 1],
  ["city:37274", 1],
  ["city:15030", 1],
  ["city:PT-1106", 1],
  ["city:FR-74056", 1],
]

const SNOW_PLACES = ["city:18134", "city:22199", "city:FR-74056", "city:28038"]
const WATER_PLACES = ["city:46250", "city:29067", "city:07040", "city:20069", "city:39075", "city:15030", "city:41091"]

export const SYNTHETIC_ZONES: Zone[] = [
  ...COUNTRIES,
  ...REGIONS,
  ...PLACES.map((place) => ({
    id: place.id,
    name: place.name,
    level: "city" as const,
    parent: place.region,
  })),
]

// ---------------------------------------------------------------- sports

interface SportProfile {
  weight: number
  /** Median distance in km and spread factor (log-normal). */
  km: [median: number, spread: number]
  /** Average moving speed in km/h. */
  speed: number
  gps: "always" | "never" | "sometimes"
  shape: "grid" | "smooth" | "court"
  where?: "snow" | "water"
  climbPerKm: number
}

const DEFAULT_PROFILE: SportProfile = { weight: 0.3, km: [6, 0.4], speed: 8, gps: "sometimes", shape: "smooth", climbPerKm: 8 }

const PROFILES: Record<string, Partial<SportProfile>> = {
  Run: { weight: 24, km: [9, 0.35], speed: 11.5, gps: "always", shape: "grid", climbPerKm: 9 },
  TrailRun: { weight: 4, km: [14, 0.4], speed: 8.5, gps: "always", shape: "smooth", climbPerKm: 45 },
  VirtualRun: { weight: 1, km: [8, 0.3], speed: 11, gps: "never", climbPerKm: 0 },
  Walk: { weight: 9, km: [4.5, 0.4], speed: 5, gps: "always", shape: "grid", climbPerKm: 8 },
  Hike: { weight: 5, km: [12, 0.35], speed: 3.8, gps: "always", shape: "smooth", climbPerKm: 60 },
  Ride: { weight: 22, km: [55, 0.45], speed: 26, gps: "always", shape: "smooth", climbPerKm: 11 },
  MountainBikeRide: { weight: 5, km: [32, 0.35], speed: 15, gps: "always", shape: "smooth", climbPerKm: 28 },
  GravelRide: { weight: 3, km: [60, 0.35], speed: 20, gps: "always", shape: "smooth", climbPerKm: 14 },
  EBikeRide: { weight: 2, km: [25, 0.35], speed: 21, gps: "always", shape: "grid", climbPerKm: 8 },
  EMountainBikeRide: { weight: 1, km: [30, 0.3], speed: 16, gps: "always", shape: "smooth", climbPerKm: 30 },
  VirtualRide: { weight: 3, km: [35, 0.35], speed: 30, gps: "never", climbPerKm: 0 },
  Velomobile: { weight: 0.2, km: [40, 0.3], speed: 32, gps: "always", shape: "smooth", climbPerKm: 5 },
  Handcycle: { weight: 0.2, km: [20, 0.3], speed: 18, gps: "always", shape: "smooth", climbPerKm: 5 },
  Swim: { weight: 4, km: [2, 0.3], speed: 2.8, gps: "sometimes", shape: "smooth", where: "water", climbPerKm: 0 },
  Rowing: { weight: 0.6, km: [8, 0.3], speed: 9, gps: "sometimes", shape: "smooth", where: "water", climbPerKm: 0 },
  VirtualRow: { weight: 0.4, km: [6, 0.3], speed: 9, gps: "never", climbPerKm: 0 },
  Kayaking: { weight: 0.8, km: [9, 0.3], speed: 7, gps: "always", shape: "smooth", where: "water", climbPerKm: 0 },
  Canoeing: { weight: 0.4, km: [8, 0.3], speed: 6, gps: "always", shape: "smooth", where: "water", climbPerKm: 0 },
  StandUpPaddling: { weight: 0.6, km: [5, 0.3], speed: 5, gps: "always", shape: "smooth", where: "water", climbPerKm: 0 },
  Surfing: { weight: 0.6, km: [3, 0.3], speed: 4, gps: "always", shape: "court", where: "water", climbPerKm: 0 },
  Kitesurf: { weight: 0.3, km: [15, 0.3], speed: 22, gps: "always", shape: "smooth", where: "water", climbPerKm: 0 },
  Windsurf: { weight: 0.3, km: [14, 0.3], speed: 20, gps: "always", shape: "smooth", where: "water", climbPerKm: 0 },
  Sail: { weight: 0.3, km: [20, 0.3], speed: 11, gps: "always", shape: "smooth", where: "water", climbPerKm: 0 },
  AlpineSki: { weight: 1.5, km: [28, 0.3], speed: 16, gps: "always", shape: "smooth", where: "snow", climbPerKm: 15 },
  BackcountrySki: { weight: 0.6, km: [14, 0.3], speed: 5, gps: "always", shape: "smooth", where: "snow", climbPerKm: 85 },
  NordicSki: { weight: 0.5, km: [15, 0.3], speed: 11, gps: "always", shape: "smooth", where: "snow", climbPerKm: 15 },
  Snowboard: { weight: 0.6, km: [22, 0.3], speed: 15, gps: "always", shape: "smooth", where: "snow", climbPerKm: 10 },
  Snowshoe: { weight: 0.3, km: [8, 0.3], speed: 3.5, gps: "always", shape: "smooth", where: "snow", climbPerKm: 55 },
  IceSkate: { weight: 0.2, km: [5, 0.3], speed: 12, gps: "sometimes", shape: "court", climbPerKm: 0 },
  InlineSkate: { weight: 0.5, km: [15, 0.3], speed: 16, gps: "always", shape: "grid", climbPerKm: 4 },
  Skateboard: { weight: 0.3, km: [6, 0.3], speed: 12, gps: "always", shape: "grid", climbPerKm: 4 },
  RollerSki: { weight: 0.2, km: [16, 0.3], speed: 15, gps: "always", shape: "smooth", climbPerKm: 10 },
  Wheelchair: { weight: 0.2, km: [6, 0.3], speed: 8, gps: "always", shape: "grid", climbPerKm: 3 },
  WeightTraining: { weight: 4, km: [0, 0], speed: 0, gps: "never", climbPerKm: 0 },
  Crossfit: { weight: 1, km: [0, 0], speed: 0, gps: "never", climbPerKm: 0 },
  Workout: { weight: 2, km: [0, 0], speed: 0, gps: "never", climbPerKm: 0 },
  HighIntensityIntervalTraining: { weight: 1, km: [0, 0], speed: 0, gps: "never", climbPerKm: 0 },
  Elliptical: { weight: 0.5, km: [6, 0.3], speed: 9, gps: "never", climbPerKm: 0 },
  StairStepper: { weight: 0.3, km: [0, 0], speed: 0, gps: "never", climbPerKm: 0 },
  Yoga: { weight: 2, km: [0, 0], speed: 0, gps: "never", climbPerKm: 0 },
  Pilates: { weight: 0.8, km: [0, 0], speed: 0, gps: "never", climbPerKm: 0 },
  PhysicalTherapy: { weight: 0.3, km: [0, 0], speed: 0, gps: "never", climbPerKm: 0 },
  RockClimbing: { weight: 0.8, km: [1.5, 0.4], speed: 1.5, gps: "sometimes", shape: "smooth", climbPerKm: 120 },
  Dance: { weight: 0.3, km: [0, 0], speed: 0, gps: "never", climbPerKm: 0 },
  Tennis: { weight: 0.8, km: [3, 0.3], speed: 4, gps: "sometimes", shape: "court", climbPerKm: 0 },
  Padel: { weight: 1.5, km: [2.5, 0.3], speed: 3.5, gps: "sometimes", shape: "court", climbPerKm: 0 },
  Badminton: { weight: 0.2, km: [2, 0.3], speed: 3, gps: "never", climbPerKm: 0 },
  Squash: { weight: 0.2, km: [2, 0.3], speed: 3, gps: "never", climbPerKm: 0 },
  Racquetball: { weight: 0.1, km: [2, 0.3], speed: 3, gps: "never", climbPerKm: 0 },
  TableTennis: { weight: 0.2, km: [0, 0], speed: 0, gps: "never", climbPerKm: 0 },
  Pickleball: { weight: 0.2, km: [2, 0.3], speed: 3, gps: "sometimes", shape: "court", climbPerKm: 0 },
  Soccer: { weight: 0.8, km: [7, 0.3], speed: 6, gps: "sometimes", shape: "court", climbPerKm: 0 },
  Basketball: { weight: 0.3, km: [4, 0.3], speed: 5, gps: "sometimes", shape: "court", climbPerKm: 0 },
  Volleyball: { weight: 0.2, km: [2, 0.3], speed: 3, gps: "never", climbPerKm: 0 },
  Cricket: { weight: 0.1, km: [3, 0.3], speed: 3, gps: "never", climbPerKm: 0 },
  Golf: { weight: 0.5, km: [8, 0.2], speed: 3, gps: "always", shape: "smooth", climbPerKm: 10 },
}

function profileFor(type: string): SportProfile {
  return { ...DEFAULT_PROFILE, ...PROFILES[type] }
}

// ---------------------------------------------------------------- random

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Rng = () => number

const gaussian = (rng: Rng) => {
  const u = Math.max(rng(), 1e-9)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng())
}

function weighted<T>(rng: Rng, entries: [T, number][]): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  let r = rng() * total
  for (const [value, w] of entries) {
    r -= w
    if (r <= 0) return value
  }
  return entries[entries.length - 1][0]
}

const pick = <T>(rng: Rng, list: T[]) => list[Math.floor(rng() * list.length)]

// ---------------------------------------------------------------- routes

const M_PER_DEG = 111_320

function offset(lng: number, lat: number, dx: number, dy: number): [number, number] {
  return [lng + dx / (M_PER_DEG * Math.cos((lat * Math.PI) / 180)), lat + dy / M_PER_DEG]
}

/**
 * A loop that follows a rotated street grid: straight blocks with turns at
 * "intersections", heading home in the second half.
 */
function gridRoute(rng: Rng, start: [number, number], meters: number, gridDeg: number) {
  const coords: number[] = [start[0], start[1]]
  let [x, y] = [0, 0]
  let travelled = 0
  let dir = Math.floor(rng() * 4)
  const grid = (gridDeg * Math.PI) / 180

  while (travelled < meters) {
    const homeward = travelled > meters * 0.5
    if (homeward) {
      // Pick the grid direction that brings us closest to the start.
      let best = dir
      let bestDist = Infinity
      for (let d = 0; d < 4; d++) {
        const a = grid + (d * Math.PI) / 2
        const nx = x + Math.cos(a) * 200
        const ny = y + Math.sin(a) * 200
        const dist = Math.hypot(nx, ny) + rng() * 120
        if (dist < bestDist) {
          bestDist = dist
          best = d
        }
      }
      dir = best
    } else if (rng() < 0.55) {
      dir = (dir + (rng() < 0.5 ? 1 : 3)) % 4
    }

    const block = 120 + rng() * 420
    const angle = grid + (dir * Math.PI) / 2
    const steps = Math.max(1, Math.round(block / 60))
    for (let s = 0; s < steps; s++) {
      x += (Math.cos(angle) * block) / steps
      y += (Math.sin(angle) * block) / steps
      const [lng, lat] = offset(start[0], start[1], x + gaussian(rng) * 3, y + gaussian(rng) * 3)
      coords.push(lng, lat)
    }
    travelled += block
    if (homeward && Math.hypot(x, y) < 150) break
  }
  coords.push(start[0], start[1])
  return coords
}

/** A free-flowing loop or out-and-back, for rides, trails and mountains. */
function smoothRoute(rng: Rng, start: [number, number], meters: number, loop: boolean) {
  const step = Math.max(25, Math.min(140, meters / 300))
  const coords: number[] = [start[0], start[1]]
  let [x, y] = [0, 0]
  let heading = rng() * Math.PI * 2
  let turn = 0
  const outward: [number, number][] = []
  const target = loop ? meters : meters / 2

  for (let travelled = 0; travelled < target; travelled += step) {
    turn = turn * 0.85 + gaussian(rng) * 0.09
    heading += turn
    if (loop && travelled > target * 0.45) {
      const home = Math.atan2(-y, -x)
      let delta = home - heading
      delta = Math.atan2(Math.sin(delta), Math.cos(delta))
      const pull = Math.min(1, (travelled / target - 0.45) * 1.8)
      heading += delta * 0.12 * pull
      if (travelled > target * 0.75 && Math.hypot(x, y) < step * 2) break
    }
    x += Math.cos(heading) * step
    y += Math.sin(heading) * step
    outward.push([x, y])
    const [lng, lat] = offset(start[0], start[1], x, y)
    coords.push(lng, lat)
  }

  if (loop) {
    coords.push(start[0], start[1])
  } else {
    for (let i = outward.length - 2; i >= 0; i--) {
      const [ox, oy] = outward[i]
      const [lng, lat] = offset(start[0], start[1], ox + gaussian(rng) * 4, oy + gaussian(rng) * 4)
      coords.push(lng, lat)
    }
  }
  return coords
}

/** Back-and-forth inside a court or a small area (tennis, surf, football). */
function courtRoute(rng: Rng, start: [number, number], meters: number) {
  const coords: number[] = []
  const w = 12 + rng() * 40
  const h = 20 + rng() * 60
  const legs = Math.max(8, Math.round(meters / ((w + h) / 2)))
  for (let i = 0; i < Math.min(legs, 220); i++) {
    const [lng, lat] = offset(start[0], start[1], (rng() - 0.5) * w, (rng() - 0.5) * h)
    coords.push(lng, lat)
  }
  return coords
}

function zonesAlong(coords: number[]) {
  const passes = new Set<string>()
  for (let i = 0; i < coords.length; i += 6) {
    for (const place of PLACES) {
      if (haversine(coords[i], coords[i + 1], place.lng, place.lat) < place.radius) {
        passes.add(place.id)
        passes.add(place.region)
        passes.add(place.country)
      }
    }
  }
  return [...passes]
}

function zonesOf(place: Place) {
  return [place.id, place.region, place.country]
}

// ---------------------------------------------------------------- names

const MOMENT = (hour: number) =>
  hour < 12 ? "por la mañana" : hour < 15 ? "a mediodía" : hour < 21 ? "por la tarde" : "por la noche"

function nameFor(rng: Rng, label: string, hour: number, place: Place, home: boolean) {
  if (!home && rng() < 0.6) return `${label} en ${place.name}`
  if (rng() < 0.12) return pick(rng, ["Tirada larga", "Rodaje suave", "Series", "Salida con amigos", "Vuelta de recuperación", "Ruta nueva"])
  return `${label} ${MOMENT(hour)}`
}

// ---------------------------------------------------------------- main

export interface SyntheticOptions {
  count?: number
  seed?: number
  /** Inclusive range of start dates. */
  from?: string
  to?: string
}

const pad = (n: number) => String(n).padStart(2, "0")

function madridOffsetHours(date: Date) {
  // Central European Summer Time runs from the last Sunday of March to the
  // last Sunday of October; close enough for synthetic data.
  const month = date.getUTCMonth()
  return month > 2 && month < 10 ? 2 : 1
}

export function generateActivities({
  count = 1500,
  seed = 7,
  from = "2022-01-01",
  to = "2026-10-01",
}: SyntheticOptions = {}): Activity[] {
  const rng = mulberry32(seed)
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T23:59:59Z`)
  const placesById = new Map(PLACES.map((place) => [place.id, place]))
  const sportWeights = SPORTS.map(
    (sport) => [sport.type, profileFor(sport.type).weight] as [string, number]
  )

  const activities: Activity[] = []

  for (let i = 0; i < count; i++) {
    // The first 56 activities cover every sport once, so all colors show up.
    const type = i < SPORTS.length ? SPORTS[i].type : weighted(rng, sportWeights)
    const profile = profileFor(type)

    let placeId = weighted(rng, HOME_WEIGHTS)
    if (profile.where === "snow") placeId = pick(rng, SNOW_PLACES)
    if (profile.where === "water") placeId = pick(rng, WATER_PLACES)
    const place = placesById.get(placeId)!
    const home = place.region === "region:ES-MD"

    const day = start + rng() * (end - start)
    const date = new Date(day)
    const hour = weighted(rng, [
      [7, 3],
      [8, 3],
      [9, 3],
      [10, 3],
      [12, 1],
      [14, 1],
      [18, 3],
      [19, 4],
      [20, 2],
      [21, 1],
    ])
    const minute = Math.floor(rng() * 60)
    const local = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute, Math.floor(rng() * 60))
    )
    const utc = new Date(local.getTime() - madridOffsetHours(local) * 3_600_000)

    const hasGps =
      profile.gps === "always" || (profile.gps === "sometimes" && rng() < 0.6)

    let meters =
      profile.km[0] > 0
        ? Math.max(300, profile.km[0] * Math.exp(gaussian(rng) * profile.km[1]) * 1000)
        : 0

    let polyline: string | null = null
    let zones = zonesOf(place)
    if (hasGps && meters > 0) {
      const spread = Math.min(place.radius * 0.8, 5000)
      const origin = offset(place.lng, place.lat, gaussian(rng) * spread * 0.5, gaussian(rng) * spread * 0.5)
      let coords: number[]
      if (profile.shape === "grid") coords = gridRoute(rng, origin, meters, place.grid)
      else if (profile.shape === "court") coords = courtRoute(rng, origin, meters)
      else coords = smoothRoute(rng, origin, meters, rng() < 0.75)
      if (profile.shape !== "court") meters = polylineLength(coords)
      polyline = encodePolyline(coords)
      zones = zonesAlong(coords)
      for (const zone of zonesOf(place)) if (!zones.includes(zone)) zones.push(zone)
    }

    const km = meters / 1000
    const movingTime = profile.speed > 0 && km > 0
      ? Math.round((km / (profile.speed * (0.85 + rng() * 0.3))) * 3600)
      : Math.round((35 + rng() * 55) * 60)
    const climb = profile.climbPerKm * km * (place.hilly ? 1.8 : 0.7) * (0.6 + rng() * 0.8)

    const sport = SPORTS.find((s) => s.type === type)!
    activities.push({
      id: 10_000_000_000 + i * 7 + Math.floor(rng() * 7),
      name: nameFor(rng, sport.label, hour, place, home),
      sportType: type,
      startDate: utc.toISOString().replace(/\.\d{3}Z$/, "Z"),
      startDateLocal: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(hour)}:${pad(minute)}:${pad(local.getUTCSeconds())}`,
      distance: Math.round(meters * 10) / 10,
      movingTime,
      elapsedTime: Math.round(movingTime * (1.04 + rng() * 0.3)),
      elevationGain: Math.round(climb),
      polyline,
      zones,
      startZones: zonesOf(place),
    })
  }

  return activities.sort((a, b) => a.startDate.localeCompare(b.startDate))
}

/** Detailed streams for the detail panel in demo mode. */
export function syntheticStreams(activity: Activity, coords: ArrayLike<number>) {
  const rng = mulberry32(activity.id % 2_147_483_647)
  const points = coords.length / 2
  const distance: number[] = []
  const altitude: number[] = []
  let travelled = 0
  let altitudeNow = 550 + rng() * 900
  let slope = 0
  const hilliness = Math.max(0.5, activity.elevationGain / Math.max(1, activity.distance / 1000) / 10)
  for (let i = 0; i < points; i++) {
    if (i > 0) {
      travelled += haversine(coords[(i - 1) * 2], coords[(i - 1) * 2 + 1], coords[i * 2], coords[i * 2 + 1])
    }
    slope = slope * 0.92 + gaussian(rng) * 0.6 * hilliness
    altitudeNow = Math.max(0, altitudeNow + slope)
    distance.push(Math.round(travelled))
    altitude.push(Math.round(altitudeNow * 10) / 10)
  }
  return { distance, altitude }
}

/** Shape of `GET /athlete/activities` items, for the Strava API mock. */
export function toStravaSummary(activity: Activity, athleteId: number) {
  const first = activity.polyline ? decodePolyline(activity.polyline) : null
  const startLatLng = first && first.length >= 2 ? [first[1], first[0]] : []
  return {
    resource_state: 2,
    athlete: { id: athleteId, resource_state: 1 },
    id: activity.id,
    name: activity.name,
    distance: activity.distance,
    moving_time: activity.movingTime,
    elapsed_time: activity.elapsedTime,
    total_elevation_gain: activity.elevationGain,
    sport_type: activity.sportType,
    type: activity.sportType,
    start_date: activity.startDate,
    start_date_local: `${activity.startDateLocal}Z`,
    timezone: "(GMT+01:00) Europe/Madrid",
    start_latlng: startLatLng,
    map: {
      id: `a${activity.id}`,
      summary_polyline: activity.polyline ?? "",
      resource_state: 2,
    },
    trainer: !activity.polyline,
    manual: false,
    private: false,
    visibility: "everyone",
  }
}

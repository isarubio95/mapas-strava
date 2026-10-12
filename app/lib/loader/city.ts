/**
 * Procedural city for the loading screen: a warped street grid crossed by a
 * river, a couple of parks, and routes that wander its streets the way real
 * activities do (from home, along favourite avenues, often looping back).
 * Everything is deterministic for a given seed.
 */

export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type StreetKind = "minor" | "major" | "path"

export interface Street {
  kind: StreetKind
  /** Interleaved x, y. */
  points: Float32Array
}

export interface CityRoute {
  /** Strava `sport_type`, for the color. */
  sport: string
  /** Interleaved x, y. */
  points: Float32Array
  /** Distance from the start at each point. */
  distances: Float32Array
  /** Seconds after the loader starts when the route begins drawing. */
  start: number
  /** Seconds it takes to draw. */
  duration: number
}

export interface City {
  /** Half width and half height of the street grid. */
  extent: [number, number]
  streets: Street[]
  /** River centerline, interleaved x, y. */
  river: Float32Array
  riverWidth: number
  /** Park outlines, interleaved x, y. */
  parks: Float32Array[]
  /** Where most routes start. */
  home: [number, number]
  /** Sorted by start time. */
  routes: CityRoute[]
}

const COLS = 31
const ROWS = 23
const SPACING = 5
const SUBDIVISIONS = 4
const RIVER_HALF_WIDTH = 2.3
const EXTENT: [number, number] = [
  ((COLS - 1) / 2) * SPACING,
  ((ROWS - 1) / 2) * SPACING,
]

interface SportSpec {
  type: string
  share: number
  steps: [number, number]
  /** World units per second while drawing. */
  speed: number
  loops: number
}

const SPORTS: SportSpec[] = [
  { type: "Ride", share: 0.36, steps: [22, 58], speed: 34, loops: 0.7 },
  { type: "Run", share: 0.32, steps: [9, 24], speed: 20, loops: 0.85 },
  { type: "Walk", share: 0.12, steps: [5, 12], speed: 14, loops: 0.9 },
  { type: "Hike", share: 0.08, steps: [10, 20], speed: 15, loops: 0.6 },
  {
    type: "MountainBikeRide",
    share: 0.12,
    steps: [18, 40],
    speed: 28,
    loops: 0.6,
  },
]

interface Edge {
  a: number
  b: number
  kind: StreetKind
  /** Warped polyline from `a` to `b`. */
  points: Float32Array
  /** How much routes like this street. */
  weight: number
}

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

const between = (rng: Rng, min: number, max: number) =>
  min + (max - min) * rng()

/** Polyline lengths so far, point by point. */
export function cumulativeDistances(points: Float32Array) {
  const out = new Float32Array(points.length / 2)
  for (let i = 1; i < out.length; i++) {
    out[i] =
      out[i - 1] +
      Math.hypot(
        points[i * 2] - points[i * 2 - 2],
        points[i * 2 + 1] - points[i * 2 - 1]
      )
  }
  return out
}

/** Lateral normals of a polyline, one unit vector per point. */
function normals(points: Float32Array) {
  const n = points.length / 2
  const out = new Float32Array(points.length)
  for (let i = 0; i < n; i++) {
    const from = Math.max(0, i - 1)
    const to = Math.min(n - 1, i + 1)
    const dx = points[to * 2] - points[from * 2]
    const dy = points[to * 2 + 1] - points[from * 2 + 1]
    const length = Math.hypot(dx, dy) || 1
    out[i * 2] = -dy / length
    out[i * 2 + 1] = dx / length
  }
  return out
}

export function generateCity(seed = 7, routeCount = 420): City {
  const rng = mulberry32(seed)
  const [ex, ey] = EXTENT

  const phase = Array.from({ length: 8 }, () => rng() * Math.PI * 2)
  const warp = (x: number, y: number): [number, number] => [
    x +
      2.4 * Math.sin(y * 0.061 + phase[0]) +
      0.9 * Math.sin(y * 0.17 + phase[1]),
    y +
      2.4 * Math.sin(x * 0.053 + phase[2]) +
      0.9 * Math.sin(x * 0.19 + phase[3]),
  ]
  const riverY = (x: number) =>
    -0.3 * ey +
    6 * Math.sin(x * 0.045 + phase[4]) +
    2.5 * Math.sin(x * 0.11 + phase[5])

  // Lattice nodes, jittered but not yet warped.
  const nodeCount = COLS * ROWS
  const lattice = new Float32Array(nodeCount * 2)
  const alive = new Uint8Array(nodeCount)
  const index = (i: number, j: number) => j * COLS + i
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      const k = index(i, j)
      const x = (i - (COLS - 1) / 2) * SPACING + between(rng, -0.9, 0.9)
      const y = (j - (ROWS - 1) / 2) * SPACING + between(rng, -0.9, 0.9)
      lattice[k * 2] = x
      lattice[k * 2 + 1] = y
      alive[k] = Math.abs(y - riverY(x)) > RIVER_HALF_WIDTH + 0.7 ? 1 : 0
    }
  }

  // Parks: a few blocks whose inner streets become winding paths.
  const center = [(COLS - 1) / 2, (ROWS - 1) / 2]
  const parkCells: [i0: number, j0: number, i1: number, j1: number][] = [
    [center[0] + 3, center[1] + 1, center[0] + 6, center[1] + 3],
    [center[0] - 9, center[1] + 3, center[0] - 6, center[1] + 6],
  ]
  const inPark = (i: number, j: number) =>
    parkCells.some(([i0, j0, i1, j1]) => i > i0 && i < i1 && j > j0 && j < j1)
  const onParkPath = (ia: number, ja: number, ib: number, jb: number) =>
    parkCells.some(
      ([i0, j0, i1, j1]) =>
        Math.min(ia, ib) >= i0 &&
        Math.max(ia, ib) <= i1 &&
        Math.min(ja, jb) >= j0 &&
        Math.max(ja, jb) <= j1 &&
        (inPark(ia, ja) || inPark(ib, jb))
    )

  const isMajorRow = (j: number) => j % 6 === 3
  const isMajorCol = (i: number) => i % 7 === 1
  const diagonal = Math.round(center[0] - center[1])

  const edges: Edge[] = []
  const addEdge = (
    ia: number,
    ja: number,
    ib: number,
    jb: number,
    major: boolean,
    bridge = false
  ) => {
    const a = index(ia, ja)
    const b = index(ib, jb)
    if (!alive[a] || !alive[b]) return

    const ax = lattice[a * 2]
    const ay = lattice[a * 2 + 1]
    const bx = lattice[b * 2]
    const by = lattice[b * 2 + 1]
    const mx = (ax + bx) / 2
    const my = (ay + by) / 2
    const r = Math.hypot(mx / ex, my / ey)
    const path = onParkPath(ia, ja, ib, jb)

    // The river is crossed only by the bridges added on purpose.
    if (!bridge && Math.sign(ay - riverY(ax)) !== Math.sign(by - riverY(bx)))
      return

    // Thinner towards the outskirts, as cities are.
    const drop = major
      ? 0.45 * smoothstep(0.85, 1.1, r)
      : 0.05 + 0.6 * smoothstep(0.5, 1.0, r)
    if (!bridge && rng() < drop) return

    const kind: StreetKind = path ? "path" : major ? "major" : "minor"
    const bend = path ? between(rng, -1.2, 1.2) : 0
    const nx = -(by - ay) / SPACING
    const ny = (bx - ax) / SPACING
    const points = new Float32Array((SUBDIVISIONS + 1) * 2)
    for (let s = 0; s <= SUBDIVISIONS; s++) {
      const t = s / SUBDIVISIONS
      const lift = bend * Math.sin(Math.PI * t)
      const [x, y] = warp(
        ax + (bx - ax) * t + nx * lift,
        ay + (by - ay) * t + ny * lift
      )
      points[s * 2] = x
      points[s * 2 + 1] = y
    }
    const weight =
      (kind === "major"
        ? 2.6
        : kind === "path"
          ? 2.2
          : 0.4 + 1.6 * rng() ** 2) * (bridge ? 1.6 : 1)
    edges.push({ a, b, kind, points, weight })
  }

  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      if (i + 1 < COLS) addEdge(i, j, i + 1, j, isMajorRow(j))
      if (j + 1 < ROWS) addEdge(i, j, i, j + 1, isMajorCol(i))
      // A diagonal avenue through the middle of town.
      if (i + 1 < COLS && j + 1 < ROWS && i - j === diagonal) {
        addEdge(i, j, i + 1, j + 1, true)
      }
    }
  }

  // Bridges: no nodes survive on the water, so each one spans the gap between
  // the last street on one bank and the first on the other. Every avenue gets
  // one, and some side streets too.
  for (let i = 0; i < COLS; i++) {
    let south = -1
    for (let j = 0; j < ROWS; j++) {
      const k = index(i, j)
      if (!alive[k]) continue
      if (lattice[k * 2 + 1] < riverY(lattice[k * 2])) {
        south = j
        continue
      }
      const major = isMajorCol(i)
      if (south >= 0 && j - south <= 2 && (major || rng() < 0.3)) {
        addEdge(i, south, i, j, major, true)
      }
      break
    }
  }

  const adjacency: number[][] = Array.from({ length: nodeCount }, () => [])
  edges.forEach((edge, e) => {
    adjacency[edge.a].push(e)
    adjacency[edge.b].push(e)
  })

  const nearestNode = (x: number, y: number) => {
    let best = -1
    let bestDistance = Infinity
    for (let k = 0; k < nodeCount; k++) {
      if (adjacency[k].length < 3) continue
      const d = Math.hypot(lattice[k * 2] - x, lattice[k * 2 + 1] - y)
      if (d < bestDistance) {
        bestDistance = d
        best = k
      }
    }
    return best
  }

  const home = nearestNode(-1.5 * SPACING, 1.5 * SPACING)
  // Across the river, so routes cross the bridges and fill both banks.
  const work = nearestNode(4 * SPACING, -6 * SPACING)

  // Routes only start where they can reach home.
  const reachable = new Uint8Array(nodeCount)
  const queue = [home]
  reachable[home] = 1
  while (queue.length) {
    const node = queue.pop()!
    for (const e of adjacency[node]) {
      const other = edges[e].a === node ? edges[e].b : edges[e].a
      if (!reachable[other]) {
        reachable[other] = 1
        queue.push(other)
      }
    }
  }
  const reachableNodes = [...reachable.keys()].filter((k) => reachable[k])

  const pickStart = () => {
    const roll = rng()
    if (roll < 0.6) return home
    if (roll < 0.8 && reachable[work]) return work
    for (;;) {
      const k = reachableNodes[Math.floor(rng() * reachableNodes.length)]
      const r = Math.hypot(lattice[k * 2] / ex, lattice[k * 2 + 1] / ey)
      if (rng() < Math.exp(-r * r * 2.5)) return k
    }
  }

  const pickSport = () => {
    let roll = rng()
    for (const sport of SPORTS) {
      roll -= sport.share
      if (roll <= 0) return sport
    }
    return SPORTS[0]
  }

  const walk = (start: number, steps: number, loop: boolean) => {
    const used = new Map<number, number>()
    const path: { edge: number; forward: boolean }[] = []
    let node = start
    let previous = -1
    let hx = 0
    let hy = 0
    const sx = lattice[start * 2]
    const sy = lattice[start * 2 + 1]

    for (let step = 0; step < steps; step++) {
      const returning = loop && step > steps * 0.5
      const x = lattice[node * 2]
      const y = lattice[node * 2 + 1]
      const options: { edge: number; other: number; weight: number }[] = []
      let total = 0
      for (const e of adjacency[node]) {
        if (e === previous && adjacency[node].length > 1) continue
        const other = edges[e].a === node ? edges[e].b : edges[e].a
        const dx = lattice[other * 2] - x
        const dy = lattice[other * 2 + 1] - y
        const length = Math.hypot(dx, dy) || 1
        let weight = edges[e].weight / (1 + 2.5 * (used.get(e) ?? 0))
        if (step > 0) {
          // Keep going straight more often than turning.
          weight *= 0.35 + 1.6 * Math.max(0, (dx * hx + dy * hy) / length)
        }
        if (returning) {
          const closer =
            Math.hypot(lattice[other * 2] - sx, lattice[other * 2 + 1] - sy) <
            Math.hypot(x - sx, y - sy)
          weight *= closer ? 3.5 : 0.35
        }
        options.push({ edge: e, other, weight })
        total += weight
      }
      if (!options.length) break

      let roll = rng() * total
      let choice = options[options.length - 1]
      for (const option of options) {
        roll -= option.weight
        if (roll <= 0) {
          choice = option
          break
        }
      }
      path.push({ edge: choice.edge, forward: edges[choice.edge].a === node })
      used.set(choice.edge, (used.get(choice.edge) ?? 0) + 1)
      const dx = lattice[choice.other * 2] - x
      const dy = lattice[choice.other * 2 + 1] - y
      const length = Math.hypot(dx, dy) || 1
      hx = dx / length
      hy = dy / length
      previous = choice.edge
      node = choice.other
      if (returning && node === start) break
    }
    return path
  }

  const routes: CityRoute[] = []
  let clock = 0.1
  while (routes.length < routeCount) {
    const sport = pickSport()
    const steps = Math.round(between(rng, ...sport.steps))
    const path = walk(pickStart(), steps, rng() < sport.loops)
    if (path.length < 3) continue

    const raw: number[] = []
    for (const { edge, forward } of path) {
      const pts = edges[edge].points
      const n = pts.length / 2
      for (let s = raw.length ? 1 : 0; s < n; s++) {
        const p = forward ? s : n - 1 - s
        raw.push(pts[p * 2], pts[p * 2 + 1])
      }
    }

    // Each recording sits a little off the street center, as GPS does, so
    // repeated routes build up into thick, bright corridors.
    const points = new Float32Array(raw)
    const lateral = normals(points)
    const offset = (rng() + rng() + rng() - 1.5) * 0.32
    for (let i = 0; i < points.length / 2; i++) {
      const wobble = offset + between(rng, -0.05, 0.05)
      points[i * 2] += lateral[i * 2] * wobble
      points[i * 2 + 1] += lateral[i * 2 + 1] * wobble
    }

    const distances = cumulativeDistances(points)
    const length = distances[distances.length - 1]
    routes.push({
      sport: sport.type,
      points,
      distances,
      start: clock,
      duration: Math.min(4.2, Math.max(1.1, length / sport.speed)),
    })
    // Starts slowly, then the map fills faster and faster.
    const rate = 6 + 8 * smoothstep(0, 22, clock)
    clock += between(rng, 0.5, 1.5) / rate
  }

  const river: number[] = []
  for (let x = -ex * 1.4; x <= ex * 1.4; x += 1.5) {
    river.push(...warp(x, riverY(x)))
  }

  const parks = parkCells.map(([i0, j0, i1, j1]) => {
    const inset = 0.7
    const x0 = (i0 - center[0]) * SPACING + inset
    const x1 = (i1 - center[0]) * SPACING - inset
    const y0 = (j0 - center[1]) * SPACING + inset
    const y1 = (j1 - center[1]) * SPACING - inset
    const outline: number[] = []
    const side = (fx: number, fy: number, tx: number, ty: number) => {
      for (let s = 0; s < 8; s++) {
        const t = s / 8
        outline.push(...warp(fx + (tx - fx) * t, fy + (ty - fy) * t))
      }
    }
    side(x0, y0, x1, y0)
    side(x1, y0, x1, y1)
    side(x1, y1, x0, y1)
    side(x0, y1, x0, y0)
    return new Float32Array(outline)
  })

  return {
    extent: EXTENT,
    streets: edges.map(({ kind, points }) => ({ kind, points })),
    river: new Float32Array(river),
    riverWidth: RIVER_HALF_WIDTH * 2,
    parks,
    home: warp(lattice[home * 2], lattice[home * 2 + 1]),
    routes,
  }
}

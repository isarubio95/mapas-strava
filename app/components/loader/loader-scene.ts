import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  NormalBlending,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Blending,
} from "three"

import { hexToRgb } from "~/lib/color"
import { generateCity, type City, type CityRoute } from "~/lib/loader/city"
import { paletteForTheme } from "~/lib/map/style"
import { sportColor } from "~/lib/sports"
import type { Theme } from "~/lib/theme"

export interface LoaderScene {
  setTheme(theme: Theme): void
  setReducedMotion(reduced: boolean): void
  dispose(): void
}

/** Seconds the camera takes to pull back from home to the whole city. */
const PULL_BACK = 26
/** Seconds the bright head trails behind the tip of a drawing route. */
const HEAD = 0.35
const FOV = 38
const PAPER = "#fbf8f1"

// sRGB straight into the shaders: they skip three's color management.
const rgb = (hex: string) => {
  const [r, g, b] = hexToRgb(hex)
  return new Vector3(r / 255, g / 255, b / 255)
}

const easeInOut = (t: number) => -(Math.cos(Math.PI * Math.min(1, t)) - 1) / 2
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Fades the city out towards its edges and into the distance. */
const FADE = /* glsl */ `
  uniform vec2 uExtent;
  uniform float uFogNear;
  uniform float uFogFar;
  float fade(vec2 local, float depth) {
    float edge = 1.0 - smoothstep(0.55, 1.05, length(local / uExtent));
    return edge * (1.0 - smoothstep(uFogNear, uFogFar, depth));
  }
`

/**
 * Lines as ribbons whose width is set in world units but clamped to a pixel
 * range, like deck.gl's widthMinPixels/widthMaxPixels on the real map.
 */
const RIBBON_VERTEX = /* glsl */ `
  attribute vec2 aOffset;
  attribute float aSide;
  #ifdef ROUTE
    attribute float aTime;
    attribute vec3 aColor;
    varying float vTime;
    varying vec3 vColor;
  #endif
  uniform float uWidth;
  uniform float uMinPx;
  uniform float uMaxPx;
  uniform float uPxScale;
  varying float vSide;
  varying float vFade;
  ${FADE}
  void main() {
    vec4 center = modelViewMatrix * vec4(position, 1.0);
    float worldPerPx = max(-center.z * uPxScale, 1e-5);
    float width = clamp(uWidth / worldPerPx, uMinPx, uMaxPx) * worldPerPx;
    vec3 p = position + vec3(aOffset * width * 0.5, 0.0);
    vSide = aSide;
    vFade = fade(position.xy, -center.z);
    #ifdef ROUTE
      vTime = aTime;
      vColor = aColor;
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const RIBBON_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uSoft;
  #ifdef ROUTE
    uniform float uTime;
    uniform float uHead;
    uniform float uWhiten;
    uniform float uTint;
    uniform float uHeadBoost;
    varying float vTime;
    varying vec3 vColor;
  #endif
  varying float vSide;
  varying float vFade;
  void main() {
    float alpha = uOpacity * vFade;
    alpha *= mix(1.0, pow(1.0 - abs(vSide), 1.6), uSoft);
    vec3 color = uColor;
    #ifdef ROUTE
      if (vTime > uTime) discard;
      float head = 1.0 - smoothstep(0.0, uHead, uTime - vTime);
      color = mix(uColor, mix(vColor, vec3(1.0), uWhiten), uTint);
      color = mix(color, vec3(1.0), head * 0.55 * uTint);
      alpha *= 1.0 + head * uHeadBoost;
    #endif
    gl_FragColor = vec4(color, min(alpha, 1.0));
  }
`

const FILL_VERTEX = /* glsl */ `
  varying float vFade;
  ${FADE}
  void main() {
    vec4 center = modelViewMatrix * vec4(position, 1.0);
    vFade = fade(position.xy, -center.z);
    gl_Position = projectionMatrix * center;
  }
`

const FILL_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying float vFade;
  void main() {
    gl_FragColor = vec4(uColor, vFade);
  }
`

/** The bright dot at the tip of each route as it draws. */
const HEAD_VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute float aAlpha;
  uniform float uSize;
  uniform float uDpr;
  varying vec3 vColor;
  varying float vAlpha;
  ${FADE}
  void main() {
    vec4 center = modelViewMatrix * vec4(position, 1.0);
    vColor = aColor;
    vAlpha = aAlpha * fade(position.xy, -center.z);
    gl_PointSize = uSize * uDpr;
    gl_Position = projectionMatrix * center;
  }
`

const HEAD_FRAGMENT = /* glsl */ `
  uniform float uGlow;
  uniform vec3 uPaper;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord * 2.0 - 1.0);
    if (r > 1.0) discard;
    vec3 color;
    float alpha;
    if (uGlow > 0.5) {
      // Night: white-hot core in a colored glow.
      float core = 1.0 - smoothstep(0.14, 0.24, r);
      float glow = pow(1.0 - r, 2.4);
      color = mix(vColor, vec3(1.0), core);
      alpha = max(core, glow * 0.7);
    } else {
      // Day: an ink dot on a paper ring.
      float dot = 1.0 - smoothstep(0.24, 0.32, r);
      color = mix(uPaper, vColor, dot);
      alpha = 1.0 - smoothstep(0.42, 0.5, r);
    }
    gl_FragColor = vec4(color, alpha * vAlpha);
  }
`

interface RibbonOptions {
  route?: boolean
  /** Flat color; routes without one take their sport's color. */
  color?: string
  width: number
  minPx: number
  maxPx: number
  opacity: number
  soft?: number
  blending?: Blending
}

/** Two vertices per point, offset along the miter so joints stay closed. */
function ribbonGeometry(lines: Float32Array[], routes?: { times: Float32Array[]; colors: Vector3[] }) {
  let vertexCount = 0
  let indexCount = 0
  for (const line of lines) {
    const n = line.length / 2
    vertexCount += n * 2
    indexCount += (n - 1) * 6
  }
  const position = new Float32Array(vertexCount * 3)
  const offset = new Float32Array(vertexCount * 2)
  const side = new Float32Array(vertexCount)
  const time = routes ? new Float32Array(vertexCount) : null
  const color = routes ? new Float32Array(vertexCount * 3) : null
  const index = new Uint32Array(indexCount)

  let v = 0
  let i = 0
  lines.forEach((line, l) => {
    const n = line.length / 2
    const base = v
    for (let p = 0; p < n; p++) {
      const prev = Math.max(0, p - 1)
      const next = Math.min(n - 1, p + 1)
      let ax = line[p * 2] - line[prev * 2]
      let ay = line[p * 2 + 1] - line[prev * 2 + 1]
      let bx = line[next * 2] - line[p * 2]
      let by = line[next * 2 + 1] - line[p * 2 + 1]
      const al = Math.hypot(ax, ay)
      const bl = Math.hypot(bx, by)
      if (al) {
        ax /= al
        ay /= al
      }
      if (bl) {
        bx /= bl
        by /= bl
      }
      if (!al) [ax, ay] = [bx, by]
      if (!bl) [bx, by] = [ax, ay]
      // Tangent halfway between both segments; a U-turn keeps the outgoing one.
      let tx = ax + bx
      let ty = ay + by
      const tl = Math.hypot(tx, ty)
      if (tl < 1e-3) [tx, ty] = [bx, by]
      else [tx, ty] = [tx / tl, ty / tl]
      const nx = -ty
      const ny = tx
      const miter = 1 / Math.max(0.45, Math.abs(nx * -by + ny * bx))

      for (const s of [-1, 1]) {
        position[v * 3] = line[p * 2]
        position[v * 3 + 1] = line[p * 2 + 1]
        offset[v * 2] = nx * miter * s
        offset[v * 2 + 1] = ny * miter * s
        side[v] = s
        if (time && color && routes) {
          time[v] = routes.times[l][p]
          const c = routes.colors[l]
          color[v * 3] = c.x
          color[v * 3 + 1] = c.y
          color[v * 3 + 2] = c.z
        }
        v++
      }
    }
    for (let p = 0; p < n - 1; p++) {
      const a = base + p * 2
      index.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i)
      i += 6
    }
  })

  const geometry = new BufferGeometry()
  geometry.setAttribute("position", new BufferAttribute(position, 3))
  geometry.setAttribute("aOffset", new BufferAttribute(offset, 2))
  geometry.setAttribute("aSide", new BufferAttribute(side, 1))
  if (time) geometry.setAttribute("aTime", new BufferAttribute(time, 1))
  if (color) geometry.setAttribute("aColor", new BufferAttribute(color, 3))
  geometry.setIndex(new BufferAttribute(index, 1))
  return geometry
}

/** When each point of a route gets drawn: easing out like the map's reveal. */
function drawTimes(route: CityRoute) {
  const total = route.distances[route.distances.length - 1] || 1
  const out = new Float32Array(route.distances.length)
  for (let p = 0; p < out.length; p++) {
    out[p] =
      route.start +
      (2 / Math.PI) * Math.asin(Math.min(1, route.distances[p] / total)) * route.duration
  }
  return out
}

/** Where the tip of a route is at `time`, by distance along it. */
function headAt(route: CityRoute, time: number, out: Vector2) {
  const u = Math.min(1, Math.max(0, (time - route.start) / route.duration))
  const { distances, points } = route
  const target = Math.sin((u * Math.PI) / 2) * distances[distances.length - 1]
  let lo = 0
  let hi = distances.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (distances[mid] <= target) lo = mid
    else hi = mid
  }
  const span = distances[hi] - distances[lo] || 1
  const t = Math.min(1, Math.max(0, (target - distances[lo]) / span))
  return out.set(
    points[lo * 2] + (points[hi * 2] - points[lo * 2]) * t,
    points[lo * 2 + 1] + (points[hi * 2 + 1] - points[lo * 2 + 1]) * t
  )
}

const MAX_HEADS = 96

/**
 * Loading screen: a city like the real map, tilted in 3D, filling up with
 * routes that draw themselves as the camera pulls back and slowly turns.
 */
export function createLoaderScene(
  canvas: HTMLCanvasElement,
  { theme: initialTheme, reducedMotion: initialReduced }: { theme: Theme; reducedMotion: boolean }
): LoaderScene {
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const city: City = generateCity()
  const times = city.routes.map(drawTimes)

  const scene = new Scene()
  const camera = new PerspectiveCamera(FOV, 1, 0.5, 600)
  const pivot = new Group()
  scene.add(pivot)

  // Uniforms shared by every material, updated once per frame.
  const shared = {
    uExtent: { value: new Vector2(city.extent[0] + 6, city.extent[1] + 6) },
    uFogNear: { value: 60 },
    uFogFar: { value: 180 },
    uPxScale: { value: 0.01 },
    uTime: { value: 0 },
    uDpr: { value: renderer.getPixelRatio() },
  }

  let theme = initialTheme
  let reduced = initialReduced
  let content: Group | null = null
  let heads: { geometry: BufferGeometry; position: Float32Array; color: Float32Array; alpha: Float32Array } | null =
    null
  let routeColors: Vector3[] = []

  const materials: ShaderMaterial[] = []
  const geometries: BufferGeometry[] = []

  const ribbon = (geometry: BufferGeometry, options: RibbonOptions, order: number) => {
    const material = new ShaderMaterial({
      vertexShader: RIBBON_VERTEX,
      fragmentShader: RIBBON_FRAGMENT,
      defines: options.route ? { ROUTE: "" } : {},
      uniforms: {
        ...shared,
        uColor: { value: options.color ? rgb(options.color) : new Vector3() },
        uWidth: { value: options.width },
        uMinPx: { value: options.minPx },
        uMaxPx: { value: options.maxPx },
        uOpacity: { value: options.opacity },
        uSoft: { value: options.soft ?? 0 },
        uHead: { value: HEAD },
        uWhiten: { value: theme === "dark" ? 0.35 : 0 },
        uTint: { value: options.color ? 0 : 1 },
        uHeadBoost: { value: theme === "dark" ? 1.6 : 0 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: options.blending ?? NormalBlending,
    })
    materials.push(material)
    const mesh = new Mesh(geometry, material)
    mesh.renderOrder = order
    mesh.frustumCulled = false
    return mesh
  }

  const fill = (geometry: BufferGeometry, color: string, order: number) => {
    const material = new ShaderMaterial({
      vertexShader: FILL_VERTEX,
      fragmentShader: FILL_FRAGMENT,
      uniforms: { ...shared, uColor: { value: rgb(color) } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
    materials.push(material)
    geometries.push(geometry)
    const mesh = new Mesh(geometry, material)
    mesh.renderOrder = order
    mesh.frustumCulled = false
    return mesh
  }

  function build() {
    const dark = theme === "dark"
    const palette = paletteForTheme(theme)
    renderer.setClearColor(palette.land, 1)

    const group = new Group()

    for (const park of city.parks) {
      const shape = new Shape()
      for (let p = 0; p < park.length; p += 2) {
        if (p === 0) shape.moveTo(park[0], park[1])
        else shape.lineTo(park[p], park[p + 1])
      }
      group.add(fill(new ShapeGeometry(shape), palette.park, 0))
    }

    const river = ribbonGeometry([city.river])
    geometries.push(river)
    group.add(
      ribbon(river, { color: palette.water, width: city.riverWidth, minPx: 0, maxPx: 1e4, opacity: 1 }, 1)
    )

    const streetsOf = (kind: string) => city.streets.filter((street) => street.kind === kind).map((s) => s.points)
    const minor = ribbonGeometry(streetsOf("minor"))
    const path = ribbonGeometry(streetsOf("path"))
    const major = ribbonGeometry(streetsOf("major"))
    geometries.push(minor, path, major)
    group.add(
      ribbon(path, { color: palette.path, width: 0.18, minPx: 0.6, maxPx: 1.6, opacity: 1 }, 2),
      ribbon(minor, { color: palette.roadMinor, width: 0.26, minPx: 0.8, maxPx: 2.4, opacity: 1 }, 3),
      ribbon(major, { color: palette.roadMajor, width: 0.5, minPx: 1.2, maxPx: 4.2, opacity: 1 }, 4)
    )

    routeColors = city.routes.map((route) => rgb(sportColor(route.sport, theme)))
    const routes = ribbonGeometry(
      city.routes.map((route) => route.points),
      { times, colors: routeColors }
    )
    geometries.push(routes)

    if (dark) {
      // Additive, so repeated routes stack into bright corridors.
      group.add(
        ribbon(
          routes,
          { route: true, width: 1.3, minPx: 3, maxPx: 9, opacity: 0.16, soft: 1, blending: AdditiveBlending },
          5
        ),
        ribbon(routes, { route: true, width: 0.28, minPx: 0.9, maxPx: 2.4, opacity: 0.85 }, 6)
      )
    } else {
      group.add(
        ribbon(routes, { route: true, color: PAPER, width: 0.62, minPx: 2.8, maxPx: 5.6, opacity: 0.85 }, 5),
        ribbon(routes, { route: true, width: 0.3, minPx: 1.3, maxPx: 2.6, opacity: 0.92 }, 6)
      )
    }

    const headGeometry = new BufferGeometry()
    const headPosition = new Float32Array(MAX_HEADS * 3)
    const headColor = new Float32Array(MAX_HEADS * 3)
    const headAlpha = new Float32Array(MAX_HEADS)
    headGeometry.setAttribute("position", new BufferAttribute(headPosition, 3))
    headGeometry.setAttribute("aColor", new BufferAttribute(headColor, 3))
    headGeometry.setAttribute("aAlpha", new BufferAttribute(headAlpha, 1))
    headGeometry.setDrawRange(0, 0)
    geometries.push(headGeometry)
    const headMaterial = new ShaderMaterial({
      vertexShader: HEAD_VERTEX,
      fragmentShader: HEAD_FRAGMENT,
      uniforms: {
        ...shared,
        uSize: { value: dark ? 22 : 11 },
        uGlow: { value: dark ? 1 : 0 },
        uPaper: { value: rgb(PAPER) },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: dark ? AdditiveBlending : NormalBlending,
    })
    materials.push(headMaterial)
    const headPoints = new Points(headGeometry, headMaterial)
    headPoints.renderOrder = 7
    headPoints.frustumCulled = false
    group.add(headPoints)
    heads = { geometry: headGeometry, position: headPosition, color: headColor, alpha: headAlpha }

    content = group
    pivot.add(group)
  }

  function teardown() {
    if (content) pivot.remove(content)
    content = null
    heads = null
    for (const material of materials) material.dispose()
    for (const geometry of geometries) geometry.dispose()
    materials.length = 0
    geometries.length = 0
  }

  let width = 0
  let height = 0
  const resize = () => {
    width = canvas.clientWidth
    height = canvas.clientHeight
    if (!width || !height) return
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    shared.uPxScale.value = (2 * Math.tan((FOV * Math.PI) / 360)) / height
    if (reduced) render()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(canvas)

  const tip = new Vector2()
  let elapsed = 0

  function updateHeads(time: number) {
    if (!heads) return
    let count = 0
    if (!reduced) {
      for (let r = 0; r < city.routes.length && count < MAX_HEADS; r++) {
        const route = city.routes[r]
        if (route.start > time) break
        const age = time - route.start
        const end = route.duration
        // Fade in as the route starts, and out a moment after it arrives.
        const alpha = Math.min(1, age / 0.15) * (1 - Math.min(1, Math.max(0, (age - end) / 0.6)))
        if (alpha <= 0) continue
        headAt(route, time, tip)
        heads.position.set([tip.x, tip.y, 0], count * 3)
        const c = routeColors[r]
        heads.color.set([c.x, c.y, c.z], count * 3)
        heads.alpha[count] = alpha
        count++
      }
    }
    heads.geometry.setDrawRange(0, count)
    for (const name of ["position", "aColor", "aAlpha"]) {
      heads.geometry.getAttribute(name).needsUpdate = true
    }
  }

  function frame(time: number) {
    const u = reduced ? 1 : easeInOut(time / PULL_BACK)
    // Narrow screens see less of the city, so the camera backs off further.
    const aspect = width && height ? width / height : 1.6
    const fit = Math.max(1, 1.45 / aspect) ** 0.75
    const distance = lerp(30, 112, u) * fit
    const tilt = lerp(0.98, 0.7, u)
    const targetX = lerp(city.home[0], 0, u)
    const targetY = lerp(city.home[1], -6, u)
    const spin = reduced ? -0.18 : -0.42 + time * 0.016

    camera.position.set(0, -distance * Math.sin(tilt), distance * Math.cos(tilt))
    camera.lookAt(0, 0, 0)
    pivot.rotation.z = spin
    content?.position.set(-targetX, -targetY, 0)

    shared.uFogNear.value = distance * 0.85
    shared.uFogFar.value = distance * 2.1
    shared.uTime.value = reduced ? 1e6 : time
    updateHeads(time)
  }

  function render() {
    frame(elapsed)
    renderer.render(scene, camera)
  }

  let raf = 0
  let last = performance.now()
  const loop = (now: number) => {
    // Clamped so a hidden tab resumes where it left off instead of jumping.
    elapsed += Math.min(0.05, (now - last) / 1000)
    last = now
    render()
    raf = requestAnimationFrame(loop)
  }
  const start = () => {
    cancelAnimationFrame(raf)
    if (reduced) {
      render()
      return
    }
    last = performance.now()
    raf = requestAnimationFrame(loop)
  }

  build()
  resize()
  start()

  return {
    setTheme(next) {
      if (next === theme) return
      theme = next
      teardown()
      build()
      if (reduced) render()
    },
    setReducedMotion(next) {
      if (next === reduced) return
      reduced = next
      start()
    },
    dispose() {
      cancelAnimationFrame(raf)
      observer.disconnect()
      teardown()
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}

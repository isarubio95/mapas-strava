import type { Theme } from "~/lib/theme"

export type RGB = [number, number, number]
export type RGBA = [number, number, number, number]

export function hexToRgb(hex: string): RGB {
  let value = hex.replace("#", "").trim()
  if (value.length === 3) {
    value = value
      .split("")
      .map((char) => char + char)
      .join("")
  }
  const int = Number.parseInt(value.slice(0, 6), 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

export function rgbToHex([r, g, b]: RGB) {
  return `#${[r, g, b]
    .map((channel) =>
      Math.round(Math.min(255, Math.max(0, channel)))
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`
}

export function isHexColor(value: string) {
  return /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
}

export function normalizeHex(value: string) {
  return rgbToHex(hexToRgb(value))
}

/** Color as deck.gl expects it: 0–255 channels plus alpha. */
export function toRgba(hex: string, alpha = 1): RGBA {
  const [r, g, b] = hexToRgb(hex)
  return [r, g, b, Math.round(alpha * 255)]
}

const toLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
const fromLinear = (c: number) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055

type OKLCH = { l: number; c: number; h: number }

export function hexToOklch(hex: string): OKLCH {
  const [r, g, b] = hexToRgb(hex).map((channel) => toLinear(channel / 255))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { l: L, c: Math.hypot(A, B), h: Math.atan2(B, A) }
}

function oklchToLinear({ l, c, h }: OKLCH): RGB {
  const a = c * Math.cos(h)
  const b = c * Math.sin(h)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
}

const inGamut = (rgb: RGB) => rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4)

export function oklchToHex(color: OKLCH) {
  // Reduce chroma until the color fits in sRGB, keeping lightness and hue.
  let low = 0
  let high = color.c
  let rgb = oklchToLinear(color)
  if (!inGamut(rgb)) {
    for (let i = 0; i < 20; i++) {
      const mid = (low + high) / 2
      if (inGamut(oklchToLinear({ ...color, c: mid }))) low = mid
      else high = mid
    }
    rgb = oklchToLinear({ ...color, c: low })
  }
  return rgbToHex(rgb.map((c) => fromLinear(Math.min(1, Math.max(0, c))) * 255) as RGB)
}

const cache = new Map<string, string>()

/**
 * Keeps a color's hue but moves its lightness into the range that reads well
 * on each theme: bright enough to glow on the night map, deep enough to
 * contrast with cream by day.
 */
export function adaptToTheme(hex: string, theme: Theme) {
  const key = `${hex}:${theme}`
  const cached = cache.get(key)
  if (cached) return cached

  const color = hexToOklch(hex)
  const adapted =
    theme === "dark"
      ? { ...color, l: Math.min(0.93, Math.max(0.76, color.l)) }
      : {
          ...color,
          l: Math.min(0.6, Math.max(0.42, color.l - 0.24)),
          // Pastels turn grey when darkened, so they get extra chroma.
          c: Math.max(color.c * 1.08, Math.min(0.13, color.c * 1.9)),
        }
  const result = oklchToHex(adapted)
  cache.set(key, result)
  return result
}

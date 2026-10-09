import { useId } from "react"
import { cn } from "~/lib/utils"
import { useTheme } from "~/lib/theme"

const STARS = [
  [54, 13, 0.9],
  [61, 24, 0.7],
  [68, 8, 1.1],
  [76, 29, 0.6],
  [97, 9, 0.9],
  [103, 22, 0.7],
  [58, 33, 0.55],
  [92, 31, 0.6],
  [84, 5, 0.7],
] as const

/**
 * Day/night switch modelled on the Pinterest reference: golden sky with sun
 * and mountains by day (knob on the right), night sky with stars and a
 * crescent moon by night (knob on the left).
 *
 * The scene is driven by the `.dark` class on <html>, so server-rendered
 * markup already shows the right state before hydration.
 */
export function ThemeSwitch({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const id = useId()
  const isDark = theme === "dark"

  return (
    <button
      type="button"
      role="switch"
      data-theme-switch=""
      aria-checked={theme ? isDark : undefined}
      aria-label="Modo oscuro"
      title={isDark ? "Cambiar a modo día" : "Cambiar a modo noche"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "group/theme relative inline-flex aspect-[112/52] h-8 shrink-0 rounded-full outline-none",
        "shadow-[0_8px_16px_-8px_rgb(205_140_25/0.7)] transition-shadow duration-500 dark:shadow-[0_8px_16px_-8px_rgb(5_20_40/0.9)]",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      <svg viewBox="0 0 112 52" className="size-full" aria-hidden="true">
        <defs>
          <clipPath id={`${id}-pill`}>
            <rect width="112" height="52" rx="26" />
          </clipPath>
          <linearGradient id={`${id}-day`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fce58a" />
            <stop offset="1" stopColor="#f2bb3f" />
          </linearGradient>
          <linearGradient id={`${id}-night`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1b3650" />
            <stop offset="1" stopColor="#0d1f31" />
          </linearGradient>
          <radialGradient id={`${id}-sunglow`}>
            <stop offset="0.45" stopColor="#fffbe6" stopOpacity="0.9" />
            <stop offset="1" stopColor="#fff3b8" stopOpacity="0" />
          </radialGradient>
          <mask id={`${id}-crescent`}>
            <rect width="112" height="52" fill="white" />
            <circle cx="80" cy="16" r="8.4" fill="black" />
          </mask>
          <filter
            id={`${id}-knob`}
            x="-30%"
            y="-30%"
            width="160%"
            height="170%"
          >
            <feDropShadow
              dx="0"
              dy="1.5"
              stdDeviation="1.6"
              floodColor="#000"
              floodOpacity="0.28"
            />
          </filter>
        </defs>

        <g clipPath={`url(#${id}-pill)`}>
          <rect width="112" height="52" fill={`url(#${id}-night)`} />
          <rect
            width="112"
            height="52"
            fill={`url(#${id}-day)`}
            className="transition-opacity duration-500 ease-(--ease-out-expo) dark:opacity-0"
          />

          {STARS.map(([cx, cy, r], index) => (
            <circle
              key={index}
              cx={cx}
              cy={cy}
              r={r}
              fill="#fdfcf7"
              style={{ transitionDelay: `${120 + index * 35}ms` }}
              className="origin-center scale-50 opacity-0 transition-[opacity,scale] duration-500 [transform-box:fill-box] dark:scale-100 dark:opacity-100"
            />
          ))}

          <g className="transition-[translate,opacity] duration-500 ease-(--ease-out-expo) dark:translate-y-[26px] dark:opacity-0">
            <circle cx="30" cy="22" r="15" fill={`url(#${id}-sunglow)`} />
            <circle cx="30" cy="22" r="8.5" fill="#fffbea" />
          </g>

          <g
            mask={`url(#${id}-crescent)`}
            className="origin-center translate-y-[-22px] -rotate-45 opacity-0 transition-[translate,rotate,opacity] delay-100 duration-600 ease-(--ease-out-expo) [transform-box:fill-box] dark:translate-y-0 dark:rotate-0 dark:opacity-100"
          >
            <circle cx="85" cy="21" r="9" fill="#f6f3ea" />
          </g>

          <path
            d="M0 52V40l13-7 9 4 12-10 12 9 10-5 14 9 13-6 15 8 14-4v14z"
            className="fill-[#f0b44a] transition-[fill] duration-500 dark:fill-[#56768e]"
          />
          <path
            d="M0 52v-7l12-4 12 3 14-9 12 8 12-4 16 7 16-5 18 6v5z"
            className="fill-[#e39b30] transition-[fill] duration-500 dark:fill-[#3a576d]"
          />
          <path
            d="M34 27l12 9-6 2-3-5z M84 34l-4 7 8-1z"
            className="fill-[#f8c962] transition-[fill] duration-500 dark:fill-[#5d7d95]"
          />
        </g>

        <circle
          cx="26"
          cy="26"
          r="20"
          filter={`url(#${id}-knob)`}
          className="translate-x-[60px] fill-[#fbfaf6] transition-[translate,fill] duration-650 ease-(--ease-spring) dark:translate-x-0 dark:fill-[#f3f1ec]"
        />
      </svg>
    </button>
  )
}

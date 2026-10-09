import { cn } from "~/lib/utils"
import { getSport } from "~/lib/sports"

const SIZES = {
  xs: "size-6 [&>svg]:size-3.5",
  sm: "size-8 [&>svg]:size-4",
  md: "size-10 [&>svg]:size-5",
  lg: "size-14 [&>svg]:size-7",
} as const

/**
 * Sport tile in the style of icons.png: a squircle with the filled glyph in
 * the sport's color and a soft glow rising from the bottom edge.
 */
export function SportIcon({
  type,
  color,
  size = "md",
  className,
  label,
}: {
  type: string
  /** Theme-adapted color; defaults to the sport's own color. */
  color?: string
  size?: keyof typeof SIZES
  className?: string
  /** Accessible name; omit when a visible label sits next to the tile. */
  label?: string
}) {
  const sport = getSport(type)
  const Icon = sport.icon
  const tint = color ?? sport.color

  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ "--sport": tint } as React.CSSProperties}
      className={cn(
        "relative isolate inline-grid shrink-0 place-items-center overflow-hidden rounded-[32%] bg-(image:--tile) shadow-[inset_0_1px_0_var(--tile-edge),0_0_0_1px_var(--tile-edge)]",
        "supports-[corner-shape:squircle]:rounded-[50%] supports-[corner-shape:squircle]:[corner-shape:squircle]",
        SIZES[size],
        className
      )}
    >
      <span className="absolute inset-x-[12%] -bottom-[38%] -z-10 h-[70%] rounded-full bg-(--sport) opacity-45 blur-[6px] dark:opacity-60" />
      <Icon
        weight="fill"
        className="text-(--sport) drop-shadow-[0_0_5px_color-mix(in_oklab,var(--sport)_55%,transparent)]"
      />
    </span>
  )
}

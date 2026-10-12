import {
  MapTrifoldIcon,
  MountainsIcon,
  RoadHorizonIcon,
  TimerIcon,
  type Icon,
} from "@phosphor-icons/react"

import { formatCount, formatHours, formatKm } from "~/lib/format"
import type { Summary } from "~/lib/map/engine"
import { cn } from "~/lib/utils"

/**
 * The figures for what the map shows. With `icons`, each one carries a small
 * duotone icon in its own colour; inside a narrow `@container` the icons step
 * aside so the numbers keep the room.
 */
export function Stats({
  summary,
  className,
  compact = false,
  icons = false,
}: {
  summary: Summary | null
  className?: string
  compact?: boolean
  icons?: boolean
}) {
  if (!summary) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        Cargando rutas…
      </p>
    )
  }

  const items: {
    value: string
    unit: string
    icon: Icon
    color: string
  }[] = [
    {
      value: formatKm(summary.distance),
      unit: "km",
      icon: RoadHorizonIcon,
      color: "text-stat-distance",
    },
    {
      value: formatHours(summary.movingTime),
      unit: "h",
      icon: TimerIcon,
      color: "text-stat-time",
    },
    {
      value: formatCount(summary.count),
      unit: summary.count === 1 ? "ruta" : "rutas",
      icon: MapTrifoldIcon,
      color: "text-stat-routes",
    },
    ...(compact
      ? []
      : [
          {
            value: formatCount(Math.round(summary.elevationGain)),
            unit: "m+",
            icon: MountainsIcon,
            color: "text-stat-climb",
          },
        ]),
  ]

  return (
    <dl className={cn("flex items-baseline gap-3 tabular-nums", className)}>
      {items.map((item) => (
        <div key={item.unit} className="flex items-baseline gap-1">
          {icons && (
            <item.icon
              weight="duotone"
              aria-hidden
              className={cn(
                "size-3.5 shrink-0 self-center @max-[16rem]:hidden",
                item.color
              )}
            />
          )}
          <dt className="sr-only">{item.unit}</dt>
          <dd className="text-lg font-semibold tracking-tight">{item.value}</dd>
          <span className="text-xs text-muted-foreground">{item.unit}</span>
        </div>
      ))}
    </dl>
  )
}

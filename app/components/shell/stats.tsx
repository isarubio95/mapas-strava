import { formatCount, formatHours, formatKm } from "~/lib/format"
import type { Summary } from "~/lib/map/engine"
import { cn } from "~/lib/utils"

export function Stats({
  summary,
  className,
  compact = false,
}: {
  summary: Summary | null
  className?: string
  compact?: boolean
}) {
  if (!summary) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        Cargando rutas…
      </p>
    )
  }

  const items = [
    { value: formatKm(summary.distance), unit: "km" },
    { value: formatHours(summary.movingTime), unit: "h" },
    { value: formatCount(summary.count), unit: "salidas" },
    ...(compact
      ? []
      : [{ value: formatCount(Math.round(summary.elevationGain)), unit: "m+" }]),
  ]

  return (
    <dl className={cn("flex items-baseline gap-3 tabular-nums", className)}>
      {items.map((item) => (
        <div key={item.unit} className="flex items-baseline gap-1">
          <dt className="sr-only">{item.unit}</dt>
          <dd className="text-lg font-semibold tracking-tight">{item.value}</dd>
          <span className="text-xs text-muted-foreground">{item.unit}</span>
        </div>
      ))}
    </dl>
  )
}

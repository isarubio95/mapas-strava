import { SportIcon } from "~/components/sport-icon"
import type { Filters } from "~/lib/filters"
import { getSport, sportColor } from "~/lib/sports"
import type { Theme } from "~/lib/theme"
import { cn } from "~/lib/utils"

export function SportsRail({
  sports,
  filters,
  onChange,
  theme,
  orientation = "vertical",
}: {
  /** Sport types the user has activities of, in display order. */
  sports: string[]
  filters: Filters
  onChange: (filters: Filters) => void
  theme: Theme
  orientation?: "vertical" | "horizontal"
}) {
  const selected = filters.sports
  if (!sports.length) return null

  const toggle = (type: string) => {
    onChange({
      ...filters,
      sports: (() => {
        if (!selected) return [type]
        const next = selected.includes(type)
          ? selected.filter((item) => item !== type)
          : [...selected, type]
        return next.length ? next : null
      })(),
    })
  }

  return (
    <div
      role="toolbar"
      aria-label="Deportes"
      className={cn(
        "flex gap-1.5",
        orientation === "vertical" ? "flex-col" : "flex-row flex-wrap"
      )}
    >
      {sports.map((type) => {
        const sport = getSport(type)
        const on = !selected || selected.includes(type)
        const pressed = Boolean(selected?.includes(type))
        return (
          <button
            key={type}
            type="button"
            aria-pressed={pressed}
            aria-label={sport.label}
            title={sport.label}
            onClick={() => toggle(type)}
            className={cn(
              "rounded-[32%] transition-opacity",
              on ? "opacity-100" : "opacity-35"
            )}
          >
            <SportIcon type={type} color={sportColor(type, theme)} size="sm" />
          </button>
        )
      })}
      {selected && (
        <button
          type="button"
          className="h-8 rounded-full px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => onChange({ ...filters, sports: null })}
        >
          Todos
        </button>
      )}
    </div>
  )
}

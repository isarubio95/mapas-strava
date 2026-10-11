import { useMemo, useState, type KeyboardEvent } from "react"

import { RouteMapIcon } from "~/components/route-map-icon"
import { SportIcon } from "~/components/sport-icon"
import { Button } from "~/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog"
import { Kbd } from "~/components/ui/kbd"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import type { Activity } from "~/lib/activities"
import { formatCount, formatKm } from "~/lib/format"
import {
  EMPTY_ROUTE_QUERY,
  indexRoutes,
  ROUTE_ORDERS,
  routeFacets,
  searchRoutes,
  type RouteOrder,
  type RouteQuery,
} from "~/lib/route-search"
import { getSport, sportColor, type SportColors } from "~/lib/sports"
import type { Theme } from "~/lib/theme"
import { cn } from "~/lib/utils"

/** Rows rendered at once; past this, the query should narrow it down. */
const LIMIT = 100

const DATE = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

/** Scrolls sideways; the fading edge hints at chips past it. */
const CHIP_ROW =
  "flex min-w-0 gap-1.5 overflow-x-auto pr-6 [scrollbar-width:none] mask-r-from-[calc(100%-2rem)] [&::-webkit-scrollbar]:hidden"

/**
 * Finder for one route: by title, sport and year. Picking one shows it alone
 * on the map. The query survives closing, so the next result is one step away.
 */
export function RouteSearch({
  open,
  onOpenChange,
  activities,
  selectedId,
  theme,
  sportColors,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  activities: Activity[]
  selectedId: number | null
  theme: Theme
  sportColors?: SportColors
  onPick: (id: number) => void
}) {
  const [query, setQuery] = useState<RouteQuery>(EMPTY_ROUTE_QUERY)
  const entries = useMemo(() => indexRoutes(activities), [activities])
  const results = useMemo(() => searchRoutes(entries, query), [entries, query])
  const facets = useMemo(() => routeFacets(entries, query), [entries, query])
  const shown = results.slice(0, LIMIT)
  // The highlighted row. cmdk loses it when the rows change under it, so a
  // row that is gone hands the highlight to the first one.
  const [highlight, setHighlight] = useState("")
  const active = shown.some((activity) => String(activity.id) === highlight)
    ? highlight
    : String(shown[0]?.id ?? "")
  const filtered =
    query.text.trim() !== "" || query.sport != null || query.year != null

  const update = (patch: Partial<RouteQuery>) =>
    setQuery((current) => ({ ...current, ...patch }))

  // cmdk picks the highlighted route on Enter anywhere inside it; let the
  // chips and the order menu keep their own keys.
  const keepKeys = (event: KeyboardEvent) => {
    if (["Enter", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key))
      event.stopPropagation()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[10svh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <DialogTitle className="sr-only">Buscar una ruta</DialogTitle>
        <DialogDescription className="sr-only">
          Elige una ruta para verla sola en el mapa.
        </DialogDescription>
        <Command
          shouldFilter={false}
          loop
          value={active}
          onValueChange={setHighlight}
          className="rounded-none bg-transparent p-2"
        >
          <CommandInput
            value={query.text}
            onValueChange={(text) => update({ text })}
            placeholder="Busca por título…"
            aria-label="Título de la ruta"
          />

          <div
            className="flex flex-col gap-2 px-1 pt-3 pb-2"
            onKeyDown={keepKeys}
          >
            <div role="group" aria-label="Deporte" className={CHIP_ROW}>
              <Button
                type="button"
                size="sm"
                variant={query.sport ? "outline" : "default"}
                aria-pressed={!query.sport}
                onClick={() => update({ sport: null })}
              >
                Todos
              </Button>
              {facets.sports.map(({ type, count }) => {
                const pressed = query.sport === type
                return (
                  <Button
                    key={type}
                    type="button"
                    size="sm"
                    variant={pressed ? "default" : "outline"}
                    aria-pressed={pressed}
                    disabled={count === 0 && !pressed}
                    className="pl-1"
                    onClick={() => update({ sport: pressed ? null : type })}
                  >
                    <SportIcon
                      type={type}
                      color={sportColor(type, theme, sportColors)}
                      size="xs"
                    />
                    {getSport(type).label}
                    <span className="tabular-nums opacity-60">{count}</span>
                  </Button>
                )
              })}
            </div>

            <div className="flex items-center gap-2">
              <div
                role="group"
                aria-label="Año"
                className={cn(CHIP_ROW, "flex-1")}
              >
                <Button
                  type="button"
                  size="xs"
                  variant={query.year ? "outline" : "default"}
                  aria-pressed={!query.year}
                  onClick={() => update({ year: null })}
                >
                  Todos los años
                </Button>
                {facets.years.map(({ year, count }) => {
                  const pressed = query.year === year
                  return (
                    <Button
                      key={year}
                      type="button"
                      size="xs"
                      variant={pressed ? "default" : "outline"}
                      aria-pressed={pressed}
                      disabled={count === 0 && !pressed}
                      onClick={() => update({ year: pressed ? null : year })}
                    >
                      {year}
                    </Button>
                  )
                })}
              </div>
              <Select
                items={ROUTE_ORDERS}
                value={query.order}
                onValueChange={(order) =>
                  order && update({ order: order as RouteOrder })
                }
              >
                <SelectTrigger
                  size="sm"
                  aria-label="Orden"
                  className="shrink-0"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROUTE_ORDERS.map((order) => (
                    <SelectItem key={order.value} value={order.value}>
                      {order.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <CommandList className="max-h-[min(26rem,48svh)] border-t border-border/50 pt-1">
            <CommandEmpty className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              {entries.length === 0
                ? "Aún no hay rutas con GPS."
                : "Ninguna ruta coincide."}
              {filtered && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setQuery({ ...EMPTY_ROUTE_QUERY, order: query.order })
                  }
                >
                  Quitar filtros
                </Button>
              )}
            </CommandEmpty>
            {shown.length > 0 && (
              <CommandGroup>
                {shown.map((activity) => (
                  <RouteItem
                    key={activity.id}
                    activity={activity}
                    current={activity.id === selectedId}
                    color={sportColor(activity.sportType, theme, sportColors)}
                    onPick={onPick}
                  />
                ))}
              </CommandGroup>
            )}
          </CommandList>

          <div className="flex items-center justify-between gap-3 border-t border-border/50 px-3 pt-2 pb-1 text-xs text-muted-foreground">
            <span aria-live="polite" className="tabular-nums">
              {results.length > LIMIT
                ? `Primeras ${LIMIT} de ${formatCount(results.length)} rutas`
                : results.length === 1
                  ? "1 ruta"
                  : `${formatCount(results.length)} rutas`}
            </span>
            <span className="hidden items-center gap-1 sm:flex">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              <span className="mr-2">moverte</span>
              <Kbd>↵</Kbd>
              <span>verla sola</span>
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

function RouteItem({
  activity,
  current,
  color,
  onPick,
}: {
  activity: Activity
  current: boolean
  color: string
  onPick: (id: number) => void
}) {
  const when = new Date(activity.startDateLocal)
  const date = Number.isNaN(when.getTime())
    ? activity.startDateLocal.slice(0, 10)
    : DATE.format(when)

  return (
    <CommandItem
      value={String(activity.id)}
      data-checked={current}
      className="gap-3"
      onSelect={() => onPick(activity.id)}
    >
      <SportIcon type={activity.sportType} color={color} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{activity.name}</span>
        <span className="text-xs font-normal text-muted-foreground">
          {date} · {getSport(activity.sportType).label}
        </span>
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatKm(activity.distance)} km
      </span>
    </CommandItem>
  )
}

/** Opens the route finder; `variant` fits it to each layout. */
export function RouteSearchButton({
  onClick,
  variant = "pill",
  className,
}: {
  onClick: () => void
  variant?: "pill" | "field" | "icon"
  className?: string
}) {
  if (variant === "icon") {
    return (
      <button
        type="button"
        aria-label="Buscar ruta"
        onClick={onClick}
        className={cn(
          "panel inline-flex size-12.5 items-center justify-center rounded-4xl",
          className
        )}
      >
        <RouteMapIcon />
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Buscar ruta"
      aria-keyshortcuts="/ Control+K"
      className={cn(
        "inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
        variant === "pill"
          ? "panel h-12.5 rounded-4xl px-2.5 lg:pr-4"
          : "h-10 w-full rounded-3xl bg-input/50 pr-3 pl-2",
        className
      )}
    >
      <RouteMapIcon className={cn(variant === "field" && "size-6")} />
      <span className={cn(variant === "pill" && "sr-only lg:not-sr-only")}>
        Buscar ruta
      </span>
      <Kbd
        className={cn("ml-auto", variant === "pill" && "hidden lg:inline-flex")}
      >
        /
      </Kbd>
    </button>
  )
}

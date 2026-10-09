import { MapPinIcon } from "@phosphor-icons/react"
import type { ReactNode } from "react"

import { Button } from "~/components/ui/button"
import { Field, FieldLabel } from "~/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Slider } from "~/components/ui/slider"
import { EMPTY_FILTERS, NEAR_RADII, type Filters } from "~/lib/filters"
import type { Zone } from "~/lib/activities"

const YEARS = ["2026", "2025", "2024", "2023"] as const

const PLACES = [
  { id: "city:28079", name: "Madrid" },
  { id: "city:08019", name: "Barcelona" },
  { id: "city:46250", name: "València" },
  { id: "city:41091", name: "Sevilla" },
  { id: "city:48020", name: "Bilbao" },
  { id: "country:ES", name: "España" },
  { id: "country:PT", name: "Portugal" },
  { id: "country:FR", name: "Francia" },
] as const

export function FiltersForm({
  filters,
  onChange,
  pickingPoint,
  onPickPoint,
  maxKm,
}: {
  filters: Filters
  onChange: (filters: Filters) => void
  pickingPoint: boolean
  onPickPoint: () => void
  maxKm: number
  zones?: Zone[]
}) {
  const distance = [filters.minKm ?? 0, filters.maxKm ?? maxKm]

  return (
    <div className="flex flex-col gap-5">
      <Field>
        <FieldLabel>Año</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          <Chip
            pressed={!filters.from}
            onClick={() => onChange({ ...filters, from: null, to: null })}
          >
            Todos
          </Chip>
          {YEARS.map((year) => (
            <Chip
              key={year}
              pressed={filters.from === `${year}-01-01`}
              onClick={() =>
                onChange({ ...filters, from: `${year}-01-01`, to: `${year}-12-31` })
              }
            >
              {year}
            </Chip>
          ))}
        </div>
      </Field>

      <Field>
        <FieldLabel>Lugar</FieldLabel>
        <Select
          value={filters.zone ?? "all"}
          onValueChange={(value) =>
            onChange({
              ...filters,
              zone: !value || value === "all" ? null : String(value),
            })
          }
        >
          <SelectTrigger className="w-full bg-background/60" size="sm">
            <SelectValue placeholder="Cualquier lugar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Cualquier lugar</SelectItem>
            <SelectGroup>
              <SelectLabel>Sitios frecuentes</SelectLabel>
              {PLACES.map((place) => (
                <SelectItem key={place.id} value={place.id}>
                  {place.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {filters.zone && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip
              pressed={filters.zoneMode === "passes"}
              onClick={() => onChange({ ...filters, zoneMode: "passes" })}
            >
              Las que pasan
            </Chip>
            <Chip
              pressed={filters.zoneMode === "starts"}
              onClick={() => onChange({ ...filters, zoneMode: "starts" })}
            >
              Solo las que empiezan
            </Chip>
          </div>
        )}
      </Field>

      <Field>
        <div className="flex items-baseline justify-between gap-2">
          <FieldLabel>Distancia</FieldLabel>
          <span className="text-xs tabular-nums text-muted-foreground">
            {distance[0]}–{distance[1]} km
          </span>
        </div>
        <Slider
          min={0}
          max={maxKm}
          step={1}
          value={distance}
          onValueChange={(value) => {
            const [min, max] = value as number[]
            onChange({
              ...filters,
              minKm: min <= 0 ? null : min,
              maxKm: max >= maxKm ? null : max,
            })
          }}
        />
      </Field>

      <Field>
        <FieldLabel>Cerca de un punto</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={pickingPoint || filters.near ? "default" : "outline"}
            onClick={onPickPoint}
          >
            <MapPinIcon data-icon="inline-start" weight="fill" />
            {filters.near ? "Mover chincheta" : "Elegir en el mapa"}
          </Button>
          {filters.near && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onChange({ ...filters, near: null })}
            >
              Quitar
            </Button>
          )}
        </div>
        {filters.near && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {NEAR_RADII.map((radius) => (
              <Chip
                key={radius}
                pressed={filters.near?.radius === radius}
                onClick={() =>
                  onChange({
                    ...filters,
                    near: filters.near ? { ...filters.near, radius } : null,
                  })
                }
              >
                {radius < 1000 ? `${radius} m` : `${radius / 1000} km`}
              </Chip>
            ))}
          </div>
        )}
      </Field>

      {(filters.sports ||
        filters.from ||
        filters.zone ||
        filters.near ||
        filters.minKm != null ||
        filters.maxKm != null) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => onChange(EMPTY_FILTERS)}
        >
          Quitar filtros
        </Button>
      )}
    </div>
  )
}

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      size="xs"
      variant={pressed ? "default" : "outline"}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

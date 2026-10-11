import { CrosshairSimpleIcon, XIcon } from "@phosphor-icons/react"

import { Button } from "~/components/ui/button"
import type { Activity } from "~/lib/activities"
import { formatHours, formatKm } from "~/lib/format"
import { getSport, sportColor } from "~/lib/sports"
import type { Theme } from "~/lib/theme"

export function DetailPanel({
  activity,
  overlapped,
  profile,
  theme,
  focused,
  onFocus,
  onSelect,
  onClose,
}: {
  activity: Activity
  overlapped: Activity[]
  profile: { distance: number[]; altitude: number[] } | null
  theme: Theme
  /** Only this route is on the map. */
  focused: boolean
  onFocus: (focused: boolean) => void
  onSelect: (id: number) => void
  onClose: () => void
}) {
  const sport = getSport(activity.sportType)
  const color = sportColor(activity.sportType, theme)
  const when = new Date(activity.startDateLocal)
  const date = Number.isNaN(when.getTime())
    ? activity.startDateLocal.slice(0, 10)
    : when.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })

  return (
    <aside className="panel pointer-events-auto w-[22rem] max-w-[calc(100vw-2rem)] rounded-4xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{sport.label}</p>
          <h2 className="text-lg font-semibold tracking-tight">{activity.name}</h2>
          <p className="text-sm text-muted-foreground">{date}</p>
        </div>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Cerrar detalle" onClick={onClose}>
          <XIcon />
        </Button>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-sm tabular-nums">
        <Stat label="Distancia" value={`${formatKm(activity.distance)} km`} />
        <Stat label="Tiempo" value={`${formatHours(activity.movingTime)} h`} />
        <Stat label="Desnivel" value={`${Math.round(activity.elevationGain)} m`} />
      </dl>

      {profile && profile.altitude.length > 1 && (
        <Elevation distance={profile.distance} altitude={profile.altitude} color={color} />
      )}

      {overlapped.length > 1 && (
        <ul className="mt-4 flex max-h-36 flex-col gap-1 overflow-auto">
          {overlapped.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="w-full rounded-2xl px-2 py-1.5 text-left text-sm hover:bg-muted aria-current:bg-muted"
                aria-current={item.id === activity.id}
                onClick={() => onSelect(item.id)}
              >
                {item.name}
                <span className="ml-2 text-muted-foreground">{formatKm(item.distance)} km</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between gap-2">
        <a
          className="inline-flex text-sm font-medium text-primary underline"
          href={`https://www.strava.com/activities/${activity.id}`}
          target="_blank"
          rel="noreferrer"
        >
          View on Strava
        </a>
        {activity.polyline && (
          <Button
            type="button"
            size="sm"
            variant={focused ? "default" : "outline"}
            aria-pressed={focused}
            onClick={() => onFocus(!focused)}
          >
            <CrosshairSimpleIcon data-icon="inline-start" weight="bold" />
            Solo esta ruta
          </Button>
        )}
      </div>
    </aside>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  )
}

function Elevation({
  distance,
  altitude,
  color,
}: {
  distance: number[]
  altitude: number[]
  color: string
}) {
  const width = 280
  const height = 72
  const min = Math.min(...altitude)
  const max = Math.max(...altitude)
  const span = max - min || 1
  const last = distance[distance.length - 1] || 1
  const points = altitude
    .map((value, index) => {
      const x = (distance[index] / last) * width
      const y = height - ((value - min) / span) * (height - 8) - 4
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 h-20 w-full" role="img" aria-label="Perfil de altitud">
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
    </svg>
  )
}

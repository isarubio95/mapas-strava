import { StopIcon } from "@phosphor-icons/react"
import { useId, useMemo, useSyncExternalStore, type CSSProperties } from "react"

import { Button } from "~/components/ui/button"
import type { Activity, ActivityProfile } from "~/lib/activities"
import { formatKm } from "~/lib/format"
import type { FlyoverProgress } from "~/lib/map/flyover"
import { cn } from "~/lib/utils"

const WIDTH = 320
const HEIGHT = 48
/** Enough points for a smooth profile at HUD size. */
const MAX_POINTS = 240

/** Altitude `share` of the way along the profile. */
function altitudeAt({ distance, altitude }: ActivityProfile, share: number) {
  const target = share * distance[distance.length - 1]
  let i = 1
  while (i < distance.length - 1 && distance[i] < target) i++
  const span = distance[i] - distance[i - 1]
  const t = span > 0 ? (target - distance[i - 1]) / span : 0
  return (
    altitude[i - 1] +
    (altitude[i] - altitude[i - 1]) * Math.min(1, Math.max(0, t))
  )
}

/**
 * What the camera is flying over: the route's elevation profile lighting up
 * as it goes, distance covered and current altitude.
 */
export function FlyoverHud({
  activity,
  color,
  profile,
  progress,
  onStop,
  className,
}: {
  activity: Activity
  color: string
  profile: ActivityProfile | null
  progress: FlyoverProgress
  onStop: () => void
  className?: string
}) {
  const share = useSyncExternalStore(progress.subscribe, progress.get, () => 0)
  const clipId = useId()
  const usable = profile && profile.altitude.length > 1 ? profile : null

  const shape = useMemo(() => {
    if (!usable) return null
    const { distance, altitude } = usable
    const last = distance[distance.length - 1] || 1
    const step = Math.max(1, Math.ceil(altitude.length / MAX_POINTS))
    let min = Infinity
    let max = -Infinity
    for (const value of altitude) {
      min = Math.min(min, value)
      max = Math.max(max, value)
    }
    const span = max - min || 1
    const y = (value: number) =>
      HEIGHT - 3 - ((value - min) / span) * (HEIGHT - 8)
    const points: string[] = []
    for (let i = 0; i < altitude.length; i += step) {
      points.push(
        `${((distance[i] / last) * WIDTH).toFixed(1)},${y(altitude[i]).toFixed(1)}`
      )
    }
    points.push(`${WIDTH},${y(altitude[altitude.length - 1]).toFixed(1)}`)
    const line = points.join(" ")
    return { line, area: `0,${HEIGHT} ${line} ${WIDTH},${HEIGHT}`, y }
  }, [usable])

  const altitude = usable ? altitudeAt(usable, share) : null
  const markerTop =
    shape && altitude != null ? (shape.y(altitude) / HEIGHT) * 100 : 50

  return (
    <section
      aria-label={`Recorrido de ${activity.name}`}
      className={cn(
        "panel pointer-events-auto w-[34rem] max-w-[calc(100vw-1.5rem)] rounded-4xl px-5 pt-4 pb-3.5",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="truncate text-base font-semibold tracking-tight">
          {activity.name}
        </h2>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 rounded-4xl"
          onClick={onStop}
        >
          <StopIcon data-icon="inline-start" weight="fill" />
          Detener
        </Button>
      </div>

      <div
        role="progressbar"
        aria-label="Avance del recorrido"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(share * 100)}
        className="relative mt-3 h-12"
      >
        {shape ? (
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="none"
            className="size-full overflow-visible"
            aria-hidden
          >
            <defs>
              <clipPath id={clipId}>
                <rect x="0" y="-4" width={share * WIDTH} height={HEIGHT + 8} />
              </clipPath>
            </defs>
            <polygon points={shape.area} className="fill-muted-foreground/10" />
            <polyline
              points={shape.line}
              fill="none"
              className="stroke-muted-foreground/40"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
            <g clipPath={`url(#${clipId})`}>
              <polygon points={shape.area} fill={color} fillOpacity="0.28" />
              <polyline
                points={shape.line}
                fill="none"
                stroke={color}
                strokeWidth="2.25"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </svg>
        ) : (
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${share * 100}%`, background: color }}
            />
          </div>
        )}
        <span
          aria-hidden
          className="absolute size-3 -translate-1/2 rounded-full border-2 border-card shadow-[0_0_0_4px_rgb(0_0_0/0.08),0_0_16px_2px_var(--glow-color)]"
          style={
            {
              left: `${share * 100}%`,
              top: `${markerTop}%`,
              background: color,
              "--glow-color": `${color}99`,
            } as CSSProperties
          }
        />
      </div>

      <dl className="mt-2 flex items-baseline justify-between gap-3 text-sm tabular-nums">
        <div className="flex items-baseline gap-1.5">
          <dt className="sr-only">Distancia recorrida</dt>
          <dd className="text-lg font-semibold tracking-tight">
            {formatKm(share * activity.distance, 1)}
          </dd>
          <span className="text-muted-foreground">
            de {formatKm(activity.distance)} km
          </span>
        </div>
        {altitude != null && (
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">Altitud</dt>
            <dd className="text-lg font-semibold tracking-tight">
              {Math.round(altitude).toLocaleString("es-ES")}
            </dd>
            <span className="text-muted-foreground">m</span>
          </div>
        )}
      </dl>
    </section>
  )
}

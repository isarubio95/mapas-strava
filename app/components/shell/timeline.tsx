import { PauseIcon, PlayIcon } from "@phosphor-icons/react"

import { Button } from "~/components/ui/button"
import { dayToDate } from "~/lib/filters"
import type { Histogram } from "~/lib/map/engine"

const SPEEDS = [1, 4, 12, 52] as const

export function Timeline({
  histogram,
  day,
  playing,
  speed,
  onDay,
  onPlaying,
  onSpeed,
}: {
  histogram: Histogram | null
  day: number
  playing: boolean
  speed: number
  onDay: (day: number) => void
  onPlaying: (playing: boolean) => void
  onSpeed: (speed: number) => void
}) {
  if (!histogram) return null
  const end = histogram.startDay + histogram.counts.length * histogram.binDays
  const max = Math.max(1, ...histogram.counts)
  const width = 320
  const height = 36

  return (
    <div className="panel pointer-events-auto flex items-center gap-2 rounded-4xl px-2 py-2">
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={playing ? "Pausar" : "Reproducir"}
        onClick={() => onPlaying(!playing)}
      >
        {playing ? <PauseIcon weight="fill" /> : <PlayIcon weight="fill" />}
      </Button>
      <div className="min-w-0 flex-1">
        <input
          aria-label="Momento"
          aria-valuetext={dayToDate(day)}
          type="range"
          min={histogram.startDay}
          max={end}
          value={Math.min(end, Math.max(histogram.startDay, day))}
          onChange={(event) => onDay(Number(event.target.value))}
          className="w-full accent-primary"
        />
        <svg viewBox={`0 0 ${width} ${height}`} className="h-7 w-full" aria-hidden>
          {Array.from(histogram.counts, (count, index) => {
            const bar = width / histogram.counts.length
            const h = (count / max) * height
            return (
              <rect
                key={index}
                x={index * bar}
                y={height - h}
                width={Math.max(0.6, bar - 0.4)}
                height={h}
                className="fill-primary/50"
              />
            )
          })}
        </svg>
        <p className="text-xs tabular-nums text-muted-foreground">{dayToDate(day)}</p>
      </div>
      <div className="flex flex-col">
        {SPEEDS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={speed === value}
            className="px-1 text-xs text-muted-foreground aria-pressed:font-semibold aria-pressed:text-foreground"
            onClick={() => onSpeed(value)}
          >
            {value}×
          </button>
        ))}
      </div>
    </div>
  )
}

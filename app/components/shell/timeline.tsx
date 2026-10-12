import { PauseIcon, PlayIcon } from "@phosphor-icons/react"

import { Button } from "~/components/ui/button"
import { dayToDate } from "~/lib/filters"
import type { Histogram } from "~/lib/map/engine"

const SPEEDS = [1, 4, 12, 52] as const

/**
 * Playback bar spanning the width of the map: play and the scrubber over the
 * activity histogram on top, the date and the speeds below.
 */
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
    <div className="panel pointer-events-auto flex w-full flex-col gap-2 rounded-4xl px-3 py-3 md:px-4">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="icon-lg"
          className="size-12 [&_svg:not([class*='size-'])]:size-5"
          aria-label={playing ? "Pausar" : "Reproducir"}
          onClick={() => onPlaying(!playing)}
        >
          {playing ? <PauseIcon weight="fill" /> : <PlayIcon weight="fill" />}
        </Button>
        <div className="min-w-0 flex-1">
          {/* Stretched to the bar's width rather than kept at its ratio. */}
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            className="h-9 w-full"
            aria-hidden
          >
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
          <input
            aria-label="Momento"
            aria-valuetext={dayToDate(day)}
            type="range"
            min={histogram.startDay}
            max={end}
            value={Math.min(end, Math.max(histogram.startDay, day))}
            onChange={(event) => onDay(Number(event.target.value))}
            className="block h-6 w-full cursor-pointer accent-primary"
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="pl-1 text-sm font-medium tabular-nums">
          {dayToDate(day)}
        </p>
        <div
          role="group"
          aria-label="Velocidad"
          className="flex items-center gap-1 rounded-4xl bg-muted p-1"
        >
          {SPEEDS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={speed === value}
              className="h-9 min-w-11 rounded-4xl px-2.5 text-sm font-medium text-muted-foreground tabular-nums transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:bg-primary aria-pressed:text-primary-foreground"
              onClick={() => onSpeed(value)}
            >
              {value}×
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

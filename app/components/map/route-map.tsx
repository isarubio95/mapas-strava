import { MapLibreOverlay } from "@deck.gl/maplibre"
import { Map, useControl, useMap, type MapRef } from "@vis.gl/react-maplibre"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react"
import type { Layer } from "@deck.gl/core"

import type { Activity } from "~/lib/activities"
import { dayNumber, type Filters } from "~/lib/filters"
import {
  buildPathColors,
  heatmapLayer,
  playbackLayers,
  routeLayers,
  selectionLayers,
} from "~/lib/map/layers"
import { setupMapLibre } from "~/lib/map/maplibre"
import {
  createMapStyle,
  paletteForTheme,
  type MapPalette,
} from "~/lib/map/style"
import type { DatasetMeta, Histogram, Summary } from "~/lib/map/engine"
import {
  clock,
  RouteReveal,
  SELECTION_DRAW,
  visiblePaths,
} from "~/lib/map/reveal"
import { useRouteEngine } from "~/lib/map/use-engine"
import { sportColor, type SportColors } from "~/lib/sports"
import type { Theme } from "~/lib/theme"
import { useMediaQuery } from "~/lib/use-media-query"
import { cn } from "~/lib/utils"

import "maplibre-gl/dist/maplibre-gl.css"
import { MapSkeleton } from "./map-skeleton"

setupMapLibre()

export type MapMode = "routes" | "heatmap" | "playback"

export interface RouteMapProps {
  activities: Activity[]
  filters: Filters
  theme: Theme
  sportColors?: SportColors
  mode?: MapMode
  selectedId?: number | null
  /** Hide every other route and frame the selected one. */
  focused?: boolean
  /** Room the framed route leaves at each edge, for panels over the map. */
  focusPadding?: Padding
  onSelect?: (id: number | null, overlapped: number[]) => void
  pickingPoint?: boolean
  onPickPoint?: (point: { lng: number; lat: number }) => void
  playbackTime?: number
  playbackDrawDays?: number
  heatmapRadius?: number
  heatmapIntensity?: number
  labels?: boolean
  palette?: MapPalette
  /** Routes draw themselves in when they appear. Off for still images. */
  animateRoutes?: boolean
  preserveDrawingBuffer?: boolean
  className?: string
  onSummary?: (
    summary: Summary,
    meta: DatasetMeta,
    timeline: Histogram | null
  ) => void
}

export interface Padding {
  top: number
  bottom: number
  left: number
  right: number
}

/** Starting view until the routes load, and for accounts without GPS routes. */
const MADRID = { longitude: -3.7038, latitude: 40.4168, zoom: 11 }

const EVEN_PADDING: Padding = { top: 64, bottom: 64, left: 64, right: 64 }

/** Bounds of interleaved [lng, lat] coordinates. */
function coordsBounds(coords: Float64Array): [[number, number], [number, number]] {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i < coords.length; i += 2) {
    minX = Math.min(minX, coords[i])
    minY = Math.min(minY, coords[i + 1])
    maxX = Math.max(maxX, coords[i])
    maxY = Math.max(maxY, coords[i + 1])
  }
  return [
    [minX, minY],
    [maxX, maxY],
  ]
}

/** Shrinks padding that would leave the route under a fifth of the map. */
function fitPadding(padding: Padding, width: number, height: number): Padding {
  const x = Math.min(1, (width * 0.8) / (padding.left + padding.right))
  const y = Math.min(1, (height * 0.8) / (padding.top + padding.bottom))
  return {
    top: padding.top * y,
    bottom: padding.bottom * y,
    left: padding.left * x,
    right: padding.right * x,
  }
}

export function RouteMap({
  activities,
  filters,
  theme,
  sportColors,
  mode = "routes",
  selectedId = null,
  focused = false,
  focusPadding = EVEN_PADDING,
  onSelect,
  pickingPoint = false,
  onPickPoint,
  playbackTime = 0,
  playbackDrawDays = 1.4,
  heatmapRadius = 28,
  heatmapIntensity = 1,
  labels = false,
  palette,
  animateRoutes = true,
  preserveDrawingBuffer = false,
  className,
  onSummary,
}: RouteMapProps) {
  const mapRef = useRef<MapRef>(null)
  const overlayHost = useRef<MapLibreOverlay | null>(null)
  const { client, geometry, meta, query, ready } = useRouteEngine(
    activities,
    filters
  )
  const [selection, setSelection] = useState<{
    coords: Float64Array
    /** Clock time when it appeared, so it can draw itself in. */
    at: number
  } | null>(null)
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  const animate = animateRoutes && !reducedMotion
  const [heatPoints, setHeatPoints] = useState<Float32Array | null>(null)
  const [timestamps, setTimestamps] = useState<Float32Array | null>(null)
  const [cursor, setCursor] = useState("grab")
  const framed = useRef<object | null>(null)
  const framedSelection = useRef<Float64Array | null>(null)
  const isolated = focused && selectedId != null

  const mapStyle = useMemo(
    () => createMapStyle(palette ?? paletteForTheme(theme), { labels }),
    [palette, theme, labels]
  )

  const colors = useMemo(
    () =>
      geometry
        ? buildPathColors(geometry, activities, theme, sportColors)
        : null,
    [geometry, activities, theme, sportColors]
  )

  const dayRange = useMemo((): [number, number] => {
    const from = filters.from ? dayNumber(filters.from) : (meta?.firstDay ?? 0)
    const to = filters.to ? dayNumber(filters.to) : (meta?.lastDay ?? 1e6)
    return [from, to]
  }, [filters.from, filters.to, meta])

  const reveal = useMemo(
    () =>
      geometry
        ? new RouteReveal(geometry.startIndices, geometry.progress)
        : null,
    [geometry]
  )

  /** Routes that just came on screen start drawing; leaving routes mode resets them. */
  const revealVersion = useMemo(() => {
    if (!reveal || !geometry || !query) return 0
    const visible =
      mode === "routes" && !isolated
        ? visiblePaths(query.mask, geometry.pathDay, dayRange)
        : new Uint8Array(query.mask.length)
    reveal.update(visible, clock(), animate)
    return reveal.version
  }, [reveal, geometry, query, mode, dayRange, animate, isolated])

  const frame = useFrames(
    Math.max(
      reveal?.finishesAt ?? 0,
      selection && animate ? selection.at + SELECTION_DRAW + 0.3 : 0
    )
  )

  /** Frames the home area once per dataset. Runs on load too: the map may not exist yet. */
  const frameRoutes = useCallback(() => {
    const map = mapRef.current
    const bounds = geometry?.home
    if (!map || !geometry || !bounds || framed.current === geometry) return
    framed.current = geometry
    map.fitBounds(
      [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]],
      ],
      { padding: 48, maxZoom: 14, duration: 0 }
    )
  }, [geometry])

  useEffect(frameRoutes, [frameRoutes])

  /** Flies to the route shown alone, once per route. Runs on load too. */
  const frameSelection = useCallback(() => {
    if (!isolated || !selection) {
      framedSelection.current = null
      return
    }
    const map = mapRef.current
    if (!map || framedSelection.current === selection.coords) return
    framedSelection.current = selection.coords
    const container = map.getContainer()
    map.fitBounds(coordsBounds(selection.coords), {
      padding: fitPadding(
        focusPadding,
        container.clientWidth,
        container.clientHeight
      ),
      maxZoom: 15,
      duration: animate ? 900 : 0,
    })
  }, [isolated, selection, focusPadding, animate])

  useEffect(frameSelection, [frameSelection])

  useEffect(() => {
    if (!query || !meta) return
    onSummary?.(query.summary, meta, query.timeline)
  }, [query, meta, onSummary])

  useEffect(() => {
    if (selectedId == null) {
      setSelection(null)
      return
    }
    const index = activities.findIndex((activity) => activity.id === selectedId)
    if (index < 0 || !client.current) {
      setSelection(null)
      return
    }
    let cancelled = false
    void client.current.api.route(index).then((coords) => {
      if (!cancelled) setSelection(coords ? { coords, at: clock() } : null)
    })
    return () => {
      cancelled = true
    }
  }, [selectedId, activities, client, geometry])

  useEffect(() => {
    if (mode !== "heatmap" || !client.current || !geometry) {
      setHeatPoints(null)
      return
    }
    let cancelled = false
    void client.current.api.heatPoints(filters, 80).then((points) => {
      if (!cancelled) setHeatPoints(points)
    })
    return () => {
      cancelled = true
    }
  }, [mode, filters, client, geometry])

  useEffect(() => {
    if (mode !== "playback" || !client.current || !geometry) {
      setTimestamps(null)
      return
    }
    let cancelled = false
    void client.current.api.timestamps(playbackDrawDays).then((values) => {
      if (!cancelled) setTimestamps(values)
    })
    return () => {
      cancelled = true
    }
  }, [mode, playbackDrawDays, client, geometry])

  const layers = useMemo(() => {
    if (!geometry || !colors || !query || !reveal) return []
    const now = clock()
    const beforeId = labels ? "place-label" : undefined
    const shared = {
      geometry,
      colors,
      mask: query.mask,
      dayRange,
      theme,
      beforeId,
    }
    const list: Layer[] = []
    if (!isolated) {
      if (mode === "heatmap" && heatPoints) {
        list.push(
          heatmapLayer({
            points: heatPoints,
            theme,
            radius: heatmapRadius,
            intensity: heatmapIntensity,
            beforeId,
          })
        )
      } else if (mode === "playback" && timestamps) {
        list.push(
          ...playbackLayers({
            ...shared,
            timestamps,
            currentTime: playbackTime,
            drawDays: playbackDrawDays,
          })
        )
      } else {
        list.push(
          ...routeLayers({
            ...shared,
            reveal: {
              times: reveal.times,
              version: revealVersion,
              currentTime: reveal.time(now),
              drawing: reveal.drawing(now),
              animated: animate,
            },
            dimmed: selectedId != null,
          })
        )
      }
    }
    if (selection && selectedId != null) {
      const activity = activities.find((item) => item.id === selectedId)
      if (activity) {
        list.push(
          ...selectionLayers({
            coords: selection.coords,
            color: sportColor(activity.sportType, theme, sportColors),
            theme,
            elapsed: animate ? now - selection.at : Infinity,
            beforeId,
          })
        )
      }
    }
    return list
  }, [
    geometry,
    colors,
    query,
    reveal,
    revealVersion,
    animate,
    // Not read inside: it changes every animation frame so the clock is read again.
    frame,
    dayRange,
    theme,
    labels,
    mode,
    heatPoints,
    timestamps,
    playbackTime,
    playbackDrawDays,
    heatmapRadius,
    heatmapIntensity,
    selection,
    selectedId,
    isolated,
    activities,
    sportColors,
  ])

  const pickRoutes = useCallback(
    (x: number, y: number) => {
      const overlay = overlayHost.current
      if (!overlay || !geometry) return []
      const hits = overlay.pickMultipleObjects({
        x,
        y,
        radius: 8,
        layerIds: ["routes-core"],
      })
      const ids: number[] = []
      const seen = new Set<number>()
      for (const hit of hits) {
        if (hit.index == null) continue
        const activity = activities[geometry.pathActivity[hit.index]]
        if (!activity || seen.has(activity.id)) continue
        seen.add(activity.id)
        ids.push(activity.id)
      }
      return ids
    },
    [activities, geometry]
  )

  const onClick = useCallback(
    (event: {
      lngLat: { lng: number; lat: number }
      point: { x: number; y: number }
    }) => {
      if (pickingPoint) {
        onPickPoint?.({ lng: event.lngLat.lng, lat: event.lngLat.lat })
        return
      }
      if (mode !== "routes" || isolated) return
      const ids = pickRoutes(event.point.x, event.point.y)
      onSelect?.(ids[0] ?? null, ids)
    },
    [pickingPoint, onPickPoint, mode, isolated, pickRoutes, onSelect]
  )

  const onMouseMove = useCallback(
    (event: { point: { x: number; y: number } }) => {
      if (pickingPoint) {
        setCursor("crosshair")
        return
      }
      if (mode !== "routes" || isolated) {
        setCursor("grab")
        return
      }
      const ids = pickRoutes(event.point.x, event.point.y)
      setCursor(ids.length ? "pointer" : "grab")
    },
    [pickingPoint, mode, isolated, pickRoutes]
  )

  return (
    <div className={cn("relative size-full min-h-0", className)}>
      <Map
        ref={mapRef}
        mapStyle={mapStyle}
        initialViewState={MADRID}
        style={{ width: "100%", height: "100%" }}
        maxPitch={0}
        dragRotate={false}
        pitchWithRotate={false}
        cursor={cursor}
        attributionControl={{ compact: true }}
        // MSAA keeps the sub-pixel dark-mode routes continuous when zoomed out.
        canvasContextAttributes={{ antialias: true, preserveDrawingBuffer }}
        onLoad={() => {
          frameRoutes()
          frameSelection()
        }}
        onClick={onClick}
        onMouseMove={onMouseMove}
        onMouseDown={() => setCursor(pickingPoint ? "crosshair" : "grabbing")}
        onMouseUp={() => setCursor(pickingPoint ? "crosshair" : "grab")}
      >
        <OverlayCatcher overlayRef={overlayHost} layers={layers} />
      </Map>
      {!ready && (
        <div className="pointer-events-none absolute inset-0">
          <MapSkeleton />
        </div>
      )}
    </div>
  )
}

/** Re-renders on every animation frame until the clock passes `until`. */
function useFrames(until: number) {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    if (clock() >= until) return
    let id = requestAnimationFrame(function step() {
      setFrame((value) => value + 1)
      if (clock() < until) id = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(id)
  }, [until])
  return frame
}

function OverlayCatcher({
  overlayRef,
  layers,
}: {
  overlayRef: RefObject<MapLibreOverlay | null>
  layers: Layer[]
}) {
  const overlay = useControl(
    () => new MapLibreOverlay({ interleaved: true, layers })
  )
  const { current: map } = useMap()
  overlayRef.current = overlay
  overlay.setProps({ layers })

  // deck.gl only slots its layers under the labels once tiles have loaded and
  // draws them over everything until then, so place them again when it settles.
  useEffect(() => {
    const target = map?.getMap()
    if (!target) return
    const place = () => overlay.setProps({ layers })
    target.once("idle", place)
    return () => {
      target.off("idle", place)
    }
  }, [map, overlay, layers])
  return null
}

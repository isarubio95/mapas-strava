import { MapLibreOverlay } from "@deck.gl/maplibre"
import { Map, useControl, type MapRef } from "@vis.gl/react-maplibre"
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
import { useRouteEngine } from "~/lib/map/use-engine"
import { sportColor, type SportColors } from "~/lib/sports"
import type { Theme } from "~/lib/theme"
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
  onSelect?: (id: number | null, overlapped: number[]) => void
  pickingPoint?: boolean
  onPickPoint?: (point: { lng: number; lat: number }) => void
  playbackTime?: number
  playbackDrawDays?: number
  heatmapRadius?: number
  heatmapIntensity?: number
  labels?: boolean
  palette?: MapPalette
  preserveDrawingBuffer?: boolean
  className?: string
  onSummary?: (
    summary: Summary,
    meta: DatasetMeta,
    timeline: Histogram | null
  ) => void
}

/** Starting view until the routes load, and for accounts without GPS routes. */
const MADRID = { longitude: -3.7038, latitude: 40.4168, zoom: 11 }

export function RouteMap({
  activities,
  filters,
  theme,
  sportColors,
  mode = "routes",
  selectedId = null,
  onSelect,
  pickingPoint = false,
  onPickPoint,
  playbackTime = 0,
  playbackDrawDays = 1.4,
  heatmapRadius = 28,
  heatmapIntensity = 1,
  labels = false,
  palette,
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
  const [selectedCoords, setSelectedCoords] = useState<Float64Array | null>(
    null
  )
  const [heatPoints, setHeatPoints] = useState<Float32Array | null>(null)
  const [timestamps, setTimestamps] = useState<Float32Array | null>(null)
  const [cursor, setCursor] = useState("grab")
  const framed = useRef<object | null>(null)

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

  useEffect(() => {
    if (!query || !meta) return
    onSummary?.(query.summary, meta, query.timeline)
  }, [query, meta, onSummary])

  useEffect(() => {
    if (selectedId == null) {
      setSelectedCoords(null)
      return
    }
    const index = activities.findIndex((activity) => activity.id === selectedId)
    if (index < 0 || !client.current) {
      setSelectedCoords(null)
      return
    }
    let cancelled = false
    void client.current.api.route(index).then((coords) => {
      if (!cancelled) setSelectedCoords(coords)
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
    if (!geometry || !colors || !query) return []
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
      list.push(...routeLayers({ ...shared, dimmed: selectedId != null }))
    }
    if (selectedCoords && selectedId != null) {
      const activity = activities.find((item) => item.id === selectedId)
      if (activity) {
        list.push(
          ...selectionLayers({
            coords: selectedCoords,
            color: sportColor(activity.sportType, theme, sportColors),
            theme,
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
    selectedCoords,
    selectedId,
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
      if (mode !== "routes") return
      const ids = pickRoutes(event.point.x, event.point.y)
      onSelect?.(ids[0] ?? null, ids)
    },
    [pickingPoint, onPickPoint, mode, pickRoutes, onSelect]
  )

  const onMouseMove = useCallback(
    (event: { point: { x: number; y: number } }) => {
      if (pickingPoint) {
        setCursor("crosshair")
        return
      }
      if (mode !== "routes") {
        setCursor("grab")
        return
      }
      const ids = pickRoutes(event.point.x, event.point.y)
      setCursor(ids.length ? "pointer" : "grab")
    },
    [pickingPoint, mode, pickRoutes]
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
        canvasContextAttributes={
          preserveDrawingBuffer ? { preserveDrawingBuffer: true } : undefined
        }
        onLoad={frameRoutes}
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
  overlayRef.current = overlay
  overlay.setProps({ layers })
  return null
}

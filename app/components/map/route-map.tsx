import { MapLibreOverlay } from "@deck.gl/maplibre"
import { Map, useControl, useMap, type MapRef } from "@vis.gl/react-maplibre"
import type { GeoJSONSource } from "maplibre-gl"
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
import { viewBounds, type BBox } from "~/lib/geo"
import {
  buildPathColors,
  heatmapLayer,
  playbackLayers,
  routeLayers,
  selectionLayers,
} from "~/lib/map/layers"
import { Flyover } from "~/lib/map/flyover"
import { setupMapLibre } from "~/lib/map/maplibre"
import {
  FLYOVER_SOURCE,
  paintSelection,
  pointGeoJSON,
  ROUTES_3D_PICK_LAYER,
  withRoutes3d,
} from "~/lib/map/routes-3d"
import {
  createMapStyle,
  paletteForTheme,
  reliefForTheme,
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
import { Compass } from "./compass"
import { MapSkeleton } from "./map-skeleton"

setupMapLibre()

/** `relief` is the 3D view: the routes over real terrain, seen at an angle. */
export type MapMode = "routes" | "heatmap" | "playback" | "relief"

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
  /** In 3D, the camera flies along the selected route. */
  flyover?: boolean
  /** Share of the route flown, on every frame of the flyover. */
  onFlyoverProgress?: (share: number) => void
  /** The flyover reached the end or someone moved the map. */
  onFlyoverEnd?: () => void
  className?: string
  /** The ground in view, flat and north-up, whenever the map stops moving. */
  onViewChange?: (bounds: BBox) => void
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

/** Camera tilt of the 3D view: low enough for the horizon to show. */
const RELIEF_PITCH = 66
/** The 3D view turns a little off north, so the light rakes across the ridges. */
const RELIEF_BEARING = -24
/** Seconds the selected route takes to draw itself over the terrain. */
const SELECTION_DRAW_3D = 1.4

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2
const easeOutCubic = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3

/** Share of the selected route drawn, `at` being when it appeared. */
const selectionDrawn = (at: number, animate: boolean) =>
  animate ? easeOutCubic((clock() - at) / SELECTION_DRAW_3D) : 1

/** Bounds of interleaved [lng, lat] coordinates. */
function coordsBounds(
  coords: Float64Array
): [[number, number], [number, number]] {
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
  flyover = false,
  onFlyoverProgress,
  onFlyoverEnd,
  className,
  onViewChange,
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
  const relief = mode === "relief"
  /** The camera may be tilted: true in 3D and until it lands flat again. */
  const [tilted, setTilted] = useState(relief)
  const wasRelief = useRef(relief)
  /** The routes for the 3D view, as a GeoJSON blob URL. */
  const [routesUrl, setRoutesUrl] = useState<string | null>(null)
  const routesUrlRef = useRef<string | null>(null)

  const sports = useMemo(
    () => [...new Set(activities.map((activity) => activity.sportType))],
    [activities]
  )

  /** The selected route's color in both themes, so 3D can fade between them. */
  const selectionColors = useMemo(() => {
    const activity =
      selectedId == null
        ? null
        : activities.find((item) => item.id === selectedId)
    if (!activity) return null
    return {
      dark: sportColor(activity.sportType, "dark", sportColors),
      light: sportColor(activity.sportType, "light", sportColors),
    }
  }, [selectedId, activities, sportColors])

  const mapStyle = useMemo(() => {
    const style = createMapStyle(palette ?? paletteForTheme(theme), {
      labels,
      relief: relief ? reliefForTheme(theme) : undefined,
    })
    if (!relief) return style
    const shown =
      selection && selectionColors && selectedId != null
        ? {
            coords: selection.coords,
            colors: selectionColors,
            // Where the draw-in stands, so a rebuilt style does not flash it whole.
            drawn: selectionDrawn(selection.at, animate && !flyover),
          }
        : null
    return withRoutes3d(style, {
      routes: routesUrl,
      sports,
      theme,
      sportColors,
      hidden: isolated,
      // The flown route stands alone; a selection only steps forward.
      fade: selectedId == null ? 1 : flyover ? 0.12 : 0.3,
      selection: shown,
      flyoverStart:
        flyover && shown ? [shown.coords[0], shown.coords[1]] : null,
    })
  }, [
    palette,
    theme,
    labels,
    relief,
    routesUrl,
    sports,
    sportColors,
    isolated,
    selectedId,
    selection,
    selectionColors,
    flyover,
    animate,
  ])

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
    // Opening straight into 3D: the camera tilts down over the terrain.
    if (wasRelief.current) {
      map.easeTo({
        pitch: RELIEF_PITCH,
        bearing: RELIEF_BEARING,
        duration: animate ? 2600 : 0,
        easing: easeInOut,
      })
    }
  }, [geometry, animate])

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
      duration: animate ? (relief ? 1600 : 900) : 0,
      ...(relief && { pitch: RELIEF_PITCH - 8, bearing: map.getBearing() }),
    })
  }, [isolated, selection, focusPadding, animate, relief])

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

  /** The visible routes as GeoJSON for MapLibre to drape over the terrain. */
  useEffect(() => {
    const engine = client.current
    if (!relief || !engine || !geometry) return
    let cancelled = false
    void engine.api.routesGeoJSON(filters).then((json) => {
      if (cancelled) return
      const url = URL.createObjectURL(
        new Blob([json], { type: "application/json" })
      )
      const previous = routesUrlRef.current
      routesUrlRef.current = url
      setRoutesUrl(url)
      // MapLibre has read the old routes long before this runs.
      if (previous)
        window.setTimeout(() => URL.revokeObjectURL(previous), 10_000)
    })
    return () => {
      cancelled = true
    }
  }, [relief, filters, client, geometry])

  useEffect(
    () => () => {
      if (routesUrlRef.current) URL.revokeObjectURL(routesUrlRef.current)
    },
    []
  )

  /** Tilts the camera down over the terrain when 3D comes on, and back up when it goes. */
  useEffect(() => {
    if (wasRelief.current === relief) return
    wasRelief.current = relief
    const map = mapRef.current
    if (relief) setTilted(true)
    if (!map) return
    if (relief) {
      const bearing = map.getBearing()
      map.easeTo({
        pitch: RELIEF_PITCH,
        bearing: Math.abs(bearing) < 1 ? RELIEF_BEARING : bearing,
        zoom: map.getZoom() + 0.5,
        duration: animate ? 2400 : 0,
        easing: easeInOut,
      })
      return
    }
    map.easeTo({
      pitch: 0,
      bearing: 0,
      zoom: map.getZoom() - 0.5,
      duration: animate ? 1100 : 0,
      easing: easeInOut,
    })
    // Flat again: lock the tilt so the 2D map behaves as before.
    const settle = () => setTilted(false)
    map.once("moveend", settle)
    return () => {
      map.off("moveend", settle)
    }
  }, [relief, animate])

  const flyoverRef = useRef(flyover)
  flyoverRef.current = flyover
  const selectionTint = useRef(selectionColors)
  selectionTint.current = selectionColors

  /** The selected route draws itself over the terrain. */
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!relief || !selection || !map || !animate || flyoverRef.current) return
    let frame = 0
    const step = () => {
      const tint = selectionTint.current
      const share = selectionDrawn(selection.at, true)
      if (tint) paintSelection(map, tint, share)
      if (share < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [relief, selection, animate])

  const focusPaddingRef = useRef(focusPadding)
  focusPaddingRef.current = focusPadding
  const flyoverCallbacks = useRef({ onFlyoverProgress, onFlyoverEnd })
  flyoverCallbacks.current = { onFlyoverProgress, onFlyoverEnd }

  /** Flies the camera along the selected route, lighting it up behind the head. */
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!flyover || !relief || !selection || !map) return
    const coords = selection.coords
    const paint = (share: number) => {
      const tint = selectionTint.current
      if (tint) paintSelection(map, tint, share, true)
    }
    const end = () => flyoverCallbacks.current.onFlyoverEnd?.()
    const flight = new Flyover(
      map,
      coords,
      ({ share, at }) => {
        paint(share)
        map.getSource<GeoJSONSource>(FLYOVER_SOURCE)?.setData(pointGeoJSON(at))
        flyoverCallbacks.current.onFlyoverProgress?.(share)
      },
      () => {
        // The camera pulls back to show the whole route it just flew.
        const container = map.getContainer()
        map.fitBounds(coordsBounds(coords), {
          padding: fitPadding(
            focusPaddingRef.current,
            container.clientWidth,
            container.clientHeight
          ),
          pitch: RELIEF_PITCH - 8,
          bearing: map.getBearing(),
          maxZoom: 15,
          duration: 2400,
          easing: easeInOut,
        })
        end()
      }
    )
    flight.start()
    // Taking the controls ends the flight.
    const events = ["mousedown", "touchstart", "wheel"] as const
    for (const type of events) map.on(type, end)
    return () => {
      for (const type of events) map.off(type, end)
      flight.stop()
      paint(1)
    }
  }, [flyover, relief, selection])

  const layers = useMemo(() => {
    if (!geometry || !colors || !query || !reveal || relief) return []
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
    heatmapRadius,
    heatmapIntensity,
    selection,
    selectedId,
    isolated,
    activities,
    sportColors,
    relief,
  ])

  const pickRoutes = useCallback(
    (x: number, y: number) => {
      if (relief) {
        const map = mapRef.current
        if (!map?.getLayer(ROUTES_3D_PICK_LAYER)) return []
        const ids = new Set<number>()
        for (const feature of map.queryRenderedFeatures(
          [
            [x - 8, y - 8],
            [x + 8, y + 8],
          ],
          { layers: [ROUTES_3D_PICK_LAYER] }
        )) {
          const id = Number(feature.properties?.a)
          if (Number.isFinite(id)) ids.add(id)
        }
        return [...ids]
      }
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
    [activities, geometry, relief]
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
      if ((mode !== "routes" && !relief) || isolated || flyover) return
      const ids = pickRoutes(event.point.x, event.point.y)
      onSelect?.(ids[0] ?? null, ids)
    },
    [
      pickingPoint,
      onPickPoint,
      mode,
      relief,
      isolated,
      flyover,
      pickRoutes,
      onSelect,
    ]
  )

  const reportView = useCallback(() => {
    const map = mapRef.current
    if (!map || !onViewChange) return
    const center = map.getCenter()
    const container = map.getContainer()
    onViewChange(
      viewBounds(
        center.lng,
        center.lat,
        map.getZoom(),
        container.clientWidth,
        container.clientHeight
      )
    )
  }, [onViewChange])

  const onMouseMove = useCallback(
    (event: { point: { x: number; y: number } }) => {
      if (pickingPoint) {
        setCursor("crosshair")
        return
      }
      if ((mode !== "routes" && !relief) || isolated || flyover) {
        setCursor("grab")
        return
      }
      const ids = pickRoutes(event.point.x, event.point.y)
      setCursor(ids.length ? "pointer" : "grab")
    },
    [pickingPoint, mode, relief, isolated, flyover, pickRoutes]
  )

  return (
    <div className={cn("relative size-full min-h-0", className)}>
      <Map
        ref={mapRef}
        mapStyle={mapStyle}
        initialViewState={MADRID}
        style={{ width: "100%", height: "100%" }}
        maxPitch={relief || tilted ? 80 : 0}
        dragRotate={relief}
        pitchWithRotate={relief}
        touchPitch={relief}
        cursor={cursor}
        attributionControl={{ compact: true }}
        // MSAA keeps the sub-pixel dark-mode routes continuous when zoomed out.
        canvasContextAttributes={{ antialias: true, preserveDrawingBuffer }}
        onLoad={() => {
          frameRoutes()
          frameSelection()
          reportView()
        }}
        onMoveEnd={reportView}
        onClick={onClick}
        onMouseMove={onMouseMove}
        onMouseDown={() => setCursor(pickingPoint ? "crosshair" : "grabbing")}
        onMouseUp={() => setCursor(pickingPoint ? "crosshair" : "grab")}
      >
        <OverlayCatcher overlayRef={overlayHost} layers={layers} />
        {relief && !flyover && <Compass />}
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

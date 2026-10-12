import {
  Map as MapLibreMap,
  type GeoJSONSource,
  type LayerSpecification,
  type StyleSpecification,
} from "maplibre-gl"
import { useEffect, useImperativeHandle, useRef, type Ref } from "react"

import type { BBox } from "~/lib/geo"
import { setupMapLibre } from "~/lib/map/maplibre"
import {
  POSTER_ROUTES_SOURCE,
  POSTER_TILES_SOURCE,
} from "~/lib/map/poster-style"
import type { PlaceLabel, PosterRoutes } from "~/lib/poster"

import "maplibre-gl/dist/maplibre-gl.css"

setupMapLibre()

export interface PosterMapHandle {
  /**
   * Renders the same view at `pixelRatio`, hands the canvas to `draw` once
   * every tile is in, then goes back to the preview resolution.
   */
  capture(
    pixelRatio: number,
    draw: (canvas: HTMLCanvasElement) => void
  ): Promise<void>
  fit(bounds: BBox): void
}

/** What the map shows once it stops moving and its tiles are in. */
export interface PosterView {
  center: { lng: number; lat: number }
  zoom: number
  bounds: BBox
  /** Place labels in the loaded tiles, including some outside `bounds`. */
  places: PlaceLabel[]
}

export interface PosterMapProps {
  /** Logical size; the parent scales it down to fit the screen. */
  width: number
  height: number
  pixelRatio: number
  mapStyle: StyleSpecification
  routes: PosterRoutes | null
  initialBounds: BBox | null
  onMoveEnd?: (center: { lng: number; lat: number }) => void
  /** First time every tile and route of the initial view is drawn. */
  onReady?: () => void
  /** After the first view and every move, once the tiles are in. */
  onSettle?: (view: PosterView) => void
  ref?: Ref<PosterMapHandle>
}

const MADRID = { center: [-3.7038, 40.4168] as [number, number], zoom: 12 }
/** Wait at most this long for tiles before exporting what is there. */
const CAPTURE_TIMEOUT = 30_000

/** Keeps routes above the title block at the bottom of the poster. */
function framePadding(width: number) {
  return {
    top: width * 0.07,
    right: width * 0.06,
    bottom: width * 0.3,
    left: width * 0.06,
  }
}

function viewOf(map: MapLibreMap): PosterView {
  const center = map.getCenter()
  const bounds = map.getBounds()
  const places = map
    .querySourceFeatures(POSTER_TILES_SOURCE, { sourceLayer: "place" })
    .flatMap((feature): PlaceLabel[] => {
      const { geometry, properties } = feature
      const name = properties["name:es"] ?? properties.name
      if (geometry.type !== "Point" || !name) return []
      const [lng, lat] = geometry.coordinates
      return [
        {
          name: String(name),
          kind: String(properties.class),
          rank: Number(properties.rank ?? Infinity),
          lng,
          lat,
        },
      ]
    })
  return {
    center: { lng: center.lng, lat: center.lat },
    zoom: map.getZoom(),
    bounds: [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ],
    places,
  }
}

type PaintProperty = Parameters<MapLibreMap["setPaintProperty"]>[1]
type PaintValue = Parameters<MapLibreMap["setPaintProperty"]>[2]

/**
 * Applies paint changes layer by layer. Theme and route options only change
 * paint, and `setStyle` would also reset the routes source to its empty data.
 */
function updatePaint(
  map: MapLibreMap,
  before: StyleSpecification,
  after: StyleSpecification
) {
  const paintOf = (layer?: LayerSpecification) =>
    ((layer && "paint" in layer ? layer.paint : undefined) ?? {}) as Record<
      PaintProperty,
      PaintValue
    >
  const previous = new Map(before.layers.map((layer) => [layer.id, layer]))
  for (const layer of after.layers) {
    const old = paintOf(previous.get(layer.id))
    const paint = paintOf(layer)
    for (const key of Object.keys(paint) as PaintProperty[]) {
      if (JSON.stringify(old[key]) === JSON.stringify(paint[key])) continue
      map.setPaintProperty(layer.id, key, paint[key])
    }
  }
}

/** The poster's map: MapLibre with native layers, so any pixel ratio renders the same picture. */
export function PosterMap({
  width,
  height,
  pixelRatio,
  mapStyle,
  routes,
  initialBounds,
  onMoveEnd,
  onReady,
  onSettle,
  ref,
}: PosterMapProps) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const styleRef = useRef(mapStyle)
  const routesRef = useRef(routes)
  const ratioRef = useRef(pixelRatio)
  const capturing = useRef(false)
  const onMoveEndRef = useRef(onMoveEnd)
  onMoveEndRef.current = onMoveEnd
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady
  const onSettleRef = useRef(onSettle)
  onSettleRef.current = onSettle
  routesRef.current = routes
  ratioRef.current = pixelRatio

  useEffect(() => {
    if (!container.current) return
    const bounds = initialBounds
    const map = new MapLibreMap({
      container: container.current,
      style: styleRef.current,
      ...(bounds
        ? {
            bounds: [bounds[0], bounds[1], bounds[2], bounds[3]],
            fitBoundsOptions: { padding: framePadding(width), maxZoom: 14 },
          }
        : MADRID),
      pixelRatio: ratioRef.current,
      maxCanvasSize: [8192, 8192],
      canvasContextAttributes: { preserveDrawingBuffer: true },
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 0,
      fadeDuration: 0,
    })
    map.touchZoomRotate.disableRotation()
    map.keyboard.disableRotation()
    mapRef.current = map

    const fillRoutes = () => {
      const source = map.getSource<GeoJSONSource>(POSTER_ROUTES_SOURCE)
      if (source && routesRef.current) source.setData(routesRef.current)
    }
    map.on("load", fillRoutes)
    map.on("moveend", () => {
      const center = map.getCenter()
      onMoveEndRef.current?.({ lng: center.lng, lat: center.lat })
    })
    map.once("load", () => {
      const center = map.getCenter()
      onMoveEndRef.current?.({ lng: center.lng, lat: center.lat })
    })
    map.once("idle", () => onReadyRef.current?.())
    let settling = false
    const settle = () => {
      if (settling) return
      settling = true
      map.once("idle", () => {
        settling = false
        onSettleRef.current?.(viewOf(map))
      })
    }
    map.once("load", settle)
    map.on("moveend", settle)

    return () => {
      map.remove()
      mapRef.current = null
    }
    // Created once; the effects below apply later prop changes.
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || styleRef.current === mapStyle) return
    const before = styleRef.current
    styleRef.current = mapStyle
    if (map.loaded() || map.isStyleLoaded()) updatePaint(map, before, mapStyle)
    else map.once("load", () => updatePaint(map, before, mapStyle))
  }, [mapStyle])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !routes) return
    map.getSource<GeoJSONSource>(POSTER_ROUTES_SOURCE)?.setData(routes)
  }, [routes])

  useEffect(() => {
    const map = mapRef.current
    if (!map || capturing.current) return
    if (map.getPixelRatio() !== pixelRatio) map.setPixelRatio(pixelRatio)
  }, [pixelRatio])

  useEffect(() => {
    mapRef.current?.resize()
  }, [width, height])

  useImperativeHandle(
    ref,
    () => ({
      async capture(ratio, draw) {
        const map = mapRef.current
        if (!map) return
        capturing.current = true
        try {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(done, CAPTURE_TIMEOUT)
            function done() {
              clearTimeout(timer)
              map!.off("idle", done)
              draw(map!.getCanvas())
              resolve()
            }
            map.on("idle", done)
            map.setPixelRatio(ratio)
          })
        } finally {
          capturing.current = false
          map.setPixelRatio(ratioRef.current)
        }
      },
      fit(bounds) {
        mapRef.current?.fitBounds(
          [bounds[0], bounds[1], bounds[2], bounds[3]],
          { padding: framePadding(width), maxZoom: 14, duration: 700 }
        )
      },
    }),
    [width]
  )

  return (
    <div
      ref={container}
      className="absolute inset-0"
      style={{ width, height }}
    />
  )
}

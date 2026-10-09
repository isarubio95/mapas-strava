import { useEffect, useState, type ReactNode } from "react"

import { MapSkeleton } from "./map-skeleton"
import type { RouteMapProps } from "./route-map"

type RouteMapComponent = (props: RouteMapProps) => ReactNode

/** Loads MapLibre only in the browser, so SSR never sees WebGL or workers. */
export function MapCanvas(props: RouteMapProps) {
  const [MapView, setMapView] = useState<RouteMapComponent | null>(null)

  useEffect(() => {
    let cancelled = false
    void import("./route-map").then((module) => {
      if (!cancelled) setMapView(() => module.RouteMap)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!MapView) return <MapSkeleton className={props.className} />
  return <MapView {...props} />
}

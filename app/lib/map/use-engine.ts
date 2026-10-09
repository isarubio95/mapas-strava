import { useEffect, useRef, useState } from "react"

import type { Activity } from "~/lib/activities"
import type { Filters } from "~/lib/filters"

import {
  createEngineClient,
  type RouteEngineClient,
} from "./engine-client"
import type { DatasetMeta, QueryResult, RouteGeometry } from "./engine"

export function useRouteEngine(activities: Activity[], filters: Filters) {
  const client = useRef<RouteEngineClient | null>(null)
  const [geometry, setGeometry] = useState<RouteGeometry | null>(null)
  const [meta, setMeta] = useState<DatasetMeta | null>(null)
  const [query, setQuery] = useState<QueryResult | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const engine = createEngineClient()
    client.current = engine
    let cancelled = false
    setReady(false)
    setGeometry(null)
    setQuery(null)
    void engine.api.load(activities).then((result) => {
      if (cancelled) return
      setGeometry(result.geometry)
      setMeta(result.meta)
      setReady(true)
    })
    return () => {
      cancelled = true
      engine.terminate()
      if (client.current === engine) client.current = null
    }
  }, [activities])

  useEffect(() => {
    const engine = client.current
    if (!engine || !geometry) return
    let cancelled = false
    void engine.api.query(filters).then((result) => {
      if (!cancelled) setQuery(result)
    })
    return () => {
      cancelled = true
    }
  }, [filters, geometry])

  return { client, geometry, meta, query, ready }
}

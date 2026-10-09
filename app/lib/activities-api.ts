import { useEffect, useState } from "react"

import type { Activity, ActivityProfile } from "~/lib/activities"
import type { SportColors } from "~/lib/sports"
import { createClient } from "~/lib/supabase/client"

interface ActivityRow {
  id: number
  name: string
  sport_type: string
  start_date: string
  start_date_local: string
  distance_m: number
  moving_time_s: number
  elapsed_time_s: number
  elevation_gain_m: number
  summary_polyline: string | null
  zones: string[] | null
  start_zones: string[] | null
}

export function activityFromRow(row: ActivityRow): Activity {
  return {
    id: row.id,
    name: row.name,
    sportType: row.sport_type,
    startDate: row.start_date,
    startDateLocal: row.start_date_local,
    distance: row.distance_m,
    movingTime: row.moving_time_s,
    elapsedTime: row.elapsed_time_s,
    elevationGain: row.elevation_gain_m,
    polyline: row.summary_polyline,
    zones: row.zones ?? [],
    startZones: row.start_zones ?? [],
  }
}

/** Pages through the Data API (1 000 rows per request). */
export async function loadActivities(): Promise<Activity[]> {
  const supabase = createClient()
  const all: Activity[] = []
  const page = 1000
  for (let from = 0; from < 20_000; from += page) {
    const { data, error } = await supabase
      .from("activities")
      .select(
        "id,name,sport_type,start_date,start_date_local,distance_m,moving_time_s,elapsed_time_s,elevation_gain_m,summary_polyline,zones,start_zones"
      )
      .order("start_date", { ascending: true })
      .range(from, from + page - 1)
    if (error) throw error
    const rows = (data ?? []) as ActivityRow[]
    all.push(...rows.map(activityFromRow))
    if (rows.length < page) break
  }
  return all
}

/** The signed-in user's activities, loaded in the browser. `null` while loading. */
export function useActivities() {
  const [activities, setActivities] = useState<Activity[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadActivities()
      .then((rows) => {
        if (!cancelled) setActivities(rows)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { activities, failed }
}

/** Real elevation profile from Strava, cached by the `strava-activity` function. */
export async function loadProfile(
  activity: Activity
): Promise<ActivityProfile | null> {
  if (!activity.polyline) return null
  const supabase = createClient()
  const { data, error } = await supabase.functions.invoke<ActivityProfile>(
    `strava-activity?id=${activity.id}`,
    { method: "GET" }
  )
  if (error || !data) return null
  return data
}

export async function saveSportColor(
  type: string,
  color: string,
  current: SportColors
) {
  const supabase = createClient()
  const sport_colors = { ...current, [type]: color }
  const { data } = await supabase.auth.getUser()
  if (!data.user) return sport_colors
  await supabase.from("preferences").upsert({
    user_id: data.user.id,
    sport_colors,
    updated_at: new Date().toISOString(),
  })
  return sport_colors
}

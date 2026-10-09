import { sql } from "./supabase.ts"
import { exchangeToken, rateLimited, stravaGet } from "./strava.ts"

interface TokenRow {
  user_id: string
  access_token: string
  refresh_token: string
  expires_at: string
}

async function accessToken(userId: string) {
  const [row] = await sql()<TokenRow[]>`
    select user_id, access_token, refresh_token, expires_at
    from private.strava_tokens
    where user_id = ${userId}::uuid
  `
  if (!row) throw new Error("Sin conexión")
  const expires = new Date(row.expires_at).getTime()
  if (expires > Date.now() + 60_000) return row.access_token

  const refreshed = await exchangeToken({
    grant_type: "refresh_token",
    refresh_token: row.refresh_token,
  })
  await sql()`
    update private.strava_tokens set
      access_token = ${refreshed.access_token},
      refresh_token = ${refreshed.refresh_token},
      expires_at = to_timestamp(${refreshed.expires_at})
    where user_id = ${userId}::uuid
  `
  return refreshed.access_token as string
}

interface Summary {
  id: number
  name: string
  sport_type?: string
  type?: string
  start_date: string
  start_date_local: string
  distance: number
  moving_time: number
  elapsed_time: number
  total_elevation_gain: number
  map?: { summary_polyline?: string }
}

/** Downloads every activity page and replaces the 7-day cache for one user. */
export async function syncUser(userId: string) {
  const token = await accessToken(userId)
  const seen: number[] = []
  let page = 1
  let complete = true

  while (page <= 50) {
    const response = await stravaGet(
      `/athlete/activities?page=${page}&per_page=200`,
      token
    )
    if (response.status === 429 || rateLimited(response)) {
      complete = false
      break
    }
    if (!response.ok) throw new Error(`Listado ${response.status}`)
    const batch = (await response.json()) as Summary[]
    if (batch.length === 0) break

    for (const activity of batch) {
      const polyline = activity.map?.summary_polyline || null
      await sql()`
        insert into public.activities (
          id, user_id, name, sport_type, start_date, start_date_local,
          distance_m, moving_time_s, elapsed_time_s, elevation_gain_m,
          summary_polyline, fetched_at
        ) values (
          ${activity.id},
          ${userId}::uuid,
          ${activity.name},
          ${activity.sport_type ?? activity.type ?? "Workout"},
          ${activity.start_date}::timestamptz,
          ${activity.start_date_local.replace(/Z$/, "")}::timestamp,
          ${activity.distance ?? 0},
          ${activity.moving_time ?? 0},
          ${activity.elapsed_time ?? 0},
          ${activity.total_elevation_gain ?? 0},
          ${polyline},
          now()
        )
        on conflict (id) do update set
          user_id = excluded.user_id,
          name = excluded.name,
          sport_type = excluded.sport_type,
          start_date = excluded.start_date,
          start_date_local = excluded.start_date_local,
          distance_m = excluded.distance_m,
          moving_time_s = excluded.moving_time_s,
          elapsed_time_s = excluded.elapsed_time_s,
          elevation_gain_m = excluded.elevation_gain_m,
          summary_polyline = excluded.summary_polyline,
          fetched_at = now()
      `
      if (polyline) {
        await sql()`
          update public.activities
          set geom = extensions.st_linefromencodedpolyline(${polyline})
          where id = ${activity.id}
        `
        await sql()`select public.assign_activity_zones(${activity.id})`
      }
      seen.push(activity.id)
    }

    if (batch.length < 200) break
    page += 1
  }

  if (complete) {
    await sql()`
      delete from public.activities
      where user_id = ${userId}::uuid
        and id <> all(${seen}::bigint[])
    `
  }

  await sql()`
    update public.strava_accounts set last_sync_at = now() where user_id = ${userId}::uuid
  `
  return { imported: seen.length, complete }
}

export async function syncActiveUsers() {
  const rows = await sql()`
    select a.user_id
    from public.strava_accounts a
    join auth.users u on u.id = a.user_id
    where u.last_sign_in_at > now() - interval '7 days'
  `
  const results = []
  for (const row of rows) {
    results.push({ userId: row.user_id, ...(await syncUser(row.user_id)) })
  }
  return results
}

export async function forgetAthlete(athleteId: number) {
  const [account] = await sql()`
    select user_id from public.strava_accounts where athlete_id = ${athleteId}
  `
  if (!account) return
  await sql()`delete from public.activities where user_id = ${account.user_id}::uuid`
  await sql()`delete from private.strava_tokens where user_id = ${account.user_id}::uuid`
  await sql()`delete from public.strava_accounts where user_id = ${account.user_id}::uuid`
}

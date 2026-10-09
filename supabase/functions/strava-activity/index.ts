import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { json, preflight, sql, userIdFrom } from "../_shared/supabase.ts"
import { exchangeToken, stravaGet } from "../_shared/strava.ts"

Deno.serve(async (req) => {
  const cors = preflight(req)
  if (cors) return cors
  if (req.method !== "GET") return json({ error: "Método no permitido" }, 405)
  const userId = await userIdFrom(req)
  if (!userId) return json({ error: "Necesitas entrar" }, 401)

  const id = Number(new URL(req.url).searchParams.get("id"))
  if (!Number.isFinite(id)) return json({ error: "Actividad desconocida" }, 400)

  const [cached] = await sql()`
    select distance, altitude, fetched_at
    from public.activity_streams
    where activity_id = ${id} and user_id = ${userId}::uuid
      and fetched_at > now() - interval '7 days'
  `
  if (cached) {
    return json({ distance: cached.distance, altitude: cached.altitude })
  }

  const [tokenRow] = await sql()`
    select access_token, refresh_token, expires_at
    from private.strava_tokens
    where user_id = ${userId}::uuid
  `
  if (!tokenRow) return json({ error: "Sin conexión" }, 404)

  let token = tokenRow.access_token as string
  if (new Date(tokenRow.expires_at).getTime() < Date.now() + 60_000) {
    const refreshed = await exchangeToken({
      grant_type: "refresh_token",
      refresh_token: tokenRow.refresh_token,
    })
    token = refreshed.access_token
    await sql()`
      update private.strava_tokens set
        access_token = ${refreshed.access_token},
        refresh_token = ${refreshed.refresh_token},
        expires_at = to_timestamp(${refreshed.expires_at})
      where user_id = ${userId}::uuid
    `
  }

  const response = await stravaGet(
    `/activities/${id}/streams?keys=distance,altitude&key_by_type=true`,
    token
  )
  if (response.status === 404) return json({ distance: [], altitude: [] })
  if (!response.ok) return json({ error: "No se ha podido cargar el perfil" }, 502)

  const streams = await response.json()
  const distance = streams.distance?.data ?? []
  const altitude = streams.altitude?.data ?? []
  await sql()`
    insert into public.activity_streams (activity_id, user_id, distance, altitude, fetched_at)
    values (${id}, ${userId}::uuid, ${distance}, ${altitude}, now())
    on conflict (activity_id) do update set
      distance = excluded.distance,
      altitude = excluded.altitude,
      fetched_at = now()
  `
  return json({ distance, altitude })
})

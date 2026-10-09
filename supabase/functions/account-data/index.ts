import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { admin, json, preflight, sql, userIdFrom } from "../_shared/supabase.ts"
import { oauthBase } from "../_shared/strava.ts"

const CONFIRM = "BORRAR"

Deno.serve(async (req) => {
  const cors = preflight(req)
  if (cors) return cors
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405)
  const userId = await userIdFrom(req)
  if (!userId) return json({ error: "Necesitas entrar" }, 401)

  const body = await req.json().catch(() => ({}))
  const db = sql()

  if (body.action === "export") {
    const activities = await db`
      select id, name, sport_type, start_date, start_date_local, distance_m,
             moving_time_s, elapsed_time_s, elevation_gain_m, summary_polyline, zones
      from public.activities
      where user_id = ${userId}::uuid
      order by start_date
    `
    const preferences = await db`
      select theme, sport_colors, map_labels, poster from public.preferences
      where user_id = ${userId}::uuid
    `
    return json({ exportedAt: new Date().toISOString(), preferences, activities })
  }

  if (body.action === "disconnect" || body.action === "delete") {
    if (body.action === "delete" && body.confirmation !== CONFIRM) {
      return json({ error: `Escribe ${CONFIRM} para confirmar` }, 400)
    }
    const [tokenRow] = await db`
      select access_token from private.strava_tokens where user_id = ${userId}::uuid
    `
    if (tokenRow) {
      await fetch(`${oauthBase()}/oauth/deauthorize`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenRow.access_token}` },
      }).catch(() => undefined)
    }
    await db`delete from public.activities where user_id = ${userId}::uuid`
    await db`delete from private.strava_tokens where user_id = ${userId}::uuid`
    await db`delete from public.strava_accounts where user_id = ${userId}::uuid`

    if (body.action === "delete") {
      await db`delete from public.preferences where user_id = ${userId}::uuid`
      await admin().auth.admin.deleteUser(userId)
    }
    return json({ ok: true })
  }

  return json({ error: "Acción desconocida" }, 400)
})

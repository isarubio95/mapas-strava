import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { sql } from "../_shared/supabase.ts"
import { exchangeToken } from "../_shared/strava.ts"
import { syncUser } from "../_shared/sync.ts"

function site() {
  return Deno.env.get("SITE_URL") ?? "http://localhost:5173"
}

const SCOPE = "read,activity:read_all"

Deno.serve(async (req) => {
  const incoming = new URL(req.url)
  const code = incoming.searchParams.get("code")
  const state = incoming.searchParams.get("state")
  const denied = incoming.searchParams.get("error")
  const back = new URL("/conectar", site())

  if (denied || !code || !state) {
    back.searchParams.set("error", "cancelado")
    return Response.redirect(back, 302)
  }

  const [row] = await sql()`
    delete from private.oauth_states
    where state = ${state} and expires_at > now()
    returning user_id
  `
  if (!row) {
    back.searchParams.set("error", "estado")
    return Response.redirect(back, 302)
  }

  const token = await exchangeToken({ code, grant_type: "authorization_code" })
  const athlete = token.athlete
  const userId = row.user_id as string

  await sql()`
    insert into private.strava_tokens (user_id, access_token, refresh_token, expires_at)
    values (
      ${userId}::uuid,
      ${token.access_token},
      ${token.refresh_token},
      to_timestamp(${token.expires_at})
    )
    on conflict (user_id) do update set
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      expires_at = excluded.expires_at
  `
  await sql()`
    insert into public.strava_accounts (user_id, athlete_id, username, firstname, lastname, scope)
    values (
      ${userId}::uuid,
      ${athlete.id},
      ${athlete.username ?? null},
      ${athlete.firstname ?? null},
      ${athlete.lastname ?? null},
      ${SCOPE}
    )
    on conflict (user_id) do update set
      athlete_id = excluded.athlete_id,
      username = excluded.username,
      firstname = excluded.firstname,
      lastname = excluded.lastname,
      scope = excluded.scope,
      connected_at = now()
  `

  const job = syncUser(userId).catch((error) => console.error("sync", error))
  // Respond before the download finishes. Strava only waits on the redirect.
  EdgeRuntime.waitUntil(job)
  return Response.redirect(new URL("/", site()), 302)
})

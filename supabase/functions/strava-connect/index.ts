import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { json, preflight, sql, userIdFrom } from "../_shared/supabase.ts"
import { clientId, oauthBase, redirectUri, STRAVA_SCOPES } from "../_shared/strava.ts"

Deno.serve(async (req) => {
  const cors = preflight(req)
  if (cors) return cors
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405)
  const userId = await userIdFrom(req)
  if (!userId) return json({ error: "Necesitas entrar" }, 401)

  const state = crypto.randomUUID()
  await sql()`
    insert into private.oauth_states (state, user_id)
    values (${state}, ${userId}::uuid)
  `

  const url = new URL(`${oauthBase()}/oauth/authorize`)
  url.searchParams.set("client_id", clientId())
  url.searchParams.set("redirect_uri", redirectUri())
  url.searchParams.set("response_type", "code")
  url.searchParams.set("approval_prompt", "auto")
  url.searchParams.set("scope", STRAVA_SCOPES)
  url.searchParams.set("state", state)
  return json({ url: url.toString() })
})

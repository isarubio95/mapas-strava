import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { forgetAthlete, syncUser } from "../_shared/sync.ts"
import { sql } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const url = new URL(req.url)

  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode")
    const token = url.searchParams.get("hub.verify_token")
    const challenge = url.searchParams.get("hub.challenge")
    const expected = Deno.env.get("STRAVA_WEBHOOK_VERIFY_TOKEN")
    if (mode === "subscribe" && token && token === expected && challenge) {
      return Response.json({ "hub.challenge": challenge })
    }
    return new Response("forbidden", { status: 403 })
  }

  if (req.method !== "POST") return new Response("method", { status: 405 })

  const event = await req.json()
  const work = handle(event).catch((error) => console.error("webhook", error))
  EdgeRuntime.waitUntil(work)
  return new Response("ok", { status: 200 })
})

async function handle(event: {
  object_type?: string
  aspect_type?: string
  object_id?: number
  owner_id?: number
  updates?: { authorized?: string }
}) {
  if (event.object_type === "athlete" && event.updates?.authorized === "false") {
    if (event.owner_id) await forgetAthlete(event.owner_id)
    return
  }
  if (event.object_type !== "activity" || !event.owner_id || !event.object_id) return

  const [account] = await sql()`
    select user_id from public.strava_accounts where athlete_id = ${event.owner_id}
  `
  if (!account) return

  if (event.aspect_type === "delete") {
    await sql()`
      delete from public.activities
      where id = ${event.object_id} and user_id = ${account.user_id}::uuid
    `
    return
  }

  await syncUser(account.user_id)
}

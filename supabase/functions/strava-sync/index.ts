import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { syncActiveUsers, syncUser } from "../_shared/sync.ts"
import { isCron, json, preflight, userIdFrom } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  const cors = preflight(req)
  if (cors) return cors
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405)

  let body: { reconcile?: boolean; userId?: string } = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  if (isCron(req)) {
    if (body.userId) return json(await syncUser(body.userId))
    return json({ users: await syncActiveUsers() })
  }

  const userId = await userIdFrom(req)
  if (!userId) return json({ error: "Necesitas entrar" }, 401)
  return json(await syncUser(userId))
})

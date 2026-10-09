import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2"
import postgres from "npm:postgres"

let db: ReturnType<typeof postgres> | null = null

/** Direct Postgres connection. Used for the unexposed `private` schema. */
export function sql() {
  if (!db) {
    db = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1 })
  }
  return db
}

export function admin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function userIdFrom(req: Request): Promise<string | null> {
  const header = req.headers.get("Authorization")
  if (!header?.startsWith("Bearer ")) return null
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: header } }, auth: { persistSession: false } }
  )
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) return null
  return data.user.id
}

export function isCron(req: Request) {
  const secret = Deno.env.get("CRON_SECRET")
  if (!secret) return false
  return req.headers.get("x-cron-secret") === secret
}

/** Auth goes in the Authorization header, not cookies, so any origin is safe. */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}

/** Answers the browser's CORS preflight. Returns null for any other request. */
export function preflight(req: Request) {
  return req.method === "OPTIONS" ? new Response("ok", { headers: corsHeaders }) : null
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  })
}

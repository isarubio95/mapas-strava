import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
} from "@supabase/ssr"
import { redirect } from "react-router"

// VITE_ variables are inlined at build time, so the server bundle does not
// depend on process.env being populated at runtime.
export function createClient(request: Request) {
  const headers = new Headers()

  const supabase = createServerClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get("Cookie") ?? "") as {
            name: string
            value: string
          }[]
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            headers.append(
              "Set-Cookie",
              serializeCookieHeader(name, value, options)
            )
          )
        },
      },
    }
  )

  return { supabase, headers }
}

export async function getUser(request: Request) {
  const { supabase, headers } = createClient(request)
  const { data, error } = await supabase.auth.getClaims()
  const claims = error ? null : (data?.claims ?? null)

  return {
    supabase,
    headers,
    user: claims
      ? { id: claims.sub, email: (claims.email as string | undefined) ?? "" }
      : null,
  }
}

export async function requireUser(request: Request) {
  const result = await getUser(request)

  if (!result.user) {
    const url = new URL(request.url)
    const next = `${url.pathname}${url.search}`
    throw redirect(`/entrar?next=${encodeURIComponent(next)}`, {
      headers: result.headers,
    })
  }

  return { ...result, user: result.user }
}

// The map pages are useless without Strava data, so a signed-in user who has
// not connected yet is sent to /conectar instead.
export async function requireStravaAccount(request: Request) {
  const result = await requireUser(request)
  const { data: account } = await result.supabase
    .from("strava_accounts")
    .select("athlete_id, firstname, lastname")
    .maybeSingle()

  if (!account) throw redirect("/conectar", { headers: result.headers })

  return { ...result, account }
}

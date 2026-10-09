export const STRAVA_SCOPES = "read,activity:read_all"

export function apiBase() {
  return (Deno.env.get("STRAVA_API_BASE") ?? "https://www.strava.com/api/v3").replace(/\/$/, "")
}

export function oauthBase() {
  return (Deno.env.get("STRAVA_OAUTH_BASE") ?? "https://www.strava.com").replace(/\/$/, "")
}

export function clientId() {
  const id = Deno.env.get("STRAVA_CLIENT_ID")
  if (!id) throw new Error("Falta STRAVA_CLIENT_ID")
  return id
}

export function clientSecret() {
  const secret = Deno.env.get("STRAVA_CLIENT_SECRET")
  if (!secret) throw new Error("Falta STRAVA_CLIENT_SECRET")
  return secret
}

export function redirectUri() {
  const explicit = Deno.env.get("STRAVA_REDIRECT_URI")
  if (explicit) return explicit
  return `${Deno.env.get("SUPABASE_URL")}/functions/v1/strava-callback`
}

export async function exchangeToken(body: Record<string, string>) {
  const response = await fetch(`${oauthBase()}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: clientId(),
      client_secret: clientSecret(),
      ...body,
    }),
  })
  if (!response.ok) {
    throw new Error(`Strava token ${response.status}`)
  }
  return response.json()
}

export async function stravaGet(path: string, token: string) {
  const response = await fetch(`${apiBase()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response
}

export function rateLimited(response: Response) {
  const usage = response.headers.get("x-ratelimit-usage")
  if (!usage) return false
  const [quarter] = usage.split(",").map((part) => Number(part))
  return quarter >= 90
}

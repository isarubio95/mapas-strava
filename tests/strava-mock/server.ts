/**
 * Stand-in for the Strava API. STRAVA_API_BASE and STRAVA_OAUTH_BASE point here
 * in tests. It only serves synthetic activities.
 */
import { createServer } from "node:http"

import { decodePolyline } from "../../app/lib/polyline"
import { generateActivities, syntheticStreams, toStravaSummary } from "../fixtures/synthetic"

const activities = generateActivities({ count: 80, seed: 11 })
const athleteId = 424242
const portFlag = process.argv.indexOf("--port")
const port = Number(portFlag >= 0 ? process.argv[portFlag + 1] : 4010)

const token = {
  token_type: "Bearer",
  access_token: "mock-access",
  refresh_token: "mock-refresh",
  expires_at: Math.floor(Date.now() / 1000) + 86_400,
  expires_in: 86_400,
  athlete: { id: athleteId, username: "trazo", firstname: "Trazo", lastname: "Demo" },
}

function send(res: import("node:http").ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    "content-type": "application/json",
    "x-ratelimit-limit": "100,1000",
    "x-ratelimit-usage": "1,1",
  })
  res.end(payload)
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`)

  if (url.pathname === "/oauth/authorize") {
    const back = new URL(url.searchParams.get("redirect_uri") || "http://localhost:5173")
    back.searchParams.set("code", "mock-code")
    back.searchParams.set("scope", "read,activity:read_all")
    if (url.searchParams.get("state")) back.searchParams.set("state", url.searchParams.get("state")!)
    res.writeHead(302, { location: back.toString() })
    res.end()
    return
  }

  if (url.pathname === "/oauth/token" || url.pathname === "/oauth/deauthorize") {
    send(res, 200, token)
    return
  }

  if (url.pathname === "/api/v3/athlete") {
    send(res, 200, token.athlete)
    return
  }

  if (url.pathname === "/api/v3/athlete/activities") {
    const page = Number(url.searchParams.get("page") ?? 1)
    const perPage = Number(url.searchParams.get("per_page") ?? 200)
    const slice = activities.slice((page - 1) * perPage, page * perPage)
    send(res, 200, slice.map((activity) => toStravaSummary(activity, athleteId)))
    return
  }

  const stream = url.pathname.match(/^\/api\/v3\/activities\/(\d+)\/streams$/)
  if (stream) {
    const activity = activities.find((item) => item.id === Number(stream[1]))
    if (!activity?.polyline) {
      send(res, 200, { distance: { data: [] }, altitude: { data: [] } })
      return
    }
    const coords = decodePolyline(activity.polyline)
    const { distance, altitude } = syntheticStreams(activity, coords)
    send(res, 200, { distance: { data: distance }, altitude: { data: altitude } })
    return
  }

  send(res, 404, { message: "not found" })
})

server.listen(port, "127.0.0.1", () => {
  console.log(`strava mock on http://127.0.0.1:${port}`)
})

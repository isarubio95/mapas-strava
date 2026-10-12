import { MapApp } from "~/components/shell/map-app"
import type { Activity, ActivityProfile } from "~/lib/activities"
import { decodePolyline } from "~/lib/polyline"
import {
  generateActivities,
  syntheticStreams,
  SYNTHETIC_ZONES,
} from "../../tests/fixtures/synthetic"

import type { Route } from "./+types/prototipos"

export const meta: Route.MetaFunction = () => [
  { title: "Prototipos · Trazo" },
  {
    name: "description",
    content: "Tres formas de ver todas tus rutas en un mapa.",
  },
]

const DEMO = generateActivities({ count: 800, seed: 7 })

async function demoProfile(
  activity: Activity
): Promise<ActivityProfile | null> {
  return activity.polyline
    ? syntheticStreams(activity, decodePolyline(activity.polyline))
    : null
}

export default function Prototipos() {
  return (
    <MapApp
      activities={DEMO}
      zones={SYNTHETIC_ZONES}
      loadProfile={demoProfile}
    />
  )
}

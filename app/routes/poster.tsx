import { useMemo } from "react"
import { data, useSearchParams } from "react-router"

import { RoutesLoader } from "~/components/loader/routes-loader"
import { PosterStudio } from "~/components/poster/poster-studio"
import { useActivities } from "~/lib/activities-api"
import { filtersFromSearch } from "~/lib/filters-url"
import { parseBBox } from "~/lib/poster"
import type { SportColors } from "~/lib/sports"
import { requireStravaAccount } from "~/lib/supabase/server"

import type { Route } from "./+types/poster"

export const meta: Route.MetaFunction = () => [{ title: "Póster · Trazo" }]

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = await requireStravaAccount(request)
  const { data: prefs } = await supabase
    .from("preferences")
    .select("sport_colors")
    .maybeSingle()
  return data(
    { sportColors: (prefs?.sport_colors ?? {}) as SportColors },
    { headers }
  )
}

export default function Poster({ loaderData }: Route.ComponentProps) {
  const { activities, failed } = useActivities()
  const [params] = useSearchParams()
  const filters = useMemo(() => filtersFromSearch(params), [params])
  const view = useMemo(() => parseBBox(params.get("encuadre")), [params])
  const routeId = Number(params.get("ruta")) || null

  if (failed) {
    return (
      <main className="flex h-svh items-center justify-center bg-background">
        <p className="text-muted-foreground">
          No se han podido cargar tus rutas. Recarga la página.
        </p>
      </main>
    )
  }

  if (!activities) return <RoutesLoader />

  return (
    <PosterStudio
      activities={activities}
      filters={filters}
      routeId={routeId}
      view={view}
      sportColors={loaderData.sportColors}
    />
  )
}

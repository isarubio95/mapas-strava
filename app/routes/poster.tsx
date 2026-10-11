import { useMemo } from "react"
import { data, useSearchParams } from "react-router"

import { PosterStudio } from "~/components/poster/poster-studio"
import { useActivities } from "~/lib/activities-api"
import { filtersFromSearch } from "~/lib/filters-url"
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

  if (!activities) {
    return (
      <main className="flex h-svh items-center justify-center bg-background">
        <p className="text-muted-foreground">
          {failed
            ? "No se han podido cargar tus rutas. Recarga la página."
            : "Cargando tus rutas…"}
        </p>
      </main>
    )
  }

  return (
    <PosterStudio
      activities={activities}
      filters={filters}
      sportColors={loaderData.sportColors}
    />
  )
}

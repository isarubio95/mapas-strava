import { data } from "react-router"

import { RoutesLoader } from "~/components/loader/routes-loader"
import { MapApp } from "~/components/shell/map-app"
import { loadProfile, useActivities } from "~/lib/activities-api"
import type { SportColors } from "~/lib/sports"
import { requireStravaAccount } from "~/lib/supabase/server"

import type { Route } from "./+types/_index"

export const meta: Route.MetaFunction = () => [{ title: "Trazo" }]

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers, user, account } =
    await requireStravaAccount(request)
  const { data: prefs } = await supabase
    .from("preferences")
    .select("sport_colors")
    .maybeSingle()
  const name = [account.firstname, account.lastname].filter(Boolean).join(" ")
  return data(
    {
      sportColors: (prefs?.sport_colors ?? {}) as SportColors,
      account: { name: name || null, email: user.email },
    },
    { headers }
  )
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const { activities, failed } = useActivities()

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
    <MapApp
      activities={activities}
      sportColors={loaderData.sportColors}
      loadProfile={loadProfile}
      account={loaderData.account}
    />
  )
}

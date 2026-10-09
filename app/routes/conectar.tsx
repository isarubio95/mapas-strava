import { data, Link, redirect, useSearchParams } from "react-router"
import { useState } from "react"

import { Logo } from "~/components/logo"
import { Button } from "~/components/ui/button"
import { requireUser } from "~/lib/supabase/server"
import { createClient } from "~/lib/supabase/client"

import type { Route } from "./+types/conectar"

export const meta: Route.MetaFunction = () => [{ title: "Conectar · Trazo" }]

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = await requireUser(request)
  const { data: account } = await supabase.from("strava_accounts").select("athlete_id").maybeSingle()
  if (account) throw redirect("/", { headers })
  return data({}, { headers })
}

export default function Conectar() {
  const [params] = useSearchParams()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(
    params.get("error") ? "No se ha completado la conexión." : null
  )

  async function connect() {
    setPending(true)
    setError(null)
    const supabase = createClient()
    const { data: result, error: invokeError } = await supabase.functions.invoke("strava-connect", {
      body: {},
    })
    if (invokeError || !result?.url) {
      setError("No se ha podido iniciar la conexión. Revisa la configuración de la app.")
      setPending(false)
      return
    }
    window.location.assign(result.url as string)
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-6 p-6">
      <Logo />
      <div className="panel rounded-4xl p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Conecta tu cuenta</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Trazo descarga tus actividades para dibujarlas en el mapa. Solo tú las ves. Se guardan
          como caché durante 7 días y se borran si no entras. Puedes exportarlas o eliminarlas
          cuando quieras desde Ajustes.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Permisos: leer tu perfil y todas tus actividades.</li>
          <li>No se usan para entrenar modelos ni para analítica de terceros.</li>
          <li>Puedes revocar el acceso en Strava y aquí.</li>
        </ul>
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        <Button type="button" className="mt-6" disabled={pending} onClick={() => void connect()}>
          {pending ? "Abriendo…" : "Connect with Strava"}
        </Button>
        <p className="mt-4 text-xs text-muted-foreground">
          <Link to="/privacidad" className="underline">
            Política de privacidad
          </Link>
        </p>
      </div>
    </main>
  )
}

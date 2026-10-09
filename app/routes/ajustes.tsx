import { data, Form, Link } from "react-router"
import { useState } from "react"

import { Logo } from "~/components/logo"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { saveSportColor } from "~/lib/activities-api"
import { SPORTS, type SportColors } from "~/lib/sports"
import { createClient } from "~/lib/supabase/client"
import { requireUser } from "~/lib/supabase/server"

import type { Route } from "./+types/ajustes"

export const meta: Route.MetaFunction = () => [{ title: "Ajustes · Trazo" }]

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = await requireUser(request)
  const [{ data: account }, { data: prefs }] = await Promise.all([
    supabase.from("strava_accounts").select("firstname, athlete_id").maybeSingle(),
    supabase.from("preferences").select("sport_colors").maybeSingle(),
  ])
  return data(
    {
      connected: Boolean(account),
      name: account?.firstname ?? null,
      sportColors: (prefs?.sport_colors ?? {}) as SportColors,
    },
    { headers }
  )
}

export default function Ajustes({ loaderData }: Route.ComponentProps) {
  const [colors, setColors] = useState<SportColors>(loaderData.sportColors)
  const [confirmation, setConfirmation] = useState("")
  const [message, setMessage] = useState<string | null>(null)

  async function call(action: "export" | "disconnect" | "delete") {
    const supabase = createClient()
    const { data: result, error } = await supabase.functions.invoke("account-data", {
      body: { action, confirmation },
    })
    if (error) {
      setMessage("No se ha podido completar.")
      return
    }
    if (action === "export") {
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "trazo.json"
      link.click()
      URL.revokeObjectURL(url)
      return
    }
    if (action === "delete") {
      window.location.assign("/entrar")
      return
    }
    setMessage("Cuenta desconectada.")
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
      <Link to="/" aria-label="Trazo, inicio">
        <Logo />
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">Ajustes</h1>
      <p className="text-sm text-muted-foreground">
        {loaderData.connected
          ? `Conectada${loaderData.name ? ` como ${loaderData.name}` : ""}.`
          : "Todavía no hay una cuenta conectada."}{" "}
        <Link to="/conectar" className="underline">
          Conectar
        </Link>
      </p>

      <section className="panel rounded-4xl p-5">
        <h2 className="font-semibold">Colores</h2>
        <ul className="mt-3 grid gap-2">
          {SPORTS.slice(0, 8).map((sport) => (
            <li key={sport.type} className="flex items-center justify-between gap-3 text-sm">
              <span>{sport.label}</span>
              <input
                aria-label={`Color de ${sport.label}`}
                type="color"
                value={colors[sport.type] ?? sport.color}
                onChange={(event) => {
                  const next = event.target.value
                  setColors((current) => ({ ...current, [sport.type]: next }))
                  void saveSportColor(sport.type, next, colors)
                }}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="panel flex flex-col gap-3 rounded-4xl p-5">
        <h2 className="font-semibold">Tus datos</h2>
        <Button type="button" variant="outline" onClick={() => void call("export")}>
          Exportar
        </Button>
        <Button type="button" variant="outline" onClick={() => void call("disconnect")}>
          Desconectar
        </Button>
        <label className="text-sm text-muted-foreground">
          Escribe BORRAR para eliminar la cuenta y la caché.
          <Input
            className="mt-2"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </label>
        <Button type="button" variant="destructive" onClick={() => void call("delete")}>
          Eliminar todo
        </Button>
        {message && <p className="text-sm">{message}</p>}
      </section>

      <Form method="post" action="/salir">
        <Button type="submit" variant="ghost">
          Salir
        </Button>
      </Form>
      <Link to="/privacidad" className="text-sm underline">
        Privacidad
      </Link>
    </main>
  )
}

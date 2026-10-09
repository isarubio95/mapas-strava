import { Link } from "react-router"

import { Logo } from "~/components/logo"

import type { Route } from "./+types/privacidad"

export const meta: Route.MetaFunction = () => [{ title: "Privacidad · Trazo" }]

export default function Privacidad() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
      <Link to="/" aria-label="Trazo, inicio">
        <Logo />
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">Privacidad</h1>
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          Trazo muestra tus propias actividades de Strava en un mapa. No publica tus rutas y no
          las enseña a otras personas.
        </p>
        <p>
          La copia en la base de datos es una caché de como máximo 7 días. Si no entras en ese
          plazo, se borra y se vuelve a descargar la próxima vez. Tus preferencias (colores, tema
          y pósteres) sí se conservan.
        </p>
        <p>
          Lo que borres en Strava desaparece aquí mediante avisos de la API y una revisión diaria.
          Desde Ajustes puedes exportar tus datos o eliminarlos. Al eliminarlos, Trazo revoca el
          acceso en Strava.
        </p>
        <p>
          Los datos de Strava no se envían a modelos de inteligencia artificial ni a herramientas
          de analítica. El mapa usa teselas de OpenFreeMap, con datos de OpenStreetMap.
        </p>
        <p>Para escribirnos sobre tus datos, usa la dirección con la que creaste la cuenta.</p>
      </div>
    </main>
  )
}

import { Link } from "react-router"

import type { Route } from "./+types/auth.error"
import { AuthLayout } from "~/components/auth/auth-layout"

export const meta: Route.MetaFunction = () => [
  { title: "Enlace no válido · Trazo" },
]

export default function AuthError() {
  return (
    <AuthLayout
      title="Este enlace ya no sirve"
      description="Puede que haya caducado o que ya lo hayas usado. Pide uno nuevo desde la pantalla de entrada."
      footer={
        <Link
          to="/entrar"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Volver a entrar
        </Link>
      }
    />
  )
}

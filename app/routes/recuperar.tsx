import { Link, data, redirect, useFetcher, useSearchParams } from "react-router"

import type { Route } from "./+types/recuperar"
import { AuthLayout } from "~/components/auth/auth-layout"
import { Button } from "~/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import { authErrorMessage } from "~/lib/auth-errors"
import { createClient } from "~/lib/supabase/server"

export const meta: Route.MetaFunction = () => [
  { title: "Recuperar contraseña · Trazo" },
]

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createClient(request)
  const origin = new URL(request.url).origin
  const formData = await request.formData()

  const { error } = await supabase.auth.resetPasswordForEmail(
    String(formData.get("email") ?? ""),
    { redirectTo: `${origin}/auth/confirm?next=/nueva-contrasena` }
  )

  if (error) return data({ error: authErrorMessage(error) }, { headers })

  return redirect("/recuperar?enviado", { headers })
}

const backToLogin = (
  <Link
    to="/entrar"
    className="font-medium text-foreground underline-offset-4 hover:underline"
  >
    Volver a entrar
  </Link>
)

export default function Recuperar() {
  const fetcher = useFetcher<typeof action>()
  const [searchParams] = useSearchParams()
  const error = fetcher.data?.error
  const loading = fetcher.state !== "idle"

  if (searchParams.has("enviado")) {
    return (
      <AuthLayout
        title="Revisa tu correo"
        description="Si hay una cuenta con ese correo, te llegará un enlace para elegir una contraseña nueva."
        footer={backToLogin}
      />
    )
  }

  return (
    <AuthLayout
      title="Recupera tu contraseña"
      description="Te enviaremos un enlace para crear una nueva."
      footer={backToLogin}
    >
      <fetcher.Form method="post">
        <FieldGroup className="gap-5">
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              aria-invalid={error ? true : undefined}
              required
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <Button type="submit" size="lg" disabled={loading}>
            {loading && <Spinner data-icon="inline-start" />}
            {loading ? "Enviando…" : "Enviar enlace"}
          </Button>
        </FieldGroup>
      </fetcher.Form>
    </AuthLayout>
  )
}

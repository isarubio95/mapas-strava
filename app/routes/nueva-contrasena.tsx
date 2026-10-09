import { data, redirect, useFetcher } from "react-router"

import type { Route } from "./+types/nueva-contrasena"
import { AuthLayout } from "~/components/auth/auth-layout"
import { Button } from "~/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import { authErrorMessage } from "~/lib/auth-errors"
import { requireUser } from "~/lib/supabase/server"

const MIN_PASSWORD = 8

export const meta: Route.MetaFunction = () => [
  { title: "Nueva contraseña · Trazo" },
]

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireUser(request)
  return data(null, { headers })
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = await requireUser(request)
  const formData = await request.formData()
  const password = String(formData.get("password") ?? "")

  if (password.length < MIN_PASSWORD) {
    return { error: `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.` }
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return data({ error: authErrorMessage(error) }, { headers })

  return redirect("/", { headers })
}

export default function NuevaContrasena() {
  const fetcher = useFetcher<typeof action>()
  const error = fetcher.data?.error
  const loading = fetcher.state !== "idle"

  return (
    <AuthLayout
      title="Nueva contraseña"
      description="Elige la contraseña con la que entrarás a partir de ahora."
    >
      <fetcher.Form method="post">
        <FieldGroup className="gap-5">
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="password">Contraseña nueva</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD}
              aria-invalid={error ? true : undefined}
              required
            />
            <FieldDescription>
              Al menos {MIN_PASSWORD} caracteres.
            </FieldDescription>
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <Button type="submit" size="lg" disabled={loading}>
            {loading && <Spinner data-icon="inline-start" />}
            {loading ? "Guardando…" : "Guardar contraseña"}
          </Button>
        </FieldGroup>
      </fetcher.Form>
    </AuthLayout>
  )
}

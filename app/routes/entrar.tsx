import { Link, redirect, useFetcher, useSearchParams } from "react-router"

import type { Route } from "./+types/entrar"
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
import { safeNextPath } from "~/lib/safe-next-path"
import { createClient, getUser } from "~/lib/supabase/server"

export const meta: Route.MetaFunction = () => [{ title: "Entrar · Trazo" }]

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await getUser(request)
  if (user) throw redirect("/", { headers })
  return null
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createClient(request)
  const origin = new URL(request.url).origin
  const formData = await request.formData()

  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  })

  if (error) return { error: authErrorMessage(error) }

  return redirect(safeNextPath(formData.get("next"), "/", origin), { headers })
}

export default function Entrar() {
  const fetcher = useFetcher<typeof action>()
  const [searchParams] = useSearchParams()
  const error = fetcher.data?.error
  const loading = fetcher.state !== "idle"

  return (
    <AuthLayout
      title="Entra en Trazo"
      description="Todas tus rutas, en un solo mapa."
      footer={
        <>
          ¿No tienes cuenta?{" "}
          <Link
            to="/registro"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Crear cuenta
          </Link>
        </>
      }
    >
      <fetcher.Form method="post">
        <input
          type="hidden"
          name="next"
          value={searchParams.get("next") ?? ""}
        />
        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              required
            />
          </Field>
          <Field data-invalid={error ? true : undefined}>
            <div className="flex items-center">
              <FieldLabel htmlFor="password">Contraseña</FieldLabel>
              <Link
                to="/recuperar"
                className="ml-auto text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                ¿La has olvidado?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={error ? true : undefined}
              required
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <Button type="submit" size="lg" disabled={loading}>
            {loading && <Spinner data-icon="inline-start" />}
            {loading ? "Entrando…" : "Entrar"}
          </Button>
        </FieldGroup>
      </fetcher.Form>
    </AuthLayout>
  )
}

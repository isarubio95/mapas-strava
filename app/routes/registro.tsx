import { Link, data, redirect, useFetcher, useSearchParams } from "react-router"

import type { Route } from "./+types/registro"
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
import { createClient, getUser } from "~/lib/supabase/server"

const MIN_PASSWORD = 8

export const meta: Route.MetaFunction = () => [
  { title: "Crear cuenta · Trazo" },
]

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await getUser(request)
  if (user) throw redirect("/", { headers })
  return null
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createClient(request)
  const origin = new URL(request.url).origin
  const formData = await request.formData()

  const email = String(formData.get("email") ?? "")
  const password = String(formData.get("password") ?? "")
  const repeatPassword = String(formData.get("repeat-password") ?? "")

  if (password.length < MIN_PASSWORD) {
    return { error: `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.` }
  }
  if (password !== repeatPassword) {
    return { error: "Las contraseñas no coinciden." }
  }

  const { data: signUp, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/confirm?next=/conectar` },
  })

  if (error) return data({ error: authErrorMessage(error) }, { headers })

  // Without email confirmation (local development) the session already exists.
  if (signUp.session) return redirect("/conectar", { headers })

  return redirect("/registro?enviado", { headers })
}

export default function Registro() {
  const fetcher = useFetcher<typeof action>()
  const [searchParams] = useSearchParams()
  const error = fetcher.data?.error
  const loading = fetcher.state !== "idle"

  if (searchParams.has("enviado")) {
    return (
      <AuthLayout
        title="Revisa tu correo"
        description="Te hemos enviado un enlace para confirmar tu cuenta. Ábrelo en este navegador y seguimos."
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

  return (
    <AuthLayout
      title="Crea tu cuenta"
      description="Después conectarás tu cuenta de Strava para traer tus rutas."
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link
            to="/entrar"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Entrar
          </Link>
        </>
      }
    >
      <fetcher.Form method="post">
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
          <Field>
            <FieldLabel htmlFor="password">Contraseña</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD}
              required
            />
            <FieldDescription>
              Al menos {MIN_PASSWORD} caracteres.
            </FieldDescription>
          </Field>
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="repeat-password">Repite la contraseña</FieldLabel>
            <Input
              id="repeat-password"
              name="repeat-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={error ? true : undefined}
              required
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <Button type="submit" size="lg" disabled={loading}>
            {loading && <Spinner data-icon="inline-start" />}
            {loading ? "Creando cuenta…" : "Crear cuenta"}
          </Button>
        </FieldGroup>
      </fetcher.Form>
    </AuthLayout>
  )
}

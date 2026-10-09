import { redirect } from "react-router"

import type { Route } from "./+types/salir"
import { createClient } from "~/lib/supabase/server"

// Sign-out is an action so that it cannot be triggered by a prefetch or a link.
export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createClient(request)
  await supabase.auth.signOut()
  return redirect("/entrar", { headers })
}

export function loader() {
  return redirect("/")
}

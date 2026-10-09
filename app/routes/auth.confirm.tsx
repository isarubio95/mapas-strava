import type { EmailOtpType } from "@supabase/supabase-js"
import { redirect } from "react-router"

import type { Route } from "./+types/auth.confirm"
import { safeNextPath } from "~/lib/safe-next-path"
import { createClient } from "~/lib/supabase/server"

// Handles both the token-hash links of custom email templates and the PKCE
// `code` that the default templates send back.
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const tokenHash = url.searchParams.get("token_hash")
  const type = url.searchParams.get("type") as EmailOtpType | null
  const code = url.searchParams.get("code")
  const next = safeNextPath(url.searchParams.get("next"), "/", url.origin)

  const { supabase, headers } = createClient(request)

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    })
    if (!error) return redirect(next, { headers })
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return redirect(next, { headers })
  }

  return redirect("/auth/error", { headers })
}

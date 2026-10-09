import type { AuthError } from "@supabase/supabase-js"

const MESSAGES: Record<string, string> = {
  invalid_credentials: "El correo o la contraseña no son correctos.",
  email_not_confirmed: "Confirma tu correo antes de entrar.",
  user_already_exists: "Ya hay una cuenta con ese correo.",
  email_exists: "Ya hay una cuenta con ese correo.",
  weak_password: "La contraseña es demasiado débil.",
  same_password: "La nueva contraseña tiene que ser distinta de la anterior.",
  over_email_send_rate_limit:
    "Hemos enviado demasiados correos. Espera unos minutos y vuelve a probar.",
  over_request_rate_limit:
    "Demasiados intentos seguidos. Espera un momento y vuelve a probar.",
  otp_expired: "El enlace ha caducado. Pide uno nuevo.",
  session_not_found: "Tu sesión ha caducado. Vuelve a entrar.",
}

export function authErrorMessage(error: AuthError | Error | null) {
  const code = error && "code" in error ? error.code : undefined
  return (
    (code && MESSAGES[code]) ??
    "No se ha podido completar. Inténtalo de nuevo."
  )
}

import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from "react-router"

import type { Route } from "./+types/root"
import { Toaster } from "~/components/ui/sonner"
import { TooltipProvider } from "~/components/ui/tooltip"
import { themeScript } from "~/lib/theme"
import "./app.css"

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
]

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          name="theme-color"
          content="#f6f1e6"
          media="(prefers-color-scheme: light)"
        />
        <meta
          name="theme-color"
          content="#0b1716"
          media="(prefers-color-scheme: dark)"
        />
        {/* La app tiene tema oscuro propio; evita que Dark Reader reescriba el DOM */}
        <meta name="darkreader-lock" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Meta />
        <Links />
      </head>
      <body>
        <TooltipProvider delay={350}>{children}</TooltipProvider>
        <Toaster position="top-center" />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Algo ha fallado"
  let details = "Ha ocurrido un error inesperado. Recarga la página."
  let stack: string | undefined

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "Aquí no hay nada" : "Algo ha fallado"
    details =
      error.status === 404
        ? "Esta página no existe. Vuelve al mapa."
        : error.statusText || details
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message
    stack = error.stack
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-3 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{message}</h1>
      <p className="text-muted-foreground">{details}</p>
      <a href="/" className="font-medium text-primary underline">
        Volver al mapa
      </a>
      {stack && (
        <pre className="mt-4 w-full overflow-x-auto rounded-2xl bg-muted p-4 text-xs">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  )
}

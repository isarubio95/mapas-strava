import { Link } from "react-router"

import { RouteBackdrop } from "~/components/auth/route-backdrop"
import { Logo } from "~/components/logo"
import { ThemeSwitch } from "~/components/theme-switch"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-background">
      <RouteBackdrop />

      <header className="relative z-10 flex items-center justify-between p-5 md:px-8 md:py-6">
        <Link to="/" aria-label="Trazo, inicio" className="rounded-2xl">
          <Logo />
        </Link>
        <ThemeSwitch />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-5 pt-4 pb-16">
        <div className="flex w-full max-w-sm flex-col gap-5">
          <Card className="panel gap-5 bg-(--panel) shadow-none ring-0">
            <CardHeader>
              <CardTitle className="text-xl font-semibold tracking-[-0.02em]">
                {title}
              </CardTitle>
              {description && (
                <CardDescription className="text-pretty">
                  {description}
                </CardDescription>
              )}
            </CardHeader>
            {children && <CardContent>{children}</CardContent>}
          </Card>
          {footer && (
            <div className="text-center text-sm text-muted-foreground">
              {footer}
            </div>
          )}
        </div>
      </main>

      <footer className="relative z-10 flex justify-center gap-4 pb-6 text-xs text-muted-foreground">
        <Link to="/privacidad" className="hover:text-foreground hover:underline">
          Privacidad
        </Link>
      </footer>
    </div>
  )
}

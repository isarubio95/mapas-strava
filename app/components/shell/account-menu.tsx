import {
  GearIcon,
  MoonIcon,
  ShieldCheckIcon,
  SignOutIcon,
  UserIcon,
} from "@phosphor-icons/react"
import { Link, useSubmit } from "react-router"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { useTheme } from "~/lib/theme"
import { cn } from "~/lib/utils"

export interface Account {
  name: string | null
  email: string
}

export function AccountMenu({
  account,
  themeToggle = false,
  className,
}: {
  account: Account
  /** Adds the day/night toggle, for screens with no room for the switch. */
  themeToggle?: boolean
  className?: string
}) {
  const submit = useSubmit()
  const { theme, setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Tu cuenta"
        className={cn(
          "group/account panel pointer-events-auto inline-flex size-12.5 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:text-foreground",
          className
        )}
      >
        <span className="relative size-5">
          <UserIcon weight="bold" className="absolute inset-0 size-5" />
          {/* Filled twin revealed from the centre outwards while the menu is open. */}
          <UserIcon
            weight="fill"
            aria-hidden
            className="absolute inset-0 size-5 transition-[clip-path] duration-300 ease-(--ease-out-expo) [clip-path:circle(0%_at_50%_50%)] group-aria-expanded/account:duration-500 group-aria-expanded/account:[clip-path:circle(75%_at_50%_50%)] motion-reduce:transition-none"
          />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            {account.name && (
              <span className="text-sm font-medium text-foreground">
                {account.name}
              </span>
            )}
            <span className="truncate">{account.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLinkItem render={<Link to="/ajustes" />}>
          <GearIcon weight="fill" />
          Ajustes
        </DropdownMenuLinkItem>
        <DropdownMenuLinkItem render={<Link to="/privacidad" />}>
          <ShieldCheckIcon weight="fill" />
          Privacidad
        </DropdownMenuLinkItem>
        {themeToggle && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={theme === "dark"}
              onCheckedChange={(dark) => setTheme(dark ? "dark" : "light")}
            >
              <MoonIcon weight="fill" />
              Modo oscuro
            </DropdownMenuCheckboxItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => submit(null, { method: "post", action: "/salir" })}
        >
          <SignOutIcon weight="bold" />
          Salir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

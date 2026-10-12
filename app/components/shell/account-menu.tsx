import {
  GearIcon,
  ShieldCheckIcon,
  SignOutIcon,
  UserIcon,
} from "@phosphor-icons/react"
import { Link, useSubmit } from "react-router"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { cn } from "~/lib/utils"

export interface Account {
  name: string | null
  email: string
}

export function AccountMenu({
  account,
  className,
}: {
  account: Account
  className?: string
}) {
  const submit = useSubmit()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Tu cuenta"
        className={cn(
          "panel pointer-events-auto inline-flex size-12.5 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:text-foreground",
          className
        )}
      >
        <UserIcon weight="bold" className="size-5" />
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

import { GearIcon, ShieldCheckIcon, SignOutIcon } from "@phosphor-icons/react"
import { Link, useSubmit } from "react-router"

import { Avatar, AvatarFallback } from "~/components/ui/avatar"
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

function initials({ name, email }: Account) {
  const words = (name ?? "").split(/\s+/).filter(Boolean)
  const letters = words.length
    ? words.slice(0, 2).map((word) => word[0])
    : [email[0] ?? "?"]
  return letters.join("").toUpperCase()
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
          "panel pointer-events-auto size-12.5 rounded-full p-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          className
        )}
      >
        <Avatar className="size-full">
          <AvatarFallback className="bg-primary font-medium text-primary-foreground">
            {initials(account)}
          </AvatarFallback>
        </Avatar>
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

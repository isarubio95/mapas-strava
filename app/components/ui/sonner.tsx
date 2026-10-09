import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CheckCircleIcon,
  InfoIcon,
  WarningIcon,
  XCircleIcon,
  SpinnerIcon,
} from "@phosphor-icons/react"

import { useTheme } from "~/lib/theme"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme()

  return (
    <Sonner
      theme={theme ?? "system"}
      className="toaster group"
      icons={{
        success: <CheckCircleIcon weight="fill" className="size-4" />,
        info: <InfoIcon weight="fill" className="size-4" />,
        warning: <WarningIcon weight="fill" className="size-4" />,
        error: <XCircleIcon weight="fill" className="size-4" />,
        loading: <SpinnerIcon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-2xl)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

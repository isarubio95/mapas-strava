import { cn } from "~/lib/utils"

/** Trazo mark: a single glowing route between two points. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-8 text-primary", className)}
    >
      <rect
        width="32"
        height="32"
        rx="10"
        className="fill-foreground/[0.06] dark:fill-primary/10"
      />
      <path
        d="M8 23c3-.5 4-3.5 6-6s3-1 4.5-3S21 8.5 25 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-0 blur-[3px] dark:opacity-60"
      />
      <path
        d="M8 23c3-.5 4-3.5 6-6s3-1 4.5-3S21 8.5 25 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="23" r="2.6" fill="currentColor" />
      <circle
        cx="25"
        cy="8"
        r="2.4"
        className="fill-background"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-[1.05rem] font-semibold tracking-[-0.02em]",
        className
      )}
    >
      <LogoMark />
      Trazo
    </span>
  )
}

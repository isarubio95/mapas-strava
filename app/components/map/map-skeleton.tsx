import { cn } from "~/lib/utils"

export function MapSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("size-full bg-[#f6f1e6] dark:bg-[#0b1716]", className)}
      aria-hidden
    />
  )
}

import type { Icon } from "@phosphor-icons/react"
import { cn } from "cn"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

import { Button } from "~/components/ui/button"

/**
 * Same curve as the fitAI bottom nav. The pill moves with a CSS transition on
 * `transform` instead of animating `left` from JS, so the compositor drives it.
 */
const INDICATOR_TRANSITION =
  "transition-[transform,width] duration-240 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"

export type SegmentedItem<T extends string> = {
  value: T
  label: string
  title?: string
  icon?: Icon
}

/**
 * Pill-shaped single-choice selector whose filled background slides sideways
 * to the chosen item.
 */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  className,
  labelClassName,
}: {
  items: SegmentedItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  /** Lets labels collapse (e.g. `sr-only xl:not-sr-only`) and leave the icons. */
  labelClassName?: string
}) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const canAnimate = useRef(false)
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  const activeIndex = items.findIndex((item) => item.value === value)

  const measure = useCallback(() => {
    const item = activeIndex >= 0 ? itemRefs.current[activeIndex] : null
    const next = item
      ? { left: item.offsetLeft, width: item.offsetWidth }
      : { left: 0, width: 0 }
    setIndicator((prev) =>
      prev.left === next.left && prev.width === next.width ? prev : next
    )
  }, [activeIndex])

  useLayoutEffect(measure, [measure])

  // Skip the transition on the first placement so the pill does not slide in
  // from the left edge on load.
  useEffect(() => {
    if (indicator.width > 0) canAnimate.current = true
  }, [indicator.width])

  useEffect(() => {
    const bar = itemRefs.current[0]?.parentElement
    if (!bar) return
    const observer = new ResizeObserver(measure)
    observer.observe(bar)
    return () => observer.disconnect()
  }, [measure])

  return (
    <div
      className={cn(
        "panel relative flex h-12.5 items-center gap-1 rounded-4xl p-1",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-1 left-0 rounded-4xl bg-primary",
          canAnimate.current && INDICATOR_TRANSITION
        )}
        style={{
          transform: `translateX(${indicator.left}px)`,
          width: indicator.width,
          opacity: indicator.width > 0 ? 1 : 0,
        }}
      />
      {items.map((item, index) => {
        const ItemIcon = item.icon
        const on = item.value === value
        return (
          <Button
            key={item.value}
            ref={(el) => {
              itemRefs.current[index] = el
            }}
            type="button"
            size="sm"
            variant="ghost"
            aria-pressed={on}
            title={item.title}
            className={cn(
              "relative z-10 h-full rounded-4xl transition-colors duration-240",
              on &&
                "text-primary-foreground hover:bg-transparent hover:text-primary-foreground dark:hover:bg-transparent"
            )}
            onClick={() => onChange(item.value)}
          >
            {ItemIcon && <ItemIcon data-icon="inline-start" weight="fill" />}
            {labelClassName ? (
              <span className={labelClassName}>{item.label}</span>
            ) : (
              item.label
            )}
          </Button>
        )
      })}
    </div>
  )
}

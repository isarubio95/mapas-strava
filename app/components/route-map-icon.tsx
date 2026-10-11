import { useId } from "react"

import { cn } from "~/lib/utils"

const ROUTE = "M19 50C28 50 28 42 31 38S38 27 45 24"

/** Route finder tile: a route drawn between two pins on a little city map. */
export function RouteMapIcon({ className }: { className?: string }) {
  const clip = useId()
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn("size-7 shrink-0", className)}
    >
      <clipPath id={clip}>
        <rect width="64" height="64" rx="15" />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <rect width="64" height="64" fill="#EAEFF4" />
        <g fill="#C6E8B1">
          <rect x="38" y="37" width="20" height="13" rx="3" />
          <rect x="6" y="27" width="11" height="9" rx="2.5" />
          <rect x="24" y="15" width="10" height="8" rx="2.5" />
        </g>
        <path
          d="M-8 25H72M-8 42H72M-8 58H72M14-8V72M33-8V72M52-8V72"
          stroke="#fff"
          strokeWidth="2.4"
          transform="rotate(-14 32 32)"
        />
        <path
          d="M-2 21C8 21 11 11 21 10S33 5 37-2"
          fill="none"
          stroke="#9BD3F6"
          strokeWidth="6"
        />
      </g>
      <rect
        x="1"
        y="1"
        width="62"
        height="62"
        rx="14"
        fill="none"
        stroke="#0B1716"
        strokeOpacity="0.1"
        strokeWidth="2"
      />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={ROUTE} stroke="#1D6BE0" strokeWidth="8" />
        <path d={ROUTE} stroke="#4BA6FF" strokeWidth="5" />
        <path d={ROUTE} stroke="#C4E5FF" strokeWidth="1.4" />
      </g>
      <ellipse
        cx="45"
        cy="24"
        rx="5.5"
        ry="2.6"
        fill="#fff"
        stroke="#E53B32"
        strokeWidth="1.6"
      />
      <ellipse
        cx="19"
        cy="50"
        rx="6"
        ry="2.8"
        fill="#fff"
        stroke="#2BAF47"
        strokeWidth="1.6"
      />
      <path
        d="M45 24C43.6 20.6 38 17.6 38 13A7 7 0 1 1 52 13C52 17.6 46.4 20.6 45 24Z"
        fill="#F0443A"
      />
      <circle cx="45" cy="13" r="2.8" fill="#fff" />
      <path
        d="M19 50C17.4 46.2 11 42.8 11 37.5A8 8 0 1 1 27 37.5C27 42.8 20.6 46.2 19 50Z"
        fill="#34C04F"
      />
      <circle cx="19" cy="37.5" r="3.2" fill="#fff" />
    </svg>
  )
}

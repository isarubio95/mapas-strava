const STREETS = [
  "M-20 140 C 180 120 320 180 520 150 S 860 90 1220 130",
  "M-20 320 C 140 300 300 340 480 300 S 820 260 1220 300",
  "M-20 520 C 200 500 380 560 600 520 S 980 470 1220 500",
  "M-20 690 C 240 660 420 720 660 690 S 1010 650 1220 680",
  "M120 -20 C 140 180 100 380 150 580 S 170 760 160 820",
  "M340 -20 C 320 200 380 420 340 620 S 330 760 350 820",
  "M600 -20 C 640 160 580 360 630 560 S 610 740 640 820",
  "M860 -20 C 840 220 900 400 860 600 S 880 760 870 820",
  "M1060 -20 C 1080 200 1030 420 1080 620 S 1060 760 1070 820",
  "M-20 40 L 420 420 L 760 800",
  "M1220 60 L 820 380 L 520 820",
  "M220 820 C 420 620 620 560 900 300 S 1120 120 1220 40",
]

const RIVER =
  "M-40 600 C 160 560 260 640 420 610 S 700 520 860 560 S 1100 640 1240 590"

const ROUTES = [
  "M150 580 C 210 470 300 430 340 330 S 470 180 600 160 S 820 220 860 300 S 980 420 1080 380",
  "M120 140 C 260 230 380 300 470 420 S 640 560 760 600 S 940 640 1060 560",
  "M340 760 C 360 640 420 560 520 520 S 700 470 760 380 S 820 230 900 160",
]

/** Decorative fragment of the night map behind the sign-in screens. */
export function RouteBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <svg
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        className="size-full"
      >
        <path
          d={RIVER}
          fill="none"
          strokeWidth="38"
          strokeLinecap="round"
          className="stroke-[#d3e2da] dark:stroke-[#081a1b]"
        />
        <g
          fill="none"
          strokeWidth="1.4"
          className="stroke-[#dccfb4] dark:stroke-[#2a4643]"
        >
          {STREETS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {ROUTES.map((d, index) => (
            <g
              key={d}
              className="animate-[route-draw_2.6s_var(--ease-out-expo)_both]"
              style={{
                strokeDasharray: 1600,
                animationDelay: `${200 + index * 260}ms`,
              }}
            >
              <path
                d={d}
                strokeWidth="12"
                className="stroke-primary opacity-10 blur-[6px] dark:opacity-40"
              />
              <path
                d={d}
                strokeWidth="3"
                className="stroke-primary opacity-70 dark:opacity-95"
              />
            </g>
          ))}
        </g>
      </svg>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--background)_18%,color-mix(in_oklab,var(--background)_55%,transparent)_55%,transparent_100%)]" />
    </div>
  )
}

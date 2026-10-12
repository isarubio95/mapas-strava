import { useMap } from "@vis.gl/react-maplibre"
import { useEffect, useState } from "react"

import { cn } from "~/lib/utils"

/**
 * North needle for the 3D view. It turns and tilts with the camera, and puts
 * north back up when pressed. It reads the camera itself, so turning the map
 * re-renders only this button.
 */
export function Compass({ className }: { className?: string }) {
  const { current: map } = useMap()
  const [view, setView] = useState({ bearing: 0, pitch: 0 })

  useEffect(() => {
    const target = map?.getMap()
    if (!target) return
    const update = () =>
      setView({ bearing: target.getBearing(), pitch: target.getPitch() })
    update()
    target.on("rotate", update)
    target.on("pitch", update)
    return () => {
      target.off("rotate", update)
      target.off("pitch", update)
    }
  }, [map])

  const north = Math.abs(view.bearing) < 0.5

  return (
    <button
      type="button"
      aria-label="Orientar al norte"
      title="Orientar al norte · Arrastra con el botón derecho, o con Ctrl, para girar e inclinar"
      disabled={north}
      onClick={() => map?.easeTo({ bearing: 0, duration: 700 })}
      className={cn(
        "panel absolute top-20 right-4 z-10 flex size-12.5 items-center justify-center rounded-full transition-opacity duration-300 enabled:hover:brightness-110 disabled:cursor-default max-md:right-3",
        className
      )}
      style={{ perspective: "120px" }}
    >
      <svg
        viewBox="-12 -12 24 24"
        className="size-7"
        aria-hidden
        style={{
          transform: `rotateX(${view.pitch * 0.75}deg) rotateZ(${-view.bearing}deg)`,
        }}
      >
        <path d="M0 -10.5 L4 0 L0 -1.6 L-4 0 Z" className="fill-primary" />
        <path
          d="M0 10.5 L4 0 L0 1.6 L-4 0 Z"
          className="fill-muted-foreground/45"
        />
        <circle r="1.4" className="fill-foreground" />
      </svg>
    </button>
  )
}

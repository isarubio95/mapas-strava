import { setWorkerUrl } from "maplibre-gl"
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url"

let ready = false

/** Vite pre-bundles MapLibre and breaks its default worker URL. */
export function setupMapLibre() {
  if (ready) return
  setWorkerUrl(workerUrl)
  ready = true
}

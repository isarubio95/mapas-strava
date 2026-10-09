import { releaseProxy, wrap, type Remote } from "comlink"

import type { EngineApi } from "./engine.worker"

export interface RouteEngineClient {
  api: Remote<EngineApi>
  terminate: () => void
}

/** Runs the route engine in a Web Worker. Browser only. */
export function createEngineClient(): RouteEngineClient {
  const worker = new Worker(new URL("./engine.worker.ts", import.meta.url), {
    type: "module",
    name: "rutas",
  })
  const api = wrap<EngineApi>(worker)
  return {
    api,
    terminate: () => {
      api[releaseProxy]()
      worker.terminate()
    },
  }
}

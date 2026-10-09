import { reactRouter } from "@react-router/dev/vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), reactRouter()],
  worker: { format: "es" },
  // El callback de Strava vuelve a SITE_URL (localhost:5173): si el puerto
  // está ocupado, mejor fallar que saltar en silencio a otro.
  server: { port: 5173, strictPort: true },
})

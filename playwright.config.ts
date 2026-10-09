import { defineConfig, devices } from "@playwright/test"

const APP_PORT = 5174
const STRAVA_MOCK_PORT = 4010

// Headless Chromium has no GPU: WebGL (MapLibre and deck.gl) needs SwiftShader.
const webglArgs = [
  "--enable-unsafe-swiftshader",
  "--use-angle=swiftshader",
  "--ignore-gpu-blocklist",
]

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { args: webglArgs },
  },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"] } },
    {
      name: "movil",
      use: { ...devices["Pixel 7"] },
      testIgnore: /poster|rendimiento/,
    },
  ],
  webServer: [
    {
      command: `npx tsx tests/strava-mock/server.ts --port ${STRAVA_MOCK_PORT}`,
      port: STRAVA_MOCK_PORT,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npx react-router dev --mode e2e --port ${APP_PORT} --strictPort`,
      url: `http://localhost:${APP_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})

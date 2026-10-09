import { expect, test } from "@playwright/test"

test("el mapa de demostración muestra las tres distribuciones", async ({ page }) => {
  await page.goto("/prototipos")
  await expect(page.getByRole("heading", { name: "Mapa de Trazo" })).toBeAttached()
  await expect(page.getByRole("button", { name: "HUD" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Barra" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Dock" })).toBeVisible()
  await page.getByRole("button", { name: "Carrera" }).click()
  await expect(page.getByRole("button", { name: "Carrera" })).toHaveAttribute("aria-pressed", "true")
})

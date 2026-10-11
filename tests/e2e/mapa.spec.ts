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

test("el buscador deja una sola ruta en el mapa", async ({ page }) => {
  await page.goto("/prototipos")
  await page.getByRole("button", { name: "Buscar ruta" }).first().click()
  await page.getByRole("combobox", { name: "Título de la ruta" }).fill("series")
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/ruta=\d+&solo=1/)
  const solo = page.getByRole("button", { name: "Solo esta ruta" })
  await expect(solo).toHaveAttribute("aria-pressed", "true")
  await solo.click()
  await expect(page).not.toHaveURL(/solo=1/)
  await expect(solo).toHaveAttribute("aria-pressed", "false")
})

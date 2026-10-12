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

test("la vista 3D se elige como modo y deja recorrer una ruta", async ({
  page,
}) => {
  await page.goto("/prototipos")
  const relief = page.getByRole("button", { name: "3D", exact: true })
  // On phones the modes live in the filters drawer.
  const phone = (page.viewportSize()?.width ?? 1280) < 768
  if (phone) await page.getByRole("button", { name: /Filtros/ }).click()
  await relief.click()
  await expect(page).toHaveURL(/vista=3d/)
  if (phone) await page.keyboard.press("Escape")
  await expect(
    page.getByRole("button", { name: "Orientar al norte" })
  ).toBeVisible()

  // A lone route keeps the 3D view.
  await page.getByRole("button", { name: "Buscar ruta" }).first().click()
  await page.getByRole("combobox", { name: "Título de la ruta" }).fill("series")
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/vista=3d/)
  await expect(page).toHaveURL(/solo=1/)

  await page.getByRole("button", { name: "Recorrer en 3D" }).click()
  const hud = page.getByRole("region", { name: /^Recorrido de/ })
  await expect(hud).toBeVisible()
  await hud.getByRole("button", { name: "Detener" }).click()
  await expect(hud).toBeHidden()
  await expect(
    page.getByRole("button", { name: "Recorrer en 3D" })
  ).toBeVisible()
})

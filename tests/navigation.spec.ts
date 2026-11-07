import { test, expect } from "./outils";

test("une adresse inconnue donne une page introuvable en français", async ({ page }) => {
  const r = await page.goto("/livres/moliere/livre-qui-n-existe-pas/scene-1");
  expect(r?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Cette page n’existe pas");
});

// S15 (05/11/2026) : une section inventée d'un livre public (adresse fabriquée par un assistant)
// passe par /citation, qui mène au passage, à une liste ou au livre, jamais à la page introuvable.
test("une section inconnue d'un livre public mène au livre plutôt qu'à une page introuvable", async ({ page }) => {
  await page.goto("/livres/moliere/le-malade-imaginaire/scene-qui-n-existe-pas");
  await expect(page).not.toHaveURL(/\/scene-qui-n-existe-pas/);
  await expect(page).toHaveURL(/le-malade-imaginaire/);
  await expect(page.getByRole("heading", { level: 1 }).first()).not.toContainText("Cette page n’existe pas");
});

test("une adresse de livre mal tapée propose le bon livre", async ({ page }) => {
  await page.goto("/livres/rousseau/reveries-du-promeneur-solitaire/premiere-promenade");
  await expect(page.getByRole("link", { name: /Rêveries/ }).first()).toBeVisible();
});

test("les pages publiques ne renvoient pas vers la connexion", async ({ request }) => {
  for (const chemin of ["/", "/icon.png", "/citation?q=test", "/bibliographie/balzac", "/livres/flaubert/madame-bovary/resume"]) {
    const r = await request.get(chemin, { maxRedirects: 0 });
    expect(r.status(), chemin).toBe(200);
  }
});

test("le fil d'Ariane ramène au catalogue", async ({ page }) => {
  await page.goto("/livres/moliere/dom-juan/acte-iv-scene-i");
  await page.getByRole("link", { name: "Livres", exact: true }).first().click();
  await expect(page).toHaveURL(/\/$/);
});

// 07/11/2026 : le menu de la page résumé reste collé au défilement, et un trait suit la section lue.
test("le menu de la page résumé reste visible et suit la section lue", async ({ page }) => {
  await page.goto("/livres/rostand/cyrano-de-bergerac/resume");
  const menu = page.getByRole("navigation", { name: "Sur cette page" });
  await page.locator("#themes").evaluate((titre) => titre.scrollIntoView({ block: "start" }));
  await expect(menu.locator('[aria-current="true"]')).toHaveText("Thèmes");
  await expect(menu).toBeInViewport();
});

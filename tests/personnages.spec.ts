import { test, expect, ouvrirLiseuse } from "./outils";

// Pages des personnages (S18, 14/11/2026). Avant leur première mise en ligne (nuit du 14 au 15/11), la
// production répond 404 : le test se met de côté jusqu'au 17/11, puis un 404 le fait échouer.
async function pagePrete(page: import("@playwright/test").Page, chemin: string) {
  const r = await page.goto(chemin);
  test.skip(r?.status() === 404 && Date.now() < Date.parse("2026-11-17T00:00:00Z"), "pages personnages pas encore en ligne");
}

test("depuis la page des personnages d'une œuvre, j'ouvre un portrait", async ({ page }) => {
  await pagePrete(page, "/livres/rostand/cyrano-de-bergerac/personnages");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Les personnages de Cyrano de Bergerac");
  await page.getByRole("link", { name: /^Lire (l’analyse|son portrait)$/ } /* « Lire son portrait » jusqu'à la mise en ligne du 21/11 */).first().click();
  await expect(page).toHaveURL(/\/personnages\/cyrano-de-bergerac$/);
  await expect(page.getByRole("heading", { level: 1, name: "Cyrano de Bergerac" })).toBeVisible();
});

test("je clique une phrase d'un portrait : le livre s'ouvre sur sa preuve, et je reviens au portrait", async ({ page }) => {
  await pagePrete(page, "/livres/flaubert/madame-bovary/personnages/emma-bovary");
  await page.locator('a[href*="portrait=emma-bovary"]').first().click();
  await expect(page).toHaveURL(/madame-bovary\?.*preuve=/);
  const retour = page.getByRole("link", { name: /Retour au portrait/ });
  await expect(retour).toBeVisible();
  await retour.click();
  await expect(page).toHaveURL(/\/personnages\/emma-bovary/);
});

test("dans la liseuse, je touche le nom d'un personnage et je vois ce que je sais de lui", async ({ page }) => {
  await pagePrete(page, "/livres/flaubert/madame-bovary/personnages/emma-bovary");
  await ouvrirLiseuse(page, "/livres/flaubert/madame-bovary?line=4307");
  // Le nom est souligné par la CSS Custom Highlight API (aucun élément à viser) : on clique au milieu de
  // la première occurrence visible.
  const point = await page.waitForFunction(() => {
    const h = (CSS as unknown as { highlights?: Map<string, Iterable<Range>> }).highlights?.get("perso");
    if (!h) return null;
    for (const r of h) {
      const b = r.getBoundingClientRect();
      if (b.width > 0 && b.top > 56 && b.bottom < window.innerHeight - 40) return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    }
    return null;
  }, undefined, { timeout: 15_000 });
  const { x, y } = (await point.jsonValue()) as { x: number; y: number };
  await page.mouse.click(x, y);
  const carte = page.getByRole("dialog", { name: "Emma Bovary" });
  // Carte revue par Nick le 14/11 : le lien vers le portrait en haut, plus d'intitulé.
  await expect(carte.getByRole("link", { name: "Portrait complet" })).toBeVisible();
  await expect(carte.getByText(/mention \d+ sur \d+/)).toBeVisible();
});

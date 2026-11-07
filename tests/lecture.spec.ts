import { test, expect, ouvrirLiseuse } from "./outils";

test("depuis l'accueil, j'ouvre un livre du catalogue", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Classiques.app");
  // On touche le titre : la durée de lecture, sur la même ligne, ouvre une bulle d'aide.
  await page.locator('a[href="/livres/flaubert/madame-bovary"]').getByText("Madame Bovary", { exact: true }).first().click();
  await expect(page).toHaveURL(/\/livres\/flaubert\/madame-bovary/);
  await expect(page.getByRole("heading", { level: 1, name: "Madame Bovary" })).toBeVisible();
});

test("depuis la page d'un auteur, j'ouvre un de ses livres", async ({ page }) => {
  await page.goto("/bibliographie/moliere");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Molière");
  await page.locator('a[href="/livres/moliere/le-malade-imaginaire"]').getByText("Le Malade imaginaire").first().click();
  await expect(page).toHaveURL(/le-malade-imaginaire/);
});

test("je lis une scène et je passe à la suivante", async ({ page }) => {
  await page.goto("/livres/moliere/le-malade-imaginaire/acte-i-scene-iii");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Scène III");
  await page.locator('a[href$="/acte-i-scene-iv"]').first().click();
  await expect(page).toHaveURL(/acte-i-scene-iv$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Scène IV");
});

test("depuis une scène, le lien Sommaire montre le sommaire", async ({ page }) => {
  await page.goto("/livres/moliere/dom-juan/acte-iv-scene-i");
  await page.getByRole("link", { name: /^Sommaire · 27 scènes/ }).first().click();
  await expect(page).toHaveURL(/dom-juan#sommaire/);
  await expect(page.locator("aside").getByText("Acte I", { exact: true }).first()).toBeInViewport();
});

test("depuis une scène, je passe au livre entier au bon endroit", async ({ page }) => {
  await page.goto("/livres/moliere/dom-juan/acte-iv-scene-i");
  await page.getByRole("link", { name: /Lire le livre entier/ }).first().click();
  await expect(page).toHaveURL(/dom-juan\?line=\d+/);
  await expect(page.getByText("Quoi qu’il en soit, laissons cela").first()).toBeVisible();
});

test("je lis des italiques sans astérisque, et un nom caché reste un nom caché", async ({ page }) => {
  await ouvrirLiseuse(page, "/livres/racine/andromaque?line=48");
  await expect(page.getByText("En marge de ces vers on lit le nom d’Andromaque.").locator("em")).toHaveText("Andromaque");
  await ouvrirLiseuse(page, "/livres/stendhal/de-l-amour?line=357");
  await expect(page.getByText("comme dit le vulgaire, romanesque").locator("em")).toHaveText("romanesque");
  await page.goto("/livres/stendhal/la-chartreuse-de-parme/xiii");
  await expect(page.getByText("À ce mot, le comte M***, qui ne brillait pas")).toBeVisible();
  await expect(page.locator("em", { hasText: "qui ne brillait pas" })).toHaveCount(0);
});

test("je lis un résumé et je rejoins le livre", async ({ page }) => {
  await page.goto("/livres/flaubert/madame-bovary/resume");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Madame Bovary");
  await page.getByRole("link", { name: /Lire le livre entier/ }).first().click();
  await expect(page).toHaveURL(/\/livres\/flaubert\/madame-bovary(\?|$)/);
});

test("je lis une version en 20 minutes", async ({ page }) => {
  await ouvrirLiseuse(page, "/livres/flaubert/madame-bovary/20min");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("en 20 minutes");
  await expect(page.getByText("Lire par extraits en 20 minutes").first()).toBeVisible();
});

test("je passe d'un poème à l'autre et je retrouve la liste", async ({ page }) => {
  await page.goto("/bibliographie/rimbaud/poemes");
  expect(await page.locator('a[href*="/livres/rimbaud/"]').count()).toBeGreaterThan(100);
  await page.locator('a[href$="/le-dormeur-du-val"]').first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("DORMEUR DU VAL");
  await page.locator('a[href$="/le-bateau-ivre"]').first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("BATEAU IVRE");
  await page.getByRole("link", { name: /Tous les poèmes de Rimbaud/ }).first().click();
  await expect(page).toHaveURL(/\/bibliographie\/rimbaud\/poemes/);
});

test("j'agrandis le texte, je passe en sombre, et mes réglages restent", async ({ page }) => {
  await ouvrirLiseuse(page, "/livres/flaubert/madame-bovary/20min");
  await page.locator('button[aria-label="Paramètres de lecture"]:visible').click();
  await page.getByRole("button", { name: "Agrandir la taille" }).click();
  await page.getByRole("button", { name: "Sombre", exact: true }).click();
  await expect(page.locator("[data-reading-theme]").first()).toHaveAttribute("data-reading-theme", "dark");
  await page.reload();
  await expect(page.locator("[data-reading-theme]").first()).toHaveAttribute("data-reading-theme", "dark");
});

test("la page du catalogue des versions en 20 minutes liste des livres", async ({ page }) => {
  await page.goto("/lire-en-20-minutes");
  expect(await page.locator('a[href$="/20min"]').count()).toBeGreaterThan(50);
});

test("la page À propos répond", async ({ page }) => {
  await page.goto("/a-propos");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

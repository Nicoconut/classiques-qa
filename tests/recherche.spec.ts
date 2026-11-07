import { test, expect, champRecherche, ouvrirLiseuse } from "./outils";

test("la barre de recherche propose un livre pendant la frappe", async ({ page }) => {
  await page.goto("/bibliographie/apollinaire");
  const champ = champRecherche(page);
  await champ.click();
  await champ.pressSequentially("calligrammes", { delay: 40 });
  await expect(page.getByText("Calligrammes").first()).toBeVisible();
});

test("je cherche un mot chez un auteur et je trouve des occurrences", async ({ page }) => {
  await page.goto("/bibliographie/balzac?q=m%C3%A9lancolie");
  await expect(page.getByText(/\d[\d  ]*\s+occurrences?/).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Lire dans le livre").first()).toBeVisible();
});

test("un titre trouvé s'affiche sans balisage", async ({ page }) => {
  await page.goto("/bibliographie/apollinaire?q=coeur+couronne+et+miroir");
  await expect(page.getByText(/\d[\d  ]*\s+occurrences?/).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("body")).not.toContainText("###");
});

test("depuis l'accueil, un mot ouvre la recherche et je choisis un auteur", async ({ page }) => {
  await page.goto("/");
  const champ = page.locator("form input:not([type=hidden])").first();
  // La barre n'écoute qu'une fois la page active : on retape tant que la fenêtre n'est pas ouverte.
  await expect(async () => {
    await champ.fill("mélancolie");
    await champ.press("Enter");
    await expect(page.getByText("Recherche avancée").first()).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await page.getByRole("button", { name: "Balzac", exact: true }).first().click();
  await page.getByRole("button", { name: "Chercher", exact: true }).last().click();
  await expect(page).toHaveURL(/bibliographie\/balzac/);
  await expect(page.getByText(/\d[\d  ]*\s+occurrences?/).first()).toBeVisible({ timeout: 30_000 });
});

test("je cherche dans le livre ouvert", async ({ page }) => {
  await ouvrirLiseuse(page, "/livres/moliere/dom-juan");
  await page.locator('button[aria-label="Rechercher dans ce livre"]:visible').click();
  const champ = page.locator("input:visible").first();
  await champ.fill("Sganarelle");
  await champ.press("Enter");
  await expect(page.getByText(/\d+ \/ \d+/).first()).toBeVisible();
});

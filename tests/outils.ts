import { test as base, expect, type Page } from "@playwright/test";

// Chaque test : visiteur anonyme, hors mesure d'audience, et aucune exception
// JavaScript tolérée. Un test décrit un geste de lecteur, pas la mise en page :
// on cherche par rôle et par texte, jamais par position.
export const test = base.extend<{ erreursJs: string[] }>({
  erreursJs: [async ({ page, baseURL, context }, use) => {
    await context.addCookies([{ name: "ph_optout", value: "1", url: baseURL! }]);
    const erreurs: string[] = [];
    page.on("pageerror", (e) => erreurs.push(e.message));
    await use(erreurs);
    expect(erreurs, "exceptions JavaScript sur la page").toEqual([]);
  }, { auto: true }],
});

export { expect };

export const estIphone = (nom: string) => nom === "iphone";

/** La liseuse pose sa barre après l'hydratation : on attend qu'elle soit là. */
export async function ouvrirLiseuse(page: Page, chemin: string) {
  await page.goto(chemin);
  await page.locator('button[aria-label="Paramètres de lecture"]:visible').waitFor();
}

/** Le champ de recherche visible, quel que soit l'appareil. */
export const champRecherche = (page: Page) => page.locator("input:visible").first();

import { test as base, expect, type Page } from "@playwright/test";

// Chaque test : visiteur anonyme, hors mesure d'audience, et aucune exception
// JavaScript tolérée. Le visiteur est en version A du test A/B du thème (T01,
// ab-tests.md : sombre nuit) pour que le thème ne soit pas tiré au sort ; un
// test qui veut la version B remplace le cookie `rdg_ab`. Un test décrit un geste de lecteur, pas la mise en page :
// on cherche par rôle et par texte, jamais par position.
export const test = base.extend<{ erreursJs: string[] }>({
  erreursJs: [async ({ page, baseURL, context }, use) => {
    await context.addCookies([
      { name: "ph_optout", value: "1", url: baseURL! },
      { name: "rdg_ab", value: "A", url: baseURL! },
    ]);
    const erreurs: string[] = [];
    const origine = new URL(baseURL!).origin;
    page.on("pageerror", (e) => {
      if (requeteCoupeeParSafari(e.message, origine)) return;
      erreurs.push(e.message);
    });
    await use(erreurs);
    expect(erreurs, "exceptions JavaScript sur la page").toEqual([]);
  }, { auto: true }],
});

export { expect };

/** Safari (WebKit) signale comme exception de page une requête vers le site lui-même coupée
 *  parce que le lecteur quitte la page (« Fetch API cannot load https://classiques.app/api/…
 *  due to access control checks »), même quand le code la rattrape (try/catch, .catch) :
 *  commentaires d'Andromaque, catalogue de la recherche en revenant au portrait (qa_issues
 *  `regression-iphone-andromaque-commentaires`, `safari-fetch-catalogue-interrompu`). Ce n'est
 *  pas un défaut pour le lecteur. Seules les adresses du site sont ignorées : une vraie erreur
 *  d'accès vers un autre domaine reste comptée. */
export function requeteCoupeeParSafari(message: string, origine: string): boolean {
  // Le message arrive parfois tronqué au début (« /localhost:3107/api/search/catalog due to access
  // control checks. ») : on lit l'adresse juste avant « due to access control checks ».
  const m = message.match(/(\S+) due to access control checks\.?$/);
  if (!m) return false;
  const adresse = m[1];
  if (adresse.startsWith("/api/")) return true;
  return adresse.includes(`${new URL(origine).host}/`);
}

export const estIphone = (nom: string) => nom === "iphone";

/** La liseuse pose sa barre après l'hydratation : on attend qu'elle soit là. */
export async function ouvrirLiseuse(page: Page, chemin: string) {
  await page.goto(chemin);
  await page.locator('button[aria-label="Paramètres de lecture"]:visible').waitFor();
}

/** Le champ de recherche visible, quel que soit l'appareil. */
export const champRecherche = (page: Page) => page.locator("input:visible").first();

/** Tape une recherche dans la barre du haut et la valide par Entrée. Sur iPhone, passé quelques
 *  lettres, l'<input> est remplacé par un <textarea> « Rechercher » qui prend le focus : valider
 *  sur l'<input> d'avant (champ.press) visait un champ qui n'existait plus (qa_issues
 *  `test-recherche-entree-iphone`, 15/11/2026). On tape donc dans le champ visible, <input> ou
 *  <textarea>, et on valide au clavier, sur le champ qui a le focus. */
export async function chercherEtValider(page: Page, texte: string) {
  const champ = page.locator("[data-top-bar] :is(input, textarea):visible").first();
  await champ.fill(texte);
  await expect(page.locator("[data-top-bar] :is(input, textarea):focus")).toHaveValue(texte);
  await page.keyboard.press("Enter");
}

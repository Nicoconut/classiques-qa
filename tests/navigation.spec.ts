import { test, expect, ouvrirLiseuse, estIphone } from "./outils";

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

// S15 (16/11/2026) : une adresse inventée qui demande le livre entier (Mistral, 10/11 :
// `/le-rouge-et-le-noir/livre-complet`) mène à la page du livre, pas à une recherche de passage.
test("une adresse « livre complet », « texte intégral » ou « pdf » mène au livre", async ({ request }) => {
  for (const fin of ["livre-complet", "texte-integral", "pdf", "lire-en-ligne"]) {
    const r = await request.get(`/livres/stendhal/le-rouge-et-le-noir/${fin}`, { maxRedirects: 0 });
    expect(r.status(), fin).toBe(308);
    expect(r.headers()["location"], fin).toMatch(/\/livres\/stendhal\/le-rouge-et-le-noir$/);
  }
});

// S39 (19/11/2026) : une adresse forgée sur le sommaire, numéro puis titre (Mistral, 11/11 :
// `/le-grand-meaulnes/2-apres-quatre-heures`), mène au chapitre, pas au haut du livre.
test("une adresse « numéro + titre du chapitre » mène au chapitre", async ({ request }) => {
  for (const fin of ["2-apres-quatre-heures", "chapitre-2-apres-quatre-heures"]) {
    const r = await request.get(`/citation?q=${fin.replace(/-/g, "+")}&livre=le-grand-meaulnes&depuis=adresse`, { maxRedirects: 0 });
    expect(r.status(), fin).toBe(302);
    expect(r.headers()["location"], fin).toMatch(/\/livres\/alain-fournier\/le-grand-meaulnes\/apres-quatre-heures$/);
  }
});

// 20/11/2026 (point des fiches résumé) : 7 % seulement des visiteurs entrés par une fiche allaient vers le texte.
// Sous chaque résumé de scène ou de chapitre, un lien « Lire la scène · 3 min → » mène à sa page.
test("sous le résumé d'une scène, « Lire la scène » mène à la scène", async ({ page }) => {
  await page.goto("/livres/moliere/le-malade-imaginaire/resume");
  const lien = page.locator("[data-lire-section]").first();
  await expect(lien).toHaveText(/^Lire la scène · \d+ min →$/);
  await lien.click();
  await expect(page).toHaveURL(/\/livres\/moliere\/le-malade-imaginaire\/acte-i-scene-i$/);
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

// 14/11/2026 (qa_issues `menu-echap-clic-exterieur`) : Échap ferme le menu ≡ et rend la main au
// bouton ; un clic dans la page le ferme aussi.
test("Échap ou un clic dans la page ferme le menu", async ({ page }) => {
  await page.goto("/bibliographie/hugo");
  const bouton = page.locator('button[aria-label="Menu"]:visible');
  const ouvrir = async () => {
    await expect(async () => {
      if ((await bouton.getAttribute("aria-expanded")) !== "true") await bouton.click();
      await expect(bouton).toHaveAttribute("aria-expanded", "true", { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
  };
  await ouvrir();
  await page.keyboard.press("Escape");
  await expect(bouton).toHaveAttribute("aria-expanded", "false");
  await expect(bouton).toBeFocused();
  await ouvrir();
  // Clic brut au milieu du titre de la page, hors du menu.
  const titre = await page.getByRole("heading", { level: 1 }).first().boundingBox();
  await page.mouse.click(titre!.x + 10, titre!.y + titre!.height / 2);
  await expect(bouton).toHaveAttribute("aria-expanded", "false");
});

// 14/11/2026 (qa_issues `sommaire-niveau-5-aplati`) : un titre `#####` est en retrait sous son
// `####` dans le sommaire (Quatrevingt-treize : « La Tourgue » sous « Une bastille de province »).
test("le sommaire met une sous-partie en retrait sous sa partie", async ({ page }) => {
  await ouvrirLiseuse(page, "/livres/hugo/quatrevingt-treize#sommaire");
  const sommaire = page.locator("aside");
  const partie = sommaire.getByRole("button", { name: "IX — Une bastille de province", exact: true }).first();
  const sousPartie = sommaire.getByRole("button", { name: "I — La Tourgue", exact: true }).first();
  await sousPartie.scrollIntoViewIfNeeded();
  const a = await partie.boundingBox();
  const b = await sousPartie.boundingBox();
  expect(b!.x).toBeGreaterThan(a!.x + 8);
});

// 14/11/2026 (qa_issues `compteur-position-chapitre`) : le compteur sous le titre ne contredit pas
// le numéro du chapitre. Il ne compte ni la préface (Thérèse Raquin « XXXII » était « partie 33
// sur 33 ») ni les autres livres des Essais (« CHAPITRE XXX » était « chapitre 31 sur 108 »).
test("le compteur de section suit le numéro du chapitre", async ({ page }) => {
  await page.goto("/livres/zola/therese-raquin/xxxii");
  await expect(page.locator("header").getByText(/\b32 sur 32\b/)).toBeVisible();
  await page.goto("/livres/montaigne/essais-montaigne/des-cannibales");
  await expect(page.locator("header").getByText(/chapitre 30 sur 57\b/)).toBeVisible();
});

// 17/11/2026 (qa_issues `confidentialite-tableaux-coupes-mobile`) : sur iPhone, les tableaux des pages
// légales débordaient de leur cadre (« 30 jo ») ; ils s'empilent désormais ligne par ligne.
test("je lis les tableaux de la page confidentialité sans qu'une colonne soit coupée", async ({ page }, info) => {
  test.skip(!estIphone(info.project.name), "propre au petit écran");
  await page.goto("/confidentialite");
  const tableaux = page.locator("article table");
  await expect(tableaux.first().getByText("30 jours")).toBeVisible();
  expect(await tableaux.count()).toBeGreaterThan(0);
  for (const tableau of await tableaux.all()) {
    const { table, cadre } = await tableau.evaluate((t) => ({ table: t.scrollWidth, cadre: t.parentElement!.clientWidth }));
    expect(table, "largeur du tableau dans son cadre").toBeLessThanOrEqual(cadre);
  }
});

// 19/11/2026 (qa_issues `accueil-duree-bloque-toucher`) : sur iPhone, toucher la durée d'un livre du
// catalogue (« 37 h ») montrait une bulle d'aide et le livre ne s'ouvrait pas.
test("sur iPhone, toucher la durée d'un livre de l'accueil ouvre le livre", async ({ page }, info) => {
  test.skip(!estIphone(info.project.name), "propre au petit écran");
  await page.goto("/");
  const lien = page.locator('a[href="/livres/hugo/les-miserables"]').first();
  await lien.getByText(/\d+ h$/).tap();
  await expect(page).toHaveURL(/\/livres\/hugo\/les-miserables$/, { timeout: 15_000 });
});

// 19/11/2026 (qa_issues `impression-barre-et-liens`) : « le dormeur du val texte à imprimer ». La
// feuille imprimée gardait la barre de recherche, le fil d'Ariane, les liens et la navigation.
test("j'imprime un poème : la feuille garde le titre, l'auteur et le texte, sans la barre ni les liens", async ({ page }) => {
  await page.goto("/livres/rimbaud/poesies-rimbaud/le-dormeur-du-val");
  await expect(page.getByRole("button", { name: "Imprimer" })).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("[data-top-bar]")).toBeHidden();
  await expect(page.getByRole("navigation", { name: "Fil d'Ariane" })).toBeHidden();
  for (const nav of await page.getByRole("navigation", { name: "Sections voisines" }).all()) await expect(nav).toBeHidden();
  await expect(page.getByRole("button", { name: "Imprimer" })).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Le texte du poème (la tête de page, qui cite aussi le premier vers, est masquée à l'impression).
  await expect(page.locator("[data-numeros-ligne]").getByText(/trou de verdure/).first()).toBeVisible();
  await expect(page.getByText(/\/livres\/rimbaud\/poesies-rimbaud\/le-dormeur-du-val$/)).toBeVisible();
});

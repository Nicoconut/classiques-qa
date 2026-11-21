import { test, expect, champRecherche, chercherEtValider, ouvrirLiseuse } from "./outils";

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

// 14/11/2026 (qa_issues `recherche-entree-titre`) : Entrée sur un titre, avec ou sans le nom de
// l'auteur, ouvre le livre au lieu de chercher ces mots dans le texte (« Aucun résultat »).
test("[recherche-entree-titre] Entrée sur un titre et son auteur ouvre le livre", async ({ page }) => {
  await page.goto("/bibliographie/corneille");
  // La barre n'écoute qu'une fois la page active : on retape tant que la page n'a pas changé.
  await expect(async () => {
    await chercherEtValider(page, "Le menteur corneille");
    await expect(page).toHaveURL(/\/livres\/corneille\/le-menteur/, { timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
});

// 14/11/2026 (qa_issues `accueil-recherche-avancee`) : sur l'accueil, un titre s'ouvre directement ;
// un autre mot montre les auteurs où il apparaît, sans formulaire, et la recherche avancée reste là.
test("[recherche-accueil] depuis l'accueil, Entrée sur un titre ouvre le livre", async ({ page }) => {
  await page.goto("/");
  await expect(async () => {
    await chercherEtValider(page, "le colonel chabert");
    await expect(page).toHaveURL(/\/livres\/balzac\/le-colonel-chabert/, { timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
});

test("[recherche-accueil] depuis l'accueil, un mot montre les auteurs où il apparaît", async ({ page }) => {
  await page.goto("/");
  await expect(async () => {
    await chercherEtValider(page, "mélancolie");
    await expect(page).toHaveURL(/\/recherche\?q=m%C3%A9lancolie/, { timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
  const auteurs = page.locator("[data-where-authors]");
  const balzac = auteurs.getByRole("link", { name: /^Balzac/ });
  await expect(balzac).toBeVisible({ timeout: 30_000 });
  await expect(balzac).toHaveAttribute("href", /\/bibliographie\/balzac\?q=m%C3%A9lancolie/);
  // La recherche avancée reste à un clic.
  await page.getByRole("button", { name: "recherche avancée", exact: true }).click();
  const avancee = page.getByRole("dialog", { name: "Recherche avancée" });
  await expect(avancee).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(avancee).toBeHidden();
  await balzac.click();
  await expect(page).toHaveURL(/bibliographie\/balzac/);
  await expect(page.getByText(/\d[\d  ]*\s+occurrences?/).first()).toBeVisible({ timeout: 30_000 });
});

// 19/11/2026 (refonte de la loupe, recherche.md) : une recherche dans le livre affiche TOUS ses
// résultats sur une page, à la place du texte ; « Lire dans le livre » mène au passage, et
// « ← Les N résultats » ramène à la liste (plus de précédent / suivant).
test("je cherche dans le livre ouvert", async ({ page }) => {
  await ouvrirLiseuse(page, "/livres/moliere/dom-juan");
  await page.locator('button[aria-label="Rechercher dans ce livre"]:visible').click();
  const champ = page.locator("input:visible").first();
  await champ.fill("Sganarelle");
  await champ.press("Enter");
  await expect(page.getByText(/\d+ résultats? pour « Sganarelle » dans Dom Juan/).first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: /Lire dans le livre/ }).first().click();
  const retour = page.getByRole("button", { name: /^← Les \d+ résultats?$/ });
  await expect(retour).toBeVisible();
  await retour.click();
  await expect(page.getByText(/\d+ résultats? pour « Sganarelle »/).first()).toBeVisible();
});

// Sans compte, un lien vers une recherche dans un livre arrive sur la page statique : la liseuse
// lit `?q=` elle-même (tâche « Vercel caps », S47, 14/11/2026).
test("un lien de recherche ouvre le livre sur ses occurrences", async ({ page }) => {
  await ouvrirLiseuse(page, "/livres/moliere/dom-juan?q=Sganarelle");
  await expect(page.getByText(/\d+ résultats? pour « Sganarelle » dans Dom Juan/).first()).toBeVisible({ timeout: 30_000 });
});

// 19/11/2026 (recherche.md) : une faute de frappe montre directement les résultats du mot
// corrigé, dans la liseuse (vocabulaire du livre) comme dans le catalogue (table corpus_words).
test("une faute de frappe cherche le mot corrigé", async ({ page }) => {
  await ouvrirLiseuse(page, "/livres/maupassant/boule-de-suif?q=dilligence");
  await expect(page.getByText(/\d+ résultats? pour « diligence » dans Boule de Suif/).first()).toBeVisible({ timeout: 30_000 });
  await page.goto("/recherche?q=dilligence");
  await expect(page.getByRole("heading", { name: /« diligence » dans le catalogue/ })).toBeVisible({ timeout: 30_000 });
});

// 14/11/2026 (qa_issues `loupe-zero-renvoi-site`) : un mot absent du livre ne laisse pas le lecteur
// sur un « 0 résultat » sec, la loupe propose de chercher dans les autres livres de l'auteur.
// (« Jules » ne convient plus : Gargantua l'écrit « Iules », que la correction retrouve.)
test("la loupe sans résultat propose de chercher dans le catalogue", async ({ page }) => {
  await ouvrirLiseuse(page, "/livres/maupassant/boule-de-suif");
  await page.locator('button[aria-label="Rechercher dans ce livre"]:visible').click();
  const champ = page.locator("input:visible").first();
  await champ.fill("ordinateur");
  await champ.press("Enter");
  await expect(page.getByText(/Aucun résultat pour « ordinateur » dans Boule de Suif/).first()).toBeVisible({ timeout: 30_000 });
  const lien = page.getByRole("link", { name: /Chercher « ordinateur » dans les autres livres de/ });
  await expect(lien).toBeVisible();
  await expect(lien).toHaveAttribute("href", /\/bibliographie\/maupassant\?q=ordinateur/);
});

// 19/11/2026 (rejeu des recherches, recherche.md) : deux mots sans résultat mot pour mot donnent
// des passages proches, même répartis sur deux paragraphes voisins et sous une autre forme
// (« le patron de l'auberge parut… » puis « Il demanda »), au lieu d'« Aucun résultat ».
test("deux mots sans résultat exact : la loupe montre les passages proches", async ({ page }) => {
  await ouvrirLiseuse(page, "/livres/maupassant/boule-de-suif");
  await page.locator('button[aria-label="Rechercher dans ce livre"]:visible').click();
  const champ = page.locator("input:visible").first();
  await champ.fill("l'aubergiste demanda");
  await champ.press("Enter");
  await expect(page.getByText(/\d passages? proches? dans Boule de Suif/).first()).toBeVisible({ timeout: 30_000 });
  // Le texte du livre, caché sous la liste, contient aussi la phrase : on vise la ligne visible.
  await expect(page.getByText(/le patron de l’auberge parut lui-même/).locator("visible=true").first()).toBeVisible();
});

// 19/11/2026 : sur la page d'un auteur, le titre d'une de ses nouvelles suivi de son nom ouvre la
// nouvelle (« La parure de Guy de maupassant » répondait « Aucun résultat »).
test("le titre d'une nouvelle avec le nom de l'auteur ouvre la nouvelle", async ({ page }) => {
  await page.goto("/bibliographie/maupassant");
  await expect(async () => {
    await chercherEtValider(page, "La parure de Guy de maupassant");
    await expect(page).toHaveURL(/\/livres\/maupassant\/contes-du-jour-et-de-la-nuit/, { timeout: 8_000 });
  }).toPass({ timeout: 40_000 });
});

// 20/11/2026 (R18, recherche.md) : dans la loupe, un poème d'un autre livre du même auteur est
// proposé quand le livre ouvert n'a rien (« oceanox » dans Les Contemplations : « Oceano Nox » est
// dans Les Rayons et les Ombres), et le choisir ouvre ce poème.
test("la loupe propose un poème d'un autre livre de l'auteur", async ({ page }) => {
  await ouvrirLiseuse(page, "/livres/hugo/les-contemplations");
  await page.locator('button[aria-label="Rechercher dans ce livre"]:visible').click();
  const champ = page.locator("input:visible").first();
  await champ.click();
  await champ.pressSequentially("oceanox", { delay: 40 });
  const option = page.getByRole("option", { name: /OCEANO NOX/ });
  await expect(option).toBeVisible({ timeout: 20_000 });
  await option.click();
  await expect(page).toHaveURL(/\/livres\/hugo\/les-rayons-et-les-ombres\/oceano-nox/, { timeout: 20_000 });
});

// 17/11/2026 (recherche.md, R7) : « partie 3 » dans un livre qui n'en a que deux ne laisse pas la
// liste vide, elle montre les parties du livre avec « pas de partie 3 ».
test("[recherche-chapitre-absent] une partie qui n'existe pas montre les parties du livre", async ({ page }) => {
  await ouvrirLiseuse(page, "/livres/maupassant/bel-ami");
  await page.locator('button[aria-label="Rechercher dans ce livre"]:visible').click();
  const champ = page.locator("input:visible").first();
  await champ.click();
  await champ.pressSequentially("partie 3", { delay: 40 });
  await expect(page.getByText(/pas de partie 3/).first()).toBeVisible({ timeout: 15_000 });
});

// 19/11/2026 (qa_issues `recherche-deux-mots-20-caracteres`) : « Seine pêcheurs » chez Zola ne
// donnait rien à moins de 20 caractères et le lecteur retapait « Seine » seul. La recherche
// s'élargit seule (200, puis 1 000 caractères) et le dit.
test("deux mots éloignés : la recherche s'élargit seule au lieu de ne rien trouver", async ({ page }) => {
  await page.goto("/bibliographie/zola?q=Seine+p%C3%AAcheurs");
  await expect(page.getByText(/Aucun résultat à moins de 20 caractères/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/\d[\d  ]*\s+occurrences?/).first()).toBeVisible();
  expect(new URL(page.url()).searchParams.get("prox")).toMatch(/^(200|1000)$/);
});

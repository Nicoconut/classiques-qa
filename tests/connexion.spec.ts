import { test, expect, estIphone } from "./outils";

// Connexion (27/11/2026) : Google, Apple et Microsoft quand leurs clés sont posées, et un code reçu
// par email pour tous les autres. Aucun test n'envoie de vrai code : on vérifie la page, et que le
// serveur refuse une adresse mal formée.

test("je peux me connecter avec Google ou avec un code reçu par email", async ({ page }) => {
  await page.goto("/signin");
  const carte = page.locator("#hero-cta");
  await expect(carte.getByRole("button", { name: "Continuer avec Google" })).toBeVisible();
  await expect(carte.getByRole("textbox", { name: "Votre adresse email" })).toBeVisible();
  await expect(carte.getByRole("button", { name: "Recevoir un code par email" })).toBeVisible();
});

test("le serveur refuse d'envoyer un code à une adresse mal formée", async ({ request }) => {
  const r = await request.post("/api/connexion/code", { data: { email: "pas-une-adresse" } });
  expect(r.status()).toBe(400);
});

// Création de compte de bout en bout (demandée par Nick le 27/11/2026) : un nouveau lecteur
// demande un code, le tape, et arrive connecté sur la page qu'il voulait. Avec le secret du robot
// QA (QA_LOGIN_SECRET), le serveur rend le code au test au lieu de l'envoyer, pour la seule
// adresse qa+inscription@classiques.app, et l'oublie avant chaque passage : c'est chaque fois
// une vraie première connexion. Sans le secret, le test est sauté.
test("je crée mon compte avec un code reçu par email", async ({ page }, info) => {
  test.skip(estIphone(info.project.name), "une seule adresse de test : un appareil à la fois");
  const secret = process.env.QA_LOGIN_SECRET;
  test.skip(!secret, "QA_LOGIN_SECRET absent");
  await page.route("**/api/connexion/code", (route) =>
    route.continue({ headers: { ...route.request().headers(), "x-qa-secret": secret! } }));
  await page.goto("/signin?callbackUrl=%2Fcorpus");
  const carte = page.locator("#hero-cta");
  await carte.getByRole("textbox", { name: "Votre adresse email" }).fill("qa+inscription@classiques.app");
  const [reponse] = await Promise.all([
    page.waitForResponse("**/api/connexion/code"),
    carte.getByRole("button", { name: "Recevoir un code par email" }).click(),
  ]);
  expect(reponse.status(), "le serveur a refusé le code de test").toBe(200);
  const { code } = await reponse.json();
  await carte.getByRole("textbox", { name: "Code reçu par email" }).fill(code);
  await carte.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/corpus$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Mes Corpus" })).toBeVisible();
});

// Listes de citations et corpus partageables (E13, benchmark-enseignants.md, demandes de Nick du
// 27/11/2026) : par un lien public, ou par un lien protégé par le mot de passe de la classe. Un élève
// sans compte les ouvre ; jamais dans Google ; revenus à « Moi seul », le lien ne mène plus nulle part.
// Dans ce fichier : ses tests passent l'un après l'autre, et l'adresse de test sert à un seul à la fois.
async function connecterQa(page: import("@playwright/test").Page, retour: string) {
  const secret = process.env.QA_LOGIN_SECRET!;
  await page.route("**/api/connexion/code", (route) =>
    route.continue({ headers: { ...route.request().headers(), "x-qa-secret": secret } }));
  await page.goto(`/signin?callbackUrl=${encodeURIComponent(retour)}`);
  const carte = page.locator("#hero-cta");
  await carte.getByRole("textbox", { name: "Votre adresse email" }).fill("qa+inscription@classiques.app");
  const [reponse] = await Promise.all([
    page.waitForResponse("**/api/connexion/code"),
    carte.getByRole("button", { name: "Recevoir un code par email" }).click(),
  ]);
  const { code } = await reponse.json();
  await carte.getByRole("textbox", { name: "Code reçu par email" }).fill(code);
  await carte.getByRole("button", { name: "Se connecter" }).click();
}

test("je partage une liste de citations et un corpus avec ma classe", async ({ page, browser, baseURL }, info) => {
  test.skip(estIphone(info.project.name), "une seule adresse de test : un appareil à la fois");
  test.skip(!process.env.QA_LOGIN_SECRET, "QA_LOGIN_SECRET absent");
  await connecterQa(page, "/favoris");
  await expect(page).toHaveURL(/\/favoris$/, { timeout: 30_000 });

  const { list } = await (await page.request.post("/api/favorites/lists", { data: { name: "L’ambition dans Le Menteur" } })).json();
  await page.request.post(`/api/favorites/lists/${list.id}/citations`, { data: {
    bookId: "le-menteur", lineIdx: 116,
    selection: "À la fin j’ai quitté la robe pour l’épée", contextLine: "À la fin j’ai quitté la robe pour l’épée :",
  } });
  const { corpus } = await (await page.request.post("/api/corpora", { data: { name: "Théâtre du bac 2027", bookIds: ["le-menteur", "on-ne-badine-pas-avec-l-amour"] } })).json();
  const eleve = await browser.newContext();
  await eleve.addCookies([{ name: "ph_optout", value: "1", url: baseURL! }]);
  const p2 = await eleve.newPage();
  try {
    // Liste : lien public.
    await page.goto(`/favoris/${list.id}`);
    await page.getByRole("button", { name: "Lien public" }).click();
    const adresse = page.getByRole("textbox", { name: "Adresse à partager" });
    await expect(adresse).toHaveValue(/\/listes\/[A-Za-z0-9]{12}$/);
    const url = await adresse.inputValue();
    await p2.goto(url);
    await expect(p2.getByRole("heading", { name: "L’ambition dans Le Menteur" })).toBeVisible();
    await expect(p2.getByText("À la fin j’ai quitté la robe pour l’épée").first()).toBeVisible();
    await expect(p2.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

    // Liste : mot de passe de la classe. L'élève le tape une fois, la liste s'ouvre.
    await page.getByRole("button", { name: "Avec mot de passe" }).click();
    await page.getByPlaceholder(/Mot de passe de la classe/).fill("1reB-2027");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByRole("button", { name: "Changer le mot de passe" })).toBeVisible();
    await p2.goto(url);
    await p2.getByLabel("Mot de passe de la classe").fill("faux");
    await p2.getByRole("button", { name: "Ouvrir" }).click();
    await expect(p2.getByText("Mot de passe incorrect.")).toBeVisible();
    await p2.getByLabel("Mot de passe de la classe").fill("1reB-2027");
    await p2.getByRole("button", { name: "Ouvrir" }).click();
    await expect(p2.getByText("À la fin j’ai quitté la robe pour l’épée").first()).toBeVisible();

    // Moi seul : le lien ne mène plus nulle part.
    await page.getByRole("button", { name: "Moi seul" }).click();
    await expect(page.getByText("Vous seul y avez accès.")).toBeVisible();
    expect((await p2.goto(url))!.status()).toBe(404);

    // Corpus : lien public ; l'élève voit les œuvres et cherche dedans.
    await page.goto(`/corpus/${corpus.id}`);
    await page.getByRole("button", { name: "Lien public" }).click();
    const urlCorpus = await page.getByRole("textbox", { name: "Adresse à partager" }).inputValue();
    expect(urlCorpus).toMatch(/\/corpus\/partage\/[A-Za-z0-9]{12}$/);
    await p2.goto(urlCorpus);
    await expect(p2.getByRole("heading", { name: "Théâtre du bac 2027" })).toBeVisible();
    const res = await p2.request.get(`/api/search?q=${encodeURIComponent("Dorante")}&corpus=${corpus.id}`);
    expect((await res.json()).total, "la recherche d'un élève porte sur le corpus partagé").toBeGreaterThan(0);
  } finally {
    await eleve.close();
    await page.request.delete(`/api/favorites/lists/${list.id}`);
    await page.request.delete(`/api/corpora/${corpus.id}`);
  }
});

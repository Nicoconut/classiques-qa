import type { APIRequestContext, Locator } from "@playwright/test";
import { test, expect, ouvrirLiseuse, estIphone } from "./outils";

test("depuis l'accueil, j'ouvre un livre du catalogue", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Classiques.app");
  // On touche le titre : la durée de lecture, sur la même ligne, ouvre une bulle d'aide.
  await page.locator('a[href="/livres/flaubert/madame-bovary"]').getByText("Madame Bovary", { exact: true }).first().click();
  await expect(page).toHaveURL(/\/livres\/flaubert\/madame-bovary/);
  await expect(page.getByRole("heading", { level: 1, name: "Madame Bovary" })).toBeVisible();
});

// Accueil en ordre chronologique inverse (décision Nick 27/11/2026) : les auteurs les plus récents
// d'abord, et chez chacun le livre le plus récent en tête.
test("l'accueil présente les auteurs et leurs livres du plus récent au plus ancien", async ({ page }) => {
  await page.goto("/");
  const auteurs = await page.locator('h2 a[href^="/bibliographie/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  expect(auteurs.indexOf("/bibliographie/zola")).toBeLessThan(auteurs.indexOf("/bibliographie/moliere"));
  expect(auteurs.indexOf("/bibliographie/moliere")).toBeLessThan(auteurs.indexOf("/bibliographie/rabelais"));
  const annees = await page.locator('h2:has(a[href="/bibliographie/flaubert"]) + * , h2:has(a[href="/bibliographie/flaubert"]) ~ a')
    .evaluateAll((els) => els.map((e) => Number(e.querySelector("span")?.textContent)).filter((n) => n > 0));
  expect(annees.length).toBeGreaterThan(2);
  expect(annees).toEqual([...annees].sort((a, b) => b - a));
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

// Arrivé de Google sur l'acte IV pour « dom juan acte 1 » (registre QA dom-juan-requete-acte-1),
// je rejoins le début de l'acte I en un geste, sans enchaîner les « scène suivante ».
test("depuis une scène, je vais directement au début d'un autre acte", async ({ page }) => {
  await page.goto("/livres/moliere/dom-juan/acte-iv-scene-i");
  const actes = page.getByRole("navigation", { name: "Actes de la pièce" });
  await expect(actes.locator('[aria-current="true"]')).toHaveText("IV");
  await actes.getByRole("link", { name: "Acte I", exact: true }).click();
  await expect(page).toHaveURL(/\/dom-juan\/acte-i-scene-i$/);
  await expect(actes.locator('[aria-current="true"]')).toHaveText("I");
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
  // Dans l'écran, pas seulement dans la page (toBeVisible passait le lecteur resté en haut du livre).
  await expect(page.getByText("Quoi qu’il en soit, laissons cela").first()).toBeInViewport();
});

// Registre QA livre-complet-sans-position (17/11/2026) : depuis « La cravate et la montre »
// (10e poème sur 83), « Livre complet » ouvrait Calligrammes sur la dédicace.
test("depuis un poème, “Livre complet” m'ouvre le recueil sur ce poème", async ({ page }) => {
  await page.goto("/livres/apollinaire/calligrammes/la-cravate-et-la-montre");
  await page.getByRole("link", { name: /Livre complet/ }).first().click();
  await expect(page).toHaveURL(/\/calligrammes\?line=\d+/);
  await expect(page.getByText("LA CRAVATE DOULOUREUSE QUE TU PORTES").first()).toBeInViewport();
});

// Registre QA lettres-courtes-sans-page (17/11/2026) : la lettre VIII de la 3e partie proposait
// « LETTRE X » ; la lettre IX (« Venez, Milord… », 45 mots) et le billet de Julie n'avaient pas de
// page. Une section courte a sa page, servie mais hors de Google (noindex).
test("j'avance de lettre en lettre sans en sauter une", async ({ page }) => {
  await page.goto("/livres/rousseau/la-nouvelle-heloise/troisieme-partie-lettre-viii");
  await page.getByRole("navigation", { name: "Sections voisines" }).first().getByRole("link", { name: /LETTRE IX\b/ }).click();
  await expect(page).toHaveURL(/\/la-nouvelle-heloise\/troisieme-partie-lettre-ix$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("LETTRE IX");
  await expect(page.getByText("Venez, Milord").first()).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const reponse = await page.request.get("/livres/rousseau/la-nouvelle-heloise/troisieme-partie-lettre-ix", { maxRedirects: 0 });
  expect(reponse.status()).toBe(200);
  // La suivante est le billet de Julie, lui aussi court, puis la lettre X.
  await expect(page.getByRole("navigation", { name: "Sections voisines" }).first().getByRole("link", { name: /BILLET DE JULIE/ })).toBeVisible();
});

// Friction 25fbae89 (19/11/2026, décision de Nick) : seules les « Moralité » de Perrault avaient une
// page, aucun conte ; seul le roman du Chant VI de Maldoror, pas les Chants I à V. Une partie placée
// au-dessus des unités du livre a maintenant sa page, pour son texte propre. Les pages qui existaient
// gardent leur adresse et leur texte.
// Décision de Nick du 19/11/2026 (registre QA `perrault-contes-sans-page`) : le conte et ses
// moralités sur une seule page, 8 pages au lieu de 13 « Moralité » ; l'ancienne adresse de la
// moralité mène au conte.
test("je lis un conte de Perrault et sa moralité sur une seule page ; l'adresse de la moralité y mène", async ({ page }) => {
  const livre = "/livres/perrault/histoires-ou-contes-du-temps-passe";
  expect((await page.goto(`${livre}/le-petit-chaperon-rouge`))?.status()).toBe(200);
  expect(new URL(page.url()).pathname, "pas de redirection").toBe(`${livre}/le-petit-chaperon-rouge`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Le petit chaperon rouge");
  const texte = page.locator("[data-numeros-ligne]");
  await expect(texte.getByText(/Il était une fois une petite fille de village/).first()).toBeVisible();
  // Le conte jusqu'à sa dernière phrase, puis sa moralité, sur la même page.
  await expect(texte).toContainText("se jeta sur le Petit Chaperon rouge, et la mangea");
  await expect(texte).toContainText("On voit ici que de jeunes enfants");
  // Une page proposée à Google : pas de noindex.
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
  // Après le conte, le conte suivant.
  await expect(page.getByRole("navigation", { name: "Sections voisines" }).first().getByRole("link", { name: /Barbe-Bleue/ })).toBeVisible();
  // L'adresse d'avant de la moralité mène au conte.
  await page.goto(`${livre}/le-petit-chaperon-rouge-moralite`);
  expect(new URL(page.url()).pathname).toBe(`${livre}/le-petit-chaperon-rouge`);
  await expect(texte).toContainText("On voit ici que de jeunes enfants");
});

test("chaque chant de Maldoror a sa page, et le roman du Chant VI garde les siennes", async ({ page }) => {
  const livre = "/livres/lautreamont/les-chants-de-maldoror";
  // Une page d'avant : même adresse, même texte, même compteur.
  expect((await page.goto(`${livre}/i`))?.status()).toBe(200);
  expect(new URL(page.url()).pathname, "pas de redirection").toBe(`${livre}/i`);
  const texte = page.locator("[data-numeros-ligne]");
  await expect(texte).toContainText("Les magasins de la rue Vivienne étalent leurs richesses");
  await expect(page.locator("header").getByText(/\b1 sur 8\b/)).toBeVisible();
  // Avant elle, les strophes qui ouvrent le Chant VI, sans le chapitre I.
  await page.getByRole("navigation", { name: "Sections voisines" }).first().getByRole("link", { name: /CHANT SIXIÈME/i }).click();
  await expect(page).toHaveURL(/\/les-chants-de-maldoror\/chant-sixieme$/);
  await expect(texte).toContainText("Vous, dont le calme enviable");
  await expect(texte).not.toContainText("Les magasins de la rue Vivienne");
  // Le Chant premier n'avait aucune page.
  expect((await page.goto(`${livre}/chant-premier`))?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("CHANT PREMIER");
  await expect(texte).toContainText("Plût au ciel que le lecteur");
});

// Sans compte, un lien de citation arrive sur la page statique : la liseuse lit `?cite=` elle-même
// et va chercher le passage, même loin du début (tâche « Vercel caps », S47, 14/11/2026).
test("un lien de citation m'amène au passage", async ({ page }) => {
  await ouvrirLiseuse(page, `/livres/moliere/dom-juan?cite=${encodeURIComponent("Quoi qu’il en soit, laissons cela")}`);
  await expect(page.getByText("Quoi qu’il en soit, laissons cela").first()).toBeInViewport();
});

// Trois tests séparés plutôt qu'un seul qui enchaîne les livres (14/11/2026) :
// changer de livre en pleine lecture coupait le chargement des commentaires, que
// Safari iPhone remonte comme une erreur de page. Le test ratait son premier essai
// 4 fois en 8 jours (registre, regression-iphone-andromaque-commentaires).
test("je lis des italiques sans astérisque (vers)", async ({ page }) => {
  await ouvrirLiseuse(page, "/livres/racine/andromaque?line=48");
  await expect(page.getByText("En marge de ces vers on lit le nom d’Andromaque.").locator("em")).toHaveText("Andromaque");
});

test("je lis des italiques sans astérisque (prose)", async ({ page }) => {
  await ouvrirLiseuse(page, "/livres/stendhal/de-l-amour?line=357");
  await expect(page.getByText("comme dit le vulgaire, romanesque").locator("em")).toHaveText("romanesque");
});

// Registre QA apparat-appel-autre-ligne (14/11/2026) : l'appel « un orgue* » est un paragraphe
// au-dessus de la note `* Un homme.` ; la liseuse répétait l'astérisque à la fin du paragraphe
// suivant, « – Il faudrait un môme***, reprit Brujon.* ».
test("[texte-fidele] un appel d'apparat n'est pas répété au paragraphe de la note", async ({ page }) => {
  await ouvrirLiseuse(page, "/livres/hugo/les-miserables?line=18393");
  const ligne = page.locator("[data-line-content]", { hasText: "Il faudrait un môme" }).first();
  await expect(ligne).toBeVisible();
  expect((await ligne.textContent())!.trim()).toMatch(/reprit Brujon\.$/);
  await expect(page.locator("[data-line-content]", { hasText: "un orgue" }).first().locator("sup", { hasText: /^\*$/ })).toHaveCount(1);
});

test("un nom caché reste un nom caché, sans italique", async ({ page }) => {
  await page.goto("/livres/stendhal/la-chartreuse-de-parme/xiii");
  await expect(page.getByText("À ce mot, le comte M***, qui ne brillait pas")).toBeVisible();
  await expect(page.locator("em", { hasText: "qui ne brillait pas" })).toHaveCount(0);
});

// Registre QA italique-sup-brut (14/11/2026) : un appel de note dans un paragraphe tout en italique
// (prologue de Gargantua) s'affichait « braguettes<sup>10</sup> » en toutes lettres, sur la page de la
// section comme dans le livre entier. Le contenu de l'italique est maintenant relu.
test("[texte-fidele] un appel de note dans un italique s'affiche en exposant", async ({ page }) => {
  const verifier = async (paragraphe: Locator, ou: string) => {
    await expect(paragraphe.locator("sup", { hasText: /^10$/ }), ou).toHaveCount(1);
    // « braguettes » est suivi de l'exposant « 10 », sans balise entre les deux.
    expect(await paragraphe.textContent(), ou).toContain("La dignité des braguettes10,");
    await expect(page.locator("body"), ou).not.toContainText("<sup>");
  };
  await page.goto("/livres/rabelais/gargantua/prologe-de-l-auteur");
  await verifier(page.locator("p", { hasText: "Fessepinte, La dignité des braguettes" }).first(), "page du prologue");
  const livre = await page.getByRole("link", { name: "Livre complet →" }).getAttribute("href");
  await ouvrirLiseuse(page, livre!);
  const ligne = page.locator("[data-line-content]", { hasText: "Fessepinte, La dignité des braguettes" }).first();
  await ligne.scrollIntoViewIfNeeded();
  await verifier(ligne, "livre entier");
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
  // Le Dormeur est dans deux recueils ; la liste met les Cahiers de Douai en premier (16/11/2026), dont
  // la page ne mène pas au Bateau ivre : on prend la version des Poésies, où les deux se suivent.
  await page.locator('a[href$="/poesies-rimbaud/le-dormeur-du-val"]').first().click();
  // Casse libre : les Cahiers de Douai titrent « Le Dormeur du Val » depuis le 16/11/2026 (capitales avant).
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/dormeur du val/i);
  await page.locator('a[href$="/le-bateau-ivre"]').first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/bateau ivre/i);
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

// Test A/B du thème (T01, ab-tests.md, 20/11/2026) : un nouveau visiteur tiré en version B voit le site
// dans le réglage de son appareil (Clair = pas d'attribut, sombre = Sombre nuit) ; en version A, Sombre nuit
// quel que soit l'appareil. Le panneau de réglages montre le thème affiché comme thème actif.
for (const [version, schema, attendu] of [["B", "light", null], ["B", "dark", "sombre-nuit"], ["A", "light", "sombre-nuit"]] as const) {
  test(`nouveau visiteur en version ${version}, appareil ${schema === "light" ? "clair" : "sombre"} : le thème par défaut suit le test`, async ({ page, baseURL }) => {
    await page.context().addCookies([{ name: "rdg_ab", value: version, url: baseURL! }]);
    await page.emulateMedia({ colorScheme: schema });
    await ouvrirLiseuse(page, "/livres/flaubert/madame-bovary/20min");
    expect(await page.locator("html").getAttribute("data-reading-theme")).toBe(attendu);
    await page.locator('button[aria-label="Paramètres de lecture"]:visible').click();
    await expect(page.getByRole("button", { name: attendu === null ? "Clair" : "Sombre nuit", exact: true })).toHaveAttribute("aria-pressed", "true");
  });
}

// Registre QA strophes-non-separees (14/11/2026) : la ligne vide entre deux strophes se voit, sur la page
// du poème comme dans le livre entier. On compare l'écart entre deux strophes à l'écart entre deux vers.
test("je lis un sonnet et ses strophes sont séparées", async ({ page }) => {
  const ecarts = async (ligne: string) => {
    const vers = (texte: string) => page.locator(ligne, { hasText: texte }).first();
    await vers("petit aval qui mousse de rayons").scrollIntoViewIfNeeded();
    const [v1, v2, v4, v5] = await Promise.all(
      ["trou de verdure où chante une rivière", "Accrochant follement aux herbes", "petit aval qui mousse de rayons", "Un soldat jeune, bouche ouverte"]
        .map((t) => vers(t).boundingBox()),
    );
    expect(v1 && v2 && v4 && v5, "vers du Dormeur du val introuvables").toBeTruthy();
    return { entreVers: v2!.y - (v1!.y + v1!.height), entreStrophes: v5!.y - (v4!.y + v4!.height) };
  };
  await page.goto("/livres/rimbaud/cahiers-de-douai/le-dormeur-du-val");
  const section = await ecarts("p");
  expect(section.entreStrophes, "page du poème").toBeGreaterThan(section.entreVers + 8);
  // Le livre entier, ouvert au poème (lien « Livre complet » de la page).
  const livre = await page.getByRole("link", { name: "Livre complet →" }).getAttribute("href");
  await ouvrirLiseuse(page, livre!);
  const liseuse = await ecarts("[data-line-content]");
  expect(liseuse.entreStrophes, "livre entier").toBeGreaterThan(liseuse.entreVers + 8);
});

// Registre QA numeros-ligne-page-section (14/11/2026) : le réglage « Numéros de ligne » marche sur la page
// d'un poème, reste après rechargement, et n'est pas proposé là où il n'y a rien à numéroter.
// Un poème hors de tout programme d'examen : sur une œuvre au programme, les numéros sont là
// d'office depuis le 27/11/2026 (extrait.spec.ts).
test("j'affiche les numéros de ligne sur la page d'un poème", async ({ page }) => {
  await page.goto("/livres/baudelaire/les-fleurs-du-mal/l-albatros");
  const premierVers = page.locator("p", { hasText: "pour s’amuser, les hommes d’équipage" }).first();
  // Bord gauche du texte du vers (le numéro, généré en CSS, n'en fait pas partie).
  const debutTexte = () => premierVers.evaluate((p) => {
    const r = document.createRange();
    r.selectNodeContents(p);
    return Math.min(...Array.from(r.getClientRects()).map((c) => c.left));
  });
  const sansNumeros = await debutTexte();
  await page.locator('button[aria-label="Paramètres de lecture"]:visible').click();
  await page.getByRole("button", { name: "Afficher les numéros" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-section-linenum", "");
  // Le texte se décale pour laisser la place au numéro (compteur CSS, hors du texte copiable).
  expect(await debutTexte()).toBeGreaterThan(sansNumeros + 20);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-section-linenum", "");
  await page.locator('button[aria-label="Paramètres de lecture"]:visible').click();
  await page.getByRole("button", { name: "Masquer les numéros" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-section-linenum");
  await page.goto("/a-propos");
  await page.locator('button[aria-label="Paramètres de lecture"]:visible').click();
  await expect(page.getByRole("button", { name: "Agrandir la taille" })).toBeVisible();
  await expect(page.getByRole("button", { name: /les numéros$/ })).toHaveCount(0);
});

// Registre QA taille-police-pages-section (14/11/2026) : « Agrandir la taille » agit aussi sur la page d'un
// poème (pas seulement dans la liseuse), et le réglage tient après rechargement, sans saut à l'affichage :
// la taille est posée avant le premier rendu du texte.
test("[lecture-reglages] j'agrandis le texte sur la page d'un poème", async ({ page }) => {
  await page.goto("/livres/rimbaud/cahiers-de-douai/le-dormeur-du-val");
  const premierVers = page.locator("p", { hasText: "trou de verdure où chante une rivière" }).first();
  const taille = () => premierVers.evaluate((p) => parseFloat(getComputedStyle(p).fontSize));
  const avant = await taille();
  await page.locator('button[aria-label="Paramètres de lecture"]:visible').click();
  await page.getByRole("button", { name: "Agrandir la taille" }).click();
  await page.getByRole("button", { name: "Agrandir la taille" }).click();
  await expect.poll(taille).toBeGreaterThan(avant + 1);
  const apres = await taille();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-section-fs", "24");
  expect(await taille()).toBeCloseTo(apres, 1);
  // Retour au défaut : la page reprend sa taille d'origine.
  await page.locator('button[aria-label="Paramètres de lecture"]:visible').click();
  await page.getByRole("button", { name: "Défaut" }).click();
  await expect.poll(taille).toBeCloseTo(avant, 1);
});

test("la page du catalogue des versions en 20 minutes liste des livres", async ({ page }) => {
  await page.goto("/lire-en-20-minutes");
  expect(await page.locator('a[href$="/20min"]').count()).toBeGreaterThan(50);
});

test("la page « Tous les résumés » mène aux résumés", async ({ page }) => {
  await page.goto("/resumes");
  expect(await page.locator('a[href$="/resume"]').count()).toBeGreaterThan(250);
});

test("la page À propos répond", async ({ page }) => {
  await page.goto("/a-propos");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

// Registre QA calligrammes-dessins (16/11/2026) : la page d'un calligramme montre sa forme imprimée en
// 1918 (image chargée, avec un texte alternatif), et le texte du poème reste dans la page.
test("[texte-calligrammes] je vois le calligramme « Il pleut » tel qu'imprimé, et son texte", async ({ page }) => {
  await page.goto("/livres/apollinaire/calligrammes/il-pleut");
  await expect(page.locator("article p", { hasText: "Il pleut des voix de femmes comme si elles étaient mortes" }).first()).toBeVisible();
  const image = page.locator("figure#calligramme img").first();
  // Après le texte sur mobile : on y descend pour que l'image (loading="lazy") se charge.
  await image.scrollIntoViewIfNeeded();
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute("alt", /Il pleut/);
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete ? img.naturalWidth : 0)).toBeGreaterThan(0);
  await expect(page.locator("figure#calligramme figcaption")).toHaveText("Calligramme tel qu’imprimé en 1918");
});

// Sur mobile, j'agrandis le texte avec deux doigts : la page ne bloque pas le zoom (registre QA
// zoom-interdit-mobile, WCAG 1.4.4), et elle ne déborde pas sur le côté.
test("sur mobile, je peux zoomer et la page ne déborde pas", async ({ page }, info) => {
  for (const chemin of ["/", "/livres/moliere/dom-juan/acte-iv-scene-i"]) {
    await page.goto(chemin);
    const meta = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(meta, `viewport de ${chemin}`).not.toMatch(/user-scalable\s*=\s*(no|0)\b|maximum-scale\s*=\s*1(\.0+)?\s*(,|$)/i);
    if (!estIphone(info.project.name)) continue;
    // Sans la coupe de globals.css (overflow-x: clip) : rien ne doit dépasser l'écran.
    const largeur = await page.evaluate(() => {
      for (const el of [document.documentElement, document.body]) { el.style.overflowX = "visible"; el.style.maxWidth = "none"; }
      return { page: document.documentElement.scrollWidth, ecran: window.innerWidth };
    });
    expect(largeur.page, `largeur de ${chemin}`).toBeLessThanOrEqual(largeur.ecran + 1);
  }
});

// Arrivé de Google sur un iPhone, la première ligne de l'auteur est dans le premier écran, sans
// faire défiler : la présentation se replie, « Voir aussi » tient sur une ligne (registre QA,
// scene-texte-sous-flottaison-mobile et livre-texte-sous-flottaison-mobile, 14/11/2026), et pour
// un livre, la première phrase du premier chapitre aussi : nature de la page et téléchargements sur
// une ligne, titres et dédicace resserrés (16/11/2026). Seul test de position du fichier : c'est la
// position elle-même qui est le geste (voir sans défiler).
const premierEcran = [
  { nom: "la première réplique d'une scène", chemin: "/livres/moliere/les-fourberies-de-scapin/acte-i-scene-i", liseuse: false, debut: "fâcheuses nouvelles pour un cœur amoureux" },
  // La première phrase du premier chapitre, après la dédicace et « Première partie — Combray » :
  // ~730 px au 12/11/2026, 668 px le 16/11 avant la correction, ~520 px après (registre,
  // livre-texte-sous-flottaison-mobile).
  { nom: "le début du texte d'un livre", chemin: "/livres/proust/du-cote-de-chez-swann", liseuse: true, debut: "Longtemps, je me suis couché de bonne heure" },
];
for (const cas of premierEcran) {
  test(`sur iPhone, je vois ${cas.nom} sans faire défiler`, async ({ page }, info) => {
    test.skip(!estIphone(info.project.name), "propre au petit écran");
    if (cas.liseuse) await ouvrirLiseuse(page, cas.chemin);
    else await page.goto(cas.chemin);
    await page.evaluate(() => document.fonts.ready.then(() => true));
    // Dans le texte lui-même : le sommaire (tiroir fermé) cite aussi le début des chapitres.
    const ligne = page.locator(cas.liseuse ? "[data-line-content]" : "article p", { hasText: cas.debut }).first();
    await expect(ligne).toBeVisible();
    const boite = await ligne.boundingBox();
    expect(boite, "la ligne a une position à l'écran").not.toBeNull();
    // iPhone 13 : 664 px utiles ; la ligne doit commencer à moins de 600 px du haut.
    expect(boite!.y, `« ${cas.debut} » à ${Math.round(boite!.y)} px du haut`).toBeLessThan(600);
  });
}

// Un lien vers un passage l'emporte sur la reprise de lecture enregistrée dans le navigateur ;
// l'adresse nue, elle, reprend la lecture (page statique sans compte, S47, cas limite testé le 16/11/2026).
test("un lien vers un passage l'emporte sur ma reprise de lecture", async ({ page }) => {
  const reprise = () => localStorage.setItem("classiques.reading-progress.v1",
    JSON.stringify({ "les-miserables": { lineIdx: 7997, updatedAt: Date.now() } }));
  await page.goto("/a-propos");
  await page.evaluate(reprise);
  await ouvrirLiseuse(page, "/livres/hugo/les-miserables?line=19997");
  const loin = page.getByText("Depuis deux ans, nous l’avons dit, Paris avait vu plus d’une insurrection").first();
  await expect(loin).toBeInViewport({ timeout: 30_000 });
  await page.waitForTimeout(2000);
  await expect(loin).toBeInViewport();
  await page.evaluate(reprise);
  await ouvrirLiseuse(page, "/livres/hugo/les-miserables");
  await expect(page.getByText("Pour comprendre ce qui va suivre, il faut se figurer").first()).toBeInViewport({ timeout: 30_000 });
});

// Lien vers une ligne d'une version « 20 min » : sur iPhone, la mesure de largeur de la liseuse
// levait « ResizeObserver loop completed with undelivered notifications » (16/11/2026, corrigé
// par 8129614). Le contrôle des exceptions est fait par la fixture `erreursJs` (outils.ts).
test("un lien vers une ligne de la version 20 min s'ouvre sans erreur", async ({ page }) => {
  // Ouverture directe : passer d'abord par /20min annulerait sa requête de commentaires, que
  // WebKit sous Playwright remonte comme une exception (« due to access control checks »).
  await ouvrirLiseuse(page, "/livres/hugo/les-miserables/20min?line=40");
  await page.waitForTimeout(2500);
});

// Lien vers une phrase venu de Google, loin dans un gros livre : Safari cache la directive
// `#:~:text=` à la page ; la liseuse télécharge tout le livre et pose une copie cachée où
// Safari trouve la phrase (lib/safariTextFragment.ts, 17/11/2026). Sur ordinateur, Chrome
// passe par readTextFragment.
test("un lien Google vers une phrase loin dans un gros livre m'y amène", async ({ page }) => {
  const phrase = "Depuis deux ans, nous l’avons dit, Paris avait vu plus d’une insurrection";
  await page.goto(`/livres/hugo/les-miserables#:~:text=${encodeURIComponent(phrase).replace(/-/g, "%2D")}`,
    { referer: "https://www.google.com/" });
  await expect(page.getByText(phrase).first()).toBeInViewport({ timeout: 30_000 });
  await page.waitForTimeout(2000);
  await expect(page.getByText(phrase).first()).toBeInViewport();
  await expect(page.locator("[data-text-fragment-mirror]")).toHaveCount(0);
});

// 19/11/2026 (qa_issues `note-mobile-appel-inerte`) : sur iPhone, la marge des notes est masquée et
// toucher l'appel de note ne faisait rien. Il ouvre maintenant les notes sous le paragraphe.
test("sur iPhone, je touche un appel de note et la note s'affiche", async ({ page }, info) => {
  test.skip(!estIphone(info.project.name), "propre au petit écran");
  await ouvrirLiseuse(page, "/livres/flaubert/memoires-d-un-fou");
  // La note de la dédicace est rangée sous le paragraphe suivant (« ces pages sont dédiées… »).
  const ligne = page.locator('[id^="line-"]', { hasText: "À toi mon cher Alfred" }).first();
  const note = page.locator("details").getByText("Alfred Le Poittevin");
  await expect(note).toBeHidden();
  await ligne.locator("sup", { hasText: /^1$/ }).tap();
  await expect(note).toBeVisible();
});

// Encart « reprise de lecture » (lib/readingInserts.ts, 19/11/2026) : après ~2 min de lecture,
// un visiteur sans compte apprend que la liseuse retient sa ligne, et que le compte la garde
// pour de bon. `?encart=reprise` le pose tout de suite, sous l'écran ; le bouton mène à la
// connexion, qui me ramènera à la ligne lue.
test("l'encart de reprise de lecture me propose de créer un compte", async ({ page }) => {
  await ouvrirLiseuse(page, "/livres/flaubert/madame-bovary?encart=reprise");
  const encart = page.getByRole("complementary", { name: "Reprise de lecture" });
  await encart.scrollIntoViewIfNeeded({ timeout: 30_000 });
  await expect(encart.getByText("retient la ligne où vous vous arrêtez")).toBeInViewport();
  await encart.getByRole("link", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/signin\?from=reprise&callbackUrl=%2Flivres%2Fflaubert%2Fmadame-bovary%3Fline%3D\d+/);
  await expect(page.getByText("la ligne où vous vous êtes arrêté")).toBeVisible();
});

// Pages Classiques.app des PDF et EPUB (src/make_ebooks.py, 25/11/2026) : le lien « Répondre aux trois
// questions » ouvre la liseuse au passage où j'en étais dans le fichier, le questionnaire à l'écran.
test("le lien d'un PDF m'amène au questionnaire, là où j'en étais", async ({ page }) => {
  await ouvrirLiseuse(page, "/livres/racine/phedre?line=1261&encart=questionnaire&utm_source=pdf&utm_medium=ebook&utm_content=pub-questionnaire");
  const encart = page.locator("[data-insert=questionnaire]");
  await expect(encart.getByRole("button", { name: "Enseignant", exact: true })).toBeInViewport({ timeout: 30_000 });
  await expect(page.getByText("Régner, et de l'État embrasser la conduite").or(page.getByText("Régner, et de l’État embrasser la conduite"))).toBeVisible();
});

// Programmes d'examen (lib/promotedCorpora.ts, 25/11/2026) : sur un livre d'un programme, et seulement
// là, l'encart montre les autres œuvres et mène à la page du programme : dans la liseuse
// (lib/readingInserts.ts), sur la fiche résumé et sous chaque section ; une ligne « Au programme » est
// en haut de toutes ses pages. Les programmes vivent en base avec leurs dates : le test prend le premier
// en cours, et se passe s'il n'y en a pas.
type Programme = { slug: string; titre: string; nomCourt: string; books: { id: string; titre: string; href: string }[] };
const AUTRES = /(Les autres œuvres sont|Une autre œuvre est) aussi ici/;
async function premierProgramme(request: APIRequestContext): Promise<Programme> {
  const { corpora } = await (await request.get("/api/promoted-corpora")).json() as { corpora: Programme[] };
  test.skip(corpora.length === 0, "aucun programme en cours");
  return corpora[0];
}

test("sur un livre au programme, l'encart me montre les autres œuvres et la page du programme", async ({ page, request }) => {
  const programme = await premierProgramme(request);
  await ouvrirLiseuse(page, `${programme.books[0].href}?encart=corpus`);
  const encart = page.locator("[data-insert=corpus]");
  await encart.scrollIntoViewIfNeeded({ timeout: 30_000 });
  await expect(encart.getByText(AUTRES)).toBeInViewport();
  const onglet = encart.getByRole("tab", { name: programme.nomCourt, exact: true });
  if (await encart.getByRole("tab").count()) await onglet.click();
  await expect(encart.getByRole("link", { name: "Découvrez les fonctionnalités de Classiques.app" })).toBeVisible();
  await encart.getByRole("link", { name: "Voir tout le programme" }).click();
  await expect(page).toHaveURL(new RegExp(`/programmes/${programme.slug}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(programme.titre);
  await expect(page.getByRole("link", { name: programme.books[1].titre, exact: true }).first()).toBeVisible();
});

test("la fiche résumé et une section d'un livre au programme mènent au programme", async ({ page, request }) => {
  const programme = await premierProgramme(request);
  const livre = programme.books[0].href;
  await page.goto(livre);
  const ligne = page.getByRole("navigation", { name: "Au programme" });
  await expect(ligne.getByRole("link", { name: programme.nomCourt, exact: true })).toHaveAttribute("href", `/programmes/${programme.slug}`);
  // La première page de section du livre, par son sommaire (liens présents dans le HTML).
  const section = await page.locator("#sommaire a").first().getAttribute("href");
  for (const chemin of [`${livre}/resume`, section!]) {
    await page.goto(chemin);
    await expect(ligne.getByRole("link", { name: programme.nomCourt, exact: true })).toBeVisible();
    const encart = page.locator("[data-insert=corpus]");
    await encart.scrollIntoViewIfNeeded();
    await expect(encart.getByText(AUTRES)).toBeVisible();
    // ✕ ferme l'encart.
    await encart.getByRole("button", { name: "Fermer" }).click();
    await expect(page.locator("[data-insert=corpus]")).toHaveCount(0);
  }
});

test("sur un livre hors programme, ni encart ni ligne « Au programme »", async ({ page }) => {
  const reponse = page.waitForResponse((r) => r.url().includes("/api/promoted-corpora"));
  await ouvrirLiseuse(page, "/livres/flaubert/salammbo?encart=corpus");
  await reponse;
  await expect(page.locator("[data-insert=corpus]")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Au programme" })).toHaveCount(0);
  await page.goto("/livres/flaubert/salammbo/resume");
  await expect(page.getByRole("navigation", { name: "Voir aussi" })).toBeVisible();
  await expect(page.locator("[data-insert=corpus]")).toHaveCount(0);
});

// « Créer un compte » en haut à droite, à droite du menu (19/11/2026) : sur ordinateur seulement,
// pour un visiteur sans compte ; sur téléphone, la barre reste sans lui.
test("en haut à droite, « Créer un compte » me mène à l'inscription (ordinateur)", async ({ page }, info) => {
  await ouvrirLiseuse(page, "/livres/flaubert/madame-bovary");
  const cta = page.getByRole("link", { name: "Créer un compte" });
  if (estIphone(info.project.name)) {
    await expect(cta).toBeHidden();
    return;
  }
  await cta.click();
  await expect(page).toHaveURL(/\/signin\?from=barre&callbackUrl=%2Flivres%2Fflaubert%2Fmadame-bovary/);
});

// Encart « listes de citations » (19/11/2026) : il apprend le geste « sélectionner puis Sauver »,
// rejoué sur une phrase du livre.
test("l'encart des listes de citations m'apprend à sauver un passage", async ({ page }) => {
  await ouvrirLiseuse(page, "/livres/flaubert/madame-bovary?encart=favoris");
  const encart = page.getByRole("complementary", { name: "Listes de citations" });
  await encart.scrollIntoViewIfNeeded({ timeout: 30_000 });
  await expect(encart.getByText("il rejoint vos listes de citations")).toBeInViewport();
});

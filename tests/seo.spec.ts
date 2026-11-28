import { test, expect, estIphone } from "./outils";

const PAGES = ["/", "/lire-en-20-minutes", "/resumes", "/programmes/bac-general-francais-2027", "/bibliographie/balzac", "/livres/flaubert/madame-bovary",
  "/livres/flaubert/madame-bovary/resume", "/livres/flaubert/madame-bovary/20min", "/livres/moliere/dom-juan/acte-iv-scene-i"];

test.beforeEach(({}, info) => { test.skip(estIphone(info.project.name), "les balises ne dépendent pas de l'appareil"); });

for (const chemin of PAGES) {
  test(`balises de ${chemin}`, async ({ page }) => {
    const r = await page.goto(chemin);
    expect(r?.status()).toBe(200);
    expect((await page.title()).length).toBeGreaterThan(10);
    const description = await page.locator('meta[name="description"]').getAttribute("content");
    expect(description?.length ?? 0).toBeGreaterThan(50);
    expect(description).not.toMatch(/«\s*«/);
    const canonique = await page.locator('link[rel="canonical"]').getAttribute("href");
    // Hors de la prod (site construit pour vérification), l'adresse canonique reste relative.
    const adresse = new URL(canonique!, "https://classiques.app");
    expect(adresse.host).toBe("classiques.app");
    expect(adresse.pathname).toBe(chemin);
    expect(await page.locator('meta[name="robots"][content*="noindex"]').count()).toBe(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    for (const bloc of await page.locator('script[type="application/ld+json"]').allTextContents()) JSON.parse(bloc);
  });
}

// 25/11/2026 (S12) : les pages des programmes d'examen sont dans le plan du site, et les programmes
// étrangers ne se montrent que dans leur pays. Une réponse gardée par le CDN pour un lecteur suisse ne
// doit pas être servie aux autres (`Vary: X-Vercel-IP-Country`) ; les tests tournent hors de ces pays.
test("les programmes d'examen sont dans le plan du site, et chacun dans son pays", async ({ request }) => {
  const { corpora } = await (await request.get("/api/promoted-corpora")).json() as { corpora: { slug: string }[] };
  test.skip(corpora.length === 0, "aucun programme en cours");
  const etrangers = ["examen-suisse-de-maturite", "maturite-professionnelle-suisse", "terminale-senegal", "a-level-french-aqa", "capes-mayotte-2027"];
  expect(corpora.map((c) => c.slug).filter((s) => etrangers.includes(s)), "programmes étrangers montrés ici").toEqual([]);
  const plan = await (await request.get("/sitemaps/programmes.xml")).text();
  for (const slug of [...corpora.map((c) => c.slug), ...etrangers]) expect(plan).toContain(`/programmes/${slug}<`);
  expect(await (await request.get("/sitemap.xml")).text()).toContain("/sitemaps/programmes.xml");
});

// 14/11/2026 (qa_issues `description-double-guillemet`, `armance-epigraphes`) : la description d'une
// section cite le début du texte de l'auteur, sans doubler un guillemet qui ouvre déjà le texte
// (« « Le Réveillon ! ») et sans s'ouvrir sur l'épigraphe du chapitre.
test("la description d'une section cite le texte de l'auteur, sans double guillemet ni épigraphe", async ({ page }) => {
  const description = async (chemin: string) => {
    expect((await page.goto(chemin))?.status()).toBe(200);
    return (await page.locator('meta[name="description"]').getAttribute("content")) ?? "";
  };
  const noel = await description("/livres/maupassant/mademoiselle-fifi/nuit-de-noel");
  expect(noel).toContain("« Le Réveillon !");
  expect(noel).not.toMatch(/«\s*«/);
  const armance = await description("/livres/stendhal/armance/chapitre-xiv");
  expect(armance).toContain("Un jour Octave");
  expect(armance).not.toContain("giovin");
});

// 16/11/2026 (qa_issues `titres-numeros-anciens-xxiiii`) : un sonnet numéroté à l'ancienne
// (« XXIIII », « IIII ») ou suivi d'un point (« VIII. ») se nomme par son premier vers, même tout en
// italique (Louise Labé), sans changer d'adresse. Et la description d'une fable rangée dans un livre
// du recueil ne lui donne pas l'année du recueil (« livre dixième, 1668 » : paru en 1678-1679).
test("[seo-titres-anciens] un sonnet « XXIIII » s'appelle par son premier vers, à la même adresse", async ({ page }) => {
  const ouvrir = async (chemin: string) => {
    expect((await page.goto(chemin))?.status()).toBe(200);
    expect(new URL(page.url()).pathname, "pas de redirection").toBe(chemin);
    return page.getByRole("heading", { level: 1 });
  };
  await expect(await ouvrir("/livres/ronsard/les-amours-ronsard/le-second-livre-des-sonets-pour-helene-xxiiii"))
    .toContainText("Quand vous serez bien vieille");
  expect(await page.title()).toContain("Quand vous serez bien vieille");
  await expect(await ouvrir("/livres/louise-labe/oeuvres-louise-labe/xxiiii")).toContainText("Ne reprenez, Dames");
  await expect(await ouvrir("/livres/louise-labe/oeuvres-louise-labe/iiii")).toContainText("Depuis qu’Amour cruel");
  await expect(await ouvrir("/livres/louise-labe/oeuvres-louise-labe/sonnets-viii")).toContainText("Ie vis, ie meurs");
  await ouvrir("/livres/la-fontaine/fables-de-la-fontaine/les-deux-rats-le-renard-et-l-oeuf");
  const fable = (await page.locator('meta[name="description"]').getAttribute("content")) ?? "";
  // Le livre lui-même a changé le 18/11 (registre fables-livre-ix-x-decoupage : livre neuvième,
  // et non dixième) : le test vérifie qu'un livre est nommé, pas lequel.
  expect(fable).toMatch(/Fables, livre \p{L}+ième/u);
  expect(fable).not.toContain("1668");
});

test("les sitemaps répondent et listent des pages", async ({ request }) => {
  const index = await (await request.get("/sitemap.xml")).text();
  const fichiers = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1], "https://classiques.app").pathname);
  expect(fichiers.length).toBeGreaterThan(4);
  for (const f of fichiers) expect((await request.get(f)).status(), f).toBe(200);
});

// Friction 25fbae89 puis décision de Nick du 19/11/2026 (`perrault-contes-sans-page`) : chaque conte
// de Perrault a sa page, moralités comprises, dans le sitemap et dans les liens du livre ; les
// anciennes pages « moralité » n'y sont plus (leur adresse redirige vers le conte).
test("un conte de Perrault est dans le sitemap et les liens du livre, sa moralité n'a plus de page à part", async ({ request }) => {
  const livre = "/livres/perrault/histoires-ou-contes-du-temps-passe";
  const sitemap = await (await request.get("/sitemaps/sections.xml")).text();
  expect(sitemap).toContain(`${livre}/le-petit-chaperon-rouge</loc>`);
  expect(sitemap).not.toContain(`${livre}/le-petit-chaperon-rouge-moralite</loc>`);
  const html = await (await request.get(livre)).text();
  expect(html).toContain(`href="${livre}/le-petit-chaperon-rouge"`);
  expect(html).not.toContain(`href="${livre}/le-petit-chaperon-rouge-moralite"`);
  const ancienne = await request.get(`${livre}/le-petit-chaperon-rouge-moralite`, { maxRedirects: 0 });
  expect(ancienne.status()).toBe(308);
  expect(ancienne.headers()["location"]).toContain(`${livre}/le-petit-chaperon-rouge`);
});

// Décision de Nick du 20/11/2026 (frictions 1168617c, edeb36dc) : une adresse fautive change, l'ancienne
// redirige en 308 vers la nouvelle, et seule la nouvelle est dans le sitemap. « PREMIERE PARTIE » donnait
// `e-partie` (ordinal pris pour un numéro), « PREMIÈRE PROMENADE » `promenade` ; deux titres des Misérables
// avaient perdu leur seconde moitié (« Le drapeau. – Deuxième acte. »), recollée dans le texte.
test("une adresse de section corrigée redirige depuis l'ancienne, et seule la nouvelle est au sitemap", async ({ request }) => {
  const cas = [
    ["/livres/la-fayette/la-princesse-de-cleves", "e-partie", "premiere-partie"],
    ["/livres/la-fayette/la-princesse-de-cleves", "partie", "seconde-partie"],
    ["/livres/rousseau/les-reveries-du-promeneur-solitaire", "promenade-2", "seconde-promenade"],
    ["/livres/hugo/les-miserables", "le-drapeau", "le-drapeau-deuxieme-acte"],
    ["/livres/hugo/les-miserables", "quelques-eclaircissements-sur-les-origines-de-la-poesie-de-gavroche",
      "quelques-eclaircissements-sur-les-origines-de-la-poesie-de-gavroche-influence-d"],
    // 25/11/2026 (friction 6bb7740b) : « DIX-SEPTIÈME » était lu 509 (romain DIX) et « SEPTIÈME ».
    ["/livres/barbusse/le-feu", "septieme-la-sape", "dix-septieme-la-sape"],
    ["/livres/graffigny/lettres-d-une-peruvienne", "premiere-partie-septieme-2", "dix-septieme"],
    ["/livres/graffigny/lettres-d-une-peruvienne", "premiere-partie-septieme", "septieme"],
  ];
  const sitemap = await (await request.get("/sitemaps/sections.xml")).text();
  for (const [livre, ancien, nouveau] of cas) {
    const r = await request.get(`${livre}/${ancien}`, { maxRedirects: 0 });
    expect(r.status(), ancien).toBe(308);
    // Playwright joint les en-têtes répétés par « , » : chaque valeur doit viser la nouvelle adresse.
    for (const lieu of r.headers()["location"].split(/,\s*/)) {
      expect(decodeURIComponent(new URL(lieu, "https://classiques.app").pathname), ancien).toBe(`${livre}/${nouveau}`);
    }
    expect((await request.get(`${livre}/${nouveau}`, { maxRedirects: 0 })).status(), nouveau).toBe(200);
    expect(sitemap, nouveau).toContain(`${livre}/${nouveau}</loc>`);
    expect(sitemap, ancien).not.toContain(`${livre}/${ancien}</loc>`);
  }
  // « Le drapeau – Premier acte. » (sans point avant le tiret) garde son adresse.
  expect((await request.get("/livres/hugo/les-miserables/le-drapeau-premier-acte", { maxRedirects: 0 })).status()).toBe(200);
  const drapeau = await (await request.get("/livres/hugo/les-miserables/le-drapeau-deuxieme-acte")).text();
  expect(drapeau).toContain("Le drapeau. – Deuxième acte.");
});

test("robots.txt autorise l'exploration et donne le sitemap", async ({ request }) => {
  const texte = await (await request.get("/robots.txt")).text();
  expect(texte).toContain("Sitemap:");
  // Certains robots commerciaux sont bloqués exprès ; Google, Bing et les autres ne doivent pas l'être.
  const general = texte.split(/\n\s*\n/).find((g) => /User-Agent:\s*\*/i.test(g)) ?? "";
  expect(general).not.toMatch(/Disallow:\s*\/\s*$/m);
  for (const robot of ["Googlebot", "Bingbot"]) expect(texte).not.toMatch(new RegExp(`User-Agent:\\s*${robot}\\s*\\nDisallow:\\s*/\\s*$`, "im"));
});

// 25/11/2026 (Vercel caps, S55) : la page de chapitre allégée des robots liait le livre avec `?line=N`, une
// adresse par chapitre ; un robot relisait le livre entier autant de fois. Les visiteurs gardent `?line=`.
test("la page de chapitre servie aux robots a un seul lien vers le livre, sans `?line=`", async ({ request }) => {
  const chemin = "/livres/hugo/les-miserables/le-drapeau-deuxieme-acte";
  const html = await (await request.get(chemin, { headers: { "user-agent": "classiques-qa bot/1.0" } })).text();
  expect(html).toContain("Livre complet →");
  expect(html).not.toContain("_next/static");
  expect(html).not.toContain("?line=");
  expect(html).toContain('href="/livres/hugo/les-miserables"');
});

// 19/11/2026 (qa_issues `titre-section-exposant-perdu`) : « 1<sup>re</sup> LETTRE » s'affichait
// « 1 LETTRE » : l'exposant était retiré avec son texte. L'adresse, elle, ne change pas.
test("le titre d'une lettre garde son exposant (« 1re LETTRE »), à la même adresse", async ({ page }) => {
  const chemin = "/livres/nerval/les-filles-du-feu/a-m-l-d";
  expect((await page.goto(chemin))?.status()).toBe(200);
  expect(new URL(page.url()).pathname, "pas de redirection").toBe(chemin);
  await expect(page.locator("body")).toContainText("1re LETTRE");
  await expect(page.locator("body")).not.toContainText("1 LETTRE");
});

// 26/11/2026 (qa_issues `titre-section-nom-propre-minuscule`) : un titre imprimé en capitales passait
// tout en minuscules dans l'onglet et dans Google : « À cassandre », « Quatrieme partie ». La forme vient
// de la table `titres_casse`, écrite par un agent qui lit le livre (enrichments.md § titres-casse).
test("un titre en capitales garde ses noms propres et ses accents dans l'onglet", async ({ request }) => {
  const titre = async (chemin: string) => {
    const html = await (await request.get(chemin)).text();
    return html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
  };
  expect(await titre("/livres/ronsard/les-amours-ronsard/a-cassandre")).toMatch(/^À Cassandre — /);
  expect(await titre("/livres/la-fayette/la-princesse-de-cleves/quatrieme-partie")).toMatch(/^Quatrième partie — /);
});

import { test, expect, estIphone } from "./outils";

const PAGES = ["/", "/lire-en-20-minutes", "/bibliographie/balzac", "/livres/flaubert/madame-bovary",
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

test("les sitemaps répondent et listent des pages", async ({ request }) => {
  const index = await (await request.get("/sitemap.xml")).text();
  const fichiers = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1], "https://classiques.app").pathname);
  expect(fichiers.length).toBeGreaterThan(4);
  for (const f of fichiers) expect((await request.get(f)).status(), f).toBe(200);
});

test("robots.txt autorise l'exploration et donne le sitemap", async ({ request }) => {
  const texte = await (await request.get("/robots.txt")).text();
  expect(texte).toContain("Sitemap:");
  // Certains robots commerciaux sont bloqués exprès ; Google, Bing et les autres ne doivent pas l'être.
  const general = texte.split(/\n\s*\n/).find((g) => /User-Agent:\s*\*/i.test(g)) ?? "";
  expect(general).not.toMatch(/Disallow:\s*\/\s*$/m);
  for (const robot of ["Googlebot", "Bingbot"]) expect(texte).not.toMatch(new RegExp(`User-Agent:\\s*${robot}\\s*\\nDisallow:\\s*/\\s*$`, "im"));
});

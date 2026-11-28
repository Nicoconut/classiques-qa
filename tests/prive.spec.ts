import { test, expect, estIphone } from "./outils";

// La liste des livres privés vient d'un secret et n'apparaît jamais dans les journaux : ce dépôt est public.
const prives: string[] = JSON.parse(process.env.QA_LIVRES_PRIVES || "[]");

test.beforeEach(({}, info) => { test.skip(estIphone(info.project.name), "ne dépend pas de l'appareil"); });

test("aucun livre privé n'est lisible sans compte", async ({ request }) => {
  test.skip(prives.length === 0, "liste absente");
  let ouverts = 0;
  for (const chemin of prives) if ((await request.get(chemin, { maxRedirects: 0 })).status() === 200) ouverts++;
  expect(ouverts, "livres privés accessibles").toBe(0);
});

test("aucun livre privé n'est dans les sitemaps", async ({ request }) => {
  test.skip(prives.length === 0, "liste absente");
  const texte = await (await request.get("/sitemaps/livres.xml")).text();
  expect(prives.filter((c) => texte.includes(c)).length, "livres privés dans le sitemap").toBe(0);
});

test("l'espace privé et le connecteur demandent un compte", async ({ request }) => {
  expect((await request.get("/prive", { maxRedirects: 0 })).status()).not.toBe(200);
  expect((await request.post("/api/mcp", { data: { jsonrpc: "2.0", id: 1, method: "tools/list" } })).status()).toBe(401);
});

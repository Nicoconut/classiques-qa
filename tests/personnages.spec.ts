import { test, expect, ouvrirLiseuse } from "./outils";

// Pages des personnages (S18, 14/11/2026). Avant leur première mise en ligne (nuit du 14 au 15/11), la
// production répond 404 : le test se met de côté jusqu'au 17/11, puis un 404 le fait échouer.
async function pagePrete(page: import("@playwright/test").Page, chemin: string) {
  const r = await page.goto(chemin);
  test.skip(r?.status() === 404 && Date.now() < Date.parse("2026-11-17T00:00:00Z"), "pages personnages pas encore en ligne");
}

test("depuis la page des personnages d'une œuvre, j'ouvre un portrait", async ({ page }) => {
  await pagePrete(page, "/livres/rostand/cyrano-de-bergerac/personnages");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Les personnages de Cyrano de Bergerac");
  await page.getByRole("link", { name: /^Lire (l’analyse|son portrait)$/ } /* « Lire son portrait » jusqu'à la mise en ligne du 21/11 */).first().click();
  await expect(page).toHaveURL(/\/personnages\/cyrano-de-bergerac$/);
  await expect(page.getByRole("heading", { level: 1, name: "Cyrano de Bergerac" })).toBeVisible();
});

// 26/11/2026 (demande de Nick) : sur un portrait, le nom d'un autre personnage qui a le sien mène à sa page.
// Avant la mise en ligne de ce lien, la page n'en a pas : le test se met de côté jusqu'au 30/11.
test("sur un portrait, je clique le nom d'un autre personnage et j'arrive sur son portrait", async ({ page }) => {
  await pagePrete(page, "/livres/voltaire/candide/personnages/pangloss");
  const nom = page.locator("article a[data-perso]").filter({ hasText: /^Candide$/ }).first();
  test.skip((await nom.count()) === 0 && Date.now() < Date.parse("2026-11-30T00:00:00Z"), "liens entre portraits pas encore en ligne");
  await nom.click();
  await expect(page).toHaveURL(/\/personnages\/candide$/);
  await expect(page.getByRole("heading", { level: 1, name: "Candide" })).toBeVisible();
});

// 27/11/2026 (demande de Nick) : une citation annoncée par un deux-points est sur sa ligne, sans guillemets, et un
// seul clic (ou toucher) ouvre le livre sur elle. Avant la mise en ligne, la page n'en a pas : de côté jusqu'au 30/11.
test("je clique une citation sur sa ligne et le livre s'ouvre sur elle, du premier coup", async ({ page }) => {
  await pagePrete(page, "/livres/hugo/les-miserables/personnages/eponine");
  const citation = page.locator("article a[data-citation]").first();
  test.skip((await citation.count()) === 0 && Date.now() < Date.parse("2026-11-30T00:00:00Z"), "citations sur leur ligne pas encore en ligne");
  await expect(citation).not.toContainText("«");
  await citation.click();
  await expect(page).toHaveURL(/les-miserables\?.*preuve=/);
});

test("je clique une phrase d'un portrait : le livre s'ouvre sur sa preuve, et je reviens au portrait", async ({ page }) => {
  await pagePrete(page, "/livres/flaubert/madame-bovary/personnages/emma-bovary");
  // Téléphone : le premier toucher montre le passage, « Lire dans le livre » ouvre le livre (Nick, 25/11/2026). Sur grand
  // écran, ou avant la mise en ligne de ce geste, la phrase ouvre le livre tout de suite.
  await page.locator('a[href*="portrait=emma-bovary"]').first().click();
  const passage = page.getByRole("complementary", { name: "Le passage du livre" }).getByRole("link", { name: /Lire dans le livre/ }).first();
  await Promise.race([
    page.waitForURL(/madame-bovary\?.*preuve=/, { timeout: 15000 }),
    passage.waitFor({ state: "visible", timeout: 15000 }),
  ]);
  if (!/preuve=/.test(page.url())) await passage.click();
  await expect(page).toHaveURL(/madame-bovary\?.*preuve=/);
  const retour = page.getByRole("link", { name: /Retour au portrait/ });
  await expect(retour).toBeVisible();
  await retour.click();
  await expect(page).toHaveURL(/\/personnages\/emma-bovary/);
});

test("dans la liseuse, je touche le nom d'un personnage et je vois ce que je sais de lui", async ({ page }) => {
  await pagePrete(page, "/livres/flaubert/madame-bovary/personnages/emma-bovary");
  await ouvrirLiseuse(page, "/livres/flaubert/madame-bovary?line=4307");
  // Le nom est souligné par la CSS Custom Highlight API (aucun élément à viser) : on clique au milieu de
  // la première occurrence visible.
  const point = await page.waitForFunction(() => {
    const h = (CSS as unknown as { highlights?: Map<string, Iterable<Range>> }).highlights?.get("perso");
    if (!h) return null;
    for (const r of h) {
      const b = r.getBoundingClientRect();
      if (b.width > 0 && b.top > 56 && b.bottom < window.innerHeight - 40) return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    }
    return null;
  }, undefined, { timeout: 15_000 });
  const { x, y } = (await point.jsonValue()) as { x: number; y: number };
  await page.mouse.click(x, y);
  const carte = page.getByRole("dialog", { name: "Emma Bovary" });
  // Carte revue par Nick le 14/11 : le lien vers le portrait en haut, plus d'intitulé.
  await expect(carte.getByRole("link", { name: "Portrait complet" })).toBeVisible();
  await expect(carte.getByText(/mention \d+ sur \d+/)).toBeVisible();
});

// 25/11/2026 (qa_issues `safari-gel-noms-personnages`) : les noms soulignés de tout le livre figeaient
// Safari 22 s à l'ouverture de Dom Juan sur une ligne (7 s d'un bloc). Seules les lignes à l'écran sont
// soulignées : la page ne fige plus, et les noms qui arrivent à l'écran en défilant sont bien soulignés.
test("[liseuse-gel-noms] la liseuse ne fige pas, et les noms sont soulignés là où je lis", async ({ page }) => {
  await ouvrirLiseuse(page, "/livres/moliere/dom-juan?line=900");
  // Une page figée ne répond pas : on mesure d'ici le temps qu'elle met à répondre, pendant 5 s.
  let gel = 0;
  for (let i = 0; i < 8; i++) {
    const t = Date.now();
    await page.evaluate(() => document.title);
    gel = Math.max(gel, Date.now() - t);
    await page.waitForTimeout(600);
  }
  expect(gel, "plus longue attente d'une réponse de la page (ms)").toBeLessThan(4000);
  const soulignesAlEcran = () => page.evaluate(() => {
    const h = (CSS as unknown as { highlights?: Map<string, Iterable<Range>> }).highlights?.get("perso");
    return Array.from(h ?? []).filter((r) => { const b = r.getBoundingClientRect(); return b.width > 0 && b.top > 56 && b.bottom < window.innerHeight; }).length;
  });
  await expect.poll(soulignesAlEcran, { timeout: 30_000 }).toBeGreaterThan(0);
  // Plus bas : la première rangée au-delà de la ligne 930.
  await page.locator('[id^="line-"]').evaluateAll((els) => els.find((e) => parseInt(e.id.slice(5), 10) > 930)?.scrollIntoView({ block: "start" }));
  await expect.poll(soulignesAlEcran).toBeGreaterThan(0);
});

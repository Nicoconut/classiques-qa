import { test, expect, estIphone } from "./outils";

test("je reçois une citation partagée et je rejoins le livre", async ({ page }) => {
  await page.goto("/livres/beaumarchais/le-mariage-de-figaro/citations/en-ecrivant-cette-preface-mon-but-n-est-pas-de-rechercher-9NQTanMK");
  await expect(page.getByText("En écrivant cette préface, mon but").first()).toBeVisible();
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /^https?:/);
  // « Lire dans le livre » est un lien interne : la liseuse doit lire `?line=`/`?cite=` après une
  // navigation de Next, pas seulement au chargement complet. Elle défile jusqu'à la phrase et la
  // surligne (qa_issues `citation-lire-dans-le-livre-sans-defilement`, 17/11/2026 : restée en haut,
  // phrase hors écran sur iPhone). `toBeInViewport`, pas `toBeVisible`, qui passe hors écran.
  await page.getByRole("link", { name: /Lire dans le livre/ }).click();
  await expect(page).toHaveURL(/\/livres\/beaumarchais\/le-mariage-de-figaro\?line=\d+&cite=/);
  const phrase = page.locator("[data-line-content]").filter({ hasText: "En écrivant cette préface, mon but" }).first();
  await expect(phrase).toBeInViewport();
  // Surlignage par la CSS Custom Highlight API (navigateur qui ne l'a pas : rien à vérifier).
  await expect.poll(() => page.evaluate(() => {
    const reg = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
    return reg ? reg.has("cite") : true;
  }), { message: "la phrase citée est surlignée" }).toBe(true);
});

test("sans compte, je copie une citation sélectionnée", async ({ page }, info) => {
  test.skip(estIphone(info.project.name), "la sélection à la souris est propre à l'ordinateur");
  await page.addInitScript(() => {
    (window as unknown as { copie: string | null }).copie = null;
    const garder = (t: string) => { (window as unknown as { copie: string }).copie = t; };
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async (t: string) => garder(t),
      write: async (items: ClipboardItem[]) => garder(await (await items[0].getType("text/plain")).text()),
    } });
  });
  await page.goto("/livres/beaumarchais/le-mariage-de-figaro");
  await page.locator('button[aria-label="Paramètres de lecture"]:visible').waitFor();
  const ligne = page.locator('[id^="line-"]').filter({ hasText: /[a-zà-ÿ]{4}/ }).nth(3);
  const boite = (await ligne.boundingBox())!;
  await page.mouse.move(boite.x + 5, boite.y + 12);
  await page.mouse.down();
  await page.mouse.move(boite.x + 300, boite.y + 12, { steps: 8 });
  await page.mouse.up();
  await page.locator('button[aria-label="Partager la citation"]').first().click();
  await expect(page.getByText("Copié dans le presse-papier")).toBeVisible();
  const copie = await page.evaluate(() => (window as unknown as { copie: string }).copie);
  expect(copie).toContain("Le Mariage de Figaro");
});

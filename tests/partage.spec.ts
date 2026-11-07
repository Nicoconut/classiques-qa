import { test, expect, estIphone } from "./outils";

test("je reçois une citation partagée et je rejoins le livre", async ({ page }) => {
  await page.goto("/livres/beaumarchais/le-mariage-de-figaro/citations/en-ecrivant-cette-preface-mon-but-n-est-pas-de-rechercher-9NQTanMK");
  await expect(page.getByText("En écrivant cette préface, mon but").first()).toBeVisible();
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /^https?:/);
  await expect(page.getByRole("link", { name: /Lire dans le livre/ })).toBeVisible();
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

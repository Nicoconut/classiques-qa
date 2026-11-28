import { test, expect, ouvrirLiseuse } from "./outils";

// Mention de droits en fin de texte (27/11/2026, demande de Nick) : le texte est libre, le corpus est
// protégé comme base de données (conditions, article 5). Avant sa première mise en ligne (nuit du 27
// au 28/11), la production ne l'a pas : le test se met de côté jusqu'au 30/11, puis son absence le
// fait échouer.
async function mentionEnLigne(page: import("@playwright/test").Page) {
  const mention = page.locator("[data-rights-notice]");
  test.skip((await mention.count()) === 0 && Date.now() < Date.parse("2026-11-30T00:00:00Z"), "mention de droits pas encore en ligne");
  return mention;
}

test("en bas d'un chapitre, je lis que le texte est libre et le lien mène à l'article sur le corpus", async ({ page }) => {
  await page.goto("/livres/voltaire/candide/ce-qu-ils-virent-dans-le-pays-d-eldorado");
  const mention = await mentionEnLigne(page);
  await expect(mention).toContainText("domaine public");
  await mention.getByRole("link", { name: "conditions d’utilisation" }).click();
  await expect(page).toHaveURL(/\/conditions#corpus$/);
  await expect(page.locator("#corpus")).toContainText("5. Le corpus");
});

test("à la fin d'un livre, dans la liseuse, je trouve la mention de droits", async ({ page }) => {
  // La Cafetière : quelques pages, chargées d'un coup, donc la fin du livre est là dès l'ouverture.
  await ouvrirLiseuse(page, "/livres/gautier/la-cafetiere");
  const mention = await mentionEnLigne(page);
  await mention.scrollIntoViewIfNeeded();
  await expect(mention).toBeVisible();
  await expect(mention).toContainText("protégé comme base de données");
});

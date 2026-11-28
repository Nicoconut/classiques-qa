import { test, expect, estIphone } from "./outils";

// Extrait à imprimer avec lignes numérotées (E1, benchmark-enseignants.md, 27/11/2026) :
// le lecteur choisit un passage, la page le met sur une feuille A4 numérotée, à imprimer,
// à projeter ou à envoyer à la classe. *Le Menteur* : au programme du bac 2027.

test("je prépare un extrait numéroté d'une scène et je l'imprime", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { imprime: number }).imprime = 0;
    window.print = () => { (window as unknown as { imprime: number }).imprime++; };
  });
  await page.goto("/livres/corneille/le-menteur/acte-i-scene-premiere/extrait");
  await expect(page.getByRole("heading", { name: "Extrait à imprimer" })).toBeVisible();
  const feuille = page.locator("#ex-feuille");
  await expect(feuille).toContainText("Pierre Corneille");
  await expect(feuille).toContainText("acte I, scène 1");
  await expect(feuille).toContainText("À la fin j’ai quitté la robe pour l’épée");
  // Les noms des personnages ne comptent pas : 30 vers par défaut, numérotés tous les 5.
  await expect(page.getByText(/^30 vers/)).toBeVisible();
  await expect(feuille.locator(".ex-nums span").first()).toHaveText("5");
  // Un vers de plus à la fin : l'adresse suit, pour que le lien copié donne le même extrait.
  await page.getByRole("button", { name: "plus tard ▸" }).nth(1).click();
  await expect(page.getByText(/^31 vers/)).toBeVisible();
  await expect(page).toHaveURL(/\/extrait\?de=\d+&a=\d+$/);
  await page.getByRole("button", { name: "Imprimer", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { imprime: number }).imprime)).toBe(1);
});

test("je télécharge l'extrait en Word, numéros compris", async ({ page }) => {
  await page.goto("/livres/corneille/le-menteur/acte-i-scene-premiere/extrait");
  await expect(page.getByText(/^30 vers/)).toBeVisible();
  const [telechargement] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Word" }).click()]);
  expect(telechargement.suggestedFilename()).toBe("le-menteur-acte-i-scene-premiere-extrait.docx");
  const chemin = await telechargement.path();
  const octets = (await import("node:fs")).readFileSync(chemin!);
  expect(octets.subarray(0, 2).toString()).toBe("PK"); // archive zip
  const texte = octets.toString("utf8");
  expect(texte).toContain("word/document.xml");
  expect(texte).toContain("À la fin j’ai quitté la robe pour l’épée");
  // Numérotation de lignes de Word tous les 5 ; les noms des personnages n'en ont pas.
  expect(texte).toContain('<w:lnNumType w:countBy="5"');
  expect(texte).toMatch(/<w:suppressLineNumbers\/>[^]*?<w:smallCaps\/>[^]*?Dorante/);
});

test("l'adresse d'un extrait de prose garde ses bornes", async ({ page }) => {
  // Le premier paragraphe de Pot-Bouille, seul : le suivant n'y est pas.
  await page.goto("/livres/zola/pot-bouille/i/extrait?de=2&a=2");
  const feuille = page.locator("#ex-feuille");
  await expect(feuille).toContainText("Rue Neuve-Saint-Augustin");
  await expect(feuille).not.toContainText("Le cocher s’était penché");
  await expect(page.getByText(/^\d+ lignes/)).toBeVisible();
});

test("une page de section mène à l'extrait, numéros montrés sur une œuvre au programme", async ({ page }) => {
  await page.goto("/livres/corneille/le-menteur/acte-i-scene-premiere");
  // Œuvre au programme, lecteur sans réglage : les numéros de ligne sont là d'office.
  await expect(page.locator("html")).toHaveAttribute("data-section-linenum", "");
  await page.getByRole("link", { name: "Imprimer avec lignes numérotées" }).click();
  await expect(page).toHaveURL(/\/acte-i-scene-premiere\/extrait\?/);
  await expect(page.getByRole("heading", { name: "Extrait à imprimer" })).toBeVisible();
});

test("dans la liseuse, une sélection donne un extrait numéroté", async ({ page }, info) => {
  test.skip(estIphone(info.project.name), "la sélection à la souris est propre à l'ordinateur");
  await page.goto("/livres/corneille/le-menteur");
  await page.locator('button[aria-label="Paramètres de lecture"]:visible').waitFor();
  const vers = page.locator('[id^="line-"]').filter({ hasText: "À la fin j’ai quitté la robe pour l’épée" }).first();
  const lien = page.getByRole("link", { name: "Imprimer avec lignes numérotées" });
  // La liseuse peut encore se mettre en place (tranches, défilement) : on refait la sélection
  // jusqu'à ce que la barre apparaisse, comme un lecteur qui recommence son geste.
  await expect(async () => {
    await vers.scrollIntoViewIfNeeded();
    const boite = (await vers.boundingBox())!;
    await page.mouse.move(boite.x + 5, boite.y + 10);
    await page.mouse.down();
    await page.mouse.move(boite.x + 260, boite.y + boite.height * 3, { steps: 10 });
    await page.mouse.up();
    await expect(lien).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
  await expect(lien).toHaveAttribute("href", /\/le-menteur\/acte-i-scene-premiere\/extrait\?de=\d+(:\d+)?&a=\d+(:\d+)?&depuis=selection$/);
});

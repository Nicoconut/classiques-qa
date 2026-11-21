import fs from "node:fs";
import { test, expect, estIphone } from "./outils";

// Poids total transféré au premier chargement, budget dans connus.json : une version
// qui alourdit une page au-delà du budget échoue. Budget = poids du 05/11/2026 + marge.
const budgets: Record<string, number> = JSON.parse(fs.readFileSync(new URL("./connus.json", import.meta.url), "utf8")).poids_ko;
const PAGES: Record<string, string> = {
  accueil: "/", bibliographie: "/bibliographie/balzac", livre: "/livres/flaubert/madame-bovary",
  section: "/livres/moliere/le-malade-imaginaire/acte-i-scene-iii", resume: "/livres/flaubert/madame-bovary/resume",
  "20min": "/livres/flaubert/madame-bovary/20min",
};

for (const [nom, chemin] of Object.entries(PAGES)) {
  test(`poids : ${nom}`, async ({ page }, info) => {
    test.skip(estIphone(info.project.name), "mesuré sur Chrome, qui donne les tailles transférées");
    const client = await page.context().newCDPSession(page);
    await client.send("Network.enable");
    let octets = 0;
    client.on("Network.loadingFinished", (e) => { octets += e.encodedDataLength; });
    await page.goto(chemin);
    await page.waitForLoadState("networkidle").catch(() => {});
    const ko = Math.round(octets / 1024);
    fs.mkdirSync("test-results", { recursive: true });
    fs.appendFileSync("test-results/poids.txt", `${nom} : ${ko} Ko\n`);
    expect(ko, `poids de la page ${nom}, en Ko`).toBeLessThanOrEqual(budgets[nom]);
  });
}

import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import { test, expect } from "./outils";

// Défauts déjà connus (fichier connus.json) : seuls les nouveaux font échouer le test.
// Un défaut corrigé se retire de la liste.
const connus: Record<string, string[]> = JSON.parse(fs.readFileSync(new URL("./connus.json", import.meta.url), "utf8")).accessibilite;

const PAGES: Record<string, string> = {
  accueil: "/", bibliographie: "/bibliographie/balzac", livre: "/livres/flaubert/madame-bovary",
  section: "/livres/moliere/le-malade-imaginaire/acte-i-scene-iii", resume: "/livres/flaubert/madame-bovary/resume",
  "20min": "/livres/flaubert/madame-bovary/20min", poemes: "/bibliographie/rimbaud/poemes",
  citation: "/livres/beaumarchais/le-mariage-de-figaro/citations/en-ecrivant-cette-preface-mon-but-n-est-pas-de-rechercher-9NQTanMK",
};

// Thèmes de lecture testés : le thème par défaut (Sombre nuit, sans cookie) et le
// thème Clair, posé comme le fait le panneau de réglages (cookie `rdg`). Les thèmes
// clairs ont leur propre gris secondaire (registre QA contraste-themes-clairs).
const THEMES: Record<string, string | null> = { "": null, " (Clair)": "light" };

for (const [suffixe, theme] of Object.entries(THEMES)) {
  for (const [nom, chemin] of Object.entries(PAGES)) {
    test(`accessibilité${suffixe} : ${nom}`, async ({ page, baseURL }, info) => {
      if (theme) {
        await page.context().addCookies([{ name: "rdg", value: encodeURIComponent(JSON.stringify({ theme })), url: baseURL! }]);
      }
      await page.goto(chemin);
      await page.waitForLoadState("networkidle").catch(() => {});
      // Le thème est bien appliqué (Clair = pas d'attribut), sinon le test ne prouve rien.
      if (theme) expect(await page.locator("html").getAttribute("data-reading-theme")).toBe(theme === "light" ? null : theme);
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const graves = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      const nouveaux = graves.map((v) => v.id).filter((id) => !(connus[nom] ?? []).includes(id));
      fs.mkdirSync("test-results", { recursive: true });
      fs.appendFileSync("test-results/accessibilite.txt", `${info.project.name} ${nom}${suffixe} : ${graves.map((v) => `${v.id}(${v.nodes.length}) ${v.nodes[0]?.target}`).join(" ") || "rien"}\n`);
      expect(nouveaux, "défauts d'accessibilité nouveaux").toEqual([]);
    });
  }
}

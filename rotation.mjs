#!/usr/bin/env node
// Rotation : chaque jour, une tranche des pages du sitemap, pour parcourir tout le site en
// un mois environ (qa.md). Une requête à la fois, sans navigateur : le coût reste négligeable.
const base = process.env.BASE_URL || "https://classiques.app";
const parJour = Number(process.env.PAGES_PAR_JOUR || 300);
const xml = async (u) => (await fetch(u)).text();
const locs = (t) => [...t.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const toutes = [];
for (const f of locs(await xml(`${base}/sitemap.xml`))) toutes.push(...locs(await xml(f)));
toutes.sort();
const jour = Math.floor(Date.now() / 86_400_000);
const debut = (jour * parJour) % toutes.length;
const tranche = Array.from({ length: Math.min(parJour, toutes.length) }, (_, i) => toutes[(debut + i) % toutes.length]);

const pannes = [];
for (const url of tranche) {
  try {
    const r = await fetch(url, { redirect: "manual", headers: { Cookie: "ph_optout=1", "User-Agent": "classiques-qa rotation" } });
    const texte = r.status === 200 ? await r.text() : "";
    if (r.status !== 200) pannes.push(`${r.status} ${url}`);
    else if (!/<title>[^<]{5,}/.test(texte)) pannes.push(`sans titre ${url}`);
    else if (!/<h1[\s>]/.test(texte)) pannes.push(`sans h1 ${url}`);
  } catch (e) { pannes.push(`réseau ${url}`); }
}
console.log(`${tranche.length} pages vérifiées sur ${toutes.length}, à partir de la ${debut + 1}e : ${pannes.length} en panne`);
for (const p of pannes.slice(0, 30)) console.log(p);
process.exit(pannes.length ? 1 : 0);

import { defineConfig, devices } from "@playwright/test";

// BASE_URL : la prod par défaut, ou une version construite avant sa mise en ligne.
const base = process.env.BASE_URL || "https://classiques.app";
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 1,                       // une seconde chance : on ne signale que ce qui échoue deux fois
  workers: 3,
  reporter: [["list"], ["json", { outputFile: "resultats.json" }]],
  use: {
    baseURL: base,
    screenshot: "only-on-failure",
    extraHTTPHeaders: bypass ? { "x-vercel-protection-bypass": bypass, "x-vercel-set-bypass-cookie": "true" } : {},
  },
  projects: [
    { name: "ordinateur", use: { ...devices["Desktop Chrome"] } },
    { name: "iphone", use: { ...devices["iPhone 13"] } },     // Safari (WebKit), comme un vrai iPhone
  ],
});

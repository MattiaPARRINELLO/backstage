// Captures "hero" pour le README — data/ factice, panneau reduit ou non.
// Usage : PROJECT_ROOT=$PWD BASE_URL=http://localhost:3100 OUT_DIR=public/screenshots node scripts/hero-shots.mjs
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const projectRoot = process.env.PROJECT_ROOT ?? process.cwd();
const baseUrl = process.env.BASE_URL ?? "http://localhost:3100";
const outDir = path.join(projectRoot, process.env.OUT_DIR ?? "public/screenshots");
fs.mkdirSync(outDir, { recursive: true });

const { signJwt } = await import(path.join(projectRoot, "lib/session-core.ts"));
const token = await signJwt({ sub: "owner" });

const exe = fs.existsSync(
  "/home/mattia/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome"
)
  ? "/home/mattia/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome"
  : undefined;

const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: "fr-FR",
  timezoneId: "Europe/Paris",
});
await ctx.addCookies([
  { name: "pb_session", value: token, domain: "localhost", path: "/", httpOnly: true },
]);
const page = await ctx.newPage();

// L'overlay d'erreurs de Next en mode dev (badge rouge "N Issues") n'existe
// pas en production : on le retire des captures pour montrer l'app réelle.
await ctx.addInitScript(() => {
  const kill = () => {
    document
      .querySelectorAll("nextjs-portal, [data-nextjs-toast], [data-next-badge-root]")
      .forEach((el) => el.remove());
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", kill);
  } else {
    kill();
  }
  setInterval(kill, 300);
});

// Coupe l'overlay de dev Next (badge "N Issues") en fin de run, sinon rien.
// Les endpoints OAuth exigent de vrais tokens : on intercepte le reseau pour
// que les widgets s'affichent avec des donnees d'exemple, sans toucher au code
// de l'app. Meme logique pour /api/leetcode et /api/calendar.
const FAKE_GMAIL = {
  messages: [
    { id: "m1", threadId: "t1", from: "scolarite@exemple-universite.fr", subject: "Emploi du temps de la semaine", date: new Date(Date.now() - 3600e3).toISOString(), snippet: "Les seances ont ete mises a jour.", body: "", unread: true },
    { id: "m2", threadId: "t2", from: "no-reply@exemple-outil.fr", subject: "Votre reservation est confirmee", date: new Date(Date.now() - 7200e3).toISOString(), snippet: "C est enregistre, bonne journee.", body: "", unread: true },
    { id: "m3", threadId: "t3", from: "bourse@exemple-universite.fr", subject: "Dossier incomplet", date: new Date(Date.now() - 86400e3).toISOString(), snippet: "Merci de completer une piece manquante.", body: "", unread: false },
    { id: "m4", threadId: "t4", from: "newsletter@exemple-media.fr", subject: "La selection de la semaine", date: new Date(Date.now() - 172800e3).toISOString(), snippet: "Trois articles a lire.", body: "", unread: false },
  ],
};

const FAKE_LEETCODE = {
  leetcodeUsername: "demo-user",
  solved: 148, easySolved: 82, mediumSolved: 52, hardSolved: 14,
  ranking: 42187, totalUsers: 800000, streak: 12, syncedAt: new Date().toISOString(),
};

await page.route("**/api/gmail*", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FAKE_GMAIL) })
);
await page.route("**/api/leetcode*", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FAKE_LEETCODE) })
);

const shoot = async (name) => {
  await page.waitForTimeout(1800);
  const p = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: p });
  console.log("OK", name, "->", p);
};

// 1. Hero : chat, panneau contexte reduit
await page.goto(`${baseUrl}/chat`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const collapse = page.getByLabel("Réduire le panneau");
if (await collapse.count()) {
  await collapse.first().click();
  await page.waitForTimeout(700);
}
await shoot("hero-chat");

// 2. Panneau deploye : montre les widgets (Flux par defaut)
const expand = page.getByLabel("Étendre le panneau");
if (await expand.count()) {
  await expand.first().click();
  await page.waitForTimeout(900);
}
await shoot("panneau-flux");

// 3. Vue code (LeetCode) dans le panneau
const codeTab = page.getByRole("tab", { name: /code/i });
if (await codeTab.count()) {
  await codeTab.first().click();
  await page.waitForTimeout(1200);
  await shoot("panneau-code");
}

// 4. Page memoire
await page.goto(`${baseUrl}/brain`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2200);
await shoot("brain");

// 5. Page login (publique, pour la section auth)
await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await shoot("login");

await browser.close();
console.log("Terminé ->", outDir);

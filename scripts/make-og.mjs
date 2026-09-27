// Genere public/og.png (1200x630) — image de partage pour LinkedIn / GitHub.
// Rendu Chromium : on garde exactement les couleurs et la typo de l'app.
// Usage : bun scripts/make-og.mjs
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const root = process.env.PROJECT_ROOT ?? process.cwd();
const out = path.join(root, "public/og.png");
const logo = "data:image/png;base64," + fs.readFileSync(path.join(root, "public/backstage-logo.png")).toString("base64");

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@500&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:1200px; height:630px; background:#0a0a0a; font-family:Inter,sans-serif; overflow:hidden; position:relative; }
  /* grille discrète, comme le fond de l'app */
  .grid { position:absolute; inset:0;
    background-image:linear-gradient(#ffffff06 1px,transparent 1px),linear-gradient(90deg,#ffffff06 1px,transparent 1px);
    background-size:48px 48px; }
  .glow { position:absolute; width:900px; height:900px; right:-280px; top:-320px; border-radius:50%;
    background:radial-gradient(circle,rgba(122,162,247,.20),transparent 62%); }
  .glow2 { position:absolute; width:700px; height:700px; left:-260px; bottom:-320px; border-radius:50%;
    background:radial-gradient(circle,rgba(212,163,115,.14),transparent 62%); }
  .wrap { position:relative; z-index:2; height:100%; display:flex; flex-direction:column;
    justify-content:space-between; padding:56px 64px; }
  .top { display:flex; align-items:center; gap:20px; }
  .logo { width:104px; height:104px; }
  .wordmark { display:flex; flex-direction:column; gap:5px; }
  .wordmark h1 { font-family:"Space Grotesk",sans-serif; font-size:38px; letter-spacing:.16em; color:#e5e5e5; font-weight:700; }
  .wordmark span { font-family:"JetBrains Mono",monospace; font-size:13px; letter-spacing:.2em;
    text-transform:uppercase; color:#8a8a8a; }
  .mid { max-width:820px; }
  .mid h2 { font-family:"Space Grotesk",sans-serif; font-size:74px; line-height:1.04; color:#fafafa; font-weight:700; }
  .mid h2 em { font-style:normal; color:#7aa2f7; }
  .mid p { margin-top:24px; font-size:24px; line-height:1.5; color:#8a8a8a; max-width:760px; }
  .tags { display:flex; gap:10px; flex-wrap:wrap; }
  .tag { font-family:"JetBrains Mono",monospace; font-size:14px; letter-spacing:.06em; color:#a3a3a3;
    border:1px solid #262626; border-radius:999px; padding:8px 16px; background:#141414; }
  .tag.accent { color:#d4a373; border-color:#4a3a28; }
  .foot { display:flex; align-items:center; justify-content:space-between; }
  .foot .by { font-size:17px; color:#525252; }
  .foot .by b { color:#8a8a8a; font-weight:600; }
  .live { display:flex; align-items:center; gap:10px; font-family:"JetBrains Mono",monospace;
    font-size:15px; color:#8a8a8a; }
  .dot { width:9px; height:9px; border-radius:50%; background:#d4a373; box-shadow:0 0 14px #d4a373; }
</style></head>
<body>
  <div class="grid"></div><div class="glow"></div><div class="glow2"></div>
  <div class="wrap">
    <div class="top">
      <img class="logo" src="${logo}" alt="">
      <div class="wordmark">
        <h1>BACKSTAGE</h1>
        <span>Ton espace de contrôle</span>
      </div>
    </div>
    <div class="mid">
      <h2>Second cerveau IA<br><em>déployé en production.</em></h2>
      <p>Chat IA avec mémoire persistante, passkey, streaming temps réel, rappels synchronisés et notifications push — dans une seule PWA installable.</p>
    </div>
    <div class="foot">
      <div class="tags">
        <span class="tag accent">Next.js 16</span>
        <span class="tag">React 19</span>
        <span class="tag">TypeScript</span>
        <span class="tag">Bun</span>
        <span class="tag">WebAuthn</span>
        <span class="tag">PWA</span>
      </div>
      <div class="live"><span class="dot"></span>en production</div>
    </div>
  </div>
</body></html>`;

const exe = fs.existsSync("/home/mattia/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome")
  ? "/home/mattia/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome" : undefined;
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.waitForTimeout(900);
await page.screenshot({ path: out });
await browser.close();
console.log("OG ->", out);

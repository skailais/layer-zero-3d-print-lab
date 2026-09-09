/**
 * Renders the social share cards into public/assets/og-*.png at 1200x630.
 *
 * The site itself stays zero-dependency; this is a one-off asset step, so it
 * borrows a browser rather than adding a runtime dependency. Run it only when
 * the wording or the brand changes — the PNGs are committed.
 *
 *   npm i -D playwright-core     (or point CHROME at an installed browser)
 *   node tools/og-cards.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public', 'assets');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const CARDS = [
  { file: 'og-home.png', eyebrow: '01 · 3D PRINT LAB · MARGATE, FLORIDA', line1: 'IDEAS INTO', line2: 'OBJECTS.', foot: 'FDM · SLA · NYLON CF — COURIER & TRACKED SHIPPING' },
  { file: 'og-quote.png', eyebrow: '04 · INSTANT ESTIMATE · HUMAN-CONFIRMED', line1: 'DROP A FILE.', line2: 'GET A NUMBER.', foot: 'STL · 3MF · STEP · OBJ — REPLY WITHIN 1 BUSINESS HOUR' },
  { file: 'og-showcase.png', eyebrow: '02 · SHOWCASE · WHAT CAME OFF THE PLATE', line1: 'SELECTED', line2: 'WORK.', foot: 'ARCHITECTURE · ENGINEERING · SCULPTURE · BATCH' },
  { file: 'og-store.png', eyebrow: '03 · STORE · PRINTED GOODS', line1: 'OBJECTS READY', line2: 'TO SHIP.', foot: 'MADE TO ORDER IN 1–5 DAYS — FREE SHIPPING OVER $150' },
];

const card = (c) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{width:1200px;height:630px;background:#0b0b0c;color:#e9e7e1;position:relative;overflow:hidden}
  /* the same faint rule grid the site draws behind its pages */
  .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(233,231,225,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(233,231,225,.045) 1px,transparent 1px);background-size:60px 60px}
  .ghost{position:absolute;right:-90px;bottom:-150px;font-family:Anton,sans-serif;font-size:340px;line-height:.8;color:transparent;-webkit-text-stroke:1.5px rgba(233,231,225,.07);letter-spacing:-.02em}
  .wrap{position:relative;padding:72px 80px;height:100%;display:flex;flex-direction:column;justify-content:space-between}
  .brand{display:flex;align-items:center;gap:18px;font-family:Anton,sans-serif;font-size:32px;letter-spacing:.02em}
  .sq{width:26px;height:26px;background:#e9e7e1;transform:rotate(45deg);position:relative}
  .sq::after{content:'';position:absolute;inset:8px;background:#c8102e}
  .eyebrow{font-family:'JetBrains Mono',monospace;font-size:15px;letter-spacing:.22em;color:#77756f;display:flex;align-items:center;gap:18px}
  .eyebrow::before{content:'';width:54px;height:2px;background:#c8102e}
  h1{font-family:Anton,sans-serif;font-size:104px;line-height:.92;letter-spacing:-.01em;margin-top:22px}
  h1 span{display:block}
  .foot{font-family:'JetBrains Mono',monospace;font-size:15px;letter-spacing:.16em;color:#b9b6ae;border-top:1px solid rgba(233,231,225,.14);padding-top:22px}
</style></head><body>
  <div class="grid"></div>
  <div class="ghost">${c.line2.replace(/[^A-Z]/g, '').slice(0, 5)}</div>
  <div class="wrap">
    <div class="brand"><i class="sq"></i>LAYER ZERO</div>
    <div>
      <div class="eyebrow">${c.eyebrow}</div>
      <h1><span>${c.line1}</span><span>${c.line2}</span></h1>
    </div>
    <div class="foot">${c.foot}</div>
  </div>
</body></html>`;

(async () => {
  let chromium;
  try {
    ({ chromium } = require('playwright-core'));
  } catch {
    console.error('playwright-core is not installed. npm i -D playwright-core');
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });

  for (const c of CARDS) {
    await page.setContent(card(c), { waitUntil: 'load' });
    // the wordmark is Anton; screenshotting before it lands gives a fallback face
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    const file = path.join(OUT, c.file);
    await page.screenshot({ path: file });
    console.log(`  ${c.file}  ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
  }

  await browser.close();
  console.log('Done.');
})();

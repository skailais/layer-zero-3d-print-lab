/**
 * Builds a static copy of the site into docs/ for GitHub Pages.
 *
 * GitHub Pages cannot run the Node backend, so this build bundles the current
 * content and analytics into demo-data.js and installs a fetch() shim that
 * answers every /api/ call locally. The result is fully browsable — including
 * a read-only Master dashboard — with writes disabled.
 *
 * The dev server must be running (node server.js) so the build can pull the
 * real analytics payloads instead of re-implementing them.
 *
 *   node tools/build-static.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'docs');
const BASE = 'http://localhost:3000';
const PW = process.env.LZ_PW || 'layerzero';

const PAGES = ['index.html', 'showcase.html', 'store.html', 'quote.html', 'master.html', '404.html'];
const SCRIPTS = ['core.js', 'home.js', 'showcase.js', 'store.js', 'quote.js', 'admin.js'];

let cookie = '';
async function api(p) {
  const r = await fetch(BASE + p, { headers: { cookie } });
  if (!r.ok) throw new Error(`${p} -> ${r.status}`);
  return r.json();
}
async function login() {
  const r = await fetch(BASE + '/api/admin/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PW })
  });
  if (!r.ok) throw new Error('admin login failed (is the password still default?)');
  cookie = (r.headers.get('set-cookie') || '').split(';')[0];
}

function rmrf(p) { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); }
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
}

// ---------- path rewriting: absolute site paths -> relative, extensionless -> .html ----------
const ROUTES = { '/': 'index.html', '/showcase': 'showcase.html', '/store': 'store.html', '/quote': 'quote.html', '/master': 'master.html' };

function rewriteHtml(s) {
  // asset directories
  s = s.replace(/(["'(])\/(css|js|assets|uploads)\//g, '$1$2/');
  // routes inside href="" — longest first so /showcase beats /
  for (const [route, file] of Object.entries(ROUTES)) {
    if (route === '/') continue;
    s = s.split(`href="${route}"`).join(`href="${file}"`);
    s = s.replace(new RegExp(`href="${route}#`, 'g'), `href="${file}#`);
  }
  s = s.split('href="/"').join('href="index.html"');
  return s;
}

function rewriteJs(s) {
  s = s.replace(/(["'(`])\/(css|js|assets|uploads)\//g, '$1$2/');
  for (const [route, file] of Object.entries(ROUTES)) {
    if (route === '/') continue;
    s = s.split(`href="${route}"`).join(`href="${file}"`);
    s = s.replace(new RegExp(`href="${route}#`, 'g'), `href="${file}#`);
    s = s.split(`'${route}'`).join(`'${file}'`);
  }
  return s;
}

(async () => {
  console.log('Pulling live data from', BASE);
  await login();
  const [content, settings, showcase, products, reviews, orders, quotes, messages, events] = await Promise.all([
    api('/api/content'), api('/api/admin/settings'), api('/api/admin/showcase'), api('/api/admin/products'),
    api('/api/admin/reviews'), api('/api/admin/orders'), api('/api/admin/quotes'), api('/api/admin/messages'),
    api('/api/admin/events/recent')
  ]);
  const stats = {};
  for (const d of [7, 30, 90, 365]) stats[d] = await api('/api/admin/stats/' + d);
  console.log(`  content ${content.products.length} products · ${content.showcase.length} showcase · ${content.reviews.length} reviews`);
  console.log(`  orders ${orders.length} · quotes ${quotes.length} · messages ${messages.length} · events ${events.length}`);

  console.log('Building docs/');
  rmrf(OUT);
  copyDir(SRC, OUT);
  rmrf(path.join(OUT, 'uploads'));

  // ---------- bundled demo data ----------
  const demo = { content, settings, showcase, products, reviews, orders, quotes, messages, events, stats };
  // image/file paths inside the data are absolute too — make them relative
  let demoJson = JSON.stringify(demo).replace(/"\/(assets|uploads)\//g, '"$1/');
  if (/"\/assets\//.test(demoJson)) throw new Error('absolute asset path left in demo data');
  fs.writeFileSync(path.join(OUT, 'js', 'demo-data.js'), 'window.LZ_DEMO = ' + demoJson + ';\n');

  // ---------- fetch shim ----------
  fs.copyFileSync(path.join(__dirname, 'static-api.js'), path.join(OUT, 'js', 'static-api.js'));

  // ---------- rewrite scripts ----------
  for (const f of SCRIPTS) {
    const p = path.join(OUT, 'js', f);
    let s = fs.readFileSync(p, 'utf8');
    if (f === 'core.js') {
      const a = s;
      s = s.replace(
        "const PAGE = location.pathname.replace(/\\.html$/, '') || '/';",
        "const PAGE = (location.pathname.split('/').pop() || 'index.html');"
      );
      s = s.replace("if (!/\\/master/.test(PAGE)) track('pageview');", "if (!/master/.test(PAGE)) track('pageview');");
      s = s.replace("if ((pathPart || PAGE) === PAGE || pathPart === PAGE + '.html') return;", "if ((pathPart || PAGE) === PAGE) return;");
      s = s.replace(
        "const NAV = [['/', 'Home'], ['/showcase', 'Showcase'], ['/store', 'Store'], ['/quote', 'Get a quote']];",
        "const NAV = [['index.html', 'Home'], ['showcase.html', 'Showcase'], ['store.html', 'Store'], ['quote.html', 'Get a quote']];"
      );
      s = s.replace("if (PAGE === '/store')", "if (PAGE === 'store.html')");
      if (s === a) throw new Error('core.js rewrites did not apply');
    }
    s = rewriteJs(s);
    fs.writeFileSync(p, s);
  }

  // ---------- rewrite pages, inject shim ----------
  for (const f of PAGES) {
    const p = path.join(OUT, f);
    let s = rewriteHtml(fs.readFileSync(p, 'utf8'));
    s = s.replace(/<script src="js\/(core|admin)\.js"><\/script>/,
      '<script src="js/demo-data.js"></script>\n<script src="js/static-api.js"></script>\n<script src="js/$1.js"></script>');
    if (!s.includes('static-api.js')) throw new Error('shim not injected into ' + f);
    if (s.includes('href="/') || s.includes('src="/')) throw new Error('absolute path left in ' + f);
    fs.writeFileSync(p, s);
  }

  // GitHub Pages: skip Jekyll, and serve 404.html for unknown paths automatically
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

  const size = (function du(d) {
    return fs.readdirSync(d, { withFileTypes: true }).reduce((s, e) => {
      const p = path.join(d, e.name);
      return s + (e.isDirectory() ? du(p) : fs.statSync(p).size);
    }, 0);
  })(OUT);
  console.log(`Done — docs/ is ${(size / 1024).toFixed(0)} KB`);
})().catch(e => { console.error('BUILD FAILED:', e.message); process.exit(1); });

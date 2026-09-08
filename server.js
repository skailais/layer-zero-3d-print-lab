/**
 * LAYER ZERO — 3D Print Lab (Margate, FL)
 * Zero-dependency Node.js server: static files + JSON API + admin auth + analytics.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data');
const UPLOADS = path.join(PUBLIC, 'uploads');
const PORT = process.env.PORT || 3000;

for (const d of [DATA, UPLOADS]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });

// ---------- tiny JSON store ----------
const store = {
  cache: {},
  file(name) { return path.join(DATA, name + '.json'); },
  read(name, fallback) {
    if (this.cache[name]) return this.cache[name];
    try { this.cache[name] = JSON.parse(fs.readFileSync(this.file(name), 'utf8')); }
    catch { this.cache[name] = fallback; this.write(name, fallback); }
    return this.cache[name];
  },
  write(name, value) {
    this.cache[name] = value;
    const tmp = this.file(name) + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
    fs.renameSync(tmp, this.file(name));
  }
};

const DEFAULT_SETTINGS = {
  adminPasswordHash: null,      // set on first run
  business: {
    name: 'LAYER ZERO',
    tagline: '3D PRINT LAB · MARGATE, FL',
    address: '5400 W Atlantic Blvd, Margate, FL 33063',
    phone: '(954) 555-0142',
    email: 'orders@layerzero.print',
    hours: 'Mon–Sat 09:00–19:00',
    lat: 26.2445, lng: -80.2064
  },
  delivery: {
    pickupZips: ['33063', '33068', '33093'],
    localZipPrefixes: ['330', '331', '332', '333', '334'],   // South Florida tri-county
    floridaZipPrefixes: ['320','321','322','323','324','325','326','327','328','329','330','331','332','333','334','335','336','337','338','339','341','342','344','346','347','349'],
    rates: {
      pickup: 0,
      local: 9,
      florida: 14,
      national: 22,
      expressSurcharge: 25,
      freeOver: 150
    },
    eta: { pickup: 'Same day when ready', local: 'Next business day', florida: '2–3 business days', national: '4–6 business days' }
  },
  pricing: { pla: 0.08, petg: 0.10, abs: 0.11, tpu: 0.14, resin: 0.22, nylon: 0.18, minOrder: 15, setupFee: 5, rush: 1.6 }
};

function seedIfEmpty() {
  const s = store.read('settings', DEFAULT_SETTINGS);
  if (!s.adminPasswordHash) {
    s.adminPasswordHash = hashPw('layerzero');
    store.write('settings', s);
    console.log('  Admin password initialized to: layerzero  (change it in Master → Settings)');
  }
  store.read('showcase', require('./data-seed').showcase);
  store.read('products', require('./data-seed').products);
  store.read('reviews', require('./data-seed').reviews);
  store.read('orders', []);
  store.read('quotes', []);
  store.read('events', []);
  store.read('messages', []);
}

function hashPw(pw) {
  const salt = crypto.randomBytes(8).toString('hex');
  const h = crypto.scryptSync(pw, salt, 32).toString('hex');
  return salt + ':' + h;
}
function verifyPw(pw, stored) {
  if (!stored) return false;
  const [salt, h] = stored.split(':');
  const test = crypto.scryptSync(pw, salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(test, 'hex'));
}

// ---------- sessions ----------
const adminSessions = new Map(); // token -> expiry
function isAdmin(req) {
  const t = cookies(req).lz_admin;
  if (!t) return false;
  const exp = adminSessions.get(t);
  if (!exp || exp < Date.now()) { adminSessions.delete(t); return false; }
  return true;
}
function cookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(c => {
    const i = c.indexOf('='); if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return out;
}

// ---------- helpers ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.stl': 'model/stl', '.txt': 'text/plain',
  // without this the sitemap is served as application/octet-stream and offered
  // to the visitor as a download instead of being read as a sitemap
  '.xml': 'application/xml'
};
function send(res, status, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(status, Object.assign({ 'Content-Type': isObj ? 'application/json' : 'text/plain' }, headers));
  res.end(isObj ? JSON.stringify(body) : body);
}
function readBody(req, limit = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('Payload too large')); req.destroy(); } chunks.push(c); });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('Bad JSON')); }
    });
    req.on('error', reject);
  });
}
const id = () => Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
const clean = s => String(s == null ? '' : s).slice(0, 5000);

// ---------- delivery ----------
function deliveryZone(zip) {
  const s = store.read('settings', DEFAULT_SETTINGS).delivery;
  zip = String(zip || '').trim().slice(0, 5);
  if (!/^\d{5}$/.test(zip)) return { zone: 'unknown', rate: null };
  const p = zip.slice(0, 3);
  let zone = 'national';
  if (s.pickupZips.includes(zip)) zone = 'pickup';
  else if (s.localZipPrefixes.includes(p)) zone = 'local';
  else if (s.floridaZipPrefixes.includes(p)) zone = 'florida';
  return { zone, rate: s.rates[zone === 'pickup' ? 'local' : zone], pickupAvailable: zone === 'pickup' || zone === 'local', eta: s.eta[zone], rates: s.rates };
}

function computeOrderTotals(items, zip, method, express) {
  const products = store.read('products', []);
  let subtotal = 0; const lines = [];
  for (const it of items || []) {
    const p = products.find(x => x.id === it.id);
    if (!p || !p.active) continue;
    const qty = Math.max(1, Math.min(99, parseInt(it.qty) || 1));
    const variant = (p.variants || []).find(v => v.name === it.variant) || null;
    const price = +(p.price + (variant ? (variant.delta || 0) : 0)).toFixed(2);
    subtotal += price * qty;
    lines.push({ id: p.id, name: p.name, variant: variant ? variant.name : null, price, qty, image: p.image });
  }
  const dz = deliveryZone(zip);
  const rates = store.read('settings', DEFAULT_SETTINGS).delivery.rates;
  let shipping = 0;
  if (method === 'pickup') shipping = 0;
  else shipping = dz.rate == null ? rates.national : dz.rate;
  if (subtotal >= rates.freeOver && method !== 'pickup') shipping = 0;
  if (express && method !== 'pickup') shipping += rates.expressSurcharge;
  const tax = +(subtotal * 0.07).toFixed(2); // Broward County 7%
  return { lines, subtotal: +subtotal.toFixed(2), shipping: +shipping.toFixed(2), tax, total: +(subtotal + shipping + tax).toFixed(2), zone: method === 'pickup' ? 'pickup' : dz.zone, eta: method === 'pickup' ? 'Pickup when ready' : dz.eta };
}

// ---------- quote estimation ----------
function estimateQuote(q) {
  const pr = store.read('settings', DEFAULT_SETTINGS).pricing;
  const vol = Math.max(0, parseFloat(q.volumeCm3) || 0);      // cm³
  const density = { pla: 1.24, petg: 1.27, abs: 1.04, tpu: 1.21, resin: 1.15, nylon: 1.1 }[q.material] || 1.24;
  const infill = Math.min(100, Math.max(5, parseFloat(q.infill) || 20)) / 100;
  const effVol = vol * (0.25 + 0.75 * infill);                 // shells + infill approximation
  const grams = effVol * density;
  const perGram = pr[q.material] || pr.pla;
  const qty = Math.max(1, parseInt(q.qty) || 1);
  let unit = grams * perGram + pr.setupFee;
  if (q.finish === 'sanded') unit *= 1.25;
  if (q.finish === 'painted') unit *= 1.6;
  let total = unit * qty;
  if (qty >= 10) total *= 0.88;
  if (q.rush) total *= pr.rush;
  total = Math.max(pr.minOrder, total);
  const hours = +(effVol * 0.09 * qty).toFixed(1);
  return { grams: +grams.toFixed(1), unit: +unit.toFixed(2), total: +total.toFixed(2), printHours: hours, leadDays: q.rush ? 1 : (hours > 24 ? 5 : 3) };
}

// ---------- analytics ----------
function recordEvent(ev, req) {
  const events = store.read('events', []);
  events.push({
    id: id(), ts: Date.now(),
    type: clean(ev.type).slice(0, 40), page: clean(ev.page).slice(0, 120), label: clean(ev.label).slice(0, 120),
    value: typeof ev.value === 'number' ? ev.value : undefined,
    sid: clean(ev.sid).slice(0, 40), ref: clean(ev.ref).slice(0, 200), device: /Mobi/i.test(req.headers['user-agent'] || '') ? 'mobile' : 'desktop'
  });
  if (events.length > 50000) events.splice(0, events.length - 50000);
  store.write('events', events);
}

function analyticsSummary(days = 30) {
  const events = store.read('events', []);
  const orders = store.read('orders', []);
  const quotes = store.read('quotes', []);
  const since = Date.now() - days * 864e5;
  const ev = events.filter(e => e.ts >= since);
  const count = t => ev.filter(e => e.type === t).length;
  const sessions = new Set(ev.map(e => e.sid)).size;
  const pageviews = count('pageview');
  const byPage = {}; ev.filter(e => e.type === 'pageview').forEach(e => byPage[e.page] = (byPage[e.page] || 0) + 1);
  const clicks = {}; ev.filter(e => e.type === 'click').forEach(e => clicks[e.label] = (clicks[e.label] || 0) + 1);
  const sessOf = pred => new Set(ev.filter(pred).map(e => e.sid)).size;
  const storeViews = sessOf(e => e.type === 'pageview' && /store/.test(e.page));
  const productViews = sessOf(e => e.type === 'product_view');
  const addToCart = sessOf(e => e.type === 'add_to_cart');
  const checkoutStart = sessOf(e => e.type === 'checkout_start');
  const ordersIn = orders.filter(o => o.ts >= since);
  const quotesIn = quotes.filter(q => q.ts >= since);
  const revenue = ordersIn.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.totals.total, 0);
  const daily = {};
  for (let i = days - 1; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); daily[d] = { views: 0, sessions: new Set(), orders: 0, revenue: 0, quotes: 0 }; }
  ev.forEach(e => { const d = new Date(e.ts).toISOString().slice(0, 10); if (daily[d]) { if (e.type === 'pageview') daily[d].views++; daily[d].sessions.add(e.sid); } });
  ordersIn.forEach(o => { const d = new Date(o.ts).toISOString().slice(0, 10); if (daily[d]) { daily[d].orders++; if (o.status !== 'cancelled') daily[d].revenue += o.totals.total; } });
  quotesIn.forEach(q => { const d = new Date(q.ts).toISOString().slice(0, 10); if (daily[d]) daily[d].quotes++; });
  const series = Object.entries(daily).map(([date, v]) => ({ date, views: v.views, sessions: v.sessions.size, orders: v.orders, revenue: +v.revenue.toFixed(2), quotes: v.quotes }));
  const topProducts = {};
  ordersIn.forEach(o => o.totals.lines.forEach(l => { topProducts[l.name] = (topProducts[l.name] || 0) + l.qty; }));
  const devices = { mobile: ev.filter(e => e.device === 'mobile').length, desktop: ev.filter(e => e.device === 'desktop').length };
  const zones = {}; ordersIn.forEach(o => zones[o.totals.zone] = (zones[o.totals.zone] || 0) + 1);
  const refs = {}; ev.filter(e => e.type === 'pageview' && e.ref).forEach(e => { try { const h = new URL(e.ref).hostname; refs[h] = (refs[h] || 0) + 1; } catch {} });
  return {
    days, sessions, pageviews, byPage, clicks, devices, zones, refs,
    funnel: { visits: sessions, storeViews, productViews, addToCart, checkoutStart, orders: new Set(ordersIn.map(o => o.sid)).size || ordersIn.length },
    counts: { productViews: count('product_view'), addToCart: count('add_to_cart'), checkoutStart: count('checkout_start'), purchases: ordersIn.length },
    quotes: quotesIn.length, quoteValue: +quotesIn.reduce((s, q) => s + (q.estimate ? q.estimate.total : 0), 0).toFixed(2),
    revenue: +revenue.toFixed(2), aov: ordersIn.length ? +(revenue / ordersIn.length).toFixed(2) : 0,
    conversion: sessions ? +((ordersIn.length / sessions) * 100).toFixed(2) : 0,
    series, topProducts,
    ordersByStatus: orders.reduce((a, o) => (a[o.status] = (a[o.status] || 0) + 1, a), {}),
    unreadMessages: store.read('messages', []).filter(m => !m.read).length,
    pendingQuotes: quotes.filter(q => q.status === 'new').length,
    activeOrders: orders.filter(o => ['new', 'printing', 'ready'].includes(o.status)).length
  };
}

// ---------- API router ----------
const routes = [];
function route(method, pattern, handler, opts = {}) { routes.push({ method, pattern: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler, admin: !!opts.admin }); }

// public content
route('GET', '/api/content', () => {
  const s = store.read('settings', DEFAULT_SETTINGS);
  return {
    business: s.business, delivery: { rates: s.delivery.rates, eta: s.delivery.eta },
    showcase: store.read('showcase', []).filter(x => x.active).sort((a, b) => (a.order || 0) - (b.order || 0)),
    products: store.read('products', []).filter(x => x.active).sort((a, b) => (a.order || 0) - (b.order || 0)),
    reviews: store.read('reviews', []).filter(x => x.active).sort((a, b) => (a.order || 0) - (b.order || 0))
  };
});
route('GET', '/api/delivery/:zip', (req, res, p) => deliveryZone(p.zip));
route('POST', '/api/track', async (req) => { const b = await readBody(req, 8192); recordEvent(b, req); return { ok: true }; });
route('POST', '/api/cart/totals', async (req) => { const b = await readBody(req); return computeOrderTotals(b.items, b.zip, b.method, b.express); });
route('POST', '/api/orders', async (req) => {
  const b = await readBody(req);
  const totals = computeOrderTotals(b.items, b.customer && b.customer.zip, b.method, b.express);
  if (!totals.lines.length) throw Object.assign(new Error('Cart is empty'), { status: 400 });
  const c = b.customer || {};
  if (!c.name || !c.email) throw Object.assign(new Error('Name and email are required'), { status: 400 });
  if (b.method !== 'pickup' && (!c.address || !c.zip)) throw Object.assign(new Error('Address and ZIP required for delivery'), { status: 400 });
  const order = {
    id: 'LZ-' + (1000 + store.read('orders', []).length + 1), ts: Date.now(), status: 'new',
    customer: { name: clean(c.name), email: clean(c.email), phone: clean(c.phone), address: clean(c.address), city: clean(c.city), zip: clean(c.zip), notes: clean(c.notes) },
    method: b.method === 'pickup' ? 'pickup' : 'delivery', express: !!b.express, totals, sid: clean(b.sid)
  };
  const orders = store.read('orders', []); orders.push(order); store.write('orders', orders);
  recordEvent({ type: 'purchase', page: '/store', label: order.id, value: totals.total, sid: b.sid }, req);
  return { ok: true, order };
});
route('POST', '/api/quotes', async (req) => {
  const b = await readBody(req);
  if (!b.email || !b.name) throw Object.assign(new Error('Name and email are required'), { status: 400 });
  const estimate = estimateQuote(b);
  let file = null;
  if (b.fileData && b.fileName) {
    const safe = clean(b.fileName).replace(/[^a-z0-9._-]/gi, '_').slice(0, 80);
    const buf = Buffer.from(String(b.fileData).split(',').pop(), 'base64');
    if (buf.length > 20 * 1024 * 1024) throw Object.assign(new Error('File too large (20MB max)'), { status: 400 });
    file = id() + '_' + safe;
    fs.writeFileSync(path.join(UPLOADS, file), buf);
  }
  const quote = { id: 'Q-' + (500 + store.read('quotes', []).length + 1), ts: Date.now(), status: 'new',
    name: clean(b.name), email: clean(b.email), phone: clean(b.phone), zip: clean(b.zip),
    material: clean(b.material), infill: +b.infill || 20, qty: +b.qty || 1, finish: clean(b.finish), rush: !!b.rush,
    volumeCm3: +b.volumeCm3 || 0, dims: clean(b.dims), notes: clean(b.notes), file, estimate, sid: clean(b.sid) };
  const quotes = store.read('quotes', []); quotes.push(quote); store.write('quotes', quotes);
  recordEvent({ type: 'quote', page: '/quote', label: quote.material, value: estimate.total, sid: b.sid }, req);
  return { ok: true, quote };
});
route('POST', '/api/quotes/estimate', async (req) => { const b = await readBody(req, 8192); return estimateQuote(b); });
route('POST', '/api/messages', async (req) => {
  const b = await readBody(req, 16384);
  if (!b.email || !b.message) throw Object.assign(new Error('Email and message required'), { status: 400 });
  const msgs = store.read('messages', []);
  msgs.push({ id: id(), ts: Date.now(), name: clean(b.name), email: clean(b.email), message: clean(b.message), read: false });
  store.write('messages', msgs);
  recordEvent({ type: 'contact', page: '/', label: 'message', sid: b.sid }, req);
  return { ok: true };
});
route('GET', '/api/orders/:id', (req, res, p) => {
  const o = store.read('orders', []).find(x => x.id === p.id.toUpperCase());
  if (!o) throw Object.assign(new Error('Order not found'), { status: 404 });
  return { id: o.id, status: o.status, ts: o.ts, method: o.method, eta: o.totals.eta, total: o.totals.total, lines: o.totals.lines.map(l => ({ name: l.name, qty: l.qty })) };
});

// admin auth
route('POST', '/api/admin/login', async (req, res) => {
  const b = await readBody(req, 4096);
  const s = store.read('settings', DEFAULT_SETTINGS);
  if (!verifyPw(String(b.password || ''), s.adminPasswordHash)) { await new Promise(r => setTimeout(r, 600)); throw Object.assign(new Error('Wrong password'), { status: 401 }); }
  const token = crypto.randomBytes(24).toString('hex');
  adminSessions.set(token, Date.now() + 12 * 3600e3);
  res.setHeader('Set-Cookie', `lz_admin=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200`);
  return { ok: true };
});
route('POST', '/api/admin/logout', (req, res) => { adminSessions.delete(cookies(req).lz_admin); res.setHeader('Set-Cookie', 'lz_admin=; Path=/; Max-Age=0'); return { ok: true }; });
route('GET', '/api/admin/me', (req) => ({ admin: isAdmin(req) }));
route('POST', '/api/admin/password', async (req) => {
  const b = await readBody(req, 4096);
  const s = store.read('settings', DEFAULT_SETTINGS);
  if (!verifyPw(String(b.current || ''), s.adminPasswordHash)) throw Object.assign(new Error('Current password is wrong'), { status: 400 });
  if (String(b.next || '').length < 6) throw Object.assign(new Error('New password must be 6+ chars'), { status: 400 });
  s.adminPasswordHash = hashPw(String(b.next)); store.write('settings', s); return { ok: true };
}, { admin: true });

route('POST', '/api/admin/upload', async (req) => {
  const b = await readBody(req, 12 * 1024 * 1024);
  const m = /^data:(image\/(png|jpeg|jpg|webp|gif|svg\+xml));base64,(.+)$/.exec(String(b.data || ''));
  if (!m) throw Object.assign(new Error('Only image files are accepted'), { status: 400 });
  const ext = { png: 'png', jpeg: 'jpg', jpg: 'jpg', webp: 'webp', gif: 'gif', 'svg+xml': 'svg' }[m[2]];
  const name = id() + '.' + ext;
  fs.writeFileSync(path.join(UPLOADS, name), Buffer.from(m[3], 'base64'));
  return { ok: true, url: '/uploads/' + name };
}, { admin: true });

// admin: generic CRUD for collections
const COLLECTIONS = ['showcase', 'products', 'reviews'];
route('GET', '/api/admin/:col', (req, res, p) => {
  if (COLLECTIONS.includes(p.col)) return store.read(p.col, []).sort((a, b) => (a.order || 0) - (b.order || 0));
  if (p.col === 'orders' || p.col === 'quotes' || p.col === 'messages') return store.read(p.col, []).slice().reverse();
  if (p.col === 'settings') { const s = store.read('settings', DEFAULT_SETTINGS); return { business: s.business, delivery: s.delivery, pricing: s.pricing }; }
  throw Object.assign(new Error('Unknown collection'), { status: 404 });
}, { admin: true });
route('GET', '/api/admin/stats/:days', (req, res, p) => analyticsSummary(Math.min(365, Math.max(1, parseInt(p.days) || 30))), { admin: true });
route('GET', '/api/admin/events/recent', () => store.read('events', []).slice(-200).reverse(), { admin: true });
route('POST', '/api/admin/:col', async (req, res, p) => {
  if (!COLLECTIONS.includes(p.col)) throw Object.assign(new Error('Unknown collection'), { status: 404 });
  const b = await readBody(req);
  const list = store.read(p.col, []);
  const item = Object.assign({}, b, { id: b.id || id(), active: b.active !== false, order: typeof b.order === 'number' ? b.order : list.length + 1, updated: Date.now() });
  if (!item.created) item.created = Date.now();
  const i = list.findIndex(x => x.id === item.id);
  if (i >= 0) list[i] = Object.assign(list[i], item); else list.push(item);
  store.write(p.col, list);
  return { ok: true, item };
}, { admin: true });
route('DELETE', '/api/admin/:col/:id', (req, res, p) => {
  if (!COLLECTIONS.includes(p.col)) throw Object.assign(new Error('Unknown collection'), { status: 404 });
  const list = store.read(p.col, []).filter(x => x.id !== p.id);
  store.write(p.col, list); return { ok: true };
}, { admin: true });
route('POST', '/api/admin/:col/reorder', async (req, res, p) => {
  if (!COLLECTIONS.includes(p.col)) throw Object.assign(new Error('Unknown collection'), { status: 404 });
  const b = await readBody(req); const list = store.read(p.col, []);
  (b.ids || []).forEach((iid, i) => { const it = list.find(x => x.id === iid); if (it) it.order = i + 1; });
  store.write(p.col, list); return { ok: true };
}, { admin: true });
route('PATCH', '/api/admin/orders/:id', async (req, res, p) => {
  const b = await readBody(req, 8192); const list = store.read('orders', []);
  const o = list.find(x => x.id === p.id); if (!o) throw Object.assign(new Error('Not found'), { status: 404 });
  if (b.status) o.status = clean(b.status).slice(0, 20); if (b.adminNote != null) o.adminNote = clean(b.adminNote);
  store.write('orders', list); return { ok: true, order: o };
}, { admin: true });
route('PATCH', '/api/admin/quotes/:id', async (req, res, p) => {
  const b = await readBody(req, 8192); const list = store.read('quotes', []);
  const q = list.find(x => x.id === p.id); if (!q) throw Object.assign(new Error('Not found'), { status: 404 });
  if (b.status) q.status = clean(b.status).slice(0, 20); if (b.adminNote != null) q.adminNote = clean(b.adminNote);
  if (b.finalPrice !== undefined) q.finalPrice = b.finalPrice === null ? null : +b.finalPrice;
  store.write('quotes', list); return { ok: true, quote: q };
}, { admin: true });
route('PATCH', '/api/admin/messages/:id', async (req, res, p) => {
  const b = await readBody(req, 4096); const list = store.read('messages', []);
  const m = list.find(x => x.id === p.id); if (!m) throw Object.assign(new Error('Not found'), { status: 404 });
  m.read = !!b.read; store.write('messages', list); return { ok: true };
}, { admin: true });
route('PUT', '/api/admin/settings', async (req) => {
  const b = await readBody(req); const s = store.read('settings', DEFAULT_SETTINGS);
  if (b.business) s.business = Object.assign(s.business, b.business);
  if (b.delivery) s.delivery = Object.assign(s.delivery, b.delivery);
  if (b.pricing) s.pricing = Object.assign(s.pricing, b.pricing);
  store.write('settings', s); return { ok: true };
}, { admin: true });

route('DELETE', '/api/admin/events', () => { store.write('events', []); return { ok: true }; }, { admin: true });
route('GET', '/api/admin/export/:col', (req, res, p) => {
  if (!['orders', 'quotes', 'events', 'messages', 'products', 'showcase', 'reviews'].includes(p.col)) throw Object.assign(new Error('Unknown'), { status: 404 });
  return store.read(p.col, []);
}, { admin: true });

// ---------- server ----------
async function handle(req, res) {
  // WHATWG URL rather than url.parse: the legacy parser is deprecated
  // (DEP0169) and its quirks have had security consequences. The base is a
  // throwaway — only the path is used.
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, { error: 'Malformed URL' });
  }
  if (pathname.startsWith('/api/')) {
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = r.pattern.exec(pathname); if (!m) continue;
      try {
        if (r.admin && !isAdmin(req)) return send(res, 401, { error: 'Unauthorized' });
        const out = await r.handler(req, res, m.groups || {});
        return send(res, 200, out == null ? { ok: true } : out, { 'Cache-Control': 'no-store' });
      } catch (e) { return send(res, e.status || 500, { error: e.message }); }
    }
    return send(res, 404, { error: 'No such endpoint' });
  }
  // static
  let file = pathname === '/' ? '/index.html' : pathname;
  if (!path.extname(file)) file += '.html';
  const abs = path.normalize(path.join(PUBLIC, file));
  // Compare against PUBLIC + separator. A bare startsWith(PUBLIC) also matches
  // any sibling whose name merely begins with "public", so /../public-old/x
  // escaped the directory and was served with a 200.
  if (abs !== PUBLIC && !abs.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Forbidden');
  fs.readFile(abs, (err, data) => {
    if (err) {
      return fs.readFile(path.join(PUBLIC, '404.html'), (e2, d2) => send(res, 404, e2 ? 'Not found' : d2, { 'Content-Type': 'text/html; charset=utf-8' }));
    }
    const ext = path.extname(abs).toLowerCase();
    send(res, 200, data, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600' });
  });
}

seedIfEmpty();
http.createServer(handle).listen(PORT, () => {
  console.log('\n  LAYER ZERO — 3D Print Lab');
  console.log('  ─────────────────────────────');
  console.log(`  Site:    http://localhost:${PORT}`);
  console.log(`  Master:  http://localhost:${PORT}/master`);
  console.log('');
});

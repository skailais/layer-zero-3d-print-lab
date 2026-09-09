/**
 * Static demo API — GitHub Pages build only.
 *
 * The real site talks to a Node backend. Pages can't run one, so this shim
 * intercepts fetch() for /api/ routes and answers from the data bundled in
 * demo-data.js, mirroring the server's pricing logic exactly. Reads work,
 * writes are refused with a clear message.
 */
(function () {
  'use strict';
  const D = window.LZ_DEMO || {};
  const S = D.settings || {};
  const realFetch = window.fetch.bind(window);
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' }
  });
  const READONLY = 'Read-only demo. Clone the repo and run "node server.js" to edit content.';

  let demoAdmin = false;
  try { demoAdmin = sessionStorage.getItem('lz_demo_admin') === '1'; } catch (e) { }
  const setAdmin = v => { demoAdmin = v; try { sessionStorage.setItem('lz_demo_admin', v ? '1' : '0'); } catch (e) { } };

  // ---------- local order book so tracking works after a demo checkout ----------
  const localOrders = () => { try { return JSON.parse(localStorage.getItem('lz_demo_orders') || '[]'); } catch (e) { return []; } };
  const saveOrder = o => { try { const l = localOrders(); l.push(o); localStorage.setItem('lz_demo_orders', JSON.stringify(l.slice(-25))); } catch (e) { } };

  // ---------- pricing logic, mirrored from server.js ----------
  function deliveryZone(zip) {
    const d = S.delivery || {};
    zip = String(zip || '').trim().slice(0, 5);
    if (!/^\d{5}$/.test(zip)) return { zone: 'unknown', rate: null };
    const p = zip.slice(0, 3);
    let zone = 'national';
    if ((d.localZipPrefixes || []).includes(p)) zone = 'local';
    else if ((d.floridaZipPrefixes || []).includes(p)) zone = 'florida';
    const rates = d.rates || {};
    return { zone, rate: rates[zone], eta: (d.eta || {})[zone], rates };
  }

  function computeOrderTotals(items, zip, express) {
    const products = D.products || [];
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
    const rates = (S.delivery || {}).rates || {};
    let shipping = dz.rate == null ? rates.national : dz.rate;
    if (subtotal >= rates.freeOver) shipping = 0;
    if (express) shipping += rates.expressSurcharge;
    const tax = +(subtotal * 0.07).toFixed(2);
    return {
      lines, subtotal: +subtotal.toFixed(2), shipping: +shipping.toFixed(2), tax,
      total: +(subtotal + shipping + tax).toFixed(2),
      zone: dz.zone, eta: dz.eta
    };
  }

  function estimateQuote(q) {
    const pr = S.pricing || {};
    const vol = Math.max(0, parseFloat(q.volumeCm3) || 0);
    const density = { pla: 1.24, petg: 1.27, abs: 1.04, tpu: 1.21, resin: 1.15, nylon: 1.1 }[q.material] || 1.24;
    const infill = Math.min(100, Math.max(5, parseFloat(q.infill) || 20)) / 100;
    const effVol = vol * (0.25 + 0.75 * infill);
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
    return {
      grams: +grams.toFixed(1), unit: +unit.toFixed(2), total: +total.toFixed(2),
      printHours: +(effVol * 0.09 * qty).toFixed(1), leadDays: q.rush ? 1 : ((effVol * 0.09 * qty) > 24 ? 5 : 3)
    };
  }

  const nearestStats = days => {
    const keys = Object.keys(D.stats || {}).map(Number).sort((a, b) => a - b);
    const k = keys.reduce((best, x) => Math.abs(x - days) < Math.abs(best - days) ? x : best, keys[0]);
    return D.stats[k];
  };

  // ---------- router ----------
  async function route(pathname, method, body) {
    const seg = pathname.split('/').filter(Boolean); // ['api', ...]
    const p = '/' + seg.slice(1).join('/');

    if (p === '/content') return json(D.content);
    if (p.startsWith('/delivery/')) return json(deliveryZone(seg[2]));
    if (p === '/track') return json({ ok: true });
    if (p === '/cart/totals') return json(computeOrderTotals(body.items, body.zip, body.express));

    if (p === '/orders' && method === 'POST') {
      const totals = computeOrderTotals(body.items, (body.customer || {}).zip, body.express);
      if (!totals.lines.length) return json({ error: 'Cart is empty' }, 400);
      const c = body.customer || {};
      if (!c.name || !c.email) return json({ error: 'Name and email are required' }, 400);
      if (!c.address || !c.zip) return json({ error: 'Address and ZIP are required' }, 400);
      const order = {
        id: 'LZ-D' + Math.floor(100 + Math.random() * 900), ts: Date.now(), status: 'new',
        customer: c, method: 'delivery', express: !!body.express, totals, demo: true
      };
      saveOrder(order);
      return json({ ok: true, order });
    }

    if (p.startsWith('/orders/') && method === 'GET') {
      const id = decodeURIComponent(seg[2]).toUpperCase();
      const o = localOrders().find(x => x.id.toUpperCase() === id)
        || (D.orders || []).find(x => x.id.toUpperCase() === id);
      if (!o) return json({ error: 'Order not found' }, 404);
      return json({
        id: o.id, status: o.status, ts: o.ts, method: o.method, eta: o.totals.eta,
        total: o.totals.total, lines: o.totals.lines.map(l => ({ name: l.name, qty: l.qty }))
      });
    }

    if (p === '/quotes/estimate') return json(estimateQuote(body));
    if (p === '/quotes' && method === 'POST') {
      if (!body.name || !body.email) return json({ error: 'Name and email are required' }, 400);
      return json({
        ok: true, quote: { id: 'Q-D' + Math.floor(100 + Math.random() * 900), ts: Date.now(), estimate: estimateQuote(body), demo: true }
      });
    }
    if (p === '/messages' && method === 'POST') {
      if (!body.email || !body.message) return json({ error: 'Email and message required' }, 400);
      return json({ ok: true });
    }

    // ---------- admin ----------
    if (p === '/admin/me') return json({ admin: demoAdmin });
    if (p === '/admin/login') {
      if (String(body.password || '') !== 'layerzero') return json({ error: 'Wrong password' }, 401);
      setAdmin(true); return json({ ok: true });
    }
    if (p === '/admin/logout') { setAdmin(false); return json({ ok: true }); }

    if (p.startsWith('/admin/')) {
      if (!demoAdmin) return json({ error: 'Unauthorized' }, 401);
      if (method !== 'GET') return json({ error: READONLY }, 403);
      if (p.startsWith('/admin/stats/')) return json(nearestStats(parseInt(seg[3]) || 30));
      if (p === '/admin/events/recent') return json(D.events || []);
      if (p === '/admin/settings') return json(D.settings);
      const col = seg[2];
      if (p.startsWith('/admin/export/')) return json(D[seg[3]] || []);
      if (['showcase', 'products', 'reviews'].includes(col)) return json((D[col] || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0)));
      if (['orders', 'quotes', 'messages'].includes(col)) return json(D[col] || []);
      return json({ error: 'Unknown collection' }, 404);
    }

    return json({ error: 'No such endpoint' }, 404);
  }

  // ---------- install ----------
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const m = /(?:^|\/)api\/(.*)$/.exec(String(url).split('?')[0]);
    if (!m) return realFetch(input, init);
    const opts = init || {};
    let body = {};
    try { body = opts.body ? JSON.parse(opts.body) : {}; } catch (e) { }
    return route('/api/' + m[1], (opts.method || 'GET').toUpperCase(), body)
      .catch(err => json({ error: err.message }, 500));
  };

  // tracking beacons go nowhere in the static build
  if (navigator.sendBeacon) navigator.sendBeacon = function () { return true; };

  // banner so visitors know what they are looking at
  document.addEventListener('DOMContentLoaded', function () {
    if (/master/.test(location.pathname)) return;
    var b = document.createElement('div');
    b.className = 'demo-banner';
    b.innerHTML = '<span>STATIC DEMO · GITHUB PAGES</span><a href="https://github.com/skailais/layer-zero-3d-print-lab" target="_blank" rel="noopener">SOURCE &amp; FULL SERVER →</a>';
    document.body.appendChild(b);
  });
  var css = document.createElement('style');
  css.textContent = '.demo-banner{position:fixed;left:0;right:0;bottom:0;z-index:9700;display:flex;gap:18px;justify-content:center;align-items:center;flex-wrap:wrap;' +
    'padding:9px 16px;background:#e9e7e1;color:#0b0b0c;font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase}' +
    '.demo-banner a{color:#c8102e;text-decoration:none;font-weight:500}.demo-banner a:hover{text-decoration:underline}' +
    '@media(max-width:600px){.demo-banner{font-size:9px;gap:10px;padding:8px 12px}}';
  document.head.appendChild(css);
})();

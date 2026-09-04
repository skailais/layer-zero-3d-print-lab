/**
 * Generates 30 days of plausible traffic, orders, quotes and messages so the
 * Master dashboard demonstrates real trends. Safe to re-run: it replaces the
 * orders/quotes/events/messages files only.
 *   node tools/seed-demo.js          (seed)
 *   node tools/seed-demo.js --clear  (wipe back to empty)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const DATA = path.join(__dirname, '..', 'data');
const read = n => JSON.parse(fs.readFileSync(path.join(DATA, n + '.json'), 'utf8'));
const write = (n, v) => fs.writeFileSync(path.join(DATA, n + '.json'), JSON.stringify(v, null, 2));

if (process.argv.includes('--clear')) {
  ['orders', 'quotes', 'events', 'messages'].forEach(n => write(n, []));
  console.log('Cleared orders, quotes, events, messages.');
  process.exit(0);
}

let seed = 20260904;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const id = () => Date.now().toString(36) + Math.floor(rnd() * 1e6).toString(36);

const products = read('products');
const DAYS = 30;
const DAY = 864e5;
const now = Date.now();

const FIRST = ['Marcus', 'Dana', 'Kevin', 'Priya', 'Luis', 'Sam', 'Alicia', 'Tom', 'Renee', 'Jorge', 'Nina', 'Wes', 'Ivy', 'Carl', 'Maya', 'Owen', 'Bianca', 'Ray', 'Tessa', 'Hugo'];
const LAST = ['T.', 'R.', 'O.', 'S.', 'F.', 'M.', 'K.', 'B.', 'D.', 'L.', 'G.', 'V.', 'W.', 'P.', 'C.'];
const PLACES = [
  ['Margate', '33063', 'pickup'], ['Coconut Creek', '33073', 'local'], ['Coral Springs', '33065', 'local'],
  ['Fort Lauderdale', '33301', 'local'], ['Miami', '33131', 'local'], ['Boca Raton', '33432', 'local'],
  ['Orlando', '32801', 'florida'], ['Tampa', '33602', 'florida'], ['Jacksonville', '32202', 'florida'],
  ['Atlanta', '30301', 'national'], ['Austin', '78701', 'national'], ['Denver', '80202', 'national'],
  ['Brooklyn', '11201', 'national'], ['Seattle', '98101', 'national']
];
const REFS = ['https://www.google.com/', 'https://www.google.com/', 'https://www.google.com/', 'https://www.instagram.com/', 'https://www.reddit.com/', 'https://www.facebook.com/', 'https://maps.google.com/', ''];
const PAGES = ['/', '/', '/', '/store', '/store', '/showcase', '/quote'];
const CLICKS = ['hero:quote', 'hero:store', 'nav:cart', 'svc:custom', 'svc:design', 'svc:batch', 'home:store-all', 'home:showcase-all', 'delivery:zip-check', 'store:add:Cable Comb Set', 'store:details:Hex Planter — 120', 'showcase:quote-cta', 'cart:checkout', 'contact:send'];
const MATERIALS = ['pla', 'petg', 'abs', 'tpu', 'nylon', 'resin'];
const NOTES = [
  'Replacement bracket for a boat hatch, needs to survive sun and salt water.',
  'Prototype housing for a sensor board, 3 iterations expected.',
  'Cosplay helmet in two halves, will sand and paint myself.',
  'Broken dishwasher rail clip, I can bring the original in.',
  'Architectural site model for a client presentation on the 20th.',
  'Batch of 60 cable clips for an install job.',
  'Miniature figures for a tabletop campaign, finest detail you have.',
  'Custom drone arm, must be stiff and light.'
];
const MESSAGES = [
  'Do you print carbon fiber nylon? Need a stiff bracket for a drone build.',
  'What is the largest single piece you can print without splitting it?',
  'Can I walk in on Saturday with a broken part and get a quote on the spot?',
  'Do you offer bulk pricing for 200+ units of a small clip?',
  'Is the resin you use food safe? Making a cookie stamp.',
  'How long does a 300mm architectural model usually take?'
];

const events = [];
const orders = [];
const quotes = [];
const messages = [];
let orderNo = 1000, quoteNo = 500;

const ev = (ts, type, page, label, value, sid, ref, device) => events.push({
  id: id(), ts: Math.round(ts), type, page, label: label || '', value, sid, ref: ref || '', device
});

for (let d = DAYS - 1; d >= 0; d--) {
  const dayStart = now - d * DAY;
  const dow = new Date(dayStart).getDay();
  const weekend = dow === 0 || dow === 6;
  // gentle upward trend + weekly rhythm + noise
  const trend = 1 + (DAYS - d) / DAYS * 0.55;
  const sessions = Math.max(4, Math.round((weekend ? 9 : 17) * trend * (0.72 + rnd() * 0.6)));

  for (let s = 0; s < sessions; s++) {
    const sid = 'v' + d + '-' + s + '-' + Math.floor(rnd() * 9999).toString(36);
    const device = rnd() < 0.46 ? 'mobile' : 'desktop';
    const ref = pick(REFS);
    let t = dayStart + int(8, 22) * 3600e3 + int(0, 59) * 60e3;

    // landing
    let page = pick(PAGES);
    ev(t, 'pageview', page, '', undefined, sid, ref, device);

    // browse depth
    const depth = int(1, 4);
    for (let k = 0; k < depth; k++) {
      t += int(20, 240) * 1000;
      if (rnd() < 0.65) ev(t, 'click', page, pick(CLICKS), undefined, sid, '', device);
      page = pick(PAGES);
      ev(t + 2000, 'pageview', page, '', undefined, sid, '', device);
    }

    // zip check on home / delivery interest
    if (rnd() < 0.22) { t += 15000; ev(t, 'zip_check', '/', pick(['pickup', 'local', 'florida', 'national']), undefined, sid, '', device); }

    // store funnel
    if (rnd() < 0.42) {
      const p = pick(products);
      t += int(10, 90) * 1000;
      ev(t, 'product_view', '/store', p.name, p.price, sid, '', device);
      if (rnd() < 0.38) {
        t += int(10, 60) * 1000;
        ev(t, 'add_to_cart', '/store', p.name, p.price, sid, '', device);
        if (rnd() < 0.55) {
          t += int(20, 120) * 1000;
          ev(t, 'checkout_start', '/store', 'store', p.price, sid, '', device);
          if (rnd() < 0.5) {
            // real order
            const [city, zip, zone] = pick(PLACES);
            const method = zone === 'pickup' && rnd() < 0.7 ? 'pickup' : 'delivery';
            const express = method !== 'pickup' && rnd() < 0.16;
            const lines = [];
            const n = rnd() < 0.68 ? 1 : 2;
            for (let i = 0; i < n; i++) {
              const pr = pick(products);
              const variant = pr.variants && pr.variants.length ? pick(pr.variants) : null;
              const qty = rnd() < 0.8 ? 1 : int(2, 4);
              lines.push({ id: pr.id, name: pr.name, variant: variant ? variant.name : null, price: +(pr.price + (variant ? variant.delta || 0 : 0)).toFixed(2), qty, image: pr.image });
            }
            const subtotal = +lines.reduce((s, l) => s + l.price * l.qty, 0).toFixed(2);
            const rates = { pickup: 0, local: 9, florida: 14, national: 22 };
            let shipping = method === 'pickup' ? 0 : rates[zone] || 22;
            if (subtotal >= 150 && method !== 'pickup') shipping = 0;
            if (express) shipping += 25;
            const tax = +(subtotal * 0.07).toFixed(2);
            const eta = { pickup: 'Pickup when ready', local: 'Next business day', florida: '2–3 business days', national: '4–6 business days' }[method === 'pickup' ? 'pickup' : zone];
            const age = d;
            const status = age > 8 ? (rnd() < 0.9 ? 'delivered' : 'cancelled')
              : age > 5 ? (method === 'pickup' ? 'delivered' : 'shipped')
                : age > 3 ? 'ready' : age > 1 ? 'printing' : 'new';
            const first = pick(FIRST);
            t += int(60, 300) * 1000;
            const order = {
              id: 'LZ-' + (++orderNo), ts: Math.round(t), status,
              customer: {
                name: first + ' ' + pick(LAST), email: first.toLowerCase() + int(10, 99) + '@example.com',
                phone: '(954) 555-0' + int(100, 199), address: int(100, 4800) + ' ' + pick(['NW 8th St', 'Palm Ave', 'Coral Way', 'Ocean Dr', 'Sample Rd', 'Atlantic Blvd']),
                city, zip, notes: rnd() < 0.25 ? pick(['Gift wrap if possible.', 'Leave with the front desk.', 'Call on arrival.']) : ''
              },
              method, express,
              totals: { lines, subtotal, shipping: +shipping.toFixed(2), tax, total: +(subtotal + shipping + tax).toFixed(2), zone: method === 'pickup' ? 'pickup' : zone, eta },
              sid
            };
            orders.push(order);
            ev(t, 'purchase', '/store', order.id, order.totals.total, sid, '', device);
          }
        }
      }
    }

    // quote funnel
    if (rnd() < 0.14) {
      t += int(60, 400) * 1000;
      const material = pick(MATERIALS);
      const vol = +(int(8, 320) + rnd()).toFixed(1);
      const qty = rnd() < 0.7 ? int(1, 3) : int(8, 60);
      const infill = pick([15, 20, 25, 30, 40, 60]);
      const rush = rnd() < 0.18;
      const density = { pla: 1.24, petg: 1.27, abs: 1.04, tpu: 1.21, resin: 1.15, nylon: 1.1 }[material];
      const perGram = { pla: 0.08, petg: 0.10, abs: 0.11, tpu: 0.14, resin: 0.22, nylon: 0.18 }[material];
      const effVol = vol * (0.25 + 0.75 * infill / 100);
      const grams = effVol * density;
      let unit = grams * perGram + 5;
      const finish = pick(['raw', 'raw', 'sanded', 'painted']);
      if (finish === 'sanded') unit *= 1.25; if (finish === 'painted') unit *= 1.6;
      let total = unit * qty;
      if (qty >= 10) total *= 0.88;
      if (rush) total *= 1.6;
      total = Math.max(15, total);
      const first = pick(FIRST);
      const [, zip] = pick(PLACES);
      const age = d;
      quotes.push({
        id: 'Q-' + (++quoteNo), ts: Math.round(t),
        status: age > 10 ? pick(['done', 'done', 'declined']) : age > 6 ? pick(['accepted', 'printing']) : age > 2 ? 'quoted' : 'new',
        name: first + ' ' + pick(LAST), email: first.toLowerCase() + int(10, 99) + '@example.com',
        phone: '(954) 555-0' + int(200, 299), zip, material, infill, qty, finish, rush,
        volumeCm3: vol, dims: `${int(20, 180)} × ${int(20, 180)} × ${int(15, 200)} mm`, notes: pick(NOTES), file: null,
        estimate: { grams: +grams.toFixed(1), unit: +unit.toFixed(2), total: +total.toFixed(2), printHours: +(effVol * 0.09 * qty).toFixed(1), leadDays: rush ? 1 : 3 },
        sid
      });
      ev(t, 'quote', '/quote', material, +total.toFixed(2), sid, '', device);
    }

    // contact message
    if (rnd() < 0.035) {
      t += int(60, 300) * 1000;
      const first = pick(FIRST);
      messages.push({ id: id(), ts: Math.round(t), name: first + ' ' + pick(LAST), email: first.toLowerCase() + int(10, 99) + '@example.com', message: pick(MESSAGES), read: d > 4 });
      ev(t, 'contact', '/', 'message', undefined, sid, '', device);
    }

    // order tracking lookups
    if (rnd() < 0.05 && orders.length) { t += 30000; ev(t, 'track_lookup', '/store', pick(orders).id, undefined, sid, '', device); }
  }
}

events.sort((a, b) => a.ts - b.ts);
orders.sort((a, b) => a.ts - b.ts);
quotes.sort((a, b) => a.ts - b.ts);
messages.sort((a, b) => a.ts - b.ts);
orders.forEach((o, i) => o.id = 'LZ-' + (1001 + i));
quotes.forEach((q, i) => q.id = 'Q-' + (501 + i));

write('events', events);
write('orders', orders);
write('quotes', quotes);
write('messages', messages);

const rev = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.totals.total, 0);
console.log(`Seeded ${DAYS} days:`);
console.log(`  events   ${events.length}`);
console.log(`  orders   ${orders.length}  (revenue $${rev.toFixed(2)})`);
console.log(`  quotes   ${quotes.length}`);
console.log(`  messages ${messages.length}`);
console.log('Restart the server so it reloads the data cache.');

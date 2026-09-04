# LAYER ZERO — 3D Print Lab

A complete website for a local 3D printing service in **Margate, Florida**: marketing site,
showcase, store with checkout and delivery pricing, instant STL quoting, and a
password-protected **Master** panel for running the business.

Runs on plain Node.js with **zero npm dependencies**. Data lives in JSON files under `data/`.

---

## Live demo

**https://skailais.github.io/layer-zero-3d-print-lab/**

GitHub Pages serves static files only, so the demo runs without the Node backend: the
content, pricing, delivery zones and STL measuring all work in the browser, and the Master
panel opens read-only with `layerzero` so you can look around the dashboard. Placing an
order or editing content there is simulated. For the real thing, run the server below.

---

## Run it

```
cd "C:\Website project"
node server.js
```

Then open:

| What | Where |
|---|---|
| Public site | http://localhost:3000 |
| Master panel | http://localhost:3000/master |

On Windows you can also double-click **`start.bat`**, which starts the server and opens the browser.

**Default admin password: `layerzero`** — change it in Master → Settings → Admin password.
It is set once on first run and stored as a salted scrypt hash in `data/settings.json`.

---

## Pages

**Home (`/`)** — animated wireframe hero rendered on canvas, services, four-step process,
material comparison table, showcase strip, delivery zones with a live ZIP checker and service-radius
map, stats, reviews, featured products, contact form.

**Showcase (`/showcase`)** — filterable grid of past work. Click a piece for a spec sheet:
material, process, dimensions, print time, tags.

**Store (`/store`)** — catalog with variants and stock, product detail modal, cart drawer,
checkout with live delivery pricing, and order tracking by order number.

**Quote (`/quote`)** — drop an STL and the browser measures it: volume, bounding box, triangle
count, plus a rotating wireframe preview. Price updates live as material, infill, quantity,
finish and rush change. Submitting stores the request and uploads the file for the lab.

**Master (`/master`)** — admin only. See below.

---

## Delivery model

The facility is in Margate, so everything is priced from the customer's ZIP code.

| Zone | Who | Rate | ETA |
|---|---|---|---|
| Pickup | Margate ZIPs (33063, 33068, 33093) | Free | Same day when ready |
| Local courier | Broward, Miami-Dade, Palm Beach (ZIP 330–334) | $9 | Next business day |
| Florida | Rest of the state | $14 | 2–3 business days |
| Nationwide | All 50 states | $22 | 4–6 business days |

Free shipping over $150. Express adds $25 and a priority print slot. Tax is Broward's 7%.
Every rate, ZIP list and threshold is editable in Master → Settings — no code changes.

---

## Master panel

Sign in at `/master`. Twelve-hour session, HTTP-only cookie.

**Overview** — sessions, orders, revenue, conversion rate, quotes and add-to-cart across
7/30/90/365 days. Traffic and revenue charts with hover readouts. Conversion funnel
(visits → store → product → cart → checkout → order, counted in unique sessions).
Top clicks, top pages, orders by zone and status, top products, devices and referrers.

**Orders** — every order with customer, items, fulfilment, totals. Change status inline
(new → printing → ready → shipped → delivered) and attach internal notes. Filter by status,
export JSON.

**Quotes** — incoming quote requests with the customer's spec, the auto estimate, and the
uploaded file. Set a status and a final price.

**Messages** — contact form inbox with read/unread.

**Showcase / Store / Reviews** — add, edit, delete and reorder items by dragging the ≡ handle.
Toggle the switch to hide something from the site without deleting it. Images can be dropped
straight into the editor or referenced by URL. Products carry variants with price deltas,
stock and lead time. Everything goes live immediately.

**Live activity** — the raw event log, newest first. Export or clear it.

**Settings** — business details, delivery rates and ZIP zones, per-gram quote pricing,
and the admin password.

---

## Analytics

`public/js/core.js` sends events to `POST /api/track` using `navigator.sendBeacon`.
Tracked: page views, clicks on anything with a `data-track` attribute, product views,
add-to-cart, checkout start, purchases, quote submissions, ZIP checks, file uploads,
order lookups and contact messages. Each browser gets an anonymous session id in
`localStorage`. No third-party scripts, no cookies for visitors, nothing leaves the machine.

The log is capped at 50,000 events and trims oldest-first.

---

## Layout

```
server.js            HTTP server, JSON API, admin auth, analytics  (no dependencies)
data-seed.js         initial showcase / products / reviews content
start.bat            Windows launcher
data/                JSON store — settings, showcase, products, reviews,
                     orders, quotes, events, messages
public/
  index.html  showcase.html  store.html  quote.html  master.html  404.html
  css/   main.css (design system)  home.css  pages.css  admin.css
  js/    core.js (chrome, motion, cart, tracking)  home.js  showcase.js
         store.js  quote.js  admin.js
  assets/          generated SVG artwork for the seed items
  uploads/         admin image uploads and customer STL files
tools/
  gen-assets.js    regenerates the SVG artwork
  seed-demo.js     fills 30 days of demo traffic, orders and quotes
  smoke.js         end-to-end API test
  shot.js          headless screenshot helper
  probe.js         reports computed layout/visibility for selectors
  build-static.js  builds the GitHub Pages demo into docs/
  static-api.js    fetch shim that backs the static demo
  serve-docs.js    local preview of the Pages build
docs/                the built static demo served by GitHub Pages
```

---

## Useful commands

```
node server.js               start the site
node tools/smoke.js          run the API test suite (server must be running)
node tools/seed-demo.js      fill the dashboard with 30 days of demo data
node tools/seed-demo.js --clear   wipe orders, quotes, events and messages
node tools/gen-assets.js     regenerate the SVG artwork
node tools/build-static.js   rebuild docs/ for GitHub Pages (server must be running)
node tools/serve-docs.js     preview docs/ on a sub-path like Pages serves it
```

Restart the server after seeding — it caches the JSON files in memory.

To start completely fresh, stop the server and delete `data/`. It rebuilds on next launch
with the seed content and a fresh `layerzero` password.

---

## Design

Dark technical poster style: near-black ground (`#0b0b0c`), bone ink (`#e9e7e1`),
signal red accent (`#c8102e`). Anton for display, Inter Tight for body, JetBrains Mono for
the HUD captions. Film grain, blueprint grid, corner brackets, crosshairs and coordinate
readouts throughout.

Motion: a counting preloader, a wipe between pages, a custom cursor that grows over
interactive elements, word-by-word heading reveals, scroll-triggered fades, magnetic buttons,
animated counters, marquees, and canvas-rendered wireframe geometry on the home hero and in
the quote preview. Everything respects `prefers-reduced-motion`.

Add `?static` to any URL to freeze animations, `?nopl` to skip the preloader — both are used
by the screenshot tool.

---

## Before going live

This is a local build. To put it on the internet:

1. Change the admin password.
2. Put it behind HTTPS (a reverse proxy such as Caddy or nginx) and add the `Secure` flag
   to the admin cookie in `server.js`.
3. Wire real payment. Checkout currently records the order and collects no money —
   `POST /api/orders` in `server.js` is where a Stripe or PayPal session would be created.
4. Connect email so orders, quotes and messages notify the lab.
5. Replace the placeholder business details and the generated artwork with real photos.
6. Back up `data/` — it is the entire database.

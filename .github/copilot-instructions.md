# Copilot instructions for LAYER ZERO — 3D Print Lab

## Project overview

This repository is a zero-dependency Node.js storefront and admin app for a local 3D printing service. The app is intentionally "single-server" and static-first: `server.js` serves the public site, the Master panel, and the JSON API; `public/` contains the front-end pages and client-side scripts; `data/` is the app's JSON-backed datastore; `tools/` holds admin utilities, generators, and smoke tests.

The core business behavior lives in `server.js`: pricing, delivery zones, quote estimation, admin auth, order processing, analytics, and the API routes. The site is not a framework app; it uses plain HTTP + file-based storage and browser JS.

## Build, test, and validation commands

There are no formal lint or test scripts in `package.json` beyond the app entrypoints.

- Start the app:
  - `npm start`
  - or `node server.js`
- Run the full smoke/behavior validation against a running server:
  - `node tools/smoke.js`
- Regenerate static art assets:
  - `node tools/gen-assets.js`
- Rebuild the GitHub Pages demo in `docs/`:
  - `node tools/build-static.js` (requires the server to be running)
- Seed demo traffic/orders/quotes:
  - `node tools/seed-demo.js`
  - `node tools/seed-demo.js --clear` to wipe demo data
- Preview the static Pages build locally:
  - `node tools/serve-docs.js`

For one-off checks, prefer the targeted smoke coverage in `tools/smoke.js` instead of trying to run the entire app suite; there is no separate unit-test runner.

## High-level architecture

- `server.js`
  - Central HTTP server and request router
  - JSON store wrapper that reads/writes `data/*.json` files with in-memory caching
  - Admin authentication and session handling
  - Business rules for delivery, tax, order totals, quote estimates, and analytics
  - API endpoints for content, cart totals, orders, quotes, messages, uploads, and admin actions

- `public/`
  - Static pages (`index.html`, `showcase.html`, `store.html`, `quote.html`, `master.html`, `404.html`)
  - CSS and JS for the storefront and admin experience
  - Browser-side logic for cart, delivery calculation, quote previews, tracking, and Master panel editing

- `data/`
  - The app's persistent database: settings, showcase items, products, reviews, orders, quotes, events, and messages
  - Initial seed content comes from `data-seed.js`; if the data folder is deleted the server will rebuild it on next launch

- `tools/`
  - `smoke.js`: end-to-end validation script for order flow, quote flow, admin auth, and content updates
  - `seed-demo.js`: generates demo data for dashboard analytics
  - `gen-assets.js`: regenerates SVG artwork used by the showcase/store content
  - `build-static.js` and `serve-docs.js`: GitHub Pages compatibility utilities

- `docs/`
  - Generated static site used for the GitHub Pages demo; not the source of truth for app behavior

## Key conventions in this repo

- Zero dependencies and no framework abstraction. Keep changes in plain Node.js and browser JS unless the repository explicitly adds tooling.
- `data/*.json` is effectively the database. Prefer updating persisted JSON through the existing server routes and helper logic instead of introducing a new persistence layer.
- The app caches JSON files in memory at startup; if you change the seed data or JSON store, restart the server to reload the in-memory cache.
- Delivery and pricing rules are intentionally configured in the admin settings and are centered in `server.js` (`DEFAULT_SETTINGS`, `deliveryZone()`, `computeOrderTotals()`, `estimateQuote()`). If a price or delivery rule changes, adjust both runtime logic and the admin settings UI wording/behavior together.
- Admin auth uses an HTTP-only cookie named `lz_admin` with a 12-hour session. Any route or UI change affecting admin access should preserve the stored scrypt hash flow in `server.js`.
- Analytics are browser-sent to `/api/track` via `navigator.sendBeacon`, then stored as event records. If you add a new tracked event, keep it consistent with the existing event types and summary logic in `analyticsSummary()`.
- Uploaded files are stored under `public/uploads/` and are served directly by the app; keep file handling and validation aligned with the existing upload route.
- `README.md` is the primary source of domain behavior and deployment notes. When changing product flow, pricing, or deployment assumptions, update the documentation that explains it.

## Working style for future Copilot sessions

- Prefer surgical edits in the existing plain-Node style rather than introducing frameworks, TypeScript, or a separate app structure.
- If a change affects the public storefront or admin panel, inspect both the route logic in `server.js` and the relevant front-end file in `public/js/` before editing.
- If a change affects the persisted data model, check the seed data and the default settings in `server.js`/`data-seed.js` to keep behavior consistent.
- Treat `tools/smoke.js` as the repo's default regression check for business logic; use it to validate changes to orders, quote estimation, admin access, and delivery totals.

## Repository-specific notes

- The default admin password is initialized to `layerzero` on first run and stored as a salted scrypt hash in `data/settings.json`.
- The public demo site is served from `docs/` for GitHub Pages, but the real application runs from `server.js` and `data/` on a Node server.
- The project explicitly targets a local-service business workflow rather than a generic commerce app; keep changes aligned with the Margate, Florida printing-service domain and admin dashboard features described in `README.md`.

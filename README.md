# Counter

A modern, multi-tenant digital storefront platform for **restaurants and retail shops** (proof of concept).

Owners manage branded storefronts, catalogs (menus or products), reusable item libraries, modifiers, bundles, schedules, QR codes, loyalty, coupons, stock, orders, displays, and analytics. Customers browse on mobile, customize items, check out with **simulated payment**, and track order progress.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Demo credentials

- **Email:** `owner@thecornertable.demo`
- **Password:** `demo1234`
- **Restaurant demo:** [/r/the-corner-table](http://localhost:5173/r/the-corner-table)
- **Retail demo:** [/r/haven-and-hide](http://localhost:5173/r/haven-and-hide)

Reset demo data anytime from **Dashboard → Settings**.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite development server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview production build |
| `npm run typecheck` | TypeScript project build check |
| `npm run lint` | Oxlint |

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS 4
- React Router
- Zustand (auth, bag, restaurant, preview)
- Recharts, dnd-kit, qrcode.react, Lucide

## Architecture

- **Customer storefront** — `/r/:slug` (home), `/r/:slug/shop` (catalog), checkout, order tracker
- **Owner dashboard** — catalogs, items, modifiers, combos/bundles, branding, pages, QR, scheduling, loyalty, coupons, stock, displays, orders, analytics
- **Persistence** — `PersistenceAdapter` interface; default `localStorage` implementation (Netlify-friendly; swap for Blobs/Postgres later)
- **Auth** — session tokens + Web Crypto password hashing (POC). Replace with Netlify Identity / Clerk / Auth0 for production
- **Pricing** — order totals recalculated in `orderService` (never trust client totals)
- **Orders** — historical line-item snapshots; status changes persisted

See [PROJECT_STATUS.md](./PROJECT_STATUS.md) for phase completion and known issues.

## Environment variables

No required env vars for the local POC. Future production adapters may use:

| Variable | Purpose |
| --- | --- |
| `NETLIFY_BLOBS_*` | Blob store credentials (when adapter is added) |
| Auth provider keys | When swapping `authService` |

## Deploy (Netlify)

`netlify.toml` builds with `npm run build`, publishes `dist`, and SPA-redirects to `index.html`.

## Simulated payments

Checkout collects card-like fields for demo UX only. No payment processor is called; orders are marked `payment.method: "simulated"` with an explicit customer-facing message.

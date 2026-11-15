# MenuShop — Project Status

**Current phase:** Phase 9 (Polish) — proof-of-concept complete  
**Last updated:** 2026-11-14

## Completed features

### Phase 1 — Foundation
- [x] Vite + React + TypeScript + Tailwind CSS
- [x] Global layouts (marketing, dashboard, storefront)
- [x] Auth: sign up, sign in, sign out, forgot/reset password, profile
- [x] Multi-restaurant accounts with membership roles in the data model
- [x] Restaurant creation + switcher
- [x] Persistence adapter (localStorage) with replaceable interface
- [x] Seeded demo restaurant: **The Corner Table**

### Phase 2 — Menu management
- [x] Multiple menus per restaurant
- [x] Sections with drag-and-drop reorder (dnd-kit)
- [x] Central item library (items assigned, not duplicated)
- [x] Modifier groups + options; reusable across items
- [x] Combo builder referencing library items

### Phase 3 — Customer storefront
- [x] Public routes `/r/:slug` and `/r/:slug/menu/:menuSlug`
- [x] Branding-driven storefront shell
- [x] Menu browsing, search, dietary filters
- [x] Item detail / customizer with live price
- [x] Persistent shopping bag (local)
- [x] Mobile-first bag drawer

### Phase 4 — Combos & checkout
- [x] Combo component selection + upgrades
- [x] Pickup / delivery checkout
- [x] Simulated payment (no real charges)
- [x] Server-side (service-layer) price recalculation
- [x] Order confirmation → tracker

### Phase 5 — Order management
- [x] Dashboard order board by status
- [x] Order detail, accept/advance/cancel, internal notes
- [x] Customer order tracker with persisted status history
- [x] Simulated notifications for new orders

### Phase 6 — Scheduling & preview
- [x] Business hours + accepting-orders controls
- [x] Per-menu availability schedules
- [x] Overlap behavior setting
- [x] Live preview with simulated day/time + device mode

### Phase 7 — Branding & QR
- [x] Full theme customization + live preview
- [x] QR creation, styling, PNG/SVG export
- [x] Dynamic menu/restaurant links with scan tracking

### Phase 8 — Analytics
- [x] Metrics from real seeded + live orders/events
- [x] Popular items, pickup/delivery, volume chart
- [x] QR scan analytics, modifier frequency, conversion
- [x] Date presets

### Phase 9 — Polish
- [x] Loading / empty / error states on primary flows
- [x] Demo reset in Settings
- [x] README + environment documentation
- [x] Netlify SPA redirect config
- [x] Accessibility basics (labels, focus, reduced motion)

## Demo access

| Surface | URL / credentials |
| --- | --- |
| Landing | `/` |
| Demo storefront | `/r/the-corner-table` |
| Dashboard login | `owner@thecornertable.demo` / `demo1234` |
| Sample tracker | open any order’s “customer tracker” link from Orders |

## Outstanding / future

- Real payment processor (Stripe, etc.)
- Real SMS/email notifications
- Netlify Blobs / Postgres production adapters (interfaces ready)
- Kitchen display system
- Multi-location brand hierarchy
- Public customer accounts / favorites
- Automated demo status auto-advance intervals (manual advance works)
- Deeper WCAG audit and image optimization pipeline

## Known issues

- Auth uses Web Crypto SHA-256 + salt (POC). Swap `authService` for Netlify Identity / Clerk / Auth0 for production.
- Images use remote Unsplash URLs (demo). Upload-to-blob not wired yet; URL fields are supported.
- Analytics “unique visits” are session-id based in localStorage, not cross-device.
- Concurrent multi-tab writes use last-write-wins on localStorage (expected until transactional DB).

## Architecture snapshot

```
src/
  types/           Domain entities
  data/            Persistence + demo seed
  services/        Business logic & authorization
  stores/          Zustand (auth, restaurant, bag, preview)
  pages/           Marketing, auth, dashboard, storefront
  components/      UI + storefront + layout
  lib/             Pricing, scheduling, branding, crypto
```

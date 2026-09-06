# DealFlow360 — Autonomous Deal Optimization Platform

A full-stack MERN **B2B Sales Operations** platform whose hero feature is a **Profit-Aware Multi-Dealer Negotiation Engine**. Instead of finding the cheapest price, it searches for the deal that is **best and mutually profitable** — maximizing *Customer value × Dealer profit × Company (DealFlow360) margin* — while gate-keeping risk with autonomous approvals, What-If simulation, warehouse fulfillment and hybrid (one-time + subscription) billing.

## Differentiator in one line

> The negotiation engine never accepts a price that pushes a dealer below minimum profit, the company below minimum margin, or a discount beyond policy — it returns `AUTO_ACCEPT`, a `COUNTER_OFFER` (with value-add concessions), `ESCALATE`, or `REJECT` accordingly, backed by a live per-dealer scorecard.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Vite + React 18 + Tailwind + Zustand + React Router + Recharts + Lucide |
| Backend | Express + Mongoose (ESM), JWT auth |
| Database | MongoDB (local; DB name `dealflow360`) |
| Demo | Rep console on **:5174**, Customer portal at `/portal`, API on **:5001** |

Port **5001** is used because macOS `ControlCenter` occupies :5000. `client/vite.config.js` proxies `/api` → `http://localhost:5001`, and the server CORS whitelists `http://localhost:5174`.

---

## Quick start

```bash
# 1. start MongoDB (brew services start mongodb-community)
# 2. install everything
npm run setup

# 3. seed demo data (users, customers, products, dealers, offers,
#    warehouses, inventory, subscriptions, concessions, hero quote)
cp server/.env.example server/.env
npm run seed

# 4. run both servers (API on 5001, UI on 5174)
npm run dev
```

Then open:
- **Internal console** → http://localhost:5174
- **Customer portal** → http://localhost:5174/portal

> Current `server/.env` already configures `PORT=5001` and `CLIENT_URL=http://localhost:5174`.

---

## Demo accounts

### Internal console (click-to-fill on the sign-in screen)

| Role | Email | Password |
|---|---|---|
| Sales Rep | `rep@dealflow360.com` | `Rep@123` |
| Sales Manager | `manager@dealflow360.com` | `Manager@123` |
| Finance | `finance@dealflow360.com` | `Finance@123` |
| Admin | `admin@dealflow360.com` | `Admin@123` |

### Customer portal

| Company | Email | Password |
|---|---|---|
| Acme Corp (Gold) | `acme@acme.com` | `Acme@123` |
| Beta Industries (Silver) | `beta@beta.com` | `Beta@123` |
| Nova Labs (Platinum) | `nova@nova.com` | `Nova@123` |
| Zenith Pharma (Bronze) | `zenith@zenith.com` | `Zenith@123` |

---

## The 10-minute hero demo

1. **Login as Sales Rep** (`rep@dealflow360.com` / `Rep@123`).
2. **Dashboard** shows pipeline value ~₹29L, one at-risk deal, recent negotiation rounds.
3. Open **Quotations** → the **Acme hero quote** (20 × Business Laptop, subtotal ₹10,00,000, total ₹11,80,000 incl. GST, stage = Negotiation).
4. **Dealer comparison** — see Global Devices ⭐ recommended (weighted score, not just cheapest; TechSource is ₹500 cheaper but loses on reliability/delivery/inventory).
5. **What-If Simulator** → apply **20%** discount → risk 115.7, chain Manager → Finance, and the engine suggests a preservation play.
6. **Negotiation panel** → request **₹9,00,000**. Engine returns `COUNTER_OFFER` **₹9,20,000 + Free Installation + Priority Delivery** — customer saves ₹80,000, dealer profits ₹70,000, company profits ₹120,000, decision is *mutually* optimal.
7. **Customer portal** (`acme@acme.com` / `Acme@123`) → open the quote → **Accept this offer** → order confirmed.
8. Back in the console: **Fulfillment planner** splits 20 laptops as **Main Warehouse 15 + East Depot 5**, zero backorder.
9. **Billing preview** → ONE_TIME invoice `INV-…` with line-level margins.
10. Admin (**Policies & Settings**) → tweak the Gold ceiling or approval thresholds → engine re-evaluates immediately.

### Approval-chain demo

Beta quote (12% on a Silver tier) triggers risk 55.5 → **Sales Manager → Finance**.
- Log in as **manager** → accept → chain escalates to **Finance**.
- Log in as **finance** → accept → quote Approved, rep notified. Rejecting at any step halts the chain (verified via `/tmp/df360_appr.py`).

---

## How the engine really works

### Negotiation money flow (per unit)

```
listUnitPrice ──► customer reference price
unitPrice      ──► final customer price (negotiated)
sellingPrice   ──► what DealFlow360 pays the dealer   (company cost)
dealerCost     ──► dealer's own cost
dealerProfit   =   sellingPrice − dealerCost
dealerFloor    =   max(offer.minimumAcceptablePrice,
                       sellingPrice × (1 + minCompanyMarginPct%),
                       listUnitPrice × (1 − effectiveDiscountLimit%))
```

Every accepted price must satisfy `customer price ≥ dealerFloor` so dealer, company and discount policy all stay profitable **at once**. All negotiation math runs on the **pre-tax subtotal** (GST shown separately) so "₹10L quote vs ₹9L request" compares exactly.

### Decision rules

| Decision | When |
|---|---|
| `AUTO_ACCEPT` | Request keeps all dealers above min profit + company above min margin + inside policy |
| `COUNTER_OFFER` | Request violates a floor; engine returns the lowest mutually-profitable price + optimized concessions (best value/cost ratio) |
| `ESCALATE` | Requested discount exceeds the authorized ceiling (approval chain takes over) |
| `REJECT` | No profitable configuration exists at or below the original quote |

### Risk & approvals

- Risk = per-line discount overage × 8, blended with historical overshoot, margin health and dealer-floor violations (`riskService`).
- Routing is derived **only** from risk: `≤ autoMax` → auto-approve · `≤ managerMax` → Sales Manager · `>` → Sales Manager → Finance. Approvers are not cherry-pickable; every step is audited.
- What-If simulates on a sandboxed clone (`save:false`), so nothing persists.

---

## Project structure

```
package.json            # concurrently: dev/seed/setup
server/
  src/
    models/             # User, Customer (bcrypt), Product, Dealer, DealerOffer,
                        # Warehouse, Inventory, Quotation, Approval, Negotiation,
                        # Subscription, Concession, Notification, AuditLog, Settings
    services/           # pricing, risk, dealer, negotiation (HERO), approval,
                        # recommendation, fulfillment, billing, dealHealth,
                        # audit, notification, dashboard
    controllers/        # auth, admin, settings, quote, customer (portal),
                        # negotiation, dashboard, report, notification
    routes/             # auth, admin, quote, customer  (customer mounted BEFORE quote
                        # routes to avoid /api/customer path capture)
    seed/seed.js        # full world incl. hero quote + pre-seeded counter-offer round
client/
  src/
    layouts/            # AppLayout (internal sidebar) + PortalLayout (customer)
    pages/              # Dashboard, Quotes/Pipeline, Quote Builder, Quote Detail
                        # (dealers + what-if + approvals + negotiation + fulfillment
                        #  + billing modals), Approval Center, Negotiation Center,
                        # Fulfillment, Billing, Reports, Deal Health, Dealer Intel,
                        # Admin CRUD, Login/Signup
    pages/portal/       # customer login, dashboard, quotes, quote detail (negotiate)
    store/              # Zustand auth (user + customer) + toast UI
```

---

## Notable design decisions

- `insertMany` skips Mongoose pre-save hooks → seed uses `.create()` so passwords hash.
- Route order matters: `/api/customer` is mounted before `/api` quote routes (quote router has top-level `protect`).
- JWT payload tags `type: "user"` vs `type: "customer"` for the two separate auth middlewares.
- The customer portal sanitizes every quote before render — `margin`, `cost`, `dealerId`, `estimatedCost` never leave the server (leak-tested).
- `fulfillmentService` prefers a single source per line, respects per-warehouse availability, and reports backorders with replenishment ETA.
- `billingService` emits a ONE_TIME invoice plus a recurring schedule (periods, proration, cancellation & refund rules) → `HYBRID` billing type when subscriptions exist.

## Security hardening (implemented)

| Layer | Control | Where |
|---|---|---|
| Transport | Helmet security headers (`X-Content-Type-Options`, no sniffing, CORP `cross-origin`) | `src/app.js` |
| Rate limiting | Login/register throttled (20 tries / 15 min, successful attempts skipped); global 600 req/min on `/api` | `src/middleware/security.js` |
| Input | `sanitizeInput` strips `$`-prefixed / dotted keys from body, query & params (NoSQL injection + prototype pollution) | `src/middleware/security.js` |
| Payload | `express.json({ limit: "100kb" })` | `src/app.js` |
| Idempotency | `Idempotency-Key` header on negotiate / accept-counter / submit / confirm / fulfillment / approval-review — replays return the original response, never a second execution (24h TTL store, per-actor scoped) | `src/models/Idempotency.js`, `src/routes/*` |
| Concurrency | `expectedVersion` optimistic lock — stale writes get 409; `quote.version` bumps on every mutation | `src/controllers/quoteController.js`, `src/controllers/customerController.js` |
| Approval integrity | Pending-only resolution (already-decided → 409), 7-day `expiresAt` auto-expiry, requester ≠ approver guard (ADMIN exempt), chain only advances after an explicit Approved step | `src/services/approvalService.js`, `src/models/Approval.js` |

Deploy note: terminate TLS at a reverse proxy (nginx/ALB) and add `Strict-Transport-Security`; the app is CORS-pinned to `CLIENT_URL`.

## Test scripts

- `/tmp/df360_test2.py` — hero flow (quote → what-if → negotiate → accept-counter → fulfillment → billing), steps 1–8 pass.
- `/tmp/df360_test3.py` — dashboards, portal sanitization, reports, audit; steps 9–19 pass.
- `/tmp/df360_appr.py` — manager→finance 2-level escalation; passes.
- `/var/folders/.../opencode/security_smoke.mjs` — security suite (helmet, rate-limit headers, NoSQL injection, 100kb boundary, 409 version guard, idempotent replay no-duplicate, portal leash) — **20/20 pass**.
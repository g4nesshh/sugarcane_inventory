# Sugarcane Factory Inventory Management System

Full-stack inventory system for a sugar factory: React + Vite frontend, Node.js + Express backend, PostgreSQL + Prisma, JWT auth with role-based access control.

Built in 12 phases (see spec) — **all 12 are now complete on the backend**: project setup, database schema, authentication/RBAC, Categories/Warehouses/Items management, read-only Inventory + Stock Movement ledger views, Suppliers + Purchase Orders, Goods Receipts, Stock Issues, Stock Transfers, Production Consumption + Sugarcane, Dashboard + Reports (plus Stock Adjustments, added as a bonus — see note below), a security-hardening pass, and a Jest test suite + deployment guide.

**The frontend now has full parity with everything the backend supports (Phases 3–10)**: app shell, Dashboard, Categories/Warehouses/Items, Inventory + Stock Movement ledger, Suppliers + Purchase Orders, Goods Receipts, Stock Issues, Stock Transfers, Production Consumption + Sugarcane, Stock Adjustments, and Reports (with CSV export) are all built. Nothing module-shaped is left on the frontend unless Users/Settings get scoped — and the backend doesn't support those either (see note below).

> **Note on Stock Adjustments:** the spec's 12-phase development plan (section 27) never actually gives Stock Adjustment its own phase, even though the schema and business rules for it exist from Phase 1 and the dashboard's "recent activity" needs it to be meaningful. It's included here, bundled into Phase 10.

## Stack

- **Frontend:** React 18 + Vite, Tailwind CSS, React Router, Axios, Recharts (charts added in Phase 10)
- **Backend:** Node.js + Express, Prisma ORM, PostgreSQL
- **Auth:** JWT (access token) + bcrypt password hashing
- **Validation:** Zod
- **Architecture:** Route → Controller → Service → Prisma → PostgreSQL, with a single shared `stockService` that every stock-changing operation must go through

## What's built (Phases 1–10, backend)

- Full Prisma schema for the entire system (users, categories, items, warehouses, inventory, suppliers, purchase orders, goods receipts, stock movements, issues, transfers, adjustments, production batches/consumption, sugarcane receipts) — all monetary and quantity fields use PostgreSQL `Decimal`, not floats
- `stockService.applyMovement`: the one place that changes an `Inventory` row. It row-locks (`SELECT ... FOR UPDATE`) inside a transaction, refuses to let stock go negative, and writes an immutable `StockMovement` ledger row. Every later phase (receipts, issues, transfers, consumption, adjustments) calls this instead of touching `Inventory` directly — that's what keeps the ledger and the quantities consistent.
- JWT login (`POST /api/auth/login`) with a rate limiter, bcrypt password checks with a dummy-hash comparison so failed logins don't leak which emails exist, and `GET /api/auth/me`
- Role-based middleware (`authenticate`, `authorize(...)`) and a central `permissions.js` mapping actions → allowed roles, so later routes just do `authorize(ACCESS.receiveStock)` etc.
- Centralized error handling in the exact response shape from the spec: `{ success, message, data }` / `{ success, message, error }`, mapping Zod errors, JWT errors, and Prisma known errors (unique constraint, not found, FK conflict) to sensible HTTP codes
- Seed script: 4 users (one per role), 7 categories, 5 warehouses, 4 suppliers, 12 realistic items with opening stock — opening balances are written **through `stockService`**, not by setting `Inventory.quantity` directly, so the ledger is correct from the first row
- Frontend: Vite + Tailwind scaffold, `AuthContext` (login/logout/me), `ProtectedRoute`, a login page, and a placeholder home page — sidebar/dashboard/module pages arrive with their backend phases
- **Categories, Warehouses, Items** (Phase 3): full CRUD with search, category/warehouse/stock-status filters, sortable pagination, and role-gated writes (`manageCategories`, `manageWarehouses`, `manageItems` in `permissions.js`). Delete never removes a row — it sets `status: INACTIVE` (soft delete), since these are master records that historical stock movements, purchase orders, etc. may reference. A warehouse can't be deactivated while it still holds stock. Item listing computes total stock across warehouses (or one warehouse via `?warehouseId=`), a `stockStatus` (`OUT_OF_STOCK` / `LOW_STOCK` / `NORMAL`) from `reorderLevel`, and `stockValue` — all derived from live `Inventory` rows, not stored columns
- **Inventory views + Stock Movement ledger** (Phase 4), both read-only: `GET /api/inventory` lists every item/warehouse stock row with the same stock-status/value logic as Items, filterable by warehouse/category/search; `GET /api/inventory/:itemId` gives one item's breakdown across every warehouse. `GET /api/stock-movements` is the immutable ledger itself, filterable by item, warehouse, movement type, and date range — nothing writes to it here, it only ever gets rows from `stockService.applyMovement` in later phases
- **Suppliers + Purchase Orders** (Phase 5): Suppliers are plain CRUD with soft delete, same pattern as Categories/Warehouses. Purchase Orders auto-generate their PO number (`PO-YYYYMM-####`), and `totalAmount` is always server-computed from line items + tax − discount — never trusted from the client. Line items can only be added/changed/removed while a PO is still `DRAFT`. Status changes go through a transition map (`DRAFT→PENDING→APPROVED`, cancel from any of those) enforced server-side; `PARTIALLY_RECEIVED` and `RECEIVED` can't be set manually at all — they're reserved for the goods-receipt workflow in Phase 6, which is what actually increases stock
- **Goods Receipts** (Phase 6): the only workflow that turns a PO into real stock. One transaction does all of it — create the receipt, call `stockService.applyMovement` per line (so it lands in the immutable ledger), increment each PO line's `receivedQuantity`, then recompute the PO's status to `PARTIALLY_RECEIVED` or `RECEIVED`. Guards: a PO must be `APPROVED`/`PARTIALLY_RECEIVED` to receive against; a line can't be over-received past what's still outstanding (checked with `Decimal`, not floats); an optional `idempotencyKey` makes a retried submission return the original receipt instead of crediting stock twice. Storekeepers get read-only access to Purchase Orders (a new `viewPurchases` permission) so they can see what's left to receive without being able to create or edit POs
- **Stock Issues** (Phase 7): a request/approval workflow. Creating an issue (department + line items) never touches stock — it just records a `PENDING` request. Only `approve` moves stock, one `stockService.applyMovement` call per line inside a transaction, which is also where "not enough stock" gets caught against live quantities at approval time (not request time). `reject` just closes the request with no stock effect. Both actions are restricted to `approveIssueOrTransfer` (ADMIN, INVENTORY_MANAGER); creating a request is open to `issueStock` roles (ADMIN, INVENTORY_MANAGER, STOREKEEPER). This phase added proper `requester`/`approver` relations on `StockIssue` (previously plain `Int` foreign keys)
- **Stock Transfers** (Phase 8): same request/approve/reject shape as Issues, but between two warehouses. A request names a source and destination (validated as different) plus line items; nothing moves until `approve`, which runs `STOCK_TRANSFER_OUT` at the source then `STOCK_TRANSFER_IN` at the destination for every line **inside one transaction** — so if any line can't be fulfilled from the source, the entire transfer rolls back, not just that line. Create is restricted to `transferStock` (ADMIN, INVENTORY_MANAGER); approve/reject reuse `approveIssueOrTransfer`. (`requestedBy`/`approvedBy` on transfers are still plain user IDs, not expanded relations — only Issues got that treatment so far, since it wasn't required for transfers' own response shape)
- **Production Consumption + Sugarcane** (Phase 9):
  - Production Batches are plain records (`product`, `productionDate`, `quantityProduced`, `status`) — creating or editing one never touches stock by itself.
  - Production Consumption deducts stock **immediately** when recorded (no approval gate, matching the spec's wording for this module) — one `applyMovement` call per line inside a transaction, which is also where insufficient-stock is caught. Recording the first consumption against a batch auto-flips it from `PLANNED` to `IN_PROGRESS`; consumption is blocked once a batch is `COMPLETED`.
  - Sugarcane receipts model a gate delivery straight from a farmer/supplier — not tied to a Purchase Order. `netWeight` is always computed server-side as `grossWeight − tareWeight` (never trusted from the client), and the receipt increases stock immediately for whichever item/warehouse you designate as the cane destination. Crushing a receipt later decreases that same stock, capped per-receipt at its own `netWeight` via a running `crushedQuantity`, rolling the receipt's status from `RECEIVED` → `PARTIALLY_CRUSHED` → `CRUSHED`.
  - Schema gap-fills this phase needed: `SugarcaneReceipt` gained `itemId`/`warehouseId` (it had no way to say *which* stock a weighed delivery represented), and `ProductionConsumption` gained a `warehouse` relation and `createdAt` (both were missing from the Phase 1 stub).
  - **Scope decision:** a batch's `quantityProduced` (finished goods output) is recorded for reporting only — it does **not** automatically credit finished-goods inventory. The spec describes recording this field but never specifies crediting logic for it, and inventing that wiring risked a guess the project didn't ask for; a dedicated "finished goods receipt" endpoint can be added later if wanted.
- **Stock Adjustments** (bonus, bundled into Phase 10): reconciles a physical count against the system quantity. `systemQuantity` and the resulting `difference` are captured once, at request time, as a snapshot — approval applies that *stored* difference (not a re-snapshot), as a single `ADJUSTMENT_IN` or `ADJUSTMENT_OUT` movement; a zero difference approves with no stock movement at all. Requesting is open to `requestAdjustment` roles (ADMIN, INVENTORY_MANAGER, STOREKEEPER); approval is `approveAdjustment` (**ADMIN only** — stricter than Issues/Transfers, matching the spec's explicit "Only Admin can approve stock adjustments"). Added `warehouse` and `approver` relations to `StockAdjustment` (the requester relation existed from Phase 1 but was named `user`; renamed to `requester` for consistency with Issues/Transfers).
- **Dashboard** (`/api/dashboard/*`): `summary` bundles KPI cards (total items, total inventory value, low/out-of-stock counts, pending POs, today's receipts/issues, current sugarcane stock), the four chart datasets the spec asks for (inventory value by category, monthly purchases, monthly consumption, top-5 consumed materials in the last 30 days), and recent activity (last 5 each of purchases/receipts/issues/adjustments). `stock-movement?days=30` returns a gap-filled daily series (every day in range appears even with zero activity) split into `stockIn`/`stockOut`. `low-stock` is a dedicated, paginated low/out-of-stock item list. All aggregation is done in plain JS over fetched rows (not raw SQL), which I verified standalone against hand-built test data rather than a live database — see the project's own write-up of this for the exact cases checked.
- **Reports** (`/api/reports/*`): inventory, purchases, consumption, and stock-movement reports, each returning `{ rows, summary }` as JSON by default or a CSV file with `?format=csv` (no extra dependency — a small internal CSV writer handles comma/quote/newline escaping). Each report's `summary` includes the breakdowns the spec asks for (e.g. purchases: by-supplier, by-month, pending count; consumption: by-department, by-item, by-month).

## Frontend (app shell + Dashboard)

**Design system:** a deliberate industrial palette rather than a default SaaS look — deep cane-green (`cane-500` `#1f4d36`) for the sidebar and primary actions, molasses-amber (`clay-400` `#c98a2c`) as a sparing accent, warm-neutral stone tones for backgrounds/borders instead of pure gray or the cliché cream-and-terracotta combination. Two typefaces: **Space Grotesk** for headings and big numbers, **Inter** for body/UI text. Panels are bordered, not drop-shadowed; there's no single border-radius applied everywhere. All of this is in `tailwind.config.js` as named tokens (`cane`, `clay`, `stone`, `ink`, `rust`, `moss`) — change the look from one place.

**Shell:** `AppLayout` (sidebar + topbar + content outlet) wraps every authenticated route. `Sidebar` renders from `src/config/navigation.js` — a grouped, role-filtered nav list that only includes routes that actually exist; each future module phase appends to it rather than linking to pages that aren't built yet.

**Reusable components** (`src/components/ui/`), built now so every module page from here on reuses them instead of reinventing list/form UI:
- `DataTable` — column config, built-in pagination controls, loading/error/empty states, and a `toolbar` slot for search/filter inputs
- `Modal` / `ConfirmDialog` — for add/edit forms and approve/reject/deactivate confirmations
- `StatusBadge` — maps every status vocabulary in the app (record status, approval status, PO status, stock status, batch status, cane status) to one of five semantic colors
- `Panel`, `KpiStrip` — bordered section containers and the dashboard's control-room-style KPI strip

**Dashboard page** (`/`): wired to all three `/api/dashboard/*` endpoints. KPI strip (8 figures), a 30-day stock-movement line chart, four bar charts (inventory value by category, monthly purchases, monthly consumption, top-5 consumed materials), a low-stock table, and four recent-activity panels (purchases/receipts/issues/adjustments) — all via Recharts.

**Verification:** unlike the backend (blocked on Prisma's engine download in this sandbox), the frontend has no such limitation, so this was verified for real: `npm run build` completes with zero errors, and a dev-server smoke test returned HTTP 200. The custom Tailwind tokens were confirmed to actually appear in the compiled CSS, not silently dropped.

## Frontend — Categories, Warehouses, Items

The first three module pages, following the Dashboard's established pattern exactly. Each is a `DataTable` with a search box, relevant filter dropdowns, and server-side pagination, plus an add/edit `Modal` form and a `ConfirmDialog` for deactivation.

- **Categories** (`/categories`): name, description, item count, status. Search + status filter.
- **Warehouses** (`/warehouses`): name, location, manager, capacity, status. Search + status filter. Deactivating fails (surfaced as a toast) if the warehouse still holds stock — the backend enforces this, the frontend just displays whatever message comes back.
- **Items** (`/items`): code, name, category, live stock total (across all warehouses, or scoped to one via the warehouse filter), stock status, unit cost, record status. Search + category + warehouse + stock-status + record-status filters — five independent filters, all server-side. The add/edit form intentionally has **no supplier field and no opening-stock field**: supplier assignment belongs on the not-yet-built Suppliers page, and opening stock only ever enters the system through Goods Receipts, Sugarcane receipts, or Adjustments (never by hand-editing an Item) — the form says so directly rather than silently omitting the capability.

**New shared pieces added this phase** (`src/components/ui/`, `src/hooks/`, `src/config/`), used by all three pages and meant for every page after them:
- `useListPage` — a generic fetch-with-pagination hook: give it an API function and a filters object, it handles loading/error state, resets to page 1 when filters change, and re-fetches on page change
- `SearchInput`, `Select`, `Button`, `FormField` — the search box / dropdown / button / labeled-input patterns every list and form will need
- `useDebouncedValue` — debounces the search box so it doesn't fire a request per keystroke
- `permissions.js` — a client-side mirror of the backend's role arrays, used only to show/hide Add/Edit/Deactivate controls; the backend re-checks every request regardless, so this is UX polish, not a security boundary

**Verification:** same as the Dashboard — a real `npm run build` (zero errors) and a dev-server HTTP 200 check, plus a grep pass confirming no stale references were left behind.

## Frontend — Inventory + Stock Movement ledger

Two read-only pages mirroring the backend's Phase 4 views.

- **Inventory** (`/inventory`): every item/warehouse stock row, with search + category + warehouse + stock-status filters. A "view breakdown" action on each row opens a modal calling `GET /api/inventory/:itemId` — total stock, total value, and a per-warehouse table for that one item.
- **Stock movement ledger** (`/stock-movements`): the immutable ledger itself, filterable by item, warehouse, movement type, and a date range (two native date inputs — no calendar-picker dependency). Quantities are shown signed and colored (green `+` for incoming types, rust `−` for outgoing), plus a `previous → new` balance column. This page is wrapped in `<ProtectedRoute roles={['ADMIN','INVENTORY_MANAGER']}>` to match the backend's `viewLedger` permission exactly — Production Manager and Storekeeper never reach it (redirected to the dashboard) rather than hitting a 403, even though they *can* see the Inventory page.

**This phase also consolidated some duplication** that had started creeping in after three similar module pages: `RECORD_STATUS_OPTIONS`, `STOCK_STATUS_OPTIONS`, `MOVEMENT_TYPE_OPTIONS`, and `INCOMING_MOVEMENT_TYPES` now live in one `config/options.js`, and `toSentenceCase` moved into `utils/format.js` (previously duplicated inside `StatusBadge`). Categories/Warehouses/Items were updated to import from the shared file instead of keeping their own copies. The frontend's `INCOMING_MOVEMENT_TYPES` set was explicitly cross-checked against the backend's authoritative `INCOMING` set in `stockService.js` — a mismatch here would silently show the wrong +/− sign on every ledger row, so this was worth confirming directly rather than trusting it was copied correctly.

**Verification:** same `npm run build` + dev-server HTTP 200 checks as every prior frontend phase, plus the backend/frontend movement-type-set cross-check above.

## Frontend — Suppliers + Purchase Orders

- **Suppliers** (`/suppliers`): the established `DataTable` + modal pattern. Restricted to ADMIN/INVENTORY_MANAGER — unlike the other masters (Categories/Warehouses/Items), the backend also gates **reading** the supplier list to those two roles, so this is the first nav item that isn't visible to all four roles.
- **Purchase Orders** got dedicated pages instead of a modal, given how much more complex a PO is than a master record:
  - `/purchases` — list with row-click-to-view (search, supplier, status, date-range filters)
  - `/purchases/new` — create: supplier, expected date, tax, discount, notes, and an editable line-items table with a live-updating subtotal/tax/discount/total preview (the server always recomputes the authoritative total — this is purely a UX preview)
  - `/purchases/:id` — view mode (full detail, linked goods receipts if any) plus status-transition buttons and an **Edit** toggle that's only available while the PO is `DRAFT`

**New reusable pieces from this phase:**
- **`LineItemsTable`** — a generic editable multi-row table (select/number/text/date column types, add/remove rows, an optional computed "line total" column). Built now specifically because Purchase Orders is the *first* of five upcoming modules (Goods Receipts, Stock Issues, Transfers, Production Consumption) that all need a multi-line-item form — this avoids rebuilding that UI five separate times.
- **`DataTable` gained an `onRowClick` prop** (used by the PO list) for the same forward-looking reason — several upcoming list pages will want click-to-view-detail instead of a modal.

**The status-transition UI is a direct mirror of the backend.** The button set shown per PO status, their labels, and which one gets danger (red) styling all come from a `TRANSITIONS` map in the page that was cross-checked line-by-line against `TRANSITIONS` in `backend/src/services/purchaseOrder.service.js` — confirmed identical. This matters because the frontend's job here isn't just displaying data; getting this map wrong would let someone click a button for a transition the backend will reject (not a safety issue, since the backend still enforces it — but it'd be a confusing dead-end click).

**Verification:** same `npm run build` + dev-server HTTP 200 checks as every prior phase, plus the TRANSITIONS cross-check above.

## Frontend — Goods Receipts

- **`/receipts`** (list, role-guarded to `receiveStock` — ADMIN/INVENTORY_MANAGER/STOREKEEPER; **Production Manager is excluded here**, unlike Purchase Orders' broader `viewPurchases`): filters by PO, warehouse, and date range, row-click opens a read-only detail modal. Receipts have no post-creation workflow (they're a one-time event), so unlike POs this didn't need a dedicated detail *route* — a modal is enough.
- **`/receipts/new`**: two entry paths. Arriving via the new **"Receive goods"** button on a PO's detail page (shown when that PO is `APPROVED` or `PARTIALLY_RECEIVED`) pre-selects that PO via a `?poId=` query param. Arriving from the Goods Receipts list directly shows a picker of every currently-receivable PO (`APPROVED` + `PARTIALLY_RECEIVED`, fetched as two merged calls — the backend's list endpoint only takes one status value at a time). Either way, the line-item rows are **derived from the PO itself**: only lines where `orderedQuantity > receivedQuantity` appear, each showing its remaining quantity as a reference column, and a line can be left blank (to skip it entirely, for a partial delivery) or removed outright.
- The form generates a client-side `idempotencyKey` once per session (`crypto.randomUUID()`) and sends it with the request — this is the frontend half of the backend's retry-safe design from Phase 6: if a submission is retried, the server returns the original receipt instead of crediting stock twice.

**`LineItemsTable` gained two things** this phase, because a goods receipt's lines aren't freely-addable like a PO's — they're a fixed set drawn from the PO, just removable: a `readonly` column type (plain text instead of an input, for the item name and remaining-quantity columns), and `onAddRow`/`onRemoveRow` are now independently optional — omit `onAddRow` and the "Add line" footer simply doesn't render. One shared component now serves both the free-add pattern (POs) and the fixed-but-prunable pattern (Receipts), rather than forking it.

**Verification:** the outstanding-lines derivation (which lines show up, what "remaining" reads) was checked standalone against hand-built PO data — confirmed a fully-received line is correctly excluded and remaining quantities compute right — plus the usual `npm run build` + dev-server HTTP 200.

## Frontend — Stock Issues

- **`/issues`** (list, role-guarded to `issueStock` — ADMIN/INVENTORY_MANAGER/STOREKEEPER): filters by department, status, and date range.
- **`/issues/new`**: department (dropdown, matches the backend's department enum exactly via a new `DEPARTMENT_OPTIONS` in `config/options.js`) + purpose + remarks, plus a `LineItemsTable` for item/warehouse/quantity lines. The form says directly that stock isn't deducted until approval — availability is checked then, against live quantities, not at submission time.
- **`/issues/:id`**: detail view with Approve/Reject buttons, shown only to `approveIssueOrTransfer` roles (ADMIN/INVENTORY_MANAGER — a narrower set than who can create a request), each behind a `ConfirmDialog` that says plainly what's about to happen ("will deduct the listed quantities from stock immediately" vs. "no stock will be affected").

This closes out two of the three core stock-movement workflows on the frontend (receive, issue) — Transfers is the remaining one.

**Verification:** the usual `npm run build` (zero errors) + dev-server HTTP 200 + a stale-reference grep.

## Frontend — Stock Transfers

- **`/transfers`** (list, role-guarded to `transferStock` — ADMIN/INVENTORY_MANAGER only, Storekeeper excluded unlike Issues): filters by source warehouse, destination warehouse, status, and date range.
- **`/transfers/new`**: source + destination warehouse selects, with a client-side same-warehouse guard mirroring the backend's check, plus a `LineItemsTable` for item/quantity lines (no per-line warehouse — source/destination are transfer-level fields, unlike Issues where each line picks its own warehouse). States plainly that approval moves stock atomically and a shortfall on any single line rejects the whole transfer.
- **`/transfers/:id`**: detail view with Approve/Reject, gated the same way as Issues (`approveIssueOrTransfer`).

One real API-shape inconsistency worth noting: unlike `StockIssue`, the backend's `StockTransfer` doesn't expand `requestedBy`/`approvedBy` into `requester`/`approver` relations (a documented gap from Phase 8 — see that phase's notes). Rather than display a meaningless raw user ID, the transfer detail page simply omits those rows. If that relation ever gets added to the backend, the frontend change is a one-line addition to the `<dl>` in `StockTransferDetail.jsx`.

This completes all three core stock-movement workflows (receive, issue, transfer) on the frontend.

**Verification:** the usual `npm run build` (zero errors) + dev-server HTTP 200 + a stale-reference grep.

## Frontend — Production Consumption + Sugarcane

- **`/production/batches`** (list, role-guarded to `recordConsumption` — ADMIN/PRODUCTION_MANAGER only; Inventory Manager and Storekeeper are excluded from this whole module, matching the backend). Add/edit uses a `Modal` rather than a dedicated route — a batch has no line items, so it's a simple-fields form like Categories/Warehouses, not a PO-style multi-line one. The status field is directly editable on edit, since the backend's `productionBatch.service.js` has no transition-map guard (unlike PO/Issue/Transfer).
- **`/production/batches/:id`**: batch details, a consumption history table, and a "Record consumption" `Modal` built on `LineItemsTable` (item / warehouse / quantity / department / remarks columns). States plainly that stock deducts immediately — there's no approval step for consumption, matching the backend.
- **`/sugarcane`** (list, role-guarded to `manageSugarcane` — ADMIN/INVENTORY_MANAGER/STOREKEEPER; notably the *inverse* exclusion from Production Batches, since Production Manager is left out here). "Record receipt" is also a `Modal`, not a route — a cane receipt is a single record, not a multi-line document — and computes net weight live as gross/tare weight are typed.
- **`/sugarcane/:id`**: full weighment and delivery detail, plus a "Record crushing" `Modal`. Its max-quantity guard (`remaining = netWeight − crushedQuantity`) was verified standalone against the exact same test cases as the backend's over-crush guard (exact-remaining allowed, one unit over rejected).

This completes frontend coverage for all of backend Phase 9.

**Verification:** the usual `npm run build` (zero errors) + dev-server HTTP 200 + a stale-reference grep, plus the crush-guard logic check described above.

## Frontend — Stock Adjustments

- **`/adjustments`** (list, role-guarded to `requestAdjustment` — ADMIN/INVENTORY_MANAGER/STOREKEEPER): filters by warehouse, reason, and status. A shared `SignedQuantity` component color-codes the difference column (moss green positive, rust negative, neutral at zero) and is reused on the detail page.
- **New adjustment** is a `Modal` (single record, no line items — same reasoning as Categories/Sugarcane). Once both item and warehouse are selected, it live-looks-up the current system quantity via `getItemInventory` and shows a computed difference preview — purely a UX preview; the backend re-snapshots the real system quantity itself at submission time regardless of what the form displayed.
- **`/adjustments/:id`** follows `StockIssueDetail`'s exact approve/reject template, but approval is gated separately and more narrowly: `approveAdjustment` is **ADMIN only**, stricter than Issues/Transfers' admin-or-inventory-manager. The confirm dialog's message has three branches (increase / decrease / "count matches, no stock movement") mirroring the backend's `isZero()` / `gt(0)` branching exactly — verified standalone the same way the crush and over-receipt guards were.

This completes the frontend for every bonus feature added in backend Phase 10. Only Reports remained.

**Verification:** the usual `npm run build` (zero errors) + dev-server HTTP 200 + a stale-reference grep, plus the three-way difference-message logic check described above.

## Frontend — Reports

A single **`/reports`** page (role-guarded to `viewReports` — ADMIN/INVENTORY_MANAGER/PRODUCTION_MANAGER; Storekeeper is excluded here, unlike most operational pages) with four tabs — Inventory, Purchases, Consumption, Stock Movement — each independently filtered. Every tab follows the same shape: a `KpiStrip` summary, breakdown panels (supplier/department/item/type tallies as simple lists, a shared `MonthlyChart` Recharts bar chart for trends), a `DataTable` of the full row set (reports return everything at once — no pagination, by backend design), and an **Export CSV** button.

**A real bug found and fixed in this phase:** CSV download has to go through an authenticated `axios` request with `responseType: 'blob'` (a plain `<a href>` to the API URL wouldn't carry the Bearer token and would 401). The catch is that with `responseType: 'blob'`, an *error* response body also deserializes as a Blob instead of parsed JSON — so the existing `errorMessage()` helper silently fell back to a generic message instead of showing the server's actual validation error. Fixed in `api/reports.js`: `downloadReportCsv` now reads the blob back out, parses it, and throws a tagged `Error` (`isReadableReportError`) that the export button checks for explicitly instead of routing through `errorMessage()`. Verified standalone across three cases — a valid JSON error body, a malformed body, and the plain success path — before shipping.

**This completes frontend coverage for all of backend Phases 3–10.**

**Verification:** the usual `npm run build` (zero errors) + dev-server HTTP 200 + a stale-reference grep, plus the CSV-error-unwrapping logic check described above.

## Backend — Security hardening (Phase 11)

Rather than add new endpoints, this phase was an audit pass over everything already built, checking it against the spec's explicit security list (section 23) item by item — most of it turned out to already be solid by construction, which is worth confirming rather than assuming:

- **No password-hash leakage** — audited every single Prisma `include` of a `User` relation across all 20+ services (requester/approver/creator/receiver/performedBy, etc.). Every one already used an explicit `select` naming only `id`/`name` — none pulled the full `User` row. Nothing to fix; confirmed clean.
- **No SQL injection surface** — the only raw SQL in the codebase is `stockService.applyMovement`'s row-lock query, and it uses Prisma's tagged-template `$queryRaw` (safely parameterized), never `$queryRawUnsafe`. Confirmed via grep.
- **Mass-assignment protection is structural, not incidental** — every write endpoint validates through a Zod schema, and Zod's default behavior silently strips any field not named in the schema (verified standalone: a payload with an injected `role: 'ADMIN'` or `approvedBy: 999` comes out with only the declared fields). A client can't smuggle extra fields into a create/update by guessing a column name.
- **Secure error handling** — already confirmed from Phase 1: a 500 only includes `err.message` in the response when `NODE_ENV !== 'production'`; Prisma errors (P2002/P2025/P2003) are already mapped to generic, non-leaky messages rather than passing through raw constraint/table details.
- **New this phase — general API rate limiting.** Previously only `/auth/login` was rate-limited. Added a second, more permissive limiter (600 requests/15 min/IP) across all of `/api`, generous enough not to interfere with normal dashboard polling or list-page filtering, while still bounding scraping/abuse.
- **New this phase — production JWT-secret strength check.** `config/env.js` now refuses to start in `NODE_ENV=production` if `JWT_SECRET` is under 32 characters (dev/test stay lenient, so a placeholder secret doesn't block local setup). Verified all three cases standalone: weak+production throws, strong+production passes, weak+development passes.
- **New this phase — opt-in `trust proxy`.** Rate limiting by IP only works correctly behind a real reverse proxy if Express is told to trust `X-Forwarded-For`; blindly trusting it with no actual proxy in front would let a client spoof their IP and dodge the limiter. Added as an explicit opt-in (`TRUST_PROXY=true` in `.env`), off by default.

**Verification:** `node --check` across every changed file, the full app still requiring cleanly to the same expected Prisma-engine wall, and three standalone-tested cases for the new JWT-secret guard plus a standalone confirmation of Zod's strip-unknown-keys behavior.

## Backend — Tests + deployment (Phase 12)

### Tests

Two kinds, for an honest reason: this sandbox's network allowlist blocks Prisma's engine-binary download (the same limitation noted since Phase 1), so nothing touching a real database could be executed here — only genuinely-runnable tests were actually run.

- **`tests/unit/validators.test.js`** — pure Zod-schema tests, no database, no Prisma client. **These were actually run in this sandbox and are genuinely green: 23/23 passing.** Along the way, running them for real caught an actual bug — a test fixture used a 1-character name against a schema requiring 2+ characters, which had been masked in two other assertions by an unrelated failure happening first. Fixed and reconfirmed. This is exactly the kind of mistake that only running tests (vs. just writing them) catches.
- **`tests/integration/*.test.js`** — real `supertest` requests against the real Express app and a real (test) Postgres database, covering the specific business rules the spec calls out: login, deactivated-account rejection, role-based authorization (several specific role/route combinations), item creation, goods receipts increasing stock, the over-receipt guard, PO status roll-up (PARTIALLY_RECEIVED → RECEIVED), **idempotency-key duplicate-receipt prevention**, stock issues (request vs. approve, stock unchanged until approval, **insufficient-stock checked at approval time against live quantity, not request time**), stock transfers (**atomicity**: a multi-line transfer where only the second line fails leaves the first line's already-processed movement rolled back too — source quantity ends up exactly where it started), stock adjustments (difference computed and snapshotted correctly, positive/negative/zero-difference approval, double-approval blocked), and production consumption (immediate deduction, batch auto-advancing to `IN_PROGRESS`, blocked once `COMPLETED`).

  **These could not be executed in this sandbox** — every single one fails at the exact same, expected point (confirmed by running each file and checking the actual error): `@prisma/client did not initialize yet`, the same Prisma-engine wall from every other backend phase. What running them *did* confirm is that every `require()` path across all six test files resolves correctly through the full chain (test → helpers → app → routes → controllers → services → prisma client) — so the only remaining unknown is business-logic correctness against a live database, not file structure or import mistakes. They were written by cross-referencing the exact response shapes, error codes, and a Decimal-serialization-to-JSON-string detail against the real service code, not guessed.

  **To actually run them:** point `DATABASE_URL` at a real (ideally disposable — `resetDb()` wipes all rows between every test) Postgres database, run `npx prisma migrate deploy`, then `npm run test:integration`.

```bash
npm run test:unit         # no setup needed — runs anywhere
npm run test:integration  # needs DATABASE_URL pointed at a migrated test database
npm test                  # runs both
```

### Deployment

See **`DEPLOYMENT.md`** at the project root — environment variables for production, the `prisma migrate deploy` step, a note on `JWT_SECRET` strength (enforced since Phase 11) and `TRUST_PROXY`, frontend static-build/SPA-routing specifics, and a pre-launch checklist.

## Setup

**Prerequisites:** Node.js 18+, PostgreSQL 14+ running locally (or a connection string to one).

```bash
# 1. Backend
cd backend
cp .env.example .env        # edit DATABASE_URL / JWT_SECRET if needed
npm install
npx prisma migrate dev --name init   # creates the database tables
npm run seed                          # loads demo users + items + opening stock
npm run dev                           # http://localhost:4000

# 2. Frontend (separate terminal)
cd frontend
npm install
npm run dev                           # http://localhost:5173
```

> This project was built in a sandboxed environment whose network allowlist doesn't include Prisma's binary download host, so `npx prisma generate` / `migrate` couldn't be run here. Everything has been checked as far as the sandbox allows — dependency install, `node --check` on every file, and manual schema review — but you should run `npx prisma migrate dev` yourself on first setup; it will download the engine binaries and create the tables. On a normal machine with internet access this just works.

### Seeded logins

All seeded users share the password `Password@123` (override with `SEED_PASSWORD` env var before seeding):

| Email | Role |
|---|---|
| admin@sugarfactory.local | ADMIN |
| inventory@sugarfactory.local | INVENTORY_MANAGER |
| production@sugarfactory.local | PRODUCTION_MANAGER |
| store@sugarfactory.local | STOREKEEPER |

## API so far

```
GET    /api/health
POST   /api/auth/login
POST   /api/auth/register   (ADMIN only)
GET    /api/auth/me         (authenticated)

GET    /api/categories      ?page&limit&search&status&sortBy&sortOrder
GET    /api/categories/:id
POST   /api/categories      (ADMIN, INVENTORY_MANAGER)
PUT    /api/categories/:id  (ADMIN, INVENTORY_MANAGER)
DELETE /api/categories/:id  (ADMIN, INVENTORY_MANAGER)  -- soft delete

GET    /api/warehouses      ?page&limit&search&status&sortBy&sortOrder
GET    /api/warehouses/:id
POST   /api/warehouses      (ADMIN)
PUT    /api/warehouses/:id  (ADMIN)
DELETE /api/warehouses/:id  (ADMIN)  -- soft delete, blocked if stock > 0

GET    /api/items           ?page&limit&search&categoryId&warehouseId&stockStatus&status&sortBy&sortOrder
GET    /api/items/:id
POST   /api/items           (ADMIN, INVENTORY_MANAGER)
PUT    /api/items/:id       (ADMIN, INVENTORY_MANAGER)
DELETE /api/items/:id       (ADMIN, INVENTORY_MANAGER)  -- soft delete

GET    /api/inventory           ?page&limit&search&categoryId&warehouseId&stockStatus&sortBy&sortOrder
GET    /api/inventory/:itemId   -- one item's stock broken down by warehouse

GET    /api/stock-movements     ?page&limit&itemId&warehouseId&type&referenceType&dateFrom&dateTo&sortOrder

GET    /api/suppliers       ?page&limit&search&supplierType&status&sortBy&sortOrder   (ADMIN, INVENTORY_MANAGER)
GET    /api/suppliers/:id                                                            (ADMIN, INVENTORY_MANAGER)
POST   /api/suppliers                                                                (ADMIN, INVENTORY_MANAGER)
PUT    /api/suppliers/:id                                                            (ADMIN, INVENTORY_MANAGER)
DELETE /api/suppliers/:id   -- soft delete                                           (ADMIN, INVENTORY_MANAGER)

GET    /api/purchases       ?page&limit&search&supplierId&status&dateFrom&dateTo&sortBy&sortOrder  (ADMIN, INVENTORY_MANAGER, STOREKEEPER read; ADMIN, INVENTORY_MANAGER write)
GET    /api/purchases/:id                                                                          (ADMIN, INVENTORY_MANAGER, STOREKEEPER)
POST   /api/purchases       { supplierId, expectedDate?, tax?, discount?, notes?, items:[{itemId,orderedQuantity,unitPrice}] }   (ADMIN, INVENTORY_MANAGER)
PUT    /api/purchases/:id   -- items only editable while DRAFT; status via DRAFT→PENDING→APPROVED / CANCELLED                    (ADMIN, INVENTORY_MANAGER)

GET    /api/receipts        ?page&limit&purchaseOrderId&warehouseId&dateFrom&dateTo&sortOrder   (ADMIN, INVENTORY_MANAGER, STOREKEEPER)
GET    /api/receipts/:id                                                                        (ADMIN, INVENTORY_MANAGER, STOREKEEPER)
POST   /api/receipts        { purchaseOrderId, warehouseId, idempotencyKey?, items:[{itemId,quantity,batchNumber?,expiryDate?}] }

GET    /api/issues          ?page&limit&department&status&dateFrom&dateTo&sortOrder   (ADMIN, INVENTORY_MANAGER, STOREKEEPER)
GET    /api/issues/:id                                                                (ADMIN, INVENTORY_MANAGER, STOREKEEPER)
POST   /api/issues          { department, purpose?, remarks?, items:[{itemId,warehouseId,quantity}] }   (ADMIN, INVENTORY_MANAGER, STOREKEEPER)
                             -- department is one of PRODUCTION, MAINTENANCE, BOILER, ELECTRICAL, PACKAGING, ADMINISTRATION, OTHER
PUT    /api/issues/:id/approve   -- decreases stock, only from PENDING            (ADMIN, INVENTORY_MANAGER)
PUT    /api/issues/:id/reject    { remarks? }, only from PENDING                  (ADMIN, INVENTORY_MANAGER)

GET    /api/transfers       ?page&limit&status&sourceWarehouseId&destinationWarehouseId&dateFrom&dateTo&sortOrder  (ADMIN, INVENTORY_MANAGER)
GET    /api/transfers/:id                                                                                          (ADMIN, INVENTORY_MANAGER)
POST   /api/transfers       { sourceWarehouseId, destinationWarehouseId, items:[{itemId,quantity}] }   (ADMIN, INVENTORY_MANAGER)
PUT    /api/transfers/:id/approve   -- atomic OUT at source + IN at destination, only from PENDING     (ADMIN, INVENTORY_MANAGER)
PUT    /api/transfers/:id/reject    -- only from PENDING                                               (ADMIN, INVENTORY_MANAGER)

GET    /api/production/batches       ?page&limit&search&status&dateFrom&dateTo&sortOrder   (ADMIN, PRODUCTION_MANAGER)
GET    /api/production/batches/:id                                                         (ADMIN, PRODUCTION_MANAGER)
POST   /api/production/batches       { product, productionDate?, quantityProduced? }       (ADMIN, PRODUCTION_MANAGER)
PUT    /api/production/batches/:id   { product?, productionDate?, quantityProduced?, status? }  (ADMIN, PRODUCTION_MANAGER)

GET    /api/production/consumption   ?page&limit&productionBatchId&itemId&warehouseId&sortOrder   (ADMIN, PRODUCTION_MANAGER)
POST   /api/production/consumption   { productionBatchId, items:[{itemId,warehouseId,quantityConsumed,department?,remarks?}] }  -- decreases stock immediately

GET    /api/sugarcane        ?page&limit&supplierId&status&dateFrom&dateTo&sortOrder   (ADMIN, INVENTORY_MANAGER, STOREKEEPER)
GET    /api/sugarcane/:id                                                              (ADMIN, INVENTORY_MANAGER, STOREKEEPER)
POST   /api/sugarcane        { supplierId, itemId, warehouseId, vehicleNumber, grossWeight, tareWeight, quality?, unloadingLocation?, arrivalDate? }  -- increases stock immediately
PUT    /api/sugarcane/:id/crush   { quantity }   -- decreases stock, capped at this receipt's remaining netWeight

GET    /api/adjustments      ?page&limit&itemId&warehouseId&reason&status&sortOrder   (ADMIN, INVENTORY_MANAGER, STOREKEEPER)
GET    /api/adjustments/:id                                                           (ADMIN, INVENTORY_MANAGER, STOREKEEPER)
POST   /api/adjustments      { itemId, warehouseId, physicalQuantity, reason, remarks? }   (ADMIN, INVENTORY_MANAGER, STOREKEEPER)
PUT    /api/adjustments/:id/approve   -- applies the stored difference, only from PENDING   (ADMIN only)
PUT    /api/adjustments/:id/reject    -- only from PENDING                                  (ADMIN only)

GET    /api/dashboard/summary                                      (ADMIN, INVENTORY_MANAGER, PRODUCTION_MANAGER)
GET    /api/dashboard/stock-movement   ?days=30 (max 90)            (ADMIN, INVENTORY_MANAGER, PRODUCTION_MANAGER)
GET    /api/dashboard/low-stock        ?page&limit                  (ADMIN, INVENTORY_MANAGER, PRODUCTION_MANAGER)

GET    /api/reports/inventory       ?categoryId&warehouseId&format=csv                         (ADMIN, INVENTORY_MANAGER, PRODUCTION_MANAGER)
GET    /api/reports/purchases       ?supplierId&status&dateFrom&dateTo&format=csv
GET    /api/reports/consumption     ?itemId&warehouseId&productionBatchId&dateFrom&dateTo&format=csv
GET    /api/reports/stock-movement  ?itemId&warehouseId&type&dateFrom&dateTo&format=csv
```

All list endpoints return `{ success, message, data: { <resource>: [...], meta: { page, limit, total, totalPages } } }`. Report endpoints return `{ success, message, data: { rows, summary } }` as JSON, or a raw CSV file when `format=csv` is passed.

## Project status

**All 12 phases of the original plan are complete, backend and frontend.** Nothing module-shaped remains to build against the spec as written.

**Still genuinely open, if wanted:**
- **Running the integration tests for real** — they're written and structurally verified (see above) but have never been executed against a live database, since this sandbox can't run one. Worth doing before relying on them.
- **Full User management** (list/edit-role/deactivate) and a **Settings page** — the spec references both as Admin capabilities and lists them as frontend pages, but never specifies a backend for either. Not part of the original 12-phase plan (same situation Stock Adjustments was in before Phase 10 added it).
"# sugarcane_inventory" 

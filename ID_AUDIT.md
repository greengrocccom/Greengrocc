# Project identity audit — 2 November 2026

This is a source-code audit of identity creation/reuse across backend services, web clients and mobile sources. It is not a certification that every stored ID is valid. The read-only database results are in `backend/id-audit-results.json`; an empty collection list with a connection error means the database was not inspected.

## Database findings

The read-only audit successfully scanned **180 collections**, with no collection-level errors. It found **no duplicate nonempty `id` values** within a collection, and no duplicate `orderNumber` or `invoiceNumber` candidates. That does not rule out missing IDs or duplicate entities with different IDs.

The following stored references do not resolve to their expected parent collection. Missing parents can result from deletion or earlier ID changes; the audit does not establish which event caused each case. Do not create replacement parent records or new IDs to hide these references.

### storeorders.sourceOrderId → orders

Returned 9 broken-reference rows. Missing target IDs in this sample:

- `6a8d72964dcd9e2910e5f619`
- `6aa135db90657e17334a9965`
- `6aa13cd10b5812ef33fefcd6`
- `6aa13dc2863f06ec4ca28b8a`
- `6aa142310b5812ef33ff060d`
- `6aa1435a0b5812ef33ff0876`
- `6aa1443678f43c107a7fc104`
- `6aa1474278f43c107a7fca5d`
- `6aa15f0c1b1070873f2cf00c`

### storeinventories.productId → GreenGroccproducts

Returned 5 broken-reference rows. Missing target IDs in this sample:

- `6acf7d2bf2828ab3c1b7707c`
- `6acf7d2bf2828ab3c1b7707e`
- `6acf7d2bf2828ab3c1b77082`
- `6acf7d2bf2828ab3c1b77084`
- `6acf7d2bf2828ab3c1b77086`

### storeinventories.managerId → deliverymanagers

Returned 100 broken-reference rows (sample cap reached; there may be more). Missing target IDs in this sample:

- `6a76d721c50dffa6322b6e28`
- `6a79724894e97ced1fa3dbd2`

The sales-report change already excludes store-order parts whose source order no longer exists. Inventory orphan records still require reconciliation against deletion history; this audit made no database changes.

## Confirmed identity replacement paths fixed

1. `backend/legacy/models/order/Order.js`: the save hook generated a new order number whenever an existing number was not exactly six digits. Existing nonempty numbers now survive saves, including legacy and prefixed numbers.
2. `backend/farmer-manager-service/src/pickupControllers.js`: `ensureCentreBusinessId` generated a new identity for an existing collection centre if its ID did not match the current format, then attempted reference rewrites. It now preserves every existing nonempty ID. New/missing IDs still initialize.
3. `backend/erp-service/src/services/farmerSync.js`: shared product normalization could replace a farmer-product row's `id` with the shared `productId`. It now preserves the row identity; a missing row ID uses the existing MongoDB `_id`. Business-ID normalization remains separate.

## Further issues and risks requiring follow-up

| Area | Evidence and impact | Required approach |
|---|---|---|
| Two `Order` models | `backend/legacy/models/order/Order.js` and `backend/delivery-service/src/models/Order.js` both register `Order`; the delivery file deletes an existing registration. They have different schemas. This can change which schema is resolved through model lookup/population, depending on imports. | Consolidate the schemas or give the legacy delivery entity a distinct model/collection with an explicit migration. Do not blindly rename the collection. |
| Crop/product normalization | `ensureSharedCropBusinessId` and `ensureSharedProductBusinessId` rewrite shared business IDs and references during normal workflows. These multi-document changes are not transactional. Queries omit variety filtering when variety is empty, potentially including other varieties. | Move format migration out of ordinary reads; define canonical crop/variety identity and migrate references atomically with aliases for old IDs. |
| Inventory identity | `StoreInventory` uniquely indexes `(managerId, sku)`, but `(managerId, productId)` is not unique. Several paths perform check-then-create/upsert by product. Different SKUs can therefore represent the same product/store. | Audit duplicates, merge stock/history deliberately, then enforce a partial unique product/store index and handle concurrent duplicate-key retries. |
| Truncated product SKU | `inventorySkuForProduct` uses the last eight characters of `_id` when SKU is absent; `productIdForSku` takes the first suffix match. Different full IDs can share that suffix. | Detect ambiguity, retain full product IDs as links, and migrate fallback SKUs with compatibility lookup. |
| Earnings creation | `upsertFarmerEarningFromFinalSummary` checks for an existing earning and then creates a timestamp-based ID. The `(farmerId, orderId)` index is not unique. Concurrent finalization can create two earnings for one order. | Establish the canonical order alias, reconcile duplicates, then enforce scoped uniqueness and use atomic upsert. |
| Unstable client fallback keys | Farmer earnings statement and manager stock-history views use `Math.random()` when an expected ID is missing; history views do not first reuse `_id`. | Prefer existing row `id`/`_id`; use deterministic display-only keys for malformed legacy rows. A display fallback must never be persisted as an entity ID. |
| Timestamp-only new IDs | Grade, shift, receipt and booking creation include timestamp-only identifiers in several controllers. | New independent entities need collision-resistant IDs or atomic sequences and unique indexes. They must still retain that assigned ID on later updates. |

## Identity rules

- A database `_id`, a business/display ID and a relationship ID have different purposes. Converting an existing string to `ObjectId` does not generate a second identity.
- Updates and reads must preserve assigned row IDs. Relations must reference the original entity ID.
- A store inventory row, crop assignment, order part or receipt can legitimately have its own row ID while referencing the existing product/order. Shared business IDs may intentionally appear in multiple rows.
- Repeated create requests need a unique natural key or idempotency key and an atomic upsert. Merely using random or sequential IDs does not prevent duplicate entities.
- Changing an established ID format requires a reviewed migration covering every reference, rather than regeneration during normal operations.
- Do not add unique indexes over existing production data until duplicates have been reconciled. This audit does not merge, delete or renumber existing records.

## Verification

Run `node backend/scripts/testIdentityPreservation.mjs` for the three preservation regressions. Syntax checks were run on the changed backend modules.

Run `node backend/scripts/auditIds.mjs` for read-only duplicate candidate checks across all accessible collections and targeted broken references for store orders and inventory. It uses the configured backend database and never registers models, creates indexes, or writes database records. Candidate lists are capped at 100 groups/rows per check. Shared/scoped fields are explicitly marked for review; their repetition alone is not a defect. It does not cover every possible foreign key, historical alias, missing field, or retry race.

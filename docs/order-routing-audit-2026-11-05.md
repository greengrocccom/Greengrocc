# Order placement and dark-store visibility audit

Audited on 5 November 2026. Production read at approximately 13:28 IST. Scope: web checkout, Customerapp checkout/payment payloads, COD and online payment controllers, address snapshots, store resolution, dispatch, mixed carts, manager APIs and screens, realtime rooms, recovery, and account deletion. Findings refer to the current workspace source; production source revision was not independently verified. No application fixes, production writes, real payments, or notification sends were performed during this audit.

## Production evidence

Production database: `greengroccProductionDb`.

- One current active dark store: `PuneWestDarkStore1`, with an active multivendor and saved GPS.
- Seven non-attempted customer orders examined; all seven have at least one StoreOrder.
- Three current-store orders: `970792`, `777820`, `243627`. All are `preorder_hold`, scheduled for **2026-11-06**. Today's filters hide them on 2026-11-05.
- Four dangling assignments: `619499`, `604281`, `238050`, `132272`. Their StoreOrder manager IDs have no matching current DeliveryManager. The first three are `order_received`; `132272` is a held pre-order dated 2026-11-05.
- All seven report an empty `routingError`, including the four dangling assignments.
- None of these seven has zero store parts. A simple "missing StoreOrder" count therefore reports zero, despite four unusable assignments.

Current-coordinate distance comparisons do not establish which stores existed, were active, or were nearest at the time of historical placement. Only one store currently exists, so production cannot demonstrate competing-store nearest selection. That defect was reproduced with isolated fixtures.

## Observed flow

1. Web checkout advertises a serving store from the selected saved address through `/api/stores/nearest`.
2. Placement sends `addressId` plus a separate `customerLocation` payload. The server constructs an address snapshot, then merges that payload over it.
3. COD validates a serving store and immediate-item inventory before finalizing the customer Order. Razorpay creation validates serviceability, but verification rebuilds checkout data without `requireDarkStore: true`.
4. Finalization saves the customer Order, performs rewards/cart/user updates, and starts `dispatchDeliveryOrder` without awaiting successful store-order persistence.
5. Dispatch resolves a manager again, seeds its inventory if necessary, maps products, creates one StoreOrder or immediate/pre-order parts, reserves immediate stock, and emits manager-room events.
6. Manager HTTP queries read StoreOrder by exact `managerId`. The web screens additionally filter dates and statuses. Socket rooms derive the same manager ID from the JWT.

## Findings

### 1. P1 — Deleting a store leaves active orders permanently attached to a nonexistent manager

Evidence: `backend/admin-ops-service/src/loginAccountControllers.js:118`, `backend/delivery-service/src/controllers/managerDashboardController.js:352`, `backend/legacy/services/deliveryDispatcher.js:230`, `backend/legacy/controllers/orderController.js:1690`, `backend/legacy/controllers/orderController.js:1730`.

The generic account delete action hard-deletes the DeliveryManager without checking its open StoreOrders or reassigning them. Manager inboxes match the exact manager ID, so a replacement store cannot see those orders. Dispatch returns the existing StoreOrder without validating its owner. The admin Unrouted Orders list excludes every customer order with any StoreOrder, and reroute rejects those orders as already routed. The four production orders listed above are already in the dangling state. Their historical cause was not proven from available records.

This is a gap in the generic admin deletion action added earlier. Preserve account management capability, but require an explicit open-order disposition before removing a store login. Recovery must detect missing/inactive owners and permit safe reassignment of unstarted parts, preserving stock, payments and history.

### 2. P2 — Both manager screens default to today and hide tomorrow's newly placed pre-orders

Evidence: `DeliveryManager/src/pages/orders/OrdersPage.jsx:40`, `:70`, `:566`; `DeliveryManager/src/pages/preorders/PreOrdersPage.jsx:136`, `:156`; `backend/delivery-service/src/controllers/preOrderController.js:168`.

The general Orders screen fetches pre-orders, but filters them by `preOrderDate`, not placement date. Its default is today's date. The dedicated Pre-Orders screen also defaults to today and sends that date to the backend, excluding tomorrow's rows at query time. The current three production pre-orders are all scheduled for 6 November, so both default views can appear empty on 5 November.

Immediate workaround: **Pre-Orders → Tomorrow → All**, or clear the date filter. Fix the default to include upcoming and still-open orders and expose clear counts for hidden upcoming orders. The module-level today/tomorrow constants also become stale across midnight until the page reloads.

### 3. P1 — Area matching overrides nearest GPS, city and maximum radius

Evidence: `backend/delivery-service/src/services/darkStoreResolver.js:81`, `:217`, `:226`.

`resolveDarkStoreForOrder` searches all active stores for an area substring match and returns before checking GPS or radius. This branch does not restrict city. It can match a store/manager name embedded in address text, and missing GPS still permits selection.

Reproduced: a customer with a store approximately 111 metres away was assigned to a matching-area store 6.67 km away in a different city, beyond that store's 5 km radius.

Use the delivery-address coordinates to rank eligible stores, apply serviceability constraints first, and use locality fallbacks only under an explicit missing-GPS policy.

### 4. P1 — A cart VersionError can occur after the order is saved but before dispatch starts

Evidence: `backend/legacy/utils/orderHelpers.js:1254`, `:1398`, `:1399`, `:1492`, `:1537`, `:1544`, `:1546`.

Both cart cleanup branches still mutate a loaded items array and call `cart.save()`. New-order finalization persists the Order first, then clears the cart, then invokes dispatch. Attempt completion similarly saves the Order before cart cleanup and returns to the caller only afterward. A concurrent cart update can therefore produce a persisted customer order and a checkout error without starting dispatch. Retrying completion can fail on cart cleanup again.

The earlier atomic remove-from-cart patch does not fix this separate checkout writer. An isolated injected VersionError confirmed that completion aborts for an already persisted order. Keep cart cleanup out of the critical dispatch guarantee, make cleanup concurrency-safe, and make order retries idempotent.

### 5. P1 — Store dispatch is not durably guaranteed, and the reconciliation function is never scheduled

Evidence: `backend/legacy/utils/orderHelpers.js:1482`, `:1546`; `backend/legacy/controllers/paymentController.js:694`; `backend/legacy/services/deliveryDispatcher.js:435`, `:447`; `backend/index.js:160`.

Callers start dispatch with `void` and can return success before any StoreOrder exists. Dispatch catches most failures and returns null, leaving no guaranteed retry. For example, store seeding at `deliveryDispatcher.js:259` or StoreOrder persistence may fail after the customer Order was committed. Only the no-manager branch reliably records a routing failure; the broad exception handler just logs it.

Repository-wide search found `reconcileMissedDispatches` only at its definition, with no invocation or registration in the running backend. Even if invoked manually, it only considers recently updated `confirm` orders and skips every order with any existing part. A restart or transient database error can strand a successful checkout.

Persist a dispatch job/outbox together with order confirmation, run a retry worker, and track attempts and failure reasons. Repair invalid/missing parts rather than treating any part as complete routing.

### 6. P1 — Global location can overwrite the chosen saved delivery address

Evidence: `frontend/src/pages/Checkout.jsx:94`, `:393`, `:978`; `backend/legacy/utils/orderHelpers.js:404`, `:450`; `Customerapp/lib/features/checkout/checkout_screen.dart:214`.

The web preview selects a store using the chosen address, while placement sends global `readDeliveryLocation()` data. `mergeCustomerLocation` overwrites the chosen address's full address, area, city, state, PIN and GPS. Reproduced: a saved Pune address becomes Mumbai coordinates and locality when the global location differs. Dispatch can consequently choose a different store from the checkout preview.

The mobile payment screen correctly prefers its selected address (`payment_screen.dart:181`), while the mobile checkout attempt uses the global provider; that inconsistency can also change attempted-order snapshots. Use one authoritative delivery-address snapshot for preview, payment and dispatch. Location payloads should fill missing information rather than replace an explicitly selected valid address.

### 7. P1 — Manager login changes the physical dark store's coordinates

Evidence: `DeliveryManager/src/pages/auth/LoginPage.jsx:30`; `backend/delivery-service/src/controllers/managerAuthController.js:142`.

The login UI submits the device's current GPS, and the server writes it into DeliveryManager.latitude/longitude. A manager signing in from home or travelling moves the store's routing location. Another manager logging in from the same device can make multiple stores appear colocated. Nearest-store selection, displayed distances and delivery serviceability then use the wrong store position.

Keep fixed store coordinates separate from a manager/device's current location. Change the store pin only through an explicit authorized store-location edit.

### 8. P1 — Routing eligibility disagrees with manager access eligibility

Evidence: `backend/delivery-service/src/services/darkStoreResolver.js:217`; `backend/delivery-service/src/middleware/requireDeliveryManager.js:10`; `backend/delivery-service/src/services/multivendorAccess.js:3`.

The resolver accepts any `isActive: true` manager, including a store with no existing active multivendor. The manager API denies that same account because it requires an active multivendor. This can accept customer orders for a store whose operator cannot load the order queue. Reproduced using an active store with blank vendorId. The current production store has a valid active parent, so this is not the present cause for its three assigned orders.

Share one store-eligibility rule between catalog, checkout, dispatch and manager access. Vendor suspension/deletion must also handle open orders.

### 9. P1 — A failed second mixed-cart part is permanently skipped on retry

Evidence: `backend/legacy/services/deliveryDispatcher.js:230`, `:293`, `:323`, `:435`.

Immediate and pre-order StoreOrders are written sequentially without a transaction or per-part recovery. If the first part succeeds and the second fails, the catch returns null. Future dispatch calls stop as soon as they find the first part, and recovery also skips the order. The customer has an order containing both sets of goods but the pre-order part never reaches its queue.

Reproduced with an injected second-create error: one `sourcePart: now` record remained and retry never attempted the missing pre-order part. Persist/recover by `(sourceOrderId, sourcePart)`, verify completeness, and make stock and totals safe under retries.

### 10. P2 — The initial 3 km branch ignores a store's smaller configured radius

Evidence: `backend/delivery-service/src/services/darkStoreResolver.js:241`, `:254`.

A store 2.22 km away with `deliveryRadiusKm: 1` was accepted by the initial 3 km branch. The configured radius is only checked later, so it cannot restrict that first branch. Apply the configured service boundary before choosing the nearest candidate and explicitly define how the global radius combines with it.

### 11. P2 — Catalog and actual immediate-order checkout use different fallback rules

Evidence: `backend/delivery-service/src/services/nearestStoreCatalog.js:246`; `backend/legacy/services/deliveryDispatcher.js:54`.

The catalog enables PIN/city fallback for both pre-order and instant departments. Actual dispatch enables it only when all lines are pre-order. Reproduced: the same out-of-radius address with city information returned a store when fallback was enabled and no store when disabled. Customers may see a serving store/catalog and then be rejected at COD checkout; after online payment, verification does not repeat `requireDarkStore`, allowing successful finalization followed by a failed dispatch if eligibility changed.

Use one server-derived serving-store decision for preview and checkout, and validate/persist it consistently across payment and dispatch. Handle serviceability changes after payment explicitly.

### 12. P2 — A missing pre-order slot sends preorder products to the immediate queue

Evidence: `backend/legacy/utils/preOrderHelpers.js:83`, `:85`; `backend/legacy/services/deliveryDispatcher.js:293`.

An empty slot passes validation. Dispatch sets `isPreOrder` based on the presence of a slot, so a preorder product without a slot becomes `order_received` with `isPreOrder: false`, bypassing the vendor pre-order pipeline. Reproduced using a preorder item and blank slot. Standard web/mobile UI normally asks for a slot, but the API does not enforce this against missing or old-client payloads.

Classify by product department first, and require a valid slot whenever a cart contains preorder lines. Verification callbacks must preserve and validate the original slot/date.

## Additional risks outside the seven observed assignments

- **Online payment rebuilding mutable checkout state:** `paymentController.js:241` re-runs checkout preparation after a valid payment signature using current cart/products/prices. Errors at `:252` or a changed total at `:263` return without finalizing the paid checkout. No payment webhook recovery path was identified in the inspected order/payment routes. This is a code-path risk, not evidence of a failed payment in the production sample.
- **Manual UPI review does not synchronize existing store payment state:** proof submission calls finalization with `pending_verification` (`paymentController.js:392`), which can dispatch before approval. On approval, dispatch returns the existing StoreOrder before copying its newly paid status. This requires separate payment-status tests and a defined policy for unverified orders; it is not the reason the current three preorders are hidden.
- **Legacy alternative order API:** `/api/delivery-orders` accepts a caller-supplied manager ID and creates a separate DeliveryOrder via `delivery-service/src/controllers/orderController.js:94` and `:144`. The main manager Orders page queries StoreOrder instead. This is a separate compatibility/security risk if another client uses that endpoint. The inspected Customerapp places normal orders through `/api/orders`, so it is not its observed primary path.

## Checks that do not explain the current missing orders

- Customer FCM token absence does not block dispatch. `notificationService.js:209` returns `delivered: false` after persisting the notification, and order callers do not depend on push success.
- Manager event emit room `store_<managerId>` matches the room derived for delivery-manager JWTs in `shared/realtime/identity.js:48`. No room-name mismatch was found in this path.
- Manager Orders explicitly requests `preOrder: include` and includes `preorder_hold` status (`OrdersPage.jsx:87`). The current web issue is the additional date filter, not simply omission from the HTTP request.
- `preorder_hold` is an intentional stage pending the vendor workflow; it is not proof that dispatch failed.

## Reproduction and recommended order of repair

`node backend/scripts/diagnoseOrderRouting.mjs` runs isolated diagnostics with mocked model methods; it makes no database connection. Ten existing problems were reproduced, including partial-write fault injection. These diagnostics assert the current defects and should be converted to desired-behavior regression tests when fixes are implemented.

1. Recover the four dangling production orders using a reviewed reassignment procedure; prevent store deletion from stranding live orders.
2. Make upcoming/open pre-orders visible by default; expose Tomorrow and date-filter context.
3. Make dispatch durable and independent of cart cleanup; add missing/invalid/partial-assignment recovery.
4. Unify delivery-address precedence, fixed-store GPS, eligible-store selection and radius rules.
5. Fix mixed-part retries, pre-order validation and payment-state synchronization.

No application fixes or production changes were applied as part of this audit.

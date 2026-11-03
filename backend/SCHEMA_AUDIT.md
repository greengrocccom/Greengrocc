# Database schema audit — 3 November 2026

Reviewed 65 schema modules covering 172 model names and 173 executed schema registrations. Compared schema indexes with the database configured in `backend/.env`, with automatic collection/index creation disabled. This is a read-only review, not a migration or a complete record-by-record data integrity check. The configured database is not independently verified as the Ubuntu production database.

## Confirmed findings

| Priority | Finding | Evidence and impact |
| --- | --- | --- |
| High | Three pre-validation hooks use removed callback behavior | `delivery-service/src/models/Alert.js:48`, `Incentive.js:46`, and `Order.js:175` accept and call `next`. Calling `validate()` on all three under the installed Mongoose produced `next is not a function`. Creates/saves that validate these documents can fail. Use synchronous or async middleware without the callback. |
| High | Two incompatible Order schemas register the same model and collection | `delivery-service/src/models/Order.js:185` deletes the registered `Order` model before registering its delivery schema. `legacy/models/order/Order.js` registers the customer schema under the same name. Loading delivery first then customer reproduces `Cannot overwrite Order model once compiled`. The reverse order can replace the global model used for population. Both default to the `orders` collection. These definitions need an explicit shared-model or separate-model/collection design; do not rename collections without accounting for existing data and consumers. |
| High | Delivery references point to unregistered models | Alert has `Manager` references at lines 7 and 13 and a `Rider` reference at line 37. Delivery Order has `Manager` references at lines 18/25 and `Rider` references at lines 74/144. The registered models are `DeliveryManager` and `DeliveryBoy`. Active alert/order controllers populate rider fields; affected populate calls can fail with missing-model errors. |
| High | ERP village uniqueness is missing and existing data violates it | `erp-service/src/models/location.js:72` declares unique `(talukaId, villageCode)`, but the live database lacks this index. A read-only aggregation found **two duplicate-key groups**. Reconcile the records and their references before creating the constraint. No records were modified or deleted. |
| Medium | Category model behavior depends on import order | `legacy/models/Category.js:60` and `product-service/src/models/Category.js:99` register different schemas as `GreenGroccCategory`, guarded by the same model cache. Legacy-first loading was reproduced: both imports return the legacy model, which lacks `itemCount` and other richer schema fields/hooks. Category image required/default behavior also differs. Consolidate the definitions around a single canonical schema. |
| Medium | Inventory batch uniqueness is declared but unenforced | `admin-ops-service/src/models.js:936` declares unique `batchNumber` on `AdminInventoryBatch`; the existing `batchNumber_1` database index is non-unique. No duplicate batch-number groups were found at audit time. A controlled index migration is still required; the audit did not perform one. |
| Medium | FullTimeRule schema and deployed uniqueness differ | `delivery-service/src/models/FullTimeRule.js:5` specifies a non-unique manager index, while the database has unique `managerId_1`. Its controller explicitly expects one rule per manager. The schema should express that intended uniqueness so newly provisioned databases behave consistently. |
| Medium | Unblock review reference names a nonexistent model | `legacy/models/UnblockRequest.js:49` refers to `Admin`, but the separate administrator model registers as `AdminAccount`. Review assignment uses `req.user.id`, so verify whether existing reviewers are customer-admin users or separate admin accounts before choosing the replacement/refPath. Population would currently fail when attempted. |

## Additional startup/index observation

`farmer-manager-service/src/models.js:1498` unconditionally attempts to drop `cropId_1` at startup, although the schema still declares a non-unique cropId index. It was absent during the first live scan and present during the second. The migration comment describes removing an old **unique** index; inspect its options and drop only the incompatible legacy index rather than every index with that name. This also prevents repeated removal/recreation of a valid index.

## Checks without findings

- No duplicate index keys within the audited individual schemas.
- No declared index paths missing from the audited schemas.
- No literal defaults outside their field enums in the audited schema paths, including nested schemas.
- No deprecated literal `new: true`, `new: false`, or `returnOriginal` update options in the preceding repository scan.
- Corrected farmer unique indexes from the earlier fix were compatible during this review.

These checks do not establish that every existing document satisfies current validation, or that every ObjectId/string relationship resolves. Those require a separate data integrity scan and application-flow tests.

## Artifacts and rerun

- `scripts/auditSchemas.mjs`: reusable source audit; `--live` adds read-only index comparison.
- `schema-audit.json`: source findings.
- `schema-audit-live.json`: latest configured-database index comparison.

From the repository root:

```sh
node backend/scripts/auditSchemas.mjs --output=backend/schema-audit.json
node backend/scripts/auditSchemas.mjs --live --output=backend/schema-audit-live.json
```

The importer deliberately checks all schema modules together and records import failures. Some collisions depend on load order; a currently running server does not rule them out. Guarded alternative definitions are also identified by source inspection. No runtime schemas, records, collections, or indexes were changed by this audit.

/**
 * GET endpoints that clients may subscribe to as live views, and the
 * MongoDB collections whose writes can change each endpoint's response.
 * A route matches its `path` and every sub-path.
 */

const STORE_COLLECTIONS = [
  "storeorders",
  "deliveryboys",
  "storeinventories",
  "inventoryrequests",
  "cashsettlements",
  "shifts",
  "returnpickups",
  "gigs",
  "incentives",
  "alerts",
  "deliverymanagers",
];

const FARM_COLLECTIONS = [
  "farmerorders",
  "farmerharvestorders",
  "pickups",
  "pickupdrivers",
  "qualityinspections",
  "farmerproducts",
  "farmerstockhistories",
  "farmers",
  "farmermanagers",
  "farmerearnings",
  "farmerdocuments",
  "farmercrops",
  "farmercropplans",
  "collectioncentres",
  "vendors",
  "farmernotifications",
  "pickupdrivernotifications",
];

const CATALOG_COLLECTIONS = ["greengroccproducts", "greengrocccategories", "greengroccsections"];

const RIDER_PRESENCE_FIELDS = ["currentLocation", "lastSeenAt", "updatedAt", "fcmToken", "pendingSlotAlerts"];
/** Live rider GPS copied onto an order every few seconds; dashboards don't depend on it. */
const ORDER_TRACKING_FIELDS = ["driverLocation", "updatedAt"];

const sameId = (a, b) => String(a || "") === String(b || "");

/** Skip recomputing a delivery manager's views for another store's writes. */
function storeScope(doc, identity) {
  if (identity?.role !== "delivery_manager") return true;
  const storeId = doc.managerId || doc.darkStoreId || doc.storeId;
  if (!storeId) return true;
  return sameId(storeId, identity.id);
}

/** Skip recomputing a customer's order views for other customers' orders. */
function customerScope(doc, identity) {
  if (!identity || identity.role === "admin") return true;
  if (!doc.user) return true;
  return sameId(doc.user, identity.id);
}

export const LIVE_ROUTES = [
  {
    path: "/api/delivery-managers",
    deps: STORE_COLLECTIONS,
    scope: storeScope,
    ignoreFields: { deliveryboys: RIDER_PRESENCE_FIELDS, storeorders: ORDER_TRACKING_FIELDS },
  },
  { path: "/api/alerts", deps: ["alerts"], scope: storeScope },
  {
    path: "/api/staff/preorders",
    deps: ["storeorders", "deliveryboys", "deliverymanagers"],
    ignoreFields: { deliveryboys: RIDER_PRESENCE_FIELDS, storeorders: ORDER_TRACKING_FIELDS },
  },
  { path: "/api/staff/inventory-requests", deps: ["inventoryrequests", "deliverymanagers"] },
  { path: "/api/staff", exact: true, deps: ["staffs"] },
  { path: "/api/admin-ops/tracking", deps: ["deliveryboys", "storeorders"], minIntervalMs: 3000 },
  {
    path: "/api/admin-ops/delivery",
    deps: ["storeorders", "deliveryboys"],
    ignoreFields: { deliveryboys: RIDER_PRESENCE_FIELDS, storeorders: ORDER_TRACKING_FIELDS },
  },
  {
    path: "/api/admin-ops/govt-schemes/applications",
    exact: true,
    deps: ["adminfarmerschemeapplications", "admingovernmentschemes"],
  },
  {
    path: "/api/admin-ops/govt-schemes/applications/mine",
    exact: true,
    deps: ["adminfarmerschemeapplications", "admingovernmentschemes"],
  },
  { path: "/api/admin-ops/govt-schemes/live", exact: true, deps: ["admingovernmentschemes"] },
  {
    path: "/api/admin/dark-stores",
    deps: ["deliverymanagers", "storeinventories", "storeorders"],
    ignoreFields: { storeorders: ORDER_TRACKING_FIELDS },
  },
  { path: "/api/products/all", deps: CATALOG_COLLECTIONS },
  {
    path: "/api/admin/notifications/system-alerts",
    exact: true,
    deps: ["adminhrpayrolls", "adminhrmeetings", "adminhrcandidates", "adminhrleaverequests", "adminb2bclients", "payments", "notifications", "adminalertstates"],
    minIntervalMs: 1000,
  },
  {
    path: "/api/orders/admin/unrouted",
    exact: true,
    deps: ["orders", "storeorders", "users"],
    ignoreFields: { storeorders: ORDER_TRACKING_FIELDS },
  },
  { path: "/api/categories", deps: ["greengrocccategories"], public: true },
  { path: "/api/sections", deps: ["greengroccsections"], public: true },
  { path: "/api/orders", deps: ["orders"], scope: customerScope },
  { path: "/api/farmer", deps: FARM_COLLECTIONS },
  { path: "/api/farmers", deps: FARM_COLLECTIONS },
  { path: "/api/farmer-manager", deps: FARM_COLLECTIONS },
  {
    path: "/api/vendor/preorders",
    deps: ["storeorders", "deliveryboys", "deliverymanagers"],
    ignoreFields: { deliveryboys: RIDER_PRESENCE_FIELDS, storeorders: ORDER_TRACKING_FIELDS },
  },
  { path: "/api/vendor", deps: [...FARM_COLLECTIONS, "inventoryrequests"] },
  { path: "/api/driver", deps: FARM_COLLECTIONS },
  { path: "/api/quality", deps: FARM_COLLECTIONS },
];

import authRoutes from "./routes/authRoutes.js";
import shipmentRoutes from "./routes/shipmentRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import managerRoutes from "./routes/managerRoutes.js";
import adminDarkStoreRoutes from "./routes/adminDarkStoreRoutes.js";
import storeCatalogRoutes from "./routes/storeCatalogRoutes.js";
import liveRoutes from "./liveRoutes.js";

import orderRoutes from "./routes/order.routes.js";
import alertRoutes from "./routes/alert.routes.js";
import incentiveRoutes from "./routes/incentive.routes.js";

export default [
  { path: "/api/delivery-boys", router: authRoutes },
  { path: "/api/delivery-managers", router: managerRoutes },
  { path: "/api/admin/dark-stores", router: adminDarkStoreRoutes },
  { path: "/api/stores", router: storeCatalogRoutes },
  { path: "/api/webhooks", router: webhookRoutes },
  { path: "/api/shipments", router: shipmentRoutes },
  ...liveRoutes,
  { path: "/api/delivery-orders", router: orderRoutes },
  { path: "/api/alerts", router: alertRoutes },
  { path: "/api/incentives", router: incentiveRoutes },
];

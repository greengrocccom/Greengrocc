import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __backendDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__backendDir, ".env") });
dotenv.config();
import http from "http";
import express from "express";
import cors from "cors";
import compression from "compression";
import { connectDB, errorHandler, notFound } from "@greengrocc/shared";
import { initSocket } from "./shared/socket.js";
import { startChangeFeed, notifyWriteRequest } from "./shared/realtime/changeFeed.js";
import { startLiveViews } from "./shared/realtime/liveViews.js";
import { memoryCacheStats } from "./shared/cache/memoryCache.js";
import { LIVE_ROUTES } from "./realtime/liveRoutes.js";
import { startCatalogPublisher } from "./realtime/catalogPublisher.js";
import { startOrderStatusNotifier } from "./realtime/orderStatusNotifier.js";
import { registerOrderTrackingSocket, startOrderStatusRelay } from "./realtime/orderTracking.js";
import { startNotificationScheduler } from "./legacy/services/promotionalBroadcast.js";
// Ensure User model is registered for admin JWT role resolution
import "./legacy/models/user.js";

import authRoutes from "./auth-service/src/routes.js";
import userRoutes from "./user-service/src/routes.js";
import productRoutes from "./product-service/src/routes.js";
import inventoryRoutes from "./inventory-service/src/routes.js";
import orderRoutes from "./order-service/src/routes.js";
import paymentRoutes from "./payment-service/src/routes.js";
import deliveryRoutes from "./delivery-service/src/routes.js";
import notificationRoutes from "./notification-service/src/routes.js";
import staffRoutes from "./staff-service/src/routes.js";
import farmerManagerRoutes from "./farmer-manager-service/src/routes.js";
import erpRoutes from "./erp-service/src/routes.js";
import { seedInitialData } from "./farmer-manager-service/src/controllers.js";
import { seedErpMasters } from "./erp-service/src/seed.js";
import { seedDefaultSectionsIfEmpty } from "./product-service/src/controllers/sectionController.js";
import { seedDefaultCategoriesIfEmpty } from "./product-service/src/controllers/categoryController.js";
import { backfillBaseProductsFromProducts } from "./product-service/src/controllers/baseProductController.js";
import { importDefaultBannersIfEmpty } from "./product-service/src/services/defaultBanners.js";
import { seedDefaultCouponsIfEmpty } from "./legacy/controllers/couponController.js";
import { seedDefaultAdminIfEmpty } from "./legacy/controllers/userController.js";
import rewardRoutes from "./legacy/routes/rewardRoutes.js";
import storeSettingsRoutes from "./legacy/routes/storeSettingsRoutes.js";
import { seedDefaultRewardSettingsIfEmpty } from "./legacy/controllers/rewardController.js";
import { initIncentiveCron } from "./delivery-service/src/services/incentiveCronService.js";
import { initShiftEndOfflineCron } from "./delivery-service/src/services/shiftEndOfflineService.js";
import { initShiftStartNotifyCron } from "./delivery-service/src/services/shiftStartNotifyService.js";
import { initWalletCreditCron } from "./delivery-service/src/services/WalletCreditService.js";
import adminDarkStoreRoutes from "./delivery-service/src/routes/adminDarkStoreRoutes.js";
import storeCatalogRoutes from "./delivery-service/src/routes/storeCatalogRoutes.js";
import adminOpsRoutes from "./admin-ops-service/src/routes.js";
import { seedDefaultPricingRule } from "./admin-ops-service/src/pricingAttach.js";
import { seedDefaultRolePoliciesIfEmpty } from "./admin-ops-service/src/policyControllers.js";
import { purgeLegacySeedMarketPrices } from "./admin-ops-service/src/marketPriceControllers.js";
import { purgeLegacySeedB2bClients } from "./admin-ops-service/src/b2bControllers.js";
import { purgeLegacySeedVendorReviews } from "./farmer-manager-service/src/vendorReviewVacationControllers.js";
import { keepRawBodyForWebhooks } from "./shared/rawBody.js";

const PORT = process.env.PORT || 5001;

const allRoutes = [
  ...authRoutes,
  ...userRoutes,
  ...productRoutes,
  ...inventoryRoutes,
  ...orderRoutes,
  ...paymentRoutes,
  ...deliveryRoutes,
  ...notificationRoutes,
  ...staffRoutes,
  ...farmerManagerRoutes,
  ...erpRoutes,
  ...adminOpsRoutes,
];

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (Postman, curl, server-to-server)
      if (!origin) return callback(null, true);

      // Dynamically allow any localhost or 127.0.0.1 dev server port
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      const allowedOrigins = process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
        : [];

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);
app.use(compression({ threshold: 1024 }));
app.use(express.json({ limit: "50mb", verify: keepRawBodyForWebhooks }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use((req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    res.on("finish", () => {
      if (res.statusCode < 400) notifyWriteRequest();
    });
  }
  next();
});

app.get("/", (_req, res) => {
  res.json({ message: "GreenGrocc API is running" });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    services: [
      "auth",
      "user",
      "product",
      "inventory",
      "order",
      "payment",
      "delivery",
      "notification",
      "staff",
      "farmer-manager",
      "erp",
      "admin-ops",
    ],
    caches: memoryCacheStats(),
  });
});

for (const { path, router } of allRoutes) {
  app.use(path, router);
}

app.use("/api/admin/dark-stores", adminDarkStoreRoutes);
app.use("/api/stores", storeCatalogRoutes);
app.use("/api/rewards", rewardRoutes);
app.use("/api/settings", storeSettingsRoutes);

app.use(notFound);
app.use(errorHandler);

if (!process.env.JWT_SECRET) {
  console.warn(
    "Warning: JWT_SECRET is not set in .env — signup and login will fail until you add it."
  );
}

connectDB("server").then(async () => {
  await seedInitialData();
  await seedErpMasters();
  await seedDefaultAdminIfEmpty();
  await seedDefaultSectionsIfEmpty();
  await seedDefaultCategoriesIfEmpty();
  await backfillBaseProductsFromProducts();
  importDefaultBannersIfEmpty();
  await seedDefaultCouponsIfEmpty();
  await seedDefaultRewardSettingsIfEmpty();
  await seedDefaultPricingRule();
  await seedDefaultRolePoliciesIfEmpty();
  await purgeLegacySeedMarketPrices();
  await purgeLegacySeedB2bClients();
  await purgeLegacySeedVendorReviews();
  initIncentiveCron();
  initShiftEndOfflineCron();
  initShiftStartNotifyCron();
  initWalletCreditCron();
  {
    const { startAssignmentSweeper } = await import(
      "./delivery-service/src/services/OrderAssignmentService.js"
    );
    startAssignmentSweeper();
  }
  {
    const { settleEndedHourIncentives } = await import(
      "./delivery-service/src/services/slotAssignmentService.js"
    );
    setInterval(() => {
      settleEndedHourIncentives().catch((err) =>
        console.warn("[slotIncentive] hourly settle failed:", err.message)
      );
    }, 60 * 1000);
  }
  try {
    const { getFirebaseAdmin, getCustomerFirebaseAdmin } = await import(
      "./legacy/config/firebaseAdmin.js"
    );
    const appFb = getFirebaseAdmin();
    if (appFb) {
      console.log("[Firebase Delivery] Admin ready — delivery push notifications enabled.");
    } else {
      console.warn(
        "[Firebase Delivery] Admin not configured — put bulkserviceAccount.json in backend/legacy/config/ or set FIREBASE_* env vars."
      );
    }

    const customerFb = getCustomerFirebaseAdmin();
    if (customerFb) {
      console.log("[Firebase Customer] Admin ready — customer push notifications enabled.");
    } else {
      console.warn(
        "[Firebase Customer] Admin not configured — set CUSTOMER_FIREBASE_* env vars or put customerServiceAccount.json in backend/legacy/config/."
      );
    }
  } catch (err) {
    console.warn("[Firebase] Admin init failed:", err.message);
  }
  const server = http.createServer(app);
  const io = initSocket(server);
  startChangeFeed();
  startLiveViews({ port: PORT, routes: LIVE_ROUTES });
  startCatalogPublisher(io);
  startOrderStatusNotifier();
  registerOrderTrackingSocket(io);
  startOrderStatusRelay();
  void startNotificationScheduler();
  server.listen(PORT, () => {
    console.log(`GreenGrocc backend running on port ${PORT}`);
    console.log(`Socket.io live on port ${PORT}`);
  });
});

export default app;
 



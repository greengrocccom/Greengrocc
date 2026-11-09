import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import connectDB from "./config/dbconfig.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();
import { ensureUserIndexes } from "./utils/ensureUserIndexes.js";
import { ensureCartCompatibility } from "./utils/ensureCartCompatibility.js";
import "./models/user.js";
import heroBannerRoutes from "./routes/heroBannerRoutes.js";
import offerBannerRoutes from "./routes/offerBannerRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import addressRoutes from "./routes/addressRoutes.js";
import locationRoutes from "./routes/locationRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import adminOrderRoutes from "./routes/adminOrderRoutes.js";
import adminDarkStoreRoutes from "../delivery-service/src/routes/adminDarkStoreRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import supportRoutes from "./routes/supportRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import proxyRoutes from "./routes/proxyRoutes.js";
import brandRoutes from "./routes/brandRoutes.js";
import testimonialRoutes from "./routes/testimonialRoutes.js";
import storeSettingsRoutes from "./routes/storeSettingsRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import adminNotificationRoutes from "./routes/adminNotificationRoutes.js";
import testFcmRoutes from "./routes/testFcmRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import couponRoutes from "./routes/couponRoutes.js";
import { getFirebaseAdmin, getCustomerFirebaseAdmin } from "./config/firebaseAdmin.js";
import { keepRawBodyForWebhooks } from "../shared/rawBody.js";

const app = express();
// Default 5001 — macOS AirPlay Receiver often occupies port 5000.
const PORT = process.env.PORT || 5001;

if (!process.env.JWT_SECRET) {
  console.warn(
    "Warning: JWT_SECRET is not set in .env — signup and login will fail until you add it."
  );
}

app.use(
  cors({
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim())
      : true,
    credentials: true,
  })
);
app.use(express.json({ verify: keepRawBodyForWebhooks }));

app.get("/", (req, res) => {
  res.json({ message: "GreenGrocc API is running" });
});

app.use("/api/herobanners", heroBannerRoutes);
app.use("/api/offerbanners", offerBannerRoutes);
app.use("/api/users", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin/orders", adminOrderRoutes);
app.use("/api/admin/dark-stores", adminDarkStoreRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/proxy", proxyRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/testimonials", testimonialRoutes);
app.use("/api/settings", storeSettingsRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin/notifications", adminNotificationRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/test", testFcmRoutes);
app.use("/api/webhooks", webhookRoutes);

connectDB().then(async () => {
  try {
    await ensureUserIndexes();
  } catch (error) {
    console.error("User index setup failed:", error.message);
  }

  try {
    await ensureCartCompatibility();
  } catch (error) {
    console.error("Cart compatibility setup failed:", error.message);
  }

  try {
    getFirebaseAdmin();
    getCustomerFirebaseAdmin();
  } catch (error) {
    console.warn("Firebase Admin startup warning:", error.message);
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

export default app;

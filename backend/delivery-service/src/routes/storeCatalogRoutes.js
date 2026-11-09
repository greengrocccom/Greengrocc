import express from "express";
import DeliveryManager from "../models/DeliveryManager.js";
import StoreInventory, { hasAvailableExpr } from "../models/StoreInventory.js";
import { loadNearestStoreCatalog, storePublicPayload } from "../services/nearestStoreCatalog.js";

const router = express.Router();

router.get("/all", async (req, res, next) => {
  try {
    const managers = await DeliveryManager.find({ isActive: true }).lean();
    const storesWithCounts = await Promise.all(
      managers.map(async (m) => {
        const inStockCount = await StoreInventory.countDocuments({
          managerId: m._id,
          isActive: true,
          ...hasAvailableExpr(1),
        });
        return storePublicPayload(m, { inStockCount });
      })
    );
    return res.json({ success: true, data: storesWithCounts });
  } catch (error) {
    next(error);
  }
});

router.get("/nearest", async (req, res, next) => {
  try {
    const catalog = await loadNearestStoreCatalog(req.query);
    return res.json({
      success: true,
      store: catalog.store,
      inStockCount: Number(catalog.store?.inStockCount) || 0,
      categories: catalog.store?.categories || [],
      needsLocation: Boolean(catalog.needsLocation),
      reason: catalog.reason,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

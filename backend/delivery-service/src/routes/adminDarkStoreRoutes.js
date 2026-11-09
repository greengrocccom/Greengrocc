import express from "express";
import {
  adjustDarkStoreInventoryItem,
  checkDarkStoreCoverage,
  createDarkStoreInventoryItem,
  getDarkStore,
  listDarkStoreCoverage,
  listDarkStoreInventory,
  listDarkStores,
  updateDarkStoreCoverage,
  updateDarkStoreInventoryItem,
  updateDarkStoreLocation,
} from "../controllers/adminDarkStoreController.js";
import { protect } from "../../../legacy/middleware/authMiddleware.js";
import { requireRoles } from "../../../shared/middleware/auth.js";

const router = express.Router();
const adminOnly = [protect, requireRoles("admin")];

router.get("/", listDarkStores);
router.get("/coverage", ...adminOnly, listDarkStoreCoverage);
router.post("/coverage/check", ...adminOnly, checkDarkStoreCoverage);
router.put("/:id/coverage", ...adminOnly, updateDarkStoreCoverage);
router.get("/:id/inventory", listDarkStoreInventory);
router.post("/:id/inventory", createDarkStoreInventoryItem);
router.patch("/:id/inventory/:itemId", updateDarkStoreInventoryItem);
router.post("/:id/inventory/:itemId/adjust", adjustDarkStoreInventoryItem);
router.get("/:id", getDarkStore);
router.patch("/:id", updateDarkStoreLocation);
router.put("/:id", updateDarkStoreLocation);

export default router;

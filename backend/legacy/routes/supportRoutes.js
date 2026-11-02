import express from "express";
import {
  getAllSupportMessages,
  getSupportMessageById,
  getSupportUnreadCount,
  submitSupportMessage,
  getSupportContact,
  updateSupportMessageStatus,
} from "../controllers/supportController.js";
import { optionalProtect, protect, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/contact", getSupportContact);
router.post("/", optionalProtect, submitSupportMessage);

router.get("/admin", protect, requireAdmin, getAllSupportMessages);
router.get("/admin/unread-count", protect, requireAdmin, getSupportUnreadCount);
router.get("/admin/:id", protect, requireAdmin, getSupportMessageById);
router.patch("/admin/:id", protect, requireAdmin, updateSupportMessageStatus);

export default router;

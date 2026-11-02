import express from "express";
import { protect, requireAdmin } from "../middleware/authMiddleware.js";
import { signup, login, loginWithPhone, sendOtpLogin, resendOtpLogin, verifyOtpLogin, completeOtpSignup, resetPasswordWithPhoneOtp, createUnblockRequest, getMe, updateMe, changeMyPassword, sendAdminSecurityOtp, verifyAdminSecurityOtpController, sendAdminLoginOtp, resendAdminLoginOtp, verifyAdminLoginOtp, requestAdminPasswordReset, resetAdminPassword, createUser, getUsers, getUserOrderStats, updateUser, deleteUser } from "../controllers/userController.js";
import { clearFcmToken, saveFcmToken } from "../controllers/fcmTokenController.js";
import {
  addAddressForUser,
  getAddressesForUser,
  updateAddressForUser,
} from "../controllers/addressController.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/login/phone", loginWithPhone);
router.post("/unblock-request", createUnblockRequest);
router.post("/admin/forgot-password", requestAdminPasswordReset);
router.post("/admin/reset-password", resetAdminPassword);
router.post("/admin/otp/send", sendAdminLoginOtp);
router.post("/admin/otp/resend", resendAdminLoginOtp);
router.post("/admin/otp/verify", verifyAdminLoginOtp);
router.post("/otp/send", sendOtpLogin);
router.post("/otp/resend", resendOtpLogin);
router.post("/otp/verify", verifyOtpLogin);
router.post("/otp/complete-signup", completeOtpSignup);
router.post("/password/reset", resetPasswordWithPhoneOtp);
router.get("/me", protect, getMe);
router.post("/me/security-otp", protect, sendAdminSecurityOtp);
router.post("/me/security-otp/resend", protect, sendAdminSecurityOtp);
router.post("/me/security-otp/verify", protect, verifyAdminSecurityOtpController);
router.patch("/me", protect, updateMe);
router.patch("/me/password", protect, changeMyPassword);
router.put("/me/password", protect, changeMyPassword);
router.post("/fcm-token", protect, saveFcmToken);
router.delete("/fcm-token", protect, clearFcmToken);
router.get("/", protect, requireAdmin, getUsers);
router.post("/", protect, requireAdmin, createUser);
router.get("/:id/order-stats", protect, requireAdmin, getUserOrderStats);
router.get("/:userId/addresses", protect, requireAdmin, getAddressesForUser);
router.post("/:userId/addresses", protect, requireAdmin, addAddressForUser);
router.put("/:userId/addresses/:addressId", protect, requireAdmin, updateAddressForUser);
router.put("/:id", protect, requireAdmin, updateUser);
router.delete("/:id", protect, requireAdmin, deleteUser);

export default router;

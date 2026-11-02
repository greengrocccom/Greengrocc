import express from "express";
import {
  signup,
  login,
  loginWithPhone,
  sendOtpLogin,
  resendOtpLogin,
  verifyOtpLogin,
  completeOtpSignup,
  resetPasswordWithPhoneOtp,
  sendAdminLoginOtp,
  resendAdminLoginOtp,
  verifyAdminLoginOtp,
  sendAdminSecurityOtp,
  verifyAdminSecurityOtpController,
  requestAdminPasswordReset,
  resetAdminPassword,
  createUnblockRequest,
  getMe,
  updateMe,
  changeMyPassword,
} from "../../../legacy/controllers/userController.js";
import { protect } from "../../../legacy/middleware/authMiddleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/login/phone", loginWithPhone);
router.post("/unblock-request", createUnblockRequest);

// OTP routes for customer login & registration
router.post("/otp/send", sendOtpLogin);
router.post("/otp/resend", resendOtpLogin);
router.post("/otp/verify", verifyOtpLogin);
router.post("/otp/complete-signup", completeOtpSignup);
router.post("/password/reset", resetPasswordWithPhoneOtp);

// Admin OTP login & security
router.post("/admin/otp/send", sendAdminLoginOtp);
router.post("/admin/otp/resend", resendAdminLoginOtp);
router.post("/admin/otp/verify", verifyAdminLoginOtp);
router.post("/admin/forgot-password", requestAdminPasswordReset);
router.post("/admin/reset-password", resetAdminPassword);
router.post("/me/security-otp", protect, sendAdminSecurityOtp);
router.post("/me/security-otp/resend", protect, sendAdminSecurityOtp);
router.post("/me/security-otp/verify", protect, verifyAdminSecurityOtpController);

router.get("/me", protect, getMe);
router.patch("/me", protect, updateMe);
router.patch("/me/password", protect, changeMyPassword);
router.put("/me/password", protect, changeMyPassword);

export default router;


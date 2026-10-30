import {
  assertMsg91Configured,
  isMsg91Configured,
  msg91Config,
  MSG91_TEMPLATES,
} from "../config/msg91.js";
import Otp from "../models/Otp.js";

const VERIFIED_PHONE_TTL_MS = 10 * 60 * 1000;
const verifiedPhoneStore = new Map();
const activeOtpStore = new Map();
const devMockOtpStore = new Map();

export function normalizeIndianPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10 && /^[6789]/.test(digits)) {
    return digits;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  return null;
}

export function toMsg91Mobile(phone10) {
  return `91${phone10}`;
}

/**
 * Maps friendly aliases or DLT template names to approved 19-digit MSG91 template IDs.
 */
export function resolveTemplateId(templateOrPurpose, role) {
  if (!templateOrPurpose && !role) return msg91Config.templateId;

  const raw = String(templateOrPurpose || "").trim();
  const key = raw.toLowerCase();
  const roleKey = String(role || "").trim().toLowerCase();

  // 1. If already a valid template ID from MSG91_TEMPLATES, return directly!
  if (Object.values(MSG91_TEMPLATES).includes(raw)) {
    return raw;
  }

  // 2. If it is a 24-character hex ID (MongoDB/MSG91 format) or 10-24 digit numeric ID, return directly!
  if (/^[a-f0-9]{24}$/i.test(raw) || /^\d{10,24}$/.test(raw)) {
    return raw;
  }

  // 3. Strict role-scoped resolution (ensures roles never get mixed up)
  if (roleKey === "admin") {
    return MSG91_TEMPLATES.ADMIN_LOGIN;
  }

  if (roleKey === "delivery_verification" || roleKey === "order_delivery" || roleKey === "verification") {
    return MSG91_TEMPLATES.DELIVERY_VERIFICATION;
  }

  if (
    roleKey === "delivery" ||
    roleKey === "delivery_partner" ||
    roleKey === "delivery_boy" ||
    roleKey === "rider" ||
    roleKey === "driver"
  ) {
    if (key === "register" || key === "signup" || key === "registration") {
      return MSG91_TEMPLATES.DELIVERY_PARTNER_REGISTRATION;
    }
    return MSG91_TEMPLATES.DELIVERY_PARTNER_LOGIN;
  }

  if (roleKey === "farmer" || roleKey === "haritsetu") {
    if (key === "register" || key === "signup" || key === "registration") {
      return MSG91_TEMPLATES.HARITSETU_REGISTRATION;
    }
    return MSG91_TEMPLATES.HARITSETU_LOGIN;
  }

  if (roleKey === "user" || roleKey === "customer" || roleKey === "frontend") {
    if (key === "register" || key === "signup" || key === "registration") {
      return MSG91_TEMPLATES.USER_REGISTRATION;
    }
    return MSG91_TEMPLATES.USER_LOGIN;
  }

  // 4. Purpose-based resolution when role is not passed
  // Delivery verification OTP (customer delivery handover)
  if (
    key === "delivery_verification_otp" ||
    key === "delivery_verification" ||
    key === "delivery_verify" ||
    key === "delivery_otp" ||
    key === "order_delivery"
  ) {
    return MSG91_TEMPLATES.DELIVERY_VERIFICATION;
  }

  // GreenGrocc Admin Login OTP
  if (
    key === "greengrocc admin login otp" ||
    key === "admin_login_otp" ||
    key === "admin_login" ||
    key === "admin" ||
    key === "admin_security" ||
    key === "admin_reset"
  ) {
    return MSG91_TEMPLATES.ADMIN_LOGIN;
  }

  // Delivery Partner Login OTP
  if (
    key === "delivery_partner_login_otp" ||
    key === "delivery_partner_login" ||
    key === "delivery_login" ||
    key === "rider_login" ||
    key === "driver_login"
  ) {
    return MSG91_TEMPLATES.DELIVERY_PARTNER_LOGIN;
  }

  // Delivery Partner Registration OTP
  if (
    key === "delivery_partner_reg_otp" ||
    key === "delivery_partner_registration" ||
    key === "delivery_partner_reg" ||
    key === "delivery_reg" ||
    key === "rider_reg" ||
    key === "driver_reg"
  ) {
    return MSG91_TEMPLATES.DELIVERY_PARTNER_REGISTRATION;
  }

  // Haritsetu Registration OTP (Farmer App)
  if (
    key === "haritsetu_registration_otp" ||
    key === "haritsetu_registration" ||
    key === "haritsetu_reg" ||
    key === "farmer_registration" ||
    key === "farmer_reg"
  ) {
    return MSG91_TEMPLATES.HARITSETU_REGISTRATION;
  }

  // Haritsetu Login OTP (Farmer App)
  if (
    key === "haritsetu_login_otp" ||
    key === "haritsetu_login" ||
    key === "farmer_login"
  ) {
    return MSG91_TEMPLATES.HARITSETU_LOGIN;
  }

  // GreenGrocc Customer Registration OTP
  if (
    key === "greengrocc_registration_otp" ||
    key === "user_registration" ||
    key === "user_reg" ||
    key === "signup" ||
    key === "register" ||
    key === "registration" ||
    key === "customer_reg"
  ) {
    return MSG91_TEMPLATES.USER_REGISTRATION;
  }

  // GreenGrocc Customer Login OTP
  if (
    key === "greengrocc_login_otp" ||
    key === "user_login" ||
    key === "login" ||
    key === "customer_login"
  ) {
    return MSG91_TEMPLATES.USER_LOGIN;
  }

  // 9. GreenGrocc Common OTP (GREGRC_Common_OTP)
  if (
    key === "common" ||
    key === "common_otp" ||
    key === "gregrc_common_otp" ||
    key === "gregrc_common" ||
    key === "general" ||
    key === "default"
  ) {
    return MSG91_TEMPLATES.COMMON_OTP;
  }

  // Fallback to GREGRC_Common_OTP for all other flows / unmapped roles
  return MSG91_TEMPLATES.COMMON_OTP || msg91Config.templateId;
}

async function parseMsg91Response(response) {
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    const message =
      data.message || data.type || `MSG91 request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

/**
 * Universal OTP dispatching helper supporting all 8 MSG91 Flow templates.
 */
export async function sendOtp({
  phone,
  purpose = "login",
  templateId,
  role,
  otp,
  otpLength,
  otpExpiryMinutes,
}) {
  const phone10 = normalizeIndianPhone(phone);
  if (!phone10) {
    throw new Error("Valid 10-digit Indian phone number required");
  }

  const finalTemplateId = templateId
    ? resolveTemplateId(templateId, role)
    : resolveTemplateId(purpose, role);
  const length = Number(otpLength || msg91Config.otpLength || 6);
  const expiry = Number(otpExpiryMinutes || msg91Config.otpExpiryMinutes || 10);
  const expiresAt = new Date(Date.now() + expiry * 60 * 1000);

  // Generate 6-digit (or requested length) OTP if not provided
  const otpCode = otp
    ? String(otp).trim()
    : String(Math.floor(Math.pow(10, length - 1) + Math.random() * 9 * Math.pow(10, length - 1)));

  // Save to in-memory active store
  activeOtpStore.set(phone10, {
    code: otpCode,
    purpose,
    role: role || "user",
    expiresAt: expiresAt.getTime(),
  });

  // Persist to MongoDB Otp collection for resiliency across restarts
  try {
    await Otp.findOneAndUpdate(
      { phone: phone10, purpose },
      { code: otpCode, role: role || "user", expiresAt },
      { upsert: true, returnDocument: "after" }
    );
  } catch (dbErr) {
    console.warn(`[OTP Store DB Note] ${dbErr.message}`);
  }

  if (process.env.OTP_DEBUG_LOG === "true") {
    console.log(`[OTP DEBUG] +91${phone10}: ${otpCode} (${purpose})`);
  }

  if (!isMsg91Configured()) {
    console.warn(
      `[MSG91 DEV MOCK] OTP for +91${phone10}: ${otpCode} | Template: ${finalTemplateId} (Configure MSG91_AUTH_KEY in .env for live SMS)`
    );
    return {
      success: true,
      message: "OTP sent successfully (dev mode)",
      devMock: true,
      templateId: finalTemplateId,
      code: otpCode,
    };
  }

  // Dispatch live SMS via MSG91 Flow API (substitutes ##number## in template)
  try {
    const payload = {
      template_id: finalTemplateId,
      short_url: "0",
      recipients: [
        // DLT templates name the OTP variable differently; MSG91 ignores unused keys.
        {
          mobiles: toMsg91Mobile(phone10),
          number: otpCode,
          OTP: otpCode,
          otp: otpCode,
          var: otpCode,
          var1: otpCode,
        },
      ],
    };

    console.log(`[MSG91-Flow] Dispatching OTP SMS to +91${phone10} via Flow template ${finalTemplateId}...`);
    const response = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: {
        authkey: msg91Config.authKey,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await parseMsg91Response(response);
    if (data.type === "error") {
      throw new Error(data.message || "MSG91 Flow failed to dispatch SMS");
    }

    console.log(`[MSG91-Flow] OTP SMS successfully dispatched to +91${phone10}. (MSG91 Request ID: ${data.message})`);
    return {
      success: true,
      message: "OTP sent successfully via SMS",
      templateId: finalTemplateId,
    };
  } catch (flowErr) {
    console.warn(`[MSG91 Flow Error] ${flowErr.message}. Trying SendOTP fallback...`);
    // Fallback to SendOTP v5 with body mapping
    try {
      const params = new URLSearchParams({
        template_id: finalTemplateId,
        mobile: toMsg91Mobile(phone10),
        otp: otpCode,
      });

      const fallbackRes = await fetch(
        `https://control.msg91.com/api/v5/otp?${params.toString()}`,
        {
          method: "POST",
          headers: {
            authkey: msg91Config.authKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ number: otpCode, otp: otpCode }),
        }
      );

      const fallbackData = await parseMsg91Response(fallbackRes);
      if (fallbackData.type === "error") {
        throw new Error(fallbackData.message || flowErr.message || "Failed to send OTP");
      }

      console.log(`[MSG91-SendOTP Fallback] OTP delivered to +91${phone10}`);
      return {
        success: true,
        message: "OTP sent successfully",
        templateId: finalTemplateId,
      };
    } catch (fallbackErr) {
      throw new Error(fallbackErr.message || "Failed to deliver OTP via MSG91");
    }
  }
}

/**
 * Resend OTP with fresh code and instant SMS dispatch.
 */
export async function resendOtp({
  phone,
  purpose = "login",
  templateId,
  role,
  retryType = "text",
}) {
  return sendOtp({
    phone,
    purpose,
    templateId,
    role,
  });
}

/**
 * Direct MSG91 Retry OTP helper.
 */
export async function retryOtp({ phone, retryType = "text" }) {
  return resendOtp({ phone, retryType });
}

/**
 * Universal OTP verification helper.
 * Validates against in-memory store and MongoDB Otp collection.
 */
export async function verifyOtp({ phone, otp, purpose }) {
  const phone10 = normalizeIndianPhone(phone);
  if (!phone10) {
    return { ok: false, message: "Valid 10-digit Indian phone number required" };
  }

  const cleanOtp = String(otp || "").trim();
  if (!cleanOtp || !/^\d{4,8}$/.test(cleanOtp)) {
    return { ok: false, message: "Please enter a valid OTP" };
  }

  // 1. Check in-memory store
  const cached = activeOtpStore.get(phone10);
  if (cached) {
    if (Date.now() > cached.expiresAt) {
      activeOtpStore.delete(phone10);
    } else if (cached.code === cleanOtp) {
      activeOtpStore.delete(phone10);
      try {
        await Otp.deleteMany({ phone: phone10 });
      } catch {}
      return { ok: true };
    }
  }

  // 2. Check MongoDB Otp collection
  try {
    const query = { phone: phone10, code: cleanOtp, expiresAt: { $gt: new Date() } };
    if (purpose) {
      if (purpose === "admin_login" || purpose === "login") {
        query.purpose = { $in: ["admin_login", "login"] };
      } else {
        query.purpose = purpose;
      }
    }
    const doc = await Otp.findOne(query);
    if (doc) {
      activeOtpStore.delete(phone10);
      await Otp.deleteMany({ phone: phone10 });
      return { ok: true };
    }
  } catch (dbErr) {
    console.warn(`[OTP Verify DB Note] ${dbErr.message}`);
  }

  // 3. Fallback to MSG91 SendOTP verify if configured
  if (isMsg91Configured()) {
    try {
      const { authKey } = msg91Config;
      const params = new URLSearchParams({
        mobile: toMsg91Mobile(phone10),
        otp: cleanOtp,
      });

      const response = await fetch(
        `https://control.msg91.com/api/v5/otp/verify?${params.toString()}`,
        {
          method: "GET",
          headers: {
            authkey: authKey,
            accept: "application/json",
          },
        }
      );

      const data = await parseMsg91Response(response);
      if (data.type !== "error" && data.message?.toLowerCase().includes("verified")) {
        activeOtpStore.delete(phone10);
        return { ok: true };
      }
    } catch {}
  }

  return { ok: false, message: "Invalid or expired OTP" };
}

// ----------------------------------------------------
// Specific Helper Wrappers for Apps & Roles
// ----------------------------------------------------

/** Customer / Userapp OTP Login */
export async function sendLoginOtp(phone10, purpose = "login") {
  const isReg = purpose === "signup" || purpose === "register" || purpose === "registration";
  return sendOtp({
    phone: phone10,
    role: "user",
    purpose: isReg ? "register" : "login",
    templateId: isReg ? MSG91_TEMPLATES.USER_REGISTRATION : MSG91_TEMPLATES.USER_LOGIN,
  });
}

export async function resendLoginOtp(phone10, purpose = "login") {
  const isReg = purpose === "signup" || purpose === "register" || purpose === "registration";
  return resendOtp({
    phone: phone10,
    role: "user",
    purpose: isReg ? "register" : "login",
    templateId: isReg ? MSG91_TEMPLATES.USER_REGISTRATION : MSG91_TEMPLATES.USER_LOGIN,
  });
}

export async function verifyLoginOtp(phone10, otp) {
  const loginResult = await verifyOtp({ phone: phone10, otp, purpose: "login" });
  if (loginResult.ok) return loginResult;
  const signupResult = await verifyOtp({ phone: phone10, otp, purpose: "register" });
  return signupResult.ok ? signupResult : loginResult;
}

/** Admin Login / Security OTP */
export async function sendAdminLoginOtp(phone10) {
  return sendOtp({
    phone: phone10,
    role: "admin",
    purpose: "admin_login",
    templateId: MSG91_TEMPLATES.ADMIN_LOGIN,
  });
}

export async function resendAdminLoginOtp(phone10) {
  return resendOtp({
    phone: phone10,
    role: "admin",
    purpose: "admin_login",
    templateId: MSG91_TEMPLATES.ADMIN_LOGIN,
  });
}

export async function verifyAdminLoginOtp(phone10, otp) {
  return verifyOtp({ phone: phone10, otp, purpose: "admin_login" });
}

/** Customer Delivery Verification OTP */
export async function sendDeliveryVerificationOtp(phone10, otpCode) {
  return sendOtp({
    phone: phone10,
    role: "delivery_verification",
    purpose: "delivery_verification",
    templateId: MSG91_TEMPLATES.DELIVERY_VERIFICATION,
    otp: otpCode,
    otpLength: String(otpCode).length,
  });
}

/** Delivery Partner App (Login / Registration) */
export async function sendDeliveryPartnerOtp(phone10, purpose = "login") {
  const isReg = purpose === "register" || purpose === "signup" || purpose === "registration";
  return sendOtp({
    phone: phone10,
    role: "delivery",
    purpose: isReg ? "register" : "login",
    templateId: isReg
      ? MSG91_TEMPLATES.DELIVERY_PARTNER_REGISTRATION
      : MSG91_TEMPLATES.DELIVERY_PARTNER_LOGIN,
  });
}

export async function resendDeliveryPartnerOtp(phone10, purpose = "login") {
  const isReg = purpose === "register" || purpose === "signup" || purpose === "registration";
  return resendOtp({
    phone: phone10,
    role: "delivery",
    purpose: isReg ? "register" : "login",
    templateId: isReg
      ? MSG91_TEMPLATES.DELIVERY_PARTNER_REGISTRATION
      : MSG91_TEMPLATES.DELIVERY_PARTNER_LOGIN,
  });
}

/** Farmer App / Haritsetu (Login / Registration) */
export async function sendFarmerOtp(phone10, purpose = "login") {
  const isReg = purpose === "register" || purpose === "signup" || purpose === "registration";
  return sendOtp({
    phone: phone10,
    role: "farmer",
    purpose: isReg ? "register" : "login",
    templateId: isReg
      ? MSG91_TEMPLATES.HARITSETU_REGISTRATION
      : MSG91_TEMPLATES.HARITSETU_LOGIN,
  });
}

export async function resendFarmerOtp(phone10, purpose = "login") {
  const isReg = purpose === "register" || purpose === "signup" || purpose === "registration";
  return resendOtp({
    phone: phone10,
    role: "farmer",
    purpose: isReg ? "register" : "login",
    templateId: isReg
      ? MSG91_TEMPLATES.HARITSETU_REGISTRATION
      : MSG91_TEMPLATES.HARITSETU_LOGIN,
  });
}

/** 9. GreenGrocc Common OTP (GREGRC_Common_OTP) for all other / generic flows */
export async function sendCommonOtp(phone10, purpose = "common") {
  return sendOtp({
    phone: phone10,
    purpose,
    templateId: MSG91_TEMPLATES.COMMON_OTP,
  });
}

export async function resendCommonOtp(phone10, retryType) {
  return resendOtp({
    phone: phone10,
    purpose: "common",
    templateId: MSG91_TEMPLATES.COMMON_OTP,
    retryType,
  });
}

export function markPhoneOtpVerified(phone10) {
  verifiedPhoneStore.set(phone10, Date.now() + VERIFIED_PHONE_TTL_MS);
}

export function consumeVerifiedPhone(phone10) {
  const expiresAt = verifiedPhoneStore.get(phone10);
  if (!expiresAt || Date.now() > expiresAt) {
    verifiedPhoneStore.delete(phone10);
    return false;
  }
  verifiedPhoneStore.delete(phone10);
  return true;
}

export function isPhoneOtpVerified(phone10) {
  const expiresAt = verifiedPhoneStore.get(phone10);
  if (!expiresAt || Date.now() > expiresAt) {
    verifiedPhoneStore.delete(phone10);
    return false;
  }
  return true;
}

export { isMsg91Configured, assertMsg91Configured, MSG91_TEMPLATES, msg91Config };


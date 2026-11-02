import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import Admin from "../models/admin.js";
import Order from "../models/order/Order.js";
import UnblockRequest from "../models/UnblockRequest.js";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination.js";
import { escapeRegex } from "../utils/adminSearch.js";
import {
  normalizeIndianPhone,
  sendLoginOtp as dispatchLoginOtp,
  resendLoginOtp as dispatchResendLoginOtp,
  verifyLoginOtp as validateLoginOtp,
  sendOtp,
  resendOtp,
  verifyOtp,
  resendAdminLoginOtp as dispatchResendAdminLoginOtp,
  verifyAdminLoginOtp as validateAdminLoginOtp,
  MSG91_TEMPLATES,
  markPhoneOtpVerified,
  consumeVerifiedPhone,
} from "../utils/msg91.js";

export function isUserBlocked(user) {
  if (!user || user.role === "admin") return false;
  const raw = typeof user.toObject === "function" ? user.toObject() : user;
  if (raw.isBlocked === true || raw.blocked === true) return true;
  if (raw.isActive === false || raw.active === false) return true;
  const status = String(raw.status || "").trim().toLowerCase();
  if (status === "blocked" || status === "inactive") return true;
  return false;
}

const signToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured on the server");
  }
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

const GST_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function getActiveAdminMobile() {
  try {
    const candidates = [
      path.resolve(process.cwd(), ".env"),
      path.resolve(process.cwd(), "backend", ".env"),
      path.resolve(process.cwd(), "..", ".env"),
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        const parsed = dotenv.parse(fs.readFileSync(cand, "utf8"));
        if (parsed.ADMIN_MOBILE) {
          process.env.ADMIN_MOBILE = parsed.ADMIN_MOBILE.trim();
          break;
        }
      }
    }
  } catch {}
  return normalizeIndianPhone(process.env.ADMIN_MOBILE || "");
}

const formatAuthUser = (user) => {
  const blocked = isUserBlocked(user);
  const adminMobile = getActiveAdminMobile();
  const phone = (user.role === "admin" && adminMobile)
    ? adminMobile
    : user.phone;
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone,
    shopNo: user.shopNo || "",
    shopName: user.shopName || "",
    shopAddress: user.shopAddress || "",
    gstNumber: user.gstNumber || "",
    accountType: user.accountType || "retail",
    ownerContact: user.ownerContact || "",
    role: user.role,
    rewardPoints: user.rewardPoints || 0,
    isBlocked: blocked,
    isActive: !blocked,
    status: blocked ? "blocked" : (user.status || "active"),
  };
};

function normalizeAccountType(value) {
  const normalized = String(value || "retail").trim().toLowerCase();
  if (normalized === "bulk" || normalized === "b2b" || normalized === "wholesale") {
    return "bulk";
  }
  return "retail";
}

function pickSignupProfileFields(body, accountType = "retail") {
  const fields = { accountType };
  if (body.shopName?.trim()) fields.shopName = body.shopName.trim();
  if (body.shopAddress?.trim()) fields.shopAddress = body.shopAddress.trim();
  if (body.shopNo?.trim()) fields.shopNo = body.shopNo.trim();
  if (body.gstNumber?.trim()) fields.gstNumber = body.gstNumber.trim().toUpperCase();
  if (body.ownerContact?.trim()) {
    fields.ownerContact = normalizeIndianPhone(body.ownerContact) || body.ownerContact.trim();
  }
  return fields;
}

function validateSignupProfile(body, accountType = "retail") {
  const shopName = body.shopName?.trim() || "";
  const shopAddress = body.shopAddress?.trim() || "";
  const gstNumber = body.gstNumber?.trim() || "";
  const ownerContactRaw = body.ownerContact?.trim() || "";
  const ownerContact = ownerContactRaw
    ? normalizeIndianPhone(ownerContactRaw) || ownerContactRaw
    : "";

  if (accountType === "bulk") {
    if (!shopName || shopName.length < 2) {
      return "Business name is required (at least 2 characters)";
    }
    if (!shopAddress || shopAddress.length < 5) {
      return "Please enter a complete business location";
    }
    if (!ownerContact) {
      return "Owner contact must be 10 digits starting with 6, 7, 8, or 9";
    }
  } else {
    if (shopName && shopName.length < 2) {
      return "Shop name must be at least 2 characters";
    }
    if (shopAddress && shopAddress.length < 5) {
      return "Please enter a complete shop address";
    }
    if (ownerContactRaw && !ownerContact) {
      return "Owner contact must be 10 digits starting with 6, 7, 8, or 9";
    }
  }

  if (gstNumber && !GST_PATTERN.test(gstNumber.toUpperCase())) {
    return "Please provide a valid GST number";
  }
  return null;
}

export const signup = async (req, res) => {
  try {
    const phone = normalizeIndianPhone(req.body.phone);
    const { name, password, role = "user" } = req.body;
    const accountType = normalizeAccountType(req.body.accountType || req.body.userType);
    const profileError = validateSignupProfile(req.body, accountType);
    if (profileError) {
      return res.status(400).json({
        success: false,
        message: profileError,
      });
    }
    const profileFields = pickSignupProfileFields(req.body, accountType);

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone must be 10 digits starting with 6, 7, 8, or 9",
      });
    }

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: accountType === "bulk" ? "Owner name is required" : "Name is required",
      });
    }

    if (!password || String(password).trim().length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const Model = role === "vendor" ? Vendor : role === "admin" ? Admin : User;

    const existingPhoneUser = await Model.findOne({ phone });
    if (existingPhoneUser) {
      const isAdmin = existingPhoneUser.role === "admin";
      return res.status(409).json({
        success: false,
        message: isAdmin
          ? "This phone number is reserved for an admin account. Please use a different number to sign up."
          : "An account with this phone number already exists. Please sign in instead.",
        code: isAdmin ? "PHONE_TAKEN_ADMIN" : "PHONE_TAKEN",
      });
    }

    const user = await Model.create({
      name: name.trim(),
      phone,
      email: req.body.email?.trim().toLowerCase() || undefined,
      password: String(password).trim(),
      role,
      ...profileFields,
    });

    const token = signToken(user._id);

    return res.status(201).json({
      success: true,
      data: {
        user: formatAuthUser(user),
        token,
      },
    });
  } catch (error) {
    return respondWithControllerError(res, error);
  }
};

export const login = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required",
      });
    }

    const normalizedPhone = phone ? normalizeIndianPhone(phone) : null;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedPhone && !normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: "Phone number or email is required",
      });
    }

    if (normalizedPhone && normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: "Please sign in with either phone or email, not both",
      });
    }

    if (normalizedPhone) {
      return loginWithPhoneCredentials(req, res, normalizedPhone, password);
    }

    let user = await User.findOne({ email: normalizedEmail }).select("+password");
    if (!user) user = await Admin.findOne({ email: normalizedEmail }).select("+password");

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (isUserBlocked(user)) {
      return res.status(403).json({
        success: false,
        isBlocked: true,
        message:
          user.blockReason
            ? `Your account is deactivated/blocked by admin. Reason: ${user.blockReason}`
            : "Your account is deactivated/blocked by admin. You can submit an unblock request.",
        phone: user.phone,
        email: user.email,
        blockReason: user.blockReason || "",
      });
    }

    const token = signToken(user._id);

    res.status(200).json({
      success: true,
      data: {
        user: formatAuthUser(user),
        token,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const loginWithPhone = async (req, res) => {
  try {
    const { phone, password } = req.body;
    const normalizedPhone = normalizeIndianPhone(phone);

    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        message: "Phone must be 10 digits starting with 6, 7, 8, or 9",
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required",
      });
    }

    return loginWithPhoneCredentials(req, res, normalizedPhone, password);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

async function loginWithPhoneCredentials(_req, res, phone, password) {
  let user = await User.findOne({ phone }).select("+password");
  if (!user) user = await Admin.findOne({ phone }).select("+password");

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Invalid phone number or password",
    });
  }

  if (!user.password) {
    return res.status(401).json({
      success: false,
      message: "No password set for this account. Please sign up again or reset your password.",
    });
  }

  if (!(await user.comparePassword(password))) {
    return res.status(401).json({
      success: false,
      message: "Invalid phone number or password",
    });
  }

  if (isUserBlocked(user)) {
    return res.status(403).json({
      success: false,
      isBlocked: true,
      message:
        user.blockReason
          ? `Your account is deactivated/blocked by admin. Reason: ${user.blockReason}`
          : "Your account is deactivated/blocked by admin. You can submit an unblock request.",
      phone: user.phone,
      email: user.email,
      blockReason: user.blockReason || "",
    });
  }

  const token = signToken(user._id);

  return res.status(200).json({
    success: true,
    data: {
      user: formatAuthUser(user),
      token,
    },
  });
}

export const sendOtpLogin = async (req, res) => {
  try {
    const phone = normalizeIndianPhone(req.body.phone);
    const purpose = String(req.body.purpose || req.body.mode || "login")
      .trim()
      .toLowerCase();

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone must be 10 digits starting with 6, 7, 8, or 9",
      });
    }

    const user = await User.findOne({ phone });

    if (purpose === "signup") {
      if (user && user.role !== "admin") {
        if (isUserBlocked(user)) {
          return res.status(403).json({
            success: false,
            message: "Your account has been blocked by admin. Please contact support.",
          });
        }
        return res.status(400).json({
          success: false,
          message:
            "An account with this phone number already exists. Please sign in instead.",
        });
      }
    } else {
      // Login (and any other purpose): only send OTP for existing customers.
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "No account found with this number. Please sign up first.",
        });
      }
      if (user.role === "admin") {
        return res.status(403).json({
          success: false,
          message: "Please use the admin panel to sign in.",
        });
      }
      if (isUserBlocked(user)) {
        return res.status(403).json({
          success: false,
          isBlocked: true,
          message:
            user.blockReason
              ? `Your account is deactivated/blocked by admin. Reason: ${user.blockReason}`
              : "Your account is deactivated/blocked by admin. You can submit an unblock request.",
          phone: user.phone,
          blockReason: user.blockReason || "",
        });
      }
    }

    const result = await dispatchLoginOtp(phone, purpose);

    res.status(200).json({
      success: true,
      message: result.message,
      data: { phone },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to send OTP",
    });
  }
};

export const resendOtpLogin = async (req, res) => {
  try {
    const phone = normalizeIndianPhone(req.body.phone);
    const purpose = String(req.body.purpose || req.body.mode || "login")
      .trim()
      .toLowerCase();

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone must be 10 digits starting with 6, 7, 8, or 9",
      });
    }

    const user = await User.findOne({ phone });

    if (purpose === "signup") {
      if (user && user.role !== "admin") {
        return res.status(400).json({
          success: false,
          message: "An account with this phone number already exists. Please sign in instead.",
        });
      }
    } else {
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "No account found with this number. Please sign up first.",
        });
      }
      if (user.role === "admin") {
        return res.status(403).json({
          success: false,
          message: "Please use the admin panel to sign in.",
        });
      }
      if (isUserBlocked(user)) {
        return res.status(403).json({
          success: false,
          isBlocked: true,
          message: "Your account is deactivated/blocked by admin.",
        });
      }
    }

    const result = await dispatchResendLoginOtp(phone, purpose);

    res.status(200).json({
      success: true,
      message: result.message || "OTP resent successfully",
      data: { phone },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to resend OTP",
    });
  }
};

function respondWithControllerError(res, error) {
  if (error.name === "ValidationError") {
    const message = Object.values(error.errors)
      .map((err) => err.message)
      .join(", ");
    return res.status(400).json({ success: false, message });
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0];
    if (field === "phone") {
      return res.status(400).json({
        success: false,
        message: "An account with this phone number already exists. Try logging in instead.",
      });
    }
    if (field === "email") {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }
    return res.status(400).json({
      success: false,
      message: "An account with these details already exists.",
    });
  }

  return res.status(500).json({ success: false, message: error.message });
}

export const verifyOtpLogin = async (req, res) => {
  try {
    const phone = normalizeIndianPhone(req.body.phone);
    const { otp } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone must be 10 digits starting with 6, 7, 8, or 9",
      });
    }

    const verification = await validateLoginOtp(phone, otp);
    if (!verification.ok) {
      return res.status(400).json({
        success: false,
        message: verification.message,
      });
    }

    const user = await User.findOne({ phone });

    if (!user) {
      markPhoneOtpVerified(phone);
      return res.status(200).json({
        success: true,
        data: {
          needsSignup: true,
          phone,
        },
      });
    }

    if (user.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Please use the admin panel to sign in.",
      });
    }

    if (isUserBlocked(user)) {
      return res.status(403).json({
        success: false,
        isBlocked: true,
        message:
          user.blockReason
            ? `Your account is deactivated/blocked by admin. Reason: ${user.blockReason}`
            : "Your account is deactivated/blocked by admin. You can submit an unblock request.",
        phone: user.phone,
        blockReason: user.blockReason || "",
      });
    }

    const token = signToken(user._id);

    res.status(200).json({
      success: true,
      data: {
        user: formatAuthUser(user),
        token,
      },
    });
  } catch (error) {
    respondWithControllerError(res, error);
  }
};

export const completeOtpSignup = async (req, res) => {
  try {
    const phone = normalizeIndianPhone(req.body.phone);
    const { name } = req.body;
    const accountType = normalizeAccountType(req.body.accountType || req.body.userType);
    const optionalSignupFields = pickSignupProfileFields(req.body, accountType);

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone must be 10 digits starting with 6, 7, 8, or 9",
      });
    }

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: accountType === "bulk" ? "Owner name is required" : "Name is required",
      });
    }

    const profileError = validateSignupProfile(req.body, accountType);
    if (profileError) {
      return res.status(400).json({
        success: false,
        message: profileError,
      });
    }

    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "").trim();
    if (password && password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }
    if (email && (await User.exists({ email, phone: { $ne: phone } }))) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    if (!consumeVerifiedPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: "OTP verification expired. Please verify your phone again.",
      });
    }

    const existingPhoneUser = await User.findOne({ phone });
    if (existingPhoneUser) {
      const token = signToken(existingPhoneUser._id);
      return res.status(200).json({
        success: true,
        data: {
          user: formatAuthUser(existingPhoneUser),
          token,
        },
      });
    }

    const user = await User.create({
      name: name.trim(),
      phone,
      role: "user",
      ...(email ? { email } : {}),
      ...(password ? { password } : {}),
      ...optionalSignupFields,
    });

    const token = signToken(user._id);

    res.status(201).json({
      success: true,
      data: {
        user: formatAuthUser(user),
        token,
      },
    });
  } catch (error) {
    respondWithControllerError(res, error);
  }
};

export const resetPasswordWithPhoneOtp = async (req, res) => {
  try {
    const phone = normalizeIndianPhone(req.body.phone);
    const otp = String(req.body.otp || "").trim();
    const newPassword = String(req.body.newPassword || "").trim();

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone must be 10 digits starting with 6, 7, 8, or 9",
      });
    }

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: "OTP is required",
      });
    }

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password is required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this phone number",
      });
    }

    if (user.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Please use the admin panel to reset your password.",
      });
    }

    const verification = await validateLoginOtp(phone, otp);
    if (!verification.ok) {
      return res.status(400).json({
        success: false,
        message: verification.message,
      });
    }

    user.password = newPassword;
    await user.save();

    const token = signToken(user._id);

    res.status(200).json({
      success: true,
      message: "Password set successfully",
      data: {
        user: formatAuthUser(user),
        token,
      },
    });
  } catch (error) {
    respondWithControllerError(res, error);
  }
};

export const getMe = async (req, res) => {
  try {
    const blocked = isUserBlocked(req.user);
    if (req.user.role !== "admin" && blocked) {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked by admin. Please contact support.",
      });
    }
    res.status(200).json({
      success: true,
      data: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        phone: getAdminPhone(req.user),
        shopNo: req.user.shopNo || "",
        shopName: req.user.shopName || "",
        shopAddress: req.user.shopAddress || "",
        gstNumber: req.user.gstNumber || "",
        accountType: req.user.accountType || "retail",
        ownerContact: req.user.ownerContact || "",
        role: req.user.role,
        rewardPoints: req.user.rewardPoints || 0,
        isBlocked: blocked,
        isActive: !blocked,
        status: blocked ? "blocked" : (req.user.status || "active"),
        createdAt: req.user.createdAt,
        updatedAt: req.user.updatedAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const changeMyPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, otp } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password is required",
      });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role === "admin") {
      const verification = await verifyAdminSecurityOtp(user, otp);
      if (!verification.ok) {
        return res.status(400).json({
          success: false,
          message: verification.message || "Invalid OTP",
        });
      }
    } else {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: "Current password and new password are required",
        });
      }

      if (!user.password) {
        return res.status(400).json({
          success: false,
          message: "Password change is not available for OTP sign-in accounts",
        });
      }

      const isCurrentValid = await user.comparePassword(currentPassword);
      if (!isCurrentValid) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect",
        });
      }
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const message = Object.values(error.errors)
        .map((err) => err.message)
        .join(", ");
      return res.status(400).json({ success: false, message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

function getAdminPhone(user) {
  const adminMobile = getActiveAdminMobile();
  if (user?.role === "admin" && adminMobile) {
    return adminMobile;
  }
  return adminMobile || normalizeIndianPhone(user?.phone || "") || null;
}

function maskPhoneNumber(phone) {
  const digits = String(phone || "");
  if (digits.length < 4) return "your registered phone";
  return `******${digits.slice(-4)}`;
}

async function verifyAdminSecurityOtp(user, otp) {
  const phone = getAdminPhone(user);
  if (!phone) {
    return { ok: false, message: "No registered phone number found for this admin account" };
  }

  // If already verified in this session
  if (consumeVerifiedPhone(phone)) {
    return { ok: true };
  }

  const code = String(otp || "").trim();
  if (!code) {
    return { ok: false, message: "Valid 6-digit Common OTP is required to confirm password change" };
  }

  // 1. Check with purpose "common_security_otp"
  const secResult = await verifyOtp({ phone, otp: code, purpose: "common_security_otp" });
  if (secResult.ok) return secResult;

  // 2. Check general OTP verify without purpose constraint
  const genResult = await verifyOtp({ phone, otp: code });
  if (genResult.ok) return genResult;

  // 3. Fallback to validateLoginOtp (in case admin_login template was used)
  const loginResult = await validateLoginOtp(phone, code);
  if (loginResult.ok) return loginResult;

  return { ok: false, message: "Invalid or expired OTP. Please enter the correct OTP." };
}

export const verifyAdminSecurityOtpController = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin accounts can verify security OTP",
      });
    }

    const user = await User.findById(req.user._id);
    const phone = getAdminPhone(user || req.user);
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "No registered phone number found for this admin account",
      });
    }

    const code = String(req.body.otp || "").trim();
    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Please enter the 6-digit OTP",
      });
    }

    const verification = await verifyAdminSecurityOtp(user || req.user, code);
    if (!verification.ok) {
      return res.status(400).json({
        success: false,
        message: verification.message || "Invalid or expired OTP",
      });
    }

    markPhoneOtpVerified(phone);

    res.status(200).json({
      success: true,
      message: "OTP verified successfully. You can now set your new password.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Verification failed",
    });
  }
};

export const sendAdminSecurityOtp = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin accounts can request security OTP",
      });
    }

    const user = await User.findById(req.user._id);
    const phone = getAdminPhone(user || req.user);
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "No registered phone number found for this admin account",
      });
    }

    // Dispatched via GreenGrocc Common OTP (GREGRC_Common_OTP)
    const templateId = MSG91_TEMPLATES.COMMON_OTP || MSG91_TEMPLATES.ADMIN_LOGIN;
    const result = await sendOtp({
      phone,
      role: "admin",
      purpose: "common_security_otp",
      templateId,
    });

    res.status(200).json({
      success: true,
      message: `OTP sent successfully to ${maskPhoneNumber(phone)} via GreenGrocc Common OTP (GREGRC_Common_OTP)`,
      data: {
        phoneHint: maskPhoneNumber(phone),
        ...(result?.devMock ? { devOtp: result.code } : {}),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to send OTP",
    });
  }
};

export const requestAdminPasswordReset = async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email, role: "admin" });

    if (!user?.phone) {
      return res.status(200).json({
        success: true,
        message:
          "If an admin account exists for this email, an OTP will be sent to the registered phone number.",
      });
    }

    await sendOtp({
      phone: user.phone,
      role: "admin",
      purpose: "admin_login",
      templateId: MSG91_TEMPLATES.ADMIN_LOGIN,
    });

    res.status(200).json({
      success: true,
      message: `OTP sent to ${maskPhoneNumber(user.phone)}`,
      data: {
        email,
        phoneHint: maskPhoneNumber(user.phone),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to send OTP",
    });
  }
};

export const sendAdminLoginOtp = async (req, res) => {
  try {
    const rawInput = String(req.body.login || req.body.email || req.body.phone || "").trim();
    if (!rawInput) {
      return res.status(400).json({ success: false, message: "Admin email or phone is required" });
    }

    const adminMobile = getActiveAdminMobile();
    const normalizedPhone = normalizeIndianPhone(rawInput);
    const normalizedEmail = rawInput.toLowerCase();

    let user = null;
    if (normalizedEmail.includes("@")) {
      user =
        (await User.findOne({ email: normalizedEmail, role: "admin" })) ||
        (await Admin.findOne({ email: normalizedEmail }));
    }
    if (!user && normalizedPhone) {
      if (adminMobile && normalizedPhone === adminMobile) {
        user =
          (await User.findOne({ role: "admin" })) ||
          (await Admin.findOne({}));
      } else {
        user =
          (await User.findOne({ phone: normalizedPhone, role: "admin" })) ||
          (await Admin.findOne({ phone: normalizedPhone }));
      }
    }
    if (!user && adminMobile && (normalizedPhone === adminMobile || normalizedEmail.includes("admin"))) {
      user = (await User.findOne({ role: "admin" })) || (await Admin.findOne({}));
    }
    if (!user && adminMobile && normalizedPhone === adminMobile) {
      user = { _id: "admin", role: "admin", name: "Super Admin", email: "admin@greengrocc.com", phone: adminMobile };
    }

    // Always deliver to active adminMobile from .env if configured
    if (adminMobile && user) {
      user.phone = adminMobile;
    }

    if (!user || !user.phone) {
      return res.status(404).json({
        success: false,
        message: "No admin account with registered phone found for these credentials",
      });
    }

    if (isUserBlocked(user)) {
      return res.status(403).json({
        success: false,
        message: "Your admin account is blocked. Contact system administrator.",
      });
    }

    const targetPhone = adminMobile || user.phone;
    const result = await sendOtp({
      phone: targetPhone,
      role: "admin",
      purpose: "admin_login",
      templateId: MSG91_TEMPLATES.ADMIN_LOGIN,
    });

    return res.status(200).json({
      success: true,
      message: `Admin login OTP sent to ${maskPhoneNumber(targetPhone)}`,
      data: {
        phone: targetPhone,
        phoneHint: maskPhoneNumber(targetPhone),
        devMock: result.devMock,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to send admin login OTP" });
  }
};

export const resendAdminLoginOtp = async (req, res) => {
  try {
    const rawInput = String(req.body.login || req.body.email || req.body.phone || "").trim();
    if (!rawInput) {
      return res.status(400).json({ success: false, message: "Admin email or phone is required" });
    }

    const adminMobile = getActiveAdminMobile();
    const normalizedPhone = normalizeIndianPhone(rawInput);
    const normalizedEmail = rawInput.toLowerCase();

    let user = null;
    if (normalizedEmail.includes("@")) {
      user =
        (await User.findOne({ email: normalizedEmail, role: "admin" })) ||
        (await Admin.findOne({ email: normalizedEmail }));
    }
    if (!user && normalizedPhone) {
      if (adminMobile && normalizedPhone === adminMobile) {
        user =
          (await User.findOne({ role: "admin" })) ||
          (await Admin.findOne({}));
      } else {
        user =
          (await User.findOne({ phone: normalizedPhone, role: "admin" })) ||
          (await Admin.findOne({ phone: normalizedPhone }));
      }
    }
    if (!user && adminMobile && (normalizedPhone === adminMobile || normalizedEmail.includes("admin"))) {
      user = (await User.findOne({ role: "admin" })) || (await Admin.findOne({}));
    }
    if (!user && adminMobile && normalizedPhone === adminMobile) {
      user = { _id: "admin", role: "admin", name: "Super Admin", email: "admin@greengrocc.com", phone: adminMobile };
    }

    if (adminMobile && user) {
      user.phone = adminMobile;
    }

    if (!user || !user.phone) {
      return res.status(404).json({
        success: false,
        message: "No admin account with registered phone found for these credentials",
      });
    }

    if (isUserBlocked(user)) {
      return res.status(403).json({
        success: false,
        message: "Your admin account is blocked. Contact system administrator.",
      });
    }

    const targetPhone = adminMobile || user.phone;
    const result = await dispatchResendAdminLoginOtp(targetPhone);

    return res.status(200).json({
      success: true,
      message: `Admin login OTP resent to ${maskPhoneNumber(targetPhone)}`,
      data: {
        phone: targetPhone,
        phoneHint: maskPhoneNumber(targetPhone),
        devMock: result.devMock,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to resend admin login OTP" });
  }
};

export const verifyAdminLoginOtp = async (req, res) => {
  try {
    const rawInput = String(req.body.login || req.body.email || req.body.phone || "").trim();
    const otp = String(req.body.otp || "").trim();

    if (!rawInput || !otp) {
      return res.status(400).json({ success: false, message: "Admin identifier and OTP are required" });
    }

    const adminMobile = getActiveAdminMobile();
    const normalizedPhone = normalizeIndianPhone(rawInput);
    const normalizedEmail = rawInput.toLowerCase();

    let user = null;
    if (normalizedEmail.includes("@")) {
      user =
        (await User.findOne({ email: normalizedEmail, role: "admin" })) ||
        (await Admin.findOne({ email: normalizedEmail }));
    }
    if (!user && normalizedPhone) {
      if (adminMobile && normalizedPhone === adminMobile) {
        user =
          (await User.findOne({ role: "admin" })) ||
          (await Admin.findOne({}));
      } else {
        user =
          (await User.findOne({ phone: normalizedPhone, role: "admin" })) ||
          (await Admin.findOne({ phone: normalizedPhone }));
      }
    }
    if (!user && adminMobile && (normalizedPhone === adminMobile || normalizedEmail.includes("admin"))) {
      user = (await User.findOne({ role: "admin" })) || (await Admin.findOne({}));
    }
    if (!user && adminMobile && normalizedPhone === adminMobile) {
      user = (await User.findOne({ role: "admin" })) || (await Admin.findOne({}));
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "Admin account not found" });
    }

    if (isUserBlocked(user)) {
      return res.status(403).json({ success: false, message: "Admin account is blocked" });
    }

    const targetPhone = adminMobile || user.phone;
    const verification = await validateAdminLoginOtp(targetPhone, otp);
    if (!verification.ok) {
      return res.status(400).json({ success: false, message: verification.message || "Invalid OTP" });
    }

    user.phone = targetPhone;
    const token = signToken(user._id);
    return res.status(200).json({
      success: true,
      message: "Admin login successful",
      data: {
        user: formatAuthUser(user),
        token,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Admin OTP verification failed" });
  }
};

export const resetAdminPassword = async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const otp = String(req.body.otp || "").trim();
    const newPassword = String(req.body.newPassword || "");

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP, and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    const user = await User.findOne({ email, role: "admin" }).select("+password");
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid reset request",
      });
    }

    const verification = await validateLoginOtp(user.phone, otp);
    if (!verification.ok) {
      return res.status(400).json({
        success: false,
        message: verification.message || "Invalid OTP",
      });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password reset successfully. You can sign in with your new password.",
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const message = Object.values(error.errors)
        .map((err) => err.message)
        .join(", ");
      return res.status(400).json({ success: false, message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMe = async (req, res) => {
  try {
    const { name, email, phone, otp } = req.body;
    const updates = {};

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ success: false, message: "Name is required" });
      }
      updates.name = String(name).trim();
    }

    if (email !== undefined) {
      const trimmedEmail = String(email).trim();
      if (trimmedEmail) {
        updates.email = trimmedEmail.toLowerCase();
      } else {
        updates.email = undefined;
      }
    }

    if (phone !== undefined) {
      if (!String(phone).trim()) {
        return res.status(400).json({ success: false, message: "Phone is required" });
      }
      updates.phone = String(phone).trim();
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({
        success: false,
        message: "No profile fields to update",
      });
    }

    const emailChanging =
      updates.email !== undefined &&
      String(updates.email || "").toLowerCase() !== String(user.email || "").toLowerCase();
    const phoneChanging =
      updates.phone !== undefined && String(updates.phone) !== String(user.phone || "");

    if (user.role === "admin" && (emailChanging || phoneChanging)) {
      const verification = await verifyAdminSecurityOtp(user, otp);
      if (!verification.ok) {
        return res.status(400).json({
          success: false,
          message: verification.message || "Invalid OTP",
        });
      }
    }

    const conflictFilters = [];
    if (updates.email) conflictFilters.push({ email: updates.email });
    if (updates.phone) conflictFilters.push({ phone: updates.phone });

    if (conflictFilters.length) {
      const existingUser = await User.findOne({
        _id: { $ne: req.user._id },
        $or: conflictFilters,
      });

      if (existingUser) {
        const field = existingUser.email === updates.email ? "Email" : "Phone";
        return res.status(409).json({
          success: false,
          message: `${field} is already registered`,
        });
      }
    }

    if (updates.name) user.name = updates.name;
    if (updates.phone) user.phone = updates.phone;
    if (email !== undefined) {
      user.email = updates.email;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        shopNo: user.shopNo || "",
        shopName: user.shopName || "",
        shopAddress: user.shopAddress || "",
        gstNumber: user.gstNumber || "",
        accountType: user.accountType || "retail",
        ownerContact: user.ownerContact || "",
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const message = Object.values(error.errors)
        .map((err) => err.message)
        .join(", ");
      return res.status(400).json({ success: false, message });
    }

    res.status(500).json({ success: false, message: error.message });
  }
};

export const createUser = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name?.trim() || !phone?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Name and phone are required",
      });
    }

    const conflictFilters = [{ phone: phone.trim() }];
    if (email?.trim()) {
      conflictFilters.push({ email: email.trim().toLowerCase() });
    }

    const existingUser = await User.findOne({ $or: conflictFilters });

    if (existingUser) {
      const field = existingUser.phone === phone.trim() ? "Phone" : "Email";
      return res.status(409).json({
        success: false,
        message: `${field} is already registered`,
      });
    }

    const user = await User.create({
      name: name.trim(),
      ...(email?.trim() ? { email: email.trim().toLowerCase() } : {}),
      phone: phone.trim(),
      ...(password ? { password } : {}),
      role: "user",
    });

    res.status(201).json({
      success: true,
      message: "User created",
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const message = Object.values(error.errors)
        .map((err) => err.message)
        .join(", ");
      return res.status(400).json({ success: false, message });
    }

    res.status(500).json({ success: false, message: error.message });
  }
};

export const getUsers = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const filter = { role: { $ne: "admin" } };

    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const name = typeof req.query.name === "string" ? req.query.name.trim() : "";
    const phone = typeof req.query.phone === "string" ? req.query.phone.trim() : "";

    if (search) {
      const pattern = { $regex: escapeRegex(search), $options: "i" };
      filter.$or = [
        { name: pattern },
        { phone: pattern },
        { email: pattern },
        { shopName: pattern },
      ];
    } else {
      if (name) {
        filter.name = { $regex: escapeRegex(name), $options: "i" };
      }

      if (phone) {
        filter.phone = { $regex: escapeRegex(phone), $options: "i" };
      }
    }

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter).select("-password").sort({ createdAt: -1 }).skip(skip).limit(limit),
    ]);

    res.status(200).json(buildPaginatedResponse(users, total, page, limit));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserOrderStats = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("_id name role");
    if (!user || user.role === "admin") {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const [stats] = await Order.aggregate([
      {
        $match: {
          user: user._id,
          status: { $ne: "attempted" },
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: { $ifNull: ["$total", 0] } },
        },
      },
    ]);

    const totalOrders = stats?.totalOrders || 0;
    const totalRevenue = Number(stats?.totalRevenue) || 0;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return res.status(200).json({
      success: true,
      data: {
        userId: user._id,
        customerName: user.name,
        totalOrders,
        totalRevenue,
        averageOrderValue,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load customer history",
    });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { name, email, phone, password, isBlocked, isActive, status } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (email?.trim()) {
      const existing = await User.findOne({
        email: email.trim().toLowerCase(),
        _id: { $ne: user._id },
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: "Email is already registered",
        });
      }
      user.email = email.trim();
    }

    if (phone?.trim()) {
      const existing = await User.findOne({
        phone: phone.trim(),
        _id: { $ne: user._id },
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: "Phone is already registered",
        });
      }
      user.phone = phone.trim();
    }

    if (name?.trim()) user.name = name.trim();
    if (password) user.password = password;

    if (typeof isBlocked === "boolean" || req.body.isBlocked !== undefined) {
      const blocked = typeof isBlocked === "boolean" ? isBlocked : Boolean(req.body.isBlocked);
      user.isBlocked = blocked;
      user.isActive = !blocked;
      user.status = blocked ? "blocked" : "active";
      if (user.isBlocked) {
        user.blockReason = String(req.body.blockReason || req.body.reason || "Deactivated by admin").trim();
        user.blockedAt = new Date();
      } else {
        user.blockReason = "";
        user.blockedAt = null;
      }
    } else if (typeof isActive === "boolean" || req.body.isActive !== undefined) {
      const active = typeof isActive === "boolean" ? isActive : Boolean(req.body.isActive);
      user.isActive = active;
      user.isBlocked = !active;
      user.status = active ? "active" : "blocked";
      if (user.isBlocked) {
        user.blockReason = String(req.body.blockReason || req.body.reason || "Deactivated by admin").trim();
        user.blockedAt = new Date();
      } else {
        user.blockReason = "";
        user.blockedAt = null;
      }
    } else if ((typeof status === "string" && status.trim()) || req.body.status) {
      const s = String(status || req.body.status).trim().toLowerCase();
      user.status = s;
      if (s === "blocked" || s === "inactive") {
        user.isBlocked = true;
        user.isActive = false;
        if (!user.blockedAt) user.blockedAt = new Date();
        user.blockReason = String(req.body.blockReason || req.body.reason || "Deactivated by admin").trim();
      } else if (s === "active") {
        user.isBlocked = false;
        user.isActive = true;
        user.blockReason = "";
        user.blockedAt = null;
      }
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "User updated",
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        accountType: user.accountType,
        status: user.status || (isUserBlocked(user) ? "blocked" : "active"),
        isActive: !isUserBlocked(user),
        isBlocked: isUserBlocked(user),
        blockReason: user.blockReason || "",
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const message = Object.values(error.errors)
        .map((err) => err.message)
        .join(", ");
      return res.status(400).json({ success: false, message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createUnblockRequest = async (req, res) => {
  try {
    const rawPhone = req.body.phone;
    const rawEmail = req.body.email;
    const reason = String(req.body.reason || "").trim();

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Please provide a reason or explanation for your unblock request.",
      });
    }

    const phone = rawPhone ? normalizeIndianPhone(rawPhone) : null;
    const email = rawEmail ? String(rawEmail).trim().toLowerCase() : null;

    if (!phone && !email) {
      return res.status(400).json({
        success: false,
        message: "Valid 10-digit phone number or email is required.",
      });
    }

    const query = phone ? { phone } : { email };
    const user = await User.findOne(query);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No registered account found with these details.",
      });
    }

    if (!isUserBlocked(user)) {
      return res.status(400).json({
        success: false,
        message: "This account is currently active. You can log in directly.",
      });
    }

    const existingPending = await UnblockRequest.findOne({
      userId: user._id,
      status: "pending",
    });

    if (existingPending) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending unblock request under review by the admin team.",
        data: existingPending,
      });
    }

    const unblockReq = await UnblockRequest.create({
      userId: user._id,
      name: user.name || "Customer",
      phone: user.phone,
      email: user.email || email || "",
      accountType: user.accountType || "retail",
      reason,
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Unblock request submitted successfully. The administrator will review your account.",
      data: unblockReq,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, message: "User deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export async function seedDefaultAdminIfEmpty() {
  try {
    const existingAdmin = (await User.findOne({ role: "admin" })) || (await Admin.findOne({}));
    if (existingAdmin) {
      // Admin account already exists; never re-seed or overwrite phone numbers in database
      return;
    }
    const adminMobile = normalizeIndianPhone(process.env.ADMIN_MOBILE || "") || "9876543210";
    await User.create({
      name: "Super Admin",
      email: "admin@greengrocc.com",
      phone: adminMobile,
      password: "admin123",
      role: "admin",
    });
    console.log("Seeded default admin account (admin@greengrocc.com)");
  } catch (error) {
    console.warn("Notice on seedDefaultAdminIfEmpty:", error.message);
  }
}


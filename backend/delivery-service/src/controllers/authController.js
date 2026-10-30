import jwt from "jsonwebtoken";
import DeliveryBoy from "../models/DeliveryBoy.js";
import DeliveryManager from "../models/DeliveryManager.js";
import StoreOrder from "../models/StoreOrder.js";
import Shift from "../models/Shift.js";
import {
  sendDeliveryPartnerOtp,
  resendDeliveryPartnerOtp,
  verifyOtp,
  normalizeIndianPhone,
} from "@greengrocc/shared";
import { dispatchNextRider } from "../services/dispatchService.js";
import { getIO } from "../../../socket.js";
import {
  applyGigStatusChange,
  buildStatusResponseExtras,
  emitRiderDocumentUpdated,
  emitRiderStatusUpdated,
} from "../services/riderSocketService.js";
import { isS3Configured, uploadDataUrlToS3 } from "../services/s3Service.js";
import { areaMatches, placesEqual } from "../utils/matchPlace.js";
import { findLiveGigForManager } from "./gigManagementController.js";
import {
  formatOnlineMinutes,
  istDateString,
  istDayRange,
  listIstDatesInMonth,
  listRecentIstDates,
  liveOnlineMinutes,
  snapshotDailyActivity,
} from "../utils/onlineHoursHelper.js";
import {
  getCurrentMinutesIST,
  isSlotEnded,
} from "../utils/shiftTimeHelper.js";

/** Match a shift booking to this rider (id / phone / current pointers). */
function bookingBelongsToRider(booking, rider, riderIdStr, riderPhone) {
  const bRiderId = booking.deliveryPartnerId
    ? booking.deliveryPartnerId.toString()
    : "";
  const bRiderPhone = normalizePhone(booking.deliveryPartnerPhone || "");
  const riderPhone10 = normalizePhone(riderPhone || rider.phone || "");
  return (
    bRiderId === riderIdStr ||
    (riderPhone10 && bRiderPhone && bRiderPhone === riderPhone10) ||
    (rider.currentBooking?.bookingId &&
      booking._id?.toString() === rider.currentBooking.bookingId.toString()) ||
    (rider.shiftBooking?.bookingId &&
      booking.bookingId === rider.shiftBooking.bookingId)
  );
}

/**
 * Count today's (or listed) shift bookings. Treats ended slots as COMPLETED
 * so "Completed" updates even if the offline cron missed a booking.
 */
function tallyRiderShiftBookings({
  shifts,
  rider,
  todayStr = istDateString(),
  currentMin = getCurrentMinutesIST(),
  mutateEnded = false,
}) {
  const riderIdStr = rider._id.toString();
  const riderPhone = (rider.phone || "").trim();
  let booked = 0;
  let completed = 0;
  const dirtyShiftIds = new Set();

  for (const shift of shifts || []) {
    for (const slot of shift.slots || []) {
      for (const booking of slot.bookings || []) {
        if (!bookingBelongsToRider(booking, rider, riderIdStr, riderPhone)) {
          continue;
        }
        if (booking.status === "CANCELLED") continue;

        booked += 1;
        const pastDay = Boolean(shift.dateString && shift.dateString < todayStr);
        const slotEndedToday = isSlotEnded(
          slot.startTime,
          slot.endTime,
          currentMin,
          shift.dateString,
          todayStr
        );
        const isDone =
          booking.status === "COMPLETED" || pastDay || slotEndedToday;

        if (isDone) {
          completed += 1;
          if (
            mutateEnded &&
            booking.status !== "COMPLETED" &&
            booking.status !== "CANCELLED"
          ) {
            booking.status = "COMPLETED";
            booking.completedAt = new Date();
            dirtyShiftIds.add(shift._id?.toString?.() || String(shift._id));
          }
        }
      }
    }
  }

  return { booked, completed, dirtyShiftIds };
}

const normalizePhone = (phone) =>
  String(phone || "").replace(/\D/g, "").slice(-10);

const ALLOWED_STEPS = [
  "vehicle",
  "city",
  "area",
  "documents",
  "selfie",
  "liveness",
  "home",
];

const ALLOWED_LANGUAGES = ["en", "hi", "mr"];
const ALLOWED_VEHICLES = [
  "motorcycle",
  "bicycle",
  "electric",
  "van",
  "no_vehicle",
];
const DOC_KEYS = ["aadhaar", "pan", "passport", "license", "rc", "insurance"];

const signToken = (deliveryBoy) => {
  if (!process.env.JWT_SECRET) {
    const err = new Error("JWT_SECRET is not configured on the server");
    err.statusCode = 500;
    throw err;
  }

  return jwt.sign(
    {
      id: deliveryBoy._id.toString(),
      role: "delivery_boy",
      phone: deliveryBoy.phone,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

const authResponse = (deliveryBoy, token) => ({
  success: true,
  token,
  deliveryBoy: deliveryBoy.toSafeJSON(),
});

const applyDocumentMeta = async (target, incoming, folder = "delivery-boys/documents") => {
  if (!incoming || typeof incoming !== "object") return;

  const imageBase64 = String(incoming.imageBase64 || "");

  if (incoming.url !== undefined) {
    target.url = String(incoming.url);
  }

  // Prefer S3 URL; always keep base64 fallback so manager verification can show the image
  if (imageBase64.startsWith("data:image/")) {
    let uploaded = false;
    if (isS3Configured()) {
      try {
        const s3Res = await uploadDataUrlToS3(imageBase64, folder);
        if (s3Res && s3Res.url) {
          target.url = s3Res.url;
          uploaded = true;
          console.log(`[AWS S3] Uploaded to ${folder}: ${s3Res.url}`);
        }
      } catch (err) {
        console.error("[AWS S3 Upload Error]", err.message || err);
      }
    }
    // Save base64 when S3 is off or upload failed (so Delivery Manager can still view docs)
    if (!uploaded || !target.url) {
      target.imageBase64 = imageBase64;
    } else {
      // URL saved — clear huge base64 to keep DB smaller
      target.imageBase64 = "";
    }
  } else if (incoming.imageBase64 !== undefined && incoming.imageBase64) {
    target.imageBase64 = String(incoming.imageBase64);
  }

  if (incoming.status !== undefined) target.status = String(incoming.status);
  else if (imageBase64 || target.url) target.status = "uploaded";

  target.capturedAt = incoming.capturedAt
    ? new Date(incoming.capturedAt)
    : new Date();
};

export const register = async (req, res, next) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const password = String(req.body.password || "");
    const name = String(req.body.name || "").trim();
    const language = String(req.body.language || "en").trim();

    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 10-digit mobile number",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const existing = await DeliveryBoy.findOne({ phone }).select("+password");
    if (existing) {
      const match = await existing.comparePassword(password).catch(() => false);
      if (match) {
        const token = signToken(existing);
        return res.status(200).json(authResponse(existing, token));
      }
      return res.status(409).json({
        success: false,
        code: "ACCOUNT_EXISTS",
        message: "Account already exists with this phone number. Please login with your password.",
      });
    }

    const city = String(req.body.city || "").trim();
    const cityId = String(req.body.cityId || "").trim();
    const area = String(req.body.area || "").trim();
    const managerId = req.body.managerId || req.body.storeId;

    let targetManagerId = managerId || null;
    let targetStoreId = managerId ? String(managerId) : "";

    if (!targetManagerId && (area || cityId || city)) {
      const escapedArea = area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const mgr = await DeliveryManager.findOne({
        isActive: true,
        $or: [
          ...(escapedArea ? [{ area: { $regex: new RegExp(`^${escapedArea}$`, "i") } }] : []),
          { cityId, area },
          { city, area },
        ],
      }).sort({ createdAt: -1 });

      if (mgr) {
        targetManagerId = mgr._id;
        targetStoreId = mgr._id.toString();
      }
    }

    const deliveryBoy = await DeliveryBoy.create({
      phone,
      password,
      name,
      language: ALLOWED_LANGUAGES.includes(language) ? language : "en",
      city,
      cityId,
      area,
      managerId: targetManagerId,
      storeId: targetStoreId,
      employmentType: ['PART_TIME', 'FULL_TIME'].includes(String(req.body.employmentType || '').toUpperCase())
        ? String(req.body.employmentType).toUpperCase()
        : 'PART_TIME',
    });

    const token = signToken(deliveryBoy);
    return res.status(201).json(authResponse(deliveryBoy, token));
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const password = String(req.body.password || "");
    const language = String(req.body.language || "").trim();

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Phone number and password are required",
      });
    }

    const deliveryBoy = await DeliveryBoy.findOne({ phone }).select("+password");
    if (!deliveryBoy) {
      return res.status(401).json({
        success: false,
        message: "Invalid phone number or password",
      });
    }

    if (!deliveryBoy.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated. Contact support.",
      });
    }

    const match = await deliveryBoy.comparePassword(password);
    if (!match) {
      return res.status(401).json({
        success: false,
        message: "Invalid phone number or password",
      });
    }

    if (ALLOWED_LANGUAGES.includes(language)) {
      deliveryBoy.language = language;
      await deliveryBoy.save();
    }

    const token = signToken(deliveryBoy);
    return res.json(authResponse(deliveryBoy, token));
  } catch (error) {
    next(error);
  }
};

export const sendDeliveryPartnerOtpController = async (req, res, next) => {
  try {
    const rawPhone = req.body.phone || req.body.mobile;
    const phone = normalizeIndianPhone(rawPhone);
    const purpose = String(req.body.purpose || req.body.mode || "login").trim().toLowerCase();

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Valid 10-digit phone number is required",
      });
    }

    const isRegister = purpose === "register" || purpose === "signup";
    const existing = await DeliveryBoy.findOne({ phone });

    if (isRegister) {
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "A delivery partner account with this phone already exists. Please log in.",
        });
      }
    } else {
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "No delivery partner account found with this phone. Please register first.",
        });
      }
      if (!existing.isActive) {
        return res.status(403).json({
          success: false,
          message: "Account is deactivated. Contact support.",
        });
      }
    }

    const result = await sendDeliveryPartnerOtp(phone, isRegister ? "register" : "login");
    return res.json({
      success: true,
      message: result.message || "OTP sent successfully",
      phone,
      purpose: isRegister ? "register" : "login",
      devMock: result.devMock,
    });
  } catch (error) {
    next(error);
  }
};

export const resendDeliveryPartnerOtpController = async (req, res, next) => {
  try {
    const rawPhone = req.body.phone || req.body.mobile;
    const phone = normalizeIndianPhone(rawPhone);
    const purpose = String(req.body.purpose || req.body.mode || "login").trim().toLowerCase();

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Valid 10-digit phone number is required",
      });
    }

    const isRegister = purpose === "register" || purpose === "signup";
    const existing = await DeliveryBoy.findOne({ phone });

    if (isRegister) {
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "A delivery partner account with this phone already exists. Please log in.",
        });
      }
    } else {
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "No delivery partner account found with this phone. Please register first.",
        });
      }
      if (!existing.isActive) {
        return res.status(403).json({
          success: false,
          message: "Account is deactivated. Contact support.",
        });
      }
    }

    const result = await resendDeliveryPartnerOtp(phone, isRegister ? "register" : "login");
    return res.json({
      success: true,
      message: result.message || "OTP resent successfully",
      phone,
      purpose: isRegister ? "register" : "login",
      devMock: result.devMock,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyDeliveryPartnerOtpController = async (req, res, next) => {
  try {
    const rawPhone = req.body.phone || req.body.mobile;
    const phone = normalizeIndianPhone(rawPhone);
    const otp = String(req.body.otp || "").trim();
    const purpose = String(req.body.purpose || req.body.mode || "login").trim().toLowerCase();

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: "Phone number and OTP are required",
      });
    }

    const isRegister = purpose === "register" || purpose === "signup";
    const verification = await verifyOtp({
      phone,
      otp,
      purpose: isRegister ? "register" : "login",
    });
    if (!verification.ok) {
      return res.status(400).json({
        success: false,
        message: verification.message || "Invalid OTP",
      });
    }

    const language = String(req.body.language || "").trim();
    const name = String(req.body.name || "").replace(/\s+/g, " ").trim().slice(0, 60);
    let deliveryBoy = await DeliveryBoy.findOne({ phone });

    if (isRegister && !deliveryBoy) {
      deliveryBoy = await DeliveryBoy.create({
        phone,
        ...(name ? { name } : {}),
        language: ALLOWED_LANGUAGES.includes(language) ? language : "en",
        employmentType: "PART_TIME",
      });
      const token = signToken(deliveryBoy);
      return res.status(201).json(authResponse(deliveryBoy, token));
    }

    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery partner account not found. Please register.",
      });
    }

    if (!deliveryBoy.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated. Contact support.",
      });
    }

    let dirty = false;
    if (ALLOWED_LANGUAGES.includes(language) && deliveryBoy.language !== language) {
      deliveryBoy.language = language;
      dirty = true;
    }
    if (isRegister && name && !String(deliveryBoy.name || "").trim()) {
      deliveryBoy.name = name;
      dirty = true;
    }
    if (dirty) await deliveryBoy.save();

    const token = signToken(deliveryBoy);
    return res.json(authResponse(deliveryBoy, token));
  } catch (error) {
    next(error);
  }
};

export const ackSlotAlerts = async (req, res, next) => {
  try {
    await DeliveryBoy.updateOne(
      { _id: req.user.id },
      { $set: { pendingSlotAlerts: [] } }
    );
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const me = async (req, res, next) => {
  try {
    const deliveryBoy = await DeliveryBoy.findById(req.user.id);
    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found",
      });
    }

    return res.json({
      success: true,
      deliveryBoy: deliveryBoy.toSafeJSON(),
    });
  } catch (error) {
    next(error);
  }
};

export const updateOnboarding = async (req, res, next) => {
  try {
    const body = req.body || {};
    const step = String(body.onboardingStep || "").trim();

    if (step && !ALLOWED_STEPS.includes(step)) {
      return res.status(400).json({
        success: false,
        message: "Invalid onboarding step",
      });
    }

    const deliveryBoy = await DeliveryBoy.findById(req.user.id);
    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found",
      });
    }

    const isVerified = deliveryBoy.verificationStatus === "approved";

    // Verified riders cannot change manager-controlled identity/KYC fields
    if (isVerified) {
      if (body.phone !== undefined) {
        return res.status(403).json({
          success: false,
          message: "Phone number can only be updated by your Delivery Manager.",
        });
      }
      if (body.bankDetails !== undefined) {
        return res.status(403).json({
          success: false,
          message: "Bank details can only be updated by your Delivery Manager.",
        });
      }
      if (body.documents !== undefined) {
        return res.status(403).json({
          success: false,
          message: "Documents can only be updated by your Delivery Manager.",
        });
      }
      if (body.vehicleType !== undefined) {
        return res.status(403).json({
          success: false,
          message: "Vehicle details can only be updated by your Delivery Manager.",
        });
      }
    }

    if (step) deliveryBoy.onboardingStep = step;

    if (body.onboardingComplete !== undefined) {
      deliveryBoy.onboardingComplete = Boolean(body.onboardingComplete);
      if (deliveryBoy.onboardingComplete) {
        deliveryBoy.onboardingStep = "home";
        if (
          !deliveryBoy.verificationStatus ||
          deliveryBoy.verificationStatus === "pending"
        ) {
          deliveryBoy.verificationStatus = "pending";
        }
      }
    }

    if (body.language !== undefined) {
      const language = String(body.language).trim();
      if (ALLOWED_LANGUAGES.includes(language)) {
        deliveryBoy.language = language;
      }
    }

    if (body.city !== undefined) {
      deliveryBoy.city = String(body.city).trim();
    }

    if (body.cityId !== undefined) {
      deliveryBoy.cityId = String(body.cityId).trim();
    }

    if (body.area !== undefined) {
      deliveryBoy.area = String(body.area).trim();
    }

    if (body.managerId) {
      deliveryBoy.managerId = body.managerId;
      deliveryBoy.storeId = body.managerId.toString();
    } else if (deliveryBoy.area || deliveryBoy.cityId || deliveryBoy.city) {
      const escapedArea = (deliveryBoy.area || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const mgr = await DeliveryManager.findOne({
        isActive: true,
        $or: [
          ...(escapedArea ? [{ area: { $regex: new RegExp(`^${escapedArea}$`, "i") } }] : []),
          { cityId: deliveryBoy.cityId, area: deliveryBoy.area },
          { city: deliveryBoy.city, area: deliveryBoy.area },
        ],
      }).sort({ createdAt: -1 });

      if (mgr) {
        deliveryBoy.managerId = mgr._id;
        deliveryBoy.storeId = mgr._id.toString();
      } else {
        deliveryBoy.managerId = null;
        deliveryBoy.storeId = "";
      }
    }

    if (body.vehicleType !== undefined) {
      const vehicleType = String(body.vehicleType).trim();
      if (ALLOWED_VEHICLES.includes(vehicleType)) {
        deliveryBoy.vehicleType = vehicleType;
      }
    }

    if (body.name !== undefined) {
      deliveryBoy.name = String(body.name).trim();
    }

    if (body.bankDetails && typeof body.bankDetails === "object") {
      const b = body.bankDetails;
      deliveryBoy.bankDetails = {
        accountHolderName: String(b.accountHolderName || "").trim(),
        accountNumber: String(b.accountNumber || "").trim(),
        ifscCode: String(b.ifscCode || "").trim(),
        bankName: String(b.bankName || "").trim(),
        upiId: String(b.upiId || "").trim(),
      };
    }

    if (body.documents && typeof body.documents === "object") {
      for (const key of DOC_KEYS) {
        if (body.documents[key]) {
          await applyDocumentMeta(
            deliveryBoy.documents[key],
            body.documents[key],
            `delivery-boys/documents/${key}`
          );
        }
      }
      deliveryBoy.markModified("documents");
    }

    if (body.selfie) {
      await applyDocumentMeta(
        deliveryBoy.selfie,
        body.selfie,
        "delivery-boys/selfies"
      );
      deliveryBoy.markModified("selfie");
    }

    if (body.livenessPassed !== undefined) {
      deliveryBoy.livenessPassed = Boolean(body.livenessPassed);
      if (deliveryBoy.livenessPassed) {
        deliveryBoy.livenessPassedAt = body.livenessPassedAt
          ? new Date(body.livenessPassedAt)
          : new Date();
      }
    }

    if (body.employmentType !== undefined) {
      const et = String(body.employmentType).toUpperCase();
      if (['PART_TIME', 'FULL_TIME'].includes(et)) {
        deliveryBoy.employmentType = et;
      }
    }

    await deliveryBoy.save();

    // Notify manager dashboard when documents/selfie are uploaded during onboarding
    for (const key of DOC_KEYS) {
      if (body.documents?.[key]?.status || body.documents?.[key]?.imageBase64) {
        await emitRiderDocumentUpdated(
          deliveryBoy,
          key,
          deliveryBoy.documents[key]?.status || "uploaded"
        );
      }
    }
    if (body.selfie?.status || body.selfie?.imageBase64) {
      await emitRiderDocumentUpdated(
        deliveryBoy,
        "selfie",
        deliveryBoy.selfie?.status || "uploaded"
      );
    }

    return res.json({
      success: true,
      deliveryBoy: deliveryBoy.toSafeJSON(),
    });
  } catch (error) {
    next(error);
  }
};

/** Immediate online/offline toggle — saved instantly in DB. */
export const updateStatus = async (req, res, next) => {
  try {
    const status = String(req.body.status || "").trim().toLowerCase();
    if (!["online", "offline"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be "online" or "offline"',
      });
    }

    const existing = await DeliveryBoy.findById(req.user.id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found",
      });
    }

    const verification = existing.verificationStatus || "pending";
    if (status === "online" && verification !== "approved") {
      return res.status(403).json({
        success: false,
        message:
          "Verification pending. You can go online after manager approval (usually 3–6 hours).",
        deliveryBoy: existing.toSafeJSON(),
      });
    }

    try {
      await applyGigStatusChange(existing, status);
    } catch (err) {
      return res.status(err.statusCode || 400).json({
        success: false,
        message: err.message,
        deliveryBoy: existing.toSafeJSON(),
      });
    }

    await existing.save();
    const extras = await buildStatusResponseExtras(existing);
    await emitRiderStatusUpdated(existing, {
      todayOnlineMinutes: extras.todayOnlineMinutes,
    });

    if (status === "online") {
      // 1. Shift booking is required unless a store gig is live right now.
      if (!existing.currentBooking?.shiftId) {
        const escapedRiderArea = (existing.area || "")
          .trim()
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const gigManager = await DeliveryManager.findOne({
          isActive: true,
          $or: [
            ...(escapedRiderArea
              ? [{ area: { $regex: new RegExp(`^${escapedRiderArea}$`, "i") } }]
              : []),
            { cityId: existing.cityId, area: existing.area },
            { city: existing.city, area: existing.area },
          ],
        });
        const liveGig = gigManager
          ? await findLiveGigForManager(gigManager._id)
          : null;
        if (!liveGig && existing.employmentType !== 'FULL_TIME') {
          return res.status(400).json({
            success: false,
            code: "NO_SHIFT_BOOKED",
            message:
              "Mandatory: You must select and book a shift slot for today before going online!",
            deliveryBoy: existing.toSafeJSON(),
          });
        }
      }

      // 2. Geofence Location Verification (Near Store in Pune)
      const lat = parseFloat(req.body.latitude || req.body.lat);
      const lng = parseFloat(req.body.longitude || req.body.lng);

      const escapedRiderArea = (existing.area || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      let manager = await DeliveryManager.findOne({
        isActive: true,
        $or: [
          ...(escapedRiderArea ? [{ area: { $regex: new RegExp(`^${escapedRiderArea}$`, "i") } }] : []),
          { cityId: existing.cityId, area: existing.area },
          { city: existing.city, area: existing.area },
        ],
      });

      let storeLat = manager?.latitude ?? 18.559;
      let storeLng = manager?.longitude ?? 73.7868;
      let allowedRadius = manager?.geofenceRadius ?? 1000;

      const isSameArea =
        existing.area &&
        manager?.area &&
        existing.area.trim().toLowerCase() === manager.area.trim().toLowerCase();

      const isDefaultStoreCoords =
        Math.abs(storeLat - 18.559) < 0.001 && Math.abs(storeLng - 73.7868) < 0.001;

      if (isSameArea && isDefaultStoreCoords && !isNaN(lat) && !isNaN(lng)) {
        manager.latitude = lat;
        manager.longitude = lng;
        await manager.save().catch(() => {});
        storeLat = lat;
        storeLng = lng;
      }

      if (isSameArea) {
        allowedRadius = Math.max(allowedRadius, 15000);
      }

      if (!isNaN(lat) && !isNaN(lng)) {
        const R = 6371e3; // meters
        const φ1 = (lat * Math.PI) / 180;
        const φ2 = (storeLat * Math.PI) / 180;
        const Δφ = ((storeLat - lat) * Math.PI) / 180;
        const Δλ = ((storeLng - lng) * Math.PI) / 180;
        const a =
          Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanceMeters = R * c;

        if (distanceMeters > allowedRadius) {
          return res.status(400).json({
            success: false,
            code: "OUT_OF_GEOFENCE",
            message: `Location verification failed! You are ${Math.round(distanceMeters)}m away from store (${manager?.storeName || "Pune Store"}). Please reach near the store to start your shift.`,
            distanceMeters,
            deliveryBoy: existing.toSafeJSON(),
          });
        }
      }
    }

    return res.json({
      success: true,
      deliveryBoy: existing.toSafeJSON(),
      todayOnlineMinutes: extras.todayOnlineMinutes,
      isPeak: extras.isPeak,
      storeId: extras.storeId,
    });
  } catch (error) {
    next(error);
  }
};

function toManagerPayload(manager) {
  return {
    storeId: manager._id.toString(),
    name: manager.name || "Delivery Manager",
    phone: manager.phone || "",
    email: manager.email || "",
    storeName: manager.storeName || `${manager.area || "Area"} Dark Store`,
    storeAddress:
      manager.storeAddress ||
      `${manager.storeName || `${manager.area} Dark Store`}, ${manager.area}, ${manager.city}`,
    state: manager.state || "",
    city: manager.city || "",
    area: manager.area || "",
    pincode: manager.pincode || "",
    darkStoreQrCode: `DARKSTORE_${manager._id}`,
  };
}

/** Area delivery manager details for onboarding selection or offline verification visit. */
export const getAreaManager = async (req, res, next) => {
  try {
    const area = String(req.query.area || req.body?.area || "").trim();
    const cityId = String(req.query.cityId || req.body?.cityId || "").trim();
    const city = String(req.query.city || req.body?.city || "").trim();

    let queryArea = area;
    let queryCityId = cityId;
    let queryCity = city;

    if (!queryArea && req.user?.id) {
      const deliveryBoy = await DeliveryBoy.findById(req.user.id);
      if (deliveryBoy) {
        queryArea = deliveryBoy.area;
        queryCityId = deliveryBoy.cityId;
        queryCity = deliveryBoy.city || queryCity;
      }
    }

    if (!queryArea) {
      return res.json({
        success: true,
        manager: null,
        managers: [],
        message: "No area specified",
      });
    }

    const all = await DeliveryManager.find({ isActive: { $ne: false } }).lean();
    const sameCity = (m) => {
      if (queryCityId && placesEqual(m.cityId, queryCityId)) return true;
      if (queryCity && placesEqual(m.city, queryCity)) return true;
      // If manager has no city fields, don't exclude on city alone
      if (!m.cityId && !m.city) return true;
      return !queryCityId && !queryCity;
    };
    let matched = all.filter(
      (m) => areaMatches(m.area, queryArea) && sameCity(m)
    );

    // Fallback: area match only (fixes cityId mismatch between app & registered store)
    if (!matched.length) {
      matched = all.filter((m) => areaMatches(m.area, queryArea));
    }

    matched.sort(
      (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
    );

    if (!matched.length) {
      return res.json({
        success: true,
        manager: null,
        managers: [],
        message: "No darkstore registered",
      });
    }

    const managers = matched.map(toManagerPayload);
    return res.json({
      success: true,
      manager: managers[0],
      managers,
      count: managers.length,
    });
  } catch (error) {
    next(error);
  }
};

/** Returns all active dark store hubs registered by delivery managers. */
export const getActiveHubs = async (req, res, next) => {
  try {
    const managers = await DeliveryManager.find({ isActive: true }).select(
      "state city cityId area storeName storeAddress latitude longitude pincode"
    );

    const activeHubs = managers.map((m) => ({
      managerId: m._id.toString(),
      state: m.state || "Maharashtra",
      city: m.city || "Pune",
      cityId: m.cityId || (m.city ? m.city.toLowerCase().replace(/\s+/g, "-") : "pune"),
      area: m.area || "General",
      storeName: m.storeName || `${m.area} Dark Store`,
      storeAddress: m.storeAddress || "",
      pincode: m.pincode || "",
      latitude: m.latitude,
      longitude: m.longitude,
    }));

    return res.json({
      success: true,
      count: activeHubs.length,
      activeHubs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Heartbeat while online — keeps lastSeenAt, location, and fcmToken fresh.
 * Call every ~30–60s from the app when status is online.
 */
export const heartbeat = async (req, res, next) => {
  try {
    const now = new Date();
    const existing = await DeliveryBoy.findById(req.user.id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found",
      });
    }

    const updates = {
      lastSeenAt: now,
      // Keep on_delivery while an order is active — don't downgrade on heartbeat.
      status: existing.activeOrderId ? "on_delivery" : "online",
    };

    if (req.body.fcmToken !== undefined) {
      updates.fcmToken = String(req.body.fcmToken).trim();
    }

    const lat = Number(req.body.lat ?? req.body.latitude);
    const lng = Number(req.body.lng ?? req.body.longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      updates.currentLocation = { lat, lng, updatedAt: now };
    }

    const deliveryBoy = await DeliveryBoy.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true }
    );

    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found",
      });
    }

    try {
      if (
        deliveryBoy.status === "online" &&
        !deliveryBoy.activeOrderId &&
        deliveryBoy.managerId
      ) {
        const { retryWaitingAssignmentsForStore } = await import(
          "../services/OrderAssignmentService.js"
        );
        retryWaitingAssignmentsForStore(deliveryBoy.managerId).catch(() => {});
      }
    } catch (err) {}

    return res.json({
      success: true,
      deliveryBoy: deliveryBoy.toSafeJSON(),
    });
  } catch (error) {
    next(error);
  }
};

/** Updates FCM registration token for push notifications */
export const updateFcmToken = async (req, res, next) => {
  try {
    const fcmToken = String(req.body.fcmToken || "").trim();
    const deliveryBoy = await DeliveryBoy.findByIdAndUpdate(
      req.user.id,
      { $set: { fcmToken } },
      { new: true }
    );
    if (!deliveryBoy) {
      return res.status(404).json({ success: false, message: "Delivery boy not found" });
    }
    return res.json({
      success: true,
      message: "FCM token updated successfully",
      fcmToken: deliveryBoy.fcmToken,
    });
  } catch (error) {
    next(error);
  }
};

/** Updates live GPS coordinates of rider */
export const updateLocation = async (req, res, next) => {
  try {
    const lat = Number(req.body.lat ?? req.body.latitude);
    const lng = Number(req.body.lng ?? req.body.longitude);
    const now = new Date();

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ success: false, message: "Valid lat and lng are required" });
    }

    const deliveryBoy = await DeliveryBoy.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          currentLocation: { lat, lng, updatedAt: now },
          lastSeenAt: now,
        },
      },
      { new: true }
    );

    if (!deliveryBoy) {
      return res.status(404).json({ success: false, message: "Delivery boy not found" });
    }

    try {
      if (deliveryBoy.managerId) {
        // Push live GPS to store only when rider is working (online / on trip).
        // Idle offline GPS does not spam the Delivery Manager UI.
        // Pre-orders are assigned directly and never set activeOrderId, so an
        // "offline" rider can still be carrying orders.
        const tracking =
          deliveryBoy.status === "online" ||
          deliveryBoy.status === "on_delivery" ||
          Boolean(deliveryBoy.activeOrderId) ||
          Boolean(
            await StoreOrder.exists({
              assignedRiderId: deliveryBoy._id,
              status: { $in: ["assigned", "pickup_verified", "out_for_delivery"] },
            })
          );
        if (tracking) {
          getIO().to(`store_${deliveryBoy.managerId}`).emit("rider_location_updated", {
            riderId: deliveryBoy._id.toString(),
            name: deliveryBoy.name || deliveryBoy.phone,
            status: deliveryBoy.status,
            activeOrderId: deliveryBoy.activeOrderId
              ? String(deliveryBoy.activeOrderId)
              : null,
            location: { lat, lng, updatedAt: now.toISOString() },
          });
        }
      }
      if (
        deliveryBoy.status === "online" &&
        !deliveryBoy.activeOrderId &&
        deliveryBoy.managerId
      ) {
        const { retryWaitingAssignmentsForStore } = await import(
          "../services/OrderAssignmentService.js"
        );
        retryWaitingAssignmentsForStore(deliveryBoy.managerId).catch(() => {});
      }
    } catch (err) {}

    return res.json({
      success: true,
      currentLocation: deliveryBoy.toSafeJSON().currentLocation,
    });
  } catch (error) {
    next(error);
  }
};

/** Updates rating and total ratings count for rider */
export const updateRiderRating = async (req, res, next) => {
  try {
    const { riderId } = req.params;
    const newRating = Number(req.body.rating);

    if (isNaN(newRating) || newRating < 1 || newRating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
    }

    const rider = await DeliveryBoy.findById(riderId);
    if (!rider) {
      return res.status(404).json({ success: false, message: "Rider not found" });
    }

    const currentCount = rider.totalRatingsCount || 0;
    const currentRating = rider.rating !== undefined ? rider.rating : 5;
    const newCount = currentCount + 1;
    const updatedRating = Math.round(((currentRating * currentCount + newRating) / newCount) * 10) / 10;

    rider.rating = updatedRating;
    rider.totalRatingsCount = newCount;
    await rider.save();

    return res.json({
      success: true,
      riderId: rider._id.toString(),
      rating: rider.rating,
      totalRatingsCount: rider.totalRatingsCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /home/progress (or GET /home-dashboard)
 * Returns logged-in delivery partner's Today's Progress metrics.
 */
export const getTodayProgress = async (req, res, next) => {
  try {
    const riderId = req.user.id;
    const rider = await DeliveryBoy.findById(riderId);

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Delivery partner not found",
      });
    }

    const todayISTDateString = istDateString();

    // Reset daily counters if IST day changed (and snapshot previous day)
    if (rider.todayOnlineDate && rider.todayOnlineDate !== todayISTDateString) {
      snapshotDailyActivity(rider, {
        date: rider.todayOnlineDate,
        onlineMinutes: rider.todayOnlineMinutes || 0,
        earnings: rider.todayEarnings || 0,
        trips: rider.todayCompletedOrders || rider.todayOrderCount || 0,
      });
      rider.todayEarnings = 0;
      rider.todayCompletedOrders = 0;
      rider.todayOrderCount = 0;
      rider.todayOnlineMinutes = 0;
      rider.todayOnlineDate = todayISTDateString;
      await rider.save();
    } else if (!rider.todayOnlineDate) {
      rider.todayOnlineDate = todayISTDateString;
      await rider.save();
    }

    const hasRiderBookingPointer = Boolean(
      (rider.currentBooking && rider.currentBooking.shiftId) ||
        (rider.shiftBooking && rider.shiftBooking.bookingId)
    );

    const riderPhone = (rider.phone || "").trim();
    const riderPhone10 = normalizePhone(rider.phone);

    // Today's shifts — match by ObjectId or last-10 phone digits
    const shiftsFound = await Shift.find({
      dateString: todayISTDateString,
      $or: [
        { "slots.bookings.deliveryPartnerId": rider._id },
        ...(riderPhone ? [{ "slots.bookings.deliveryPartnerPhone": riderPhone }] : []),
        ...(riderPhone10
          ? [{ "slots.bookings.deliveryPartnerPhone": riderPhone10 }]
          : []),
        ...(rider.currentBooking?.shiftId
          ? [{ _id: rider.currentBooking.shiftId }]
          : []),
      ],
    });

    const todayShifts = shiftsFound.filter(
      (s) => s.dateString === todayISTDateString
    );
    const tallied = tallyRiderShiftBookings({
      shifts: todayShifts,
      rider,
      todayStr: todayISTDateString,
      mutateEnded: true,
    });
    let bookedShiftsCount = tallied.booked;
    let completedShiftsCount = tallied.completed;

    if (tallied.dirtyShiftIds.size) {
      await Promise.all(
        todayShifts
          .filter((s) => tallied.dirtyShiftIds.has(s._id.toString()))
          .map((s) => s.save().catch(() => {}))
      );
    }

    // Only count booking pointer if it belongs to today's shift
    if (bookedShiftsCount === 0 && hasRiderBookingPointer && rider.currentBooking?.shiftId) {
      const ptrShift = todayShifts.find(
        (s) => s._id.toString() === rider.currentBooking.shiftId.toString()
      );
      if (ptrShift) bookedShiftsCount = 1;
    }

    // Source of truth for today: delivered orders in IST midnight → 23:59:59.999
    let computedEarnings = 0;
    let computedTrips = 0;
    try {
      const dayStart = new Date(`${todayISTDateString}T00:00:00+05:30`);
      const dayEnd = new Date(`${todayISTDateString}T23:59:59.999+05:30`);
      const todaysDeliveries = await StoreOrder.find({
        assignedRiderId: rider._id,
        status: "delivered",
        deliveredAt: { $gte: dayStart, $lte: dayEnd },
      }).select("riderDeliveryEarning");
      computedTrips = todaysDeliveries.length;
      computedEarnings = todaysDeliveries.reduce(
        (sum, o) => sum + Number(o.riderDeliveryEarning || 0),
        0
      );
      computedEarnings += (rider.incentiveCredits || [])
        .filter((c) => c.dateString === todayISTDateString)
        .reduce((sum, c) => sum + Number(c.amount || 0), 0);
    } catch (_) {
      // Fallback only if query fails — still clamp to today's counters after day reset above
      computedEarnings = Math.max(0, Number(rider.todayEarnings || 0));
      computedTrips = Math.max(
        0,
        Number(rider.todayCompletedOrders || rider.todayOrderCount || 0)
      );
    }

    // Keep rider daily counters aligned to this IST day only
    rider.todayEarnings = computedEarnings;
    rider.todayCompletedOrders = computedTrips;
    rider.todayOrderCount = computedTrips;
    rider.todayOnlineDate = todayISTDateString;

    const onlineMinutes = liveOnlineMinutes(rider);
    const onlineTime = formatOnlineMinutes(onlineMinutes);

    // Keep today's snapshot fresh for history
    snapshotDailyActivity(rider, {
      date: todayISTDateString,
      onlineMinutes,
      earnings: computedEarnings,
      trips: computedTrips,
      shiftsBooked: bookedShiftsCount,
      shiftsCompleted: completedShiftsCount,
    });
    await rider.save().catch(() => {});

    return res.json({
      success: true,
      data: {
        todayEarnings: computedEarnings,
        completedTrips: computedTrips,
        onlineMinutes,
        onlineTime,
        bookedShifts: bookedShiftsCount,
        shiftsBooked: bookedShiftsCount,
        bookedShiftsCount,
        completedShifts: completedShiftsCount,
        completedShiftsCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /activity-history?range=week|month|year
 * Day (or month for year) boxes: date, earn, online time, shifts booked/completed, trips, total.
 */
export const getActivityHistory = async (req, res, next) => {
  try {
    const riderId = req.user.id;
    const rider = await DeliveryBoy.findById(riderId);
    if (!rider) {
      return res.status(404).json({ success: false, message: "Delivery partner not found" });
    }

    const range = String(req.query.range || "week").trim().toLowerCase();
    const todayStr = istDateString();
    const activityMap = new Map(
      (rider.dailyActivity || []).map((row) => [row.date, row])
    );

    const riderIdStr = rider._id.toString();
    const riderPhone = (rider.phone || "").trim();

    const dayLabelFor = (dateString) => {
      const { start } = istDayRange(dateString);
      return new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "short",
      }).format(start);
    };

    const buildDayRows = async (dateList) => {
      if (!dateList.length) {
        return {
          days: [],
          totals: {
            earnings: 0,
            onlineMinutes: 0,
            onlineTime: formatOnlineMinutes(0),
            shiftsBooked: 0,
            shiftsCompleted: 0,
            trips: 0,
            total: 0,
          },
        };
      }

      const shifts = await Shift.find({
        dateString: { $in: dateList },
        $or: [
          { "slots.bookings.deliveryPartnerId": rider._id },
          { "slots.bookings.deliveryPartnerPhone": riderPhone },
        ],
      }).lean();

      const shiftStatsByDate = {};
      for (const date of dateList) {
        shiftStatsByDate[date] = { booked: 0, completed: 0 };
      }

      const currentMin = getCurrentMinutesIST();
      for (const shift of shifts) {
        const date = shift.dateString;
        if (!shiftStatsByDate[date]) continue;
        for (const slot of shift.slots || []) {
          for (const booking of slot.bookings || []) {
            const bRiderId = booking.deliveryPartnerId
              ? booking.deliveryPartnerId.toString()
              : "";
            const bPhone = (booking.deliveryPartnerPhone || "").trim();
            const match =
              bRiderId === riderIdStr || (riderPhone && bPhone === riderPhone);
            if (!match) continue;
            if (booking.status === "CANCELLED") continue;
            shiftStatsByDate[date].booked += 1;
            const pastDay = Boolean(date && date < todayStr);
            const slotEndedToday = isSlotEnded(
              slot.startTime,
              slot.endTime,
              currentMin,
              date,
              todayStr
            );
            if (
              booking.status === "COMPLETED" ||
              pastDay ||
              slotEndedToday
            ) {
              shiftStatsByDate[date].completed += 1;
            }
          }
        }
      }

      const rangeStart = istDayRange(dateList[0]).start;
      const rangeEnd = istDayRange(dateList[dateList.length - 1]).end;
      const allOrders = await StoreOrder.find({
        assignedRiderId: rider._id,
        status: "delivered",
        deliveredAt: { $gte: rangeStart, $lte: rangeEnd },
      }).select("riderDeliveryEarning deliveredAt");

      const orderStatsByDate = {};
      for (const date of dateList) {
        orderStatsByDate[date] = { earnings: 0, trips: 0 };
      }
      for (const order of allOrders) {
        const d = istDateString(order.deliveredAt);
        if (!orderStatsByDate[d]) continue;
        orderStatsByDate[d].trips += 1;
        orderStatsByDate[d].earnings += Number(order.riderDeliveryEarning || 0);
      }

      const rows = [];
      let totalEarnings = 0;
      let totalTrips = 0;
      let totalOnline = 0;
      let totalShiftsBooked = 0;
      let totalShiftsCompleted = 0;

      for (const date of dateList) {
        const snap = activityMap.get(date);
        let earnings = orderStatsByDate[date].earnings;
        let trips = orderStatsByDate[date].trips;
        let onlineMinutes = Number(snap?.onlineMinutes || 0);
        let shiftsBooked = shiftStatsByDate[date].booked;
        let shiftsCompleted = shiftStatsByDate[date].completed;

        if (snap) {
          if (earnings <= 0 && snap.earnings > 0) earnings = Number(snap.earnings);
          if (trips <= 0 && snap.trips > 0) trips = Number(snap.trips);
          shiftsBooked = Math.max(shiftsBooked, Number(snap.shiftsBooked || 0));
          shiftsCompleted = Math.max(
            shiftsCompleted,
            Number(snap.shiftsCompleted || 0)
          );
        }

        if (date === todayStr) {
          onlineMinutes = Math.max(onlineMinutes, liveOnlineMinutes(rider));
        }

        const total = earnings;
        totalEarnings += earnings;
        totalTrips += trips;
        totalOnline += onlineMinutes;
        totalShiftsBooked += shiftsBooked;
        totalShiftsCompleted += shiftsCompleted;

        rows.push({
          date,
          dayLabel: dayLabelFor(date),
          isToday: date === todayStr,
          earnings,
          onlineMinutes,
          onlineTime: formatOnlineMinutes(onlineMinutes),
          shiftsBooked,
          shiftsCompleted,
          trips,
          total,
        });
      }

      return {
        days: [...rows].reverse(), // newest first
        totals: {
          earnings: totalEarnings,
          onlineMinutes: totalOnline,
          onlineTime: formatOnlineMinutes(totalOnline),
          shiftsBooked: totalShiftsBooked,
          shiftsCompleted: totalShiftsCompleted,
          trips: totalTrips,
          total: totalEarnings,
        },
      };
    };

    if (range === "year") {
      // 12 month summary boxes (current month back)
      const months = [];
      let totalEarnings = 0;
      let totalTrips = 0;
      let totalOnline = 0;
      let totalShiftsBooked = 0;
      let totalShiftsCompleted = 0;

      const nowParts = todayStr.split("-").map(Number);
      let y = nowParts[0];
      let m = nowParts[1];

      for (let i = 0; i < 12; i++) {
        const monthDates = listIstDatesInMonth(y, m).filter((d) => d <= todayStr);
        const { days, totals } = await buildDayRows(monthDates);
        const label = new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          month: "short",
          year: "numeric",
        }).format(istDayRange(monthDates[0] || todayStr).start);

        months.push({
          date: `${y}-${String(m).padStart(2, "0")}`,
          dayLabel: label,
          isToday: y === nowParts[0] && m === nowParts[1],
          earnings: totals.earnings,
          onlineMinutes: totals.onlineMinutes,
          onlineTime: totals.onlineTime,
          shiftsBooked: totals.shiftsBooked,
          shiftsCompleted: totals.shiftsCompleted,
          trips: totals.trips,
          total: totals.total,
          dayCount: days.length,
        });

        totalEarnings += totals.earnings;
        totalTrips += totals.trips;
        totalOnline += totals.onlineMinutes;
        totalShiftsBooked += totals.shiftsBooked;
        totalShiftsCompleted += totals.shiftsCompleted;

        m -= 1;
        if (m < 1) {
          m = 12;
          y -= 1;
        }
      }

      return res.json({
        success: true,
        data: {
          range: "year",
          granularity: "month",
          days: months,
          totals: {
            earnings: totalEarnings,
            onlineMinutes: totalOnline,
            onlineTime: formatOnlineMinutes(totalOnline),
            shiftsBooked: totalShiftsBooked,
            shiftsCompleted: totalShiftsCompleted,
            trips: totalTrips,
            total: totalEarnings,
          },
        },
      });
    }

    let dateList;
    if (range === "month") {
      const [y, m] = todayStr.split("-").map(Number);
      dateList = listIstDatesInMonth(y, m).filter((d) => d <= todayStr);
    } else {
      dateList = listRecentIstDates(7);
    }

    const { days, totals } = await buildDayRows(dateList);

    return res.json({
      success: true,
      data: {
        range: range === "month" ? "month" : "week",
        granularity: "day",
        days,
        totals,
      },
    });
  } catch (error) {
    next(error);
  }
};


import jwt from "jsonwebtoken";
import DeliveryManager from "../models/DeliveryManager.js";
import { seedManagerStore } from "../services/seedManagerStore.js";
import { hasActiveMultivendor } from "../services/multivendorAccess.js";

const normalizePhone = (phone) =>
  String(phone || "").replace(/\D/g, "").slice(-10);

const signToken = (manager) => {
  if (!process.env.JWT_SECRET) {
    const err = new Error("JWT_SECRET is not configured on the server");
    err.statusCode = 500;
    throw err;
  }

  return jwt.sign(
    {
      id: manager._id.toString(),
      role: "delivery_manager",
      email: manager.email,
      area: manager.area,
      cityId: manager.cityId,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

const authResponse = (manager, token) => ({
  success: true,
  token,
  manager: manager.toSafeJSON(),
});

const toCoord = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const citySlug = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function readStoreLocation(body = {}) {
  const latitude = toCoord(body.latitude ?? body.lat);
  const longitude = toCoord(body.longitude ?? body.lng);
  const state = String(body.state || "").trim();
  const city = String(body.city || "").trim();
  const area = String(body.area || "").trim();
  const storeAddress = String(body.storeAddress || body.address || "").trim();
  const pincode = String(body.pincode || "").replace(/\D/g, "").slice(0, 6);
  return { latitude, longitude, state, city, area, storeAddress, pincode };
}

function applyStoreLocation(manager, loc, { coordsOnly = false } = {}) {
  if (!manager || !loc) return false;
  let changed = false;
  if (loc.latitude != null && loc.longitude != null) {
    manager.latitude = loc.latitude;
    manager.longitude = loc.longitude;
    changed = true;
  }
  if (coordsOnly) return changed;
  if (loc.state) {
    manager.state = loc.state;
    changed = true;
  }
  if (loc.city) {
    manager.city = loc.city;
    manager.cityId = citySlug(loc.city);
    changed = true;
  }
  if (loc.area) {
    manager.area = loc.area;
    changed = true;
  }
  if (loc.storeAddress) {
    manager.storeAddress = loc.storeAddress;
    changed = true;
  }
  if (loc.pincode) {
    manager.pincode = loc.pincode;
    changed = true;
  }
  return changed;
}

export const register = async (_req, res) => {
  return res.status(403).json({ success: false, message: "Dark store and delivery manager logins must be requested by an active multivendor created by admin, then approved by admin." });
};

export const login = async (req, res, next) => {
  try {
    const rawIdentifier = String(req.body.identifier || req.body.email || req.body.phone || "").trim();
    const phone = normalizePhone(req.body.phone || rawIdentifier);
    const email = rawIdentifier.toLowerCase();
    const password = String(req.body.password || "");

    if ((!email && !phone) || !password) {
      return res.status(400).json({
        success: false,
        message: "Email or phone and password are required",
      });
    }

    let query;
    if (phone && /^[6-9]\d{9}$/.test(phone) && !rawIdentifier.includes("@")) {
      query = { phone };
    } else if (rawIdentifier.includes("@")) {
      query = { email };
    } else {
      query = {
        $or: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      };
    }
    const manager = await DeliveryManager.findOne(query).select("+password");

    if (!manager || !(await manager.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (!manager.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated",
      });
    }

    if (!(await hasActiveMultivendor(manager))) {
      return res.status(403).json({ success: false, message: "An active multivendor must own this dark store. Contact admin." });
    }

    // The store pin is fixed; manager/device GPS must never relocate it at login.

    // Ensure store has inventory (e.g. older accounts)
    await seedManagerStore(manager);

    const token = signToken(manager);
    return res.json(authResponse(manager, token));
  } catch (error) {
    next(error);
  }
};

export const me = async (req, res, next) => {
  try {
    const manager = await DeliveryManager.findById(req.user.id);
    if (!manager) {
      return res.status(404).json({
        success: false,
        message: "Delivery manager not found",
      });
    }
    return res.json({ success: true, manager: manager.toSafeJSON() });
  } catch (error) {
    next(error);
  }
};

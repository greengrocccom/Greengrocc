import jwt from "jsonwebtoken";
import Staff from "../models/Staff.js";
import DeliveryManager from "../../../delivery-service/src/models/DeliveryManager.js";
import DeliveryBoy from "../../../delivery-service/src/models/DeliveryBoy.js";
import {
  canCreateRole,
  CREATE_PERMISSIONS,
  ROLE_LABELS,
  STAFF_ROLES,
} from "../constants/roles.js";

const normalizePhone = (phone) =>
  String(phone || "").replace(/\D/g, "").slice(-10);

const signStaffToken = (staff) => {
  if (!process.env.JWT_SECRET) {
    const err = new Error("JWT_SECRET is not configured on the server");
    err.statusCode = 500;
    throw err;
  }

  return jwt.sign(
    {
      id: staff._id.toString(),
      role: staff.role,
      email: staff.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

const signDeliveryManagerToken = (manager) => {
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

export const getHierarchy = (_req, res) => {
  res.json({
    success: true,
    data: {
      createPermissions: CREATE_PERMISSIONS,
      roleLabels: ROLE_LABELS,
      staffRoles: STAFF_ROLES,
    },
  });
};

export const login = async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const phone = normalizePhone(req.body.phone);
    const password = String(req.body.password || "");
    const expectedRole = String(req.body.role || "").trim();

    if ((!email && !phone) || !password) {
      return res.status(400).json({
        success: false,
        message: "Email or phone and password are required",
      });
    }

    const query = email ? { email } : { phone };
    const staff = await Staff.findOne(query).select("+password");

    if (!staff || !(await staff.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (!staff.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated",
      });
    }

    if (expectedRole && staff.role !== expectedRole) {
      return res.status(403).json({
        success: false,
        message: `This login is for ${ROLE_LABELS[expectedRole] || expectedRole} only`,
      });
    }

    const token = signStaffToken(staff);
    return res.json({
      success: true,
      token,
      staff: staff.toSafeJSON(),
    });
  } catch (error) {
    next(error);
  }
};

export const me = async (req, res, next) => {
  try {
    if (req.user.role === "admin") {
      return res.json({
        success: true,
        staff: {
          id: req.user.id,
          role: "admin",
          name: "Admin",
          email: req.user.email || "",
        },
      });
    }

    const staff = await Staff.findById(req.user.id);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff account not found",
      });
    }

    return res.json({ success: true, staff: staff.toSafeJSON() });
  } catch (error) {
    next(error);
  }
};

export const listStaff = async (req, res, next) => {
  try {
    const actorRole = req.user.role;
    const filter = {};

    if (actorRole === "admin") {
      if (req.query.role) filter.role = String(req.query.role);
    } else {
      const allowed = CREATE_PERMISSIONS[actorRole] || [];
      const staffTargets = allowed.filter((r) => STAFF_ROLES.includes(r));
      if (staffTargets.length === 0) {
        return res.json({ success: true, count: 0, data: [] });
      }
      filter.role = { $in: staffTargets };
      filter.createdBy = req.user.id;
    }

    const staff = await Staff.find(filter).sort({ createdAt: -1 });
    return res.json({
      success: true,
      count: staff.length,
      data: staff.map((s) => s.toSafeJSON()),
    });
  } catch (error) {
    next(error);
  }
};

export const createAccount = async (req, res, next) => {
  try {
    const actorRole = req.user.role;
    const targetRole = String(req.body.role || "").trim();

    if (!targetRole) {
      return res.status(400).json({
        success: false,
        message: "Role is required",
      });
    }

    if (!canCreateRole(actorRole, targetRole)) {
      return res.status(403).json({
        success: false,
        message: `${ROLE_LABELS[actorRole] || actorRole} cannot create ${ROLE_LABELS[targetRole] || targetRole}`,
      });
    }

    if (targetRole === "delivery_manager") {
      return res.status(403).json({ success: false, message: "Dark store and delivery manager logins must be requested by an active multivendor created by admin, then approved by admin." });
    }

    if (targetRole === "delivery_boy") {
      return createDeliveryBoy(req, res, next);
    }

    return createStaffAccount(req, res, next, targetRole);
  } catch (error) {
    next(error);
  }
};

async function createStaffAccount(req, res, next, targetRole) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const phone = normalizePhone(req.body.phone);
    const password = String(req.body.password || "");
    const name = String(req.body.name || "").trim();

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address",
      });
    }

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

    const existingEmail = await Staff.findOne({ email });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    const existingPhone = await Staff.findOne({ phone });
    if (existingPhone) {
      return res.status(409).json({
        success: false,
        message: "Phone number already registered",
      });
    }

    const staff = await Staff.create({
      name,
      email,
      phone,
      password,
      role: targetRole,
      createdBy: req.user.id,
      createdByRole: req.user.role,
      meta: req.body.meta && typeof req.body.meta === "object" ? req.body.meta : {},
    });

    return res.status(201).json({
      success: true,
      message: `${ROLE_LABELS[targetRole]} account created`,
      staff: staff.toSafeJSON(),
    });
  } catch (error) {
    next(error);
  }
}

async function createDeliveryBoy(req, res, next) {
  try {
    const phone = normalizePhone(req.body.phone);
    const password = String(req.body.password || "");
    const name = String(req.body.name || "").trim();
    const vehicleType = String(req.body.vehicleType || "motorcycle").trim();
    const storeId = String(req.body.storeId || "").trim();
    const actorRole = req.user?.role;
    const vendorId = req.user?.vendorId || (actorRole === "vendor" ? req.user.id : "");

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

    const existing = await DeliveryBoy.findOne({ phone });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Delivery boy already registered with this phone number",
      });
    }

    let manager = null;
    if (actorRole === "delivery_manager") {
      manager = await DeliveryManager.findById(req.user.id);
      if (!manager) {
        return res.status(404).json({
          success: false,
          message: "Delivery manager not found",
        });
      }
    } else if (actorRole === "vendor") {
      if (storeId) {
        manager = await DeliveryManager.findOne({ _id: storeId, vendorId });
      } else {
        const stores = await DeliveryManager.find({ vendorId });
        if (stores.length === 1) manager = stores[0];
        else if (stores.length === 0) {
          return res.status(400).json({
            success: false,
            message: "No approved dark store found. Admin must approve a dark store for your vendor account first.",
          });
        } else {
          return res.status(400).json({
            success: false,
            message: "Please select an approved dark store for this delivery boy",
          });
        }
      }
      if (!manager) {
        return res.status(404).json({
          success: false,
          message: "Selected dark store not found or does not belong to your vendor account",
        });
      }
    } else if (actorRole === "admin" && storeId) {
      manager = await DeliveryManager.findById(storeId);
    }

    const deliveryBoy = await DeliveryBoy.create({
      phone,
      password,
      name,
      vehicleType,
      city: manager?.city || req.body.city || "",
      cityId: manager?.cityId || req.body.cityId || "",
      area: manager?.area || req.body.area || "",
      managerId: manager?._id || undefined,
      storeId: manager ? manager._id.toString() : storeId,
      vendorId: manager?.vendorId || vendorId || "",
      verificationStatus: actorRole === "vendor" || actorRole === "admin" ? "verified" : "pending",
      status: "offline",
    });

    return res.status(201).json({
      success: true,
      message: "Delivery boy account created successfully",
      deliveryBoy: deliveryBoy.toSafeJSON(),
    });
  } catch (error) {
    next(error);
  }
}

export { signDeliveryManagerToken };

import mongoose from "mongoose";

export const getVendorBatches = async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    
    // Aggregate quality inspections with farmer orders to get product and farmer details
    const qis = await db.collection("qualityinspections").aggregate([
      {
        $lookup: {
          from: "farmerorders",
          localField: "orderId",
          foreignField: "orderId",
          as: "orderData"
        }
      },
      {
        $unwind: {
          path: "$orderData",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $sort: { createdAt: -1 }
      }
    ]).toArray();

    const batches = qis.map(qi => ({
      id: qi.batchId || qi._id.toString(),
      orderId: qi.orderId,
      product: qi.orderData?.crop?.name || 'Unknown Product',
      farmer: qi.orderData?.farmerName || 'Unknown Farmer',
      receivedQty: `${qi.quantity || qi.orderData?.quantity || 0} ${qi.unit || 'KG'}`,
      status: 'Received',
      vendorStatus: qi.status || 'Confirmed by Vendor',
      date: qi.createdAt ? new Date(qi.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    }));

    return res.json({ success: true, data: batches });
  } catch (error) {
    next(error);
  }
};

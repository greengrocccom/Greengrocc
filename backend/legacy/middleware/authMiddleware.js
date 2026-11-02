import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import Admin from "../models/admin.js";

export const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized — please login",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "JWT_SECRET is not configured on the server",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let user = await User.findById(decoded.id).select("-password");
    if (!user) {
      user = await Admin.findById(decoded.id).select("-password");
    }

    if (!user && (String(decoded.role || "").toLowerCase() === "vendor" || decoded.vendorId)) {
      const Vendor = mongoose.models.Vendor;
      if (Vendor) {
        user = await Vendor.findOne({
          $or: [
            { id: decoded.id || decoded.vendorId },
            { vendorId: decoded.vendorId || decoded.id },
            ...(mongoose.isValidObjectId(decoded.id) ? [{ _id: decoded.id }] : [])
          ]
        }).select("-password");
        if (user) {
          user = { ...user.toObject(), role: "vendor", id: user.id || user._id, _id: user._id || user.id };
        }
      }
      if (!user) {
        user = {
          id: decoded.id || decoded.vendorId,
          _id: decoded.id || decoded.vendorId,
          role: "vendor",
          vendorId: decoded.vendorId || decoded.id,
          name: decoded.name || decoded.vendorName || "Vendor"
        };
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists",
      });
    }

    if (user.role !== "admin" && user.role !== "vendor") {
      const isBlocked =
        user.isBlocked === true ||
        user.blocked === true ||
        user.isActive === false ||
        user.active === false ||
        String(user.status || "").trim().toLowerCase() === "blocked" ||
        String(user.status || "").trim().toLowerCase() === "inactive";

      if (isBlocked) {
        return res.status(403).json({
          success: false,
          isBlocked: true,
          message:
            user.blockReason
              ? `Your account is deactivated or blocked by admin. Reason: ${user.blockReason}`
              : "Your account is deactivated or blocked by admin. You can submit an unblock request.",
        });
      }
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token — please login again",
    });
  }
};

export const optionalProtect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return next();
    }

    if (!process.env.JWT_SECRET) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    let user = await User.findById(decoded.id).select("-password");
    if (!user) {
      user = await Admin.findById(decoded.id).select("-password");
    }

    if (user) {
      req.user = user;
    }
  } catch {
    // Ignore invalid tokens for optional auth
  }

  next();
};

export const requireAdmin = (req, res, next) => {
  const role = String(req.user?.role || "").trim().toLowerCase();
  if (role !== "admin" && role !== "vendor") {
    return res.status(403).json({
      success: false,
      message: "Admin access only",
    });
  }
  next();
};

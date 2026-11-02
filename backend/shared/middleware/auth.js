import jwt from "jsonwebtoken";
import mongoose from "mongoose";

/** Resolve admin role when JWT only has { id } (customer/admin User tokens). */
async function resolveRoleFromUserCollection(userId) {
  if (!userId || !mongoose.connection?.readyState) return null;
  try {
    const User = mongoose.models.UserBulkMart || mongoose.models.User;
    if (!User) return null;
    const user = await User.findById(userId).select("role").lean();
    return user?.role || null;
  } catch {
    return null;
  }
}

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
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

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    let role = decoded.role ? String(decoded.role).trim().toLowerCase() : null;

    if (!role) {
      const userRole = await resolveRoleFromUserCollection(decoded.id || decoded.vendorId);
      role = userRole ? String(userRole).trim().toLowerCase() : null;
    }

    req.user = { id: decoded.id || decoded.vendorId, role, email: decoded.email, vendorId: decoded.vendorId };
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Not authorized — invalid token",
    });
  }
};

export const requireAdmin = (req, res, next) => {
  const role = String(req.user?.role || "").trim().toLowerCase();
  if (role !== "admin" && role !== "vendor") {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }
  next();
};

export const requireRoles = (...roles) => (req, res, next) => {
  const userRole = req.user?.role ? String(req.user.role).trim().toLowerCase() : "";
  const allowedRoles = roles.map((r) => String(r).trim().toLowerCase());
  if (!userRole || !allowedRoles.includes(userRole)) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission for this action",
    });
  }
  next();
};

export const optionalAuth = (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ") || !process.env.JWT_SECRET) {
    return next();
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id, role: decoded.role, vendorId: decoded.vendorId };
  } catch {
    // ignore invalid token for optional auth
  }
  next();
};

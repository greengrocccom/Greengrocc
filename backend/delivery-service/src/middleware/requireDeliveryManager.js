import DeliveryManager from "../models/DeliveryManager.js";
import { hasActiveMultivendor } from "../services/multivendorAccess.js";

/** Check the account and its owner on every request, including existing sessions. */
export const requireDeliveryManager = async (req, res, next) => {
  if (req.user?.role !== "delivery_manager") {
    return res.status(403).json({ success: false, message: "Delivery manager access required" });
  }
  try {
    const manager = await DeliveryManager.findById(req.user.id);
    if (!manager?.isActive || !(await hasActiveMultivendor(manager))) {
      return res.status(403).json({ success: false, message: "An active multivendor must own this dark store. Contact admin." });
    }
    next();
  } catch (error) {
    next(error);
  }
};

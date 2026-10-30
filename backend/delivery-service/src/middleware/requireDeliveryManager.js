/** Ensure JWT user is a delivery manager. */
export const requireDeliveryManager = (req, res, next) => {
  if (req.user?.role !== "delivery_manager") {
    return res.status(403).json({
      success: false,
      message: "Delivery manager access required",
    });
  }
  next();
};

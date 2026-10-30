import Gig from "../models/Gig.js";
import DeliveryManager from "../models/DeliveryManager.js";
import DeliveryBoy from "../models/DeliveryBoy.js";
import { formatDateStringIST, timeToMinutes } from "./shiftController.js";

/** Active gig happening right now for this store (IST). */
export async function findLiveGigForManager(managerId) {
  if (!managerId) return null;
  const todayStr = formatDateStringIST(new Date());
  const gigs = await Gig.find({
    isActive: true,
    managerId,
    dateString: todayStr,
  });
  if (!gigs.length) return null;

  const nowIST = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  }).format(new Date());
  const currentMin = timeToMinutes(nowIST);

  return (
    gigs.find((g) => {
      if (!g.startTime || !g.endTime) return true;
      const start = timeToMinutes(g.startTime);
      const end = timeToMinutes(g.endTime);
      if (end > start) return currentMin >= start && currentMin < end;
      return currentMin >= start || currentMin < end;
    }) || null
  );
}

const getManager = async (req) => {
  const manager = await DeliveryManager.findById(req.user.id);
  if (!manager) {
    const err = new Error("Delivery manager not found");
    err.statusCode = 404;
    throw err;
  }
  return manager;
};

/**
 * Store Manager creates a new Gig / Incentive
 */
export const createGig = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const {
      title,
      type,
      dateString,
      startTime,
      endTime,
      targetHours,
      targetEarnings,
      bonusAmount,
      description,
    } = req.body;

    if (!title || !dateString) {
      return res.status(400).json({
        success: false,
        message: "Title and dateString are required fields",
      });
    }

    const parsedTiers = Array.isArray(req.body.tiers)
      ? req.body.tiers
          .map((t) => ({
            minTarget: Number(t.minTarget) || 0,
            bonusAmount: Number(t.bonusAmount) || 0,
          }))
          .filter((t) => t.minTarget > 0 && t.bonusAmount > 0)
      : [];

    const defaultTargetEarnings = parsedTiers.length > 0
      ? parsedTiers[0].minTarget
      : Number(targetEarnings) || 200;

    const defaultTargetHours = parsedTiers.length > 0
      ? parsedTiers[0].minTarget
      : Number(targetHours) || 2;

    const defaultBonus = parsedTiers.length > 0 
      ? Math.max(...parsedTiers.map((t) => t.bonusAmount))
      : Number(bonusAmount) || 18;

    const gig = await Gig.create({
      managerId: manager._id,
      storeId: manager._id.toString(),
      area: manager.area || "",
      title,
      type: type || "earnings_target",
      dateString,
      startTime: startTime || "06:00 PM",
      endTime: endTime || "10:00 PM",
      targetHours: defaultTargetHours,
      targetEarnings: defaultTargetEarnings,
      bonusAmount: defaultBonus,
      tiers: parsedTiers,
      description: description || "",
      isActive: true,
    });

    try {
      const { notifyNewGig } = await import("../services/RiderNotificationService.js");
      await notifyNewGig(manager._id, {
        gigId: gig._id,
        title,
      });
    } catch (err) {
      console.warn("[createGig] notification failed:", err.message);
    }

    return res.status(201).json({
      success: true,
      message: "Gig incentive created successfully",
      gig: gig.toSafeJSON(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Store Manager lists all Gigs for their store
 */
export const listGigs = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const { date } = req.query;

    const query = { managerId: manager._id };
    if (date) {
      query.dateString = date;
    }

    const gigs = await Gig.find(query).sort({ dateString: -1, createdAt: -1 });

    return res.json({
      success: true,
      gigs: gigs.map((g) => g.toSafeJSON()),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Store Manager updates a Gig
 */
export const updateGig = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const { gigId } = req.params;

    const gig = await Gig.findOne({ _id: gigId, managerId: manager._id });
    if (!gig) {
      return res.status(404).json({ success: false, message: "Gig incentive not found" });
    }

    const allowed = [
      "title",
      "type",
      "dateString",
      "startTime",
      "endTime",
      "targetHours",
      "targetEarnings",
      "bonusAmount",
      "description",
      "isActive",
    ];

    allowed.forEach((field) => {
      if (req.body[field] !== undefined) {
        gig[field] = req.body[field];
      }
    });

    if (Array.isArray(req.body.tiers)) {
      gig.tiers = req.body.tiers
        .map((t) => ({
          minTarget: Number(t.minTarget) || 0,
          bonusAmount: Number(t.bonusAmount) || 0,
        }))
        .filter((t) => t.minTarget > 0 && t.bonusAmount > 0);
    }

    await gig.save();

    return res.json({
      success: true,
      message: "Gig incentive updated successfully",
      gig: gig.toSafeJSON(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Store Manager deletes a Gig
 */
export const deleteGig = async (req, res, next) => {
  try {
    const manager = await getManager(req);
    const { gigId } = req.params;

    const gig = await Gig.findOneAndDelete({ _id: gigId, managerId: manager._id });
    if (!gig) {
      return res.status(404).json({ success: false, message: "Gig incentive not found" });
    }

    return res.json({
      success: true,
      message: "Gig incentive deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delivery Driver fetches active Gigs for their assigned store
 */
export const getPartnerGigs = async (req, res, next) => {
  try {
    const rider = await DeliveryBoy.findById(req.user.id);
    if (!rider) {
      return res.status(404).json({ success: false, message: "Delivery partner not found" });
    }

    const riderArea = rider.area?.trim();
    let manager = null;
    if (rider.managerId) {
      manager = await DeliveryManager.findById(rider.managerId);
      if (manager) {
        const managerArea = (manager.area || "").trim().toLowerCase();
        if (riderArea && managerArea && riderArea.toLowerCase() !== managerArea) {
          manager = null;
        }
      }
    }

    if (!manager && riderArea) {
      const escapedArea = riderArea.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      manager = await DeliveryManager.findOne({
        isActive: true,
        area: new RegExp(`^${escapedArea}$`, "i"),
      }).sort({ createdAt: -1 });
    }

    if (!manager) {
      return res.json({
        success: true,
        storeName: "No Store Assigned",
        gigs: [],
      });
    }

    const gigs = await Gig.find({
      isActive: true,
      managerId: manager._id,
    }).sort({ dateString: -1, createdAt: -1 });

    return res.json({
      success: true,
      storeName: manager.storeName || `${manager.area} Dark Store`,
      gigs: gigs.map((g) => g.toSafeJSON()),
    });
  } catch (error) {
    next(error);
  }
};

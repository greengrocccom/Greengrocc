import { getIO } from "../../../socket.js";
import DeliveryBoy from "../models/DeliveryBoy.js";
import { resolveStoreIdForRider } from "../utils/storeResolver.js";
import {
  ensureTodayOnlineTracking,
  liveOnlineMinutes,
} from "../utils/onlineHoursHelper.js";
import { isCurrentlyPeak } from "../utils/peakHoursHelper.js";

export async function emitRiderStatusUpdated(rider, extra = {}) {
  const storeId = await resolveStoreIdForRider(rider);
  if (!storeId) return;

  try {
    getIO()
      .to(`store_${storeId}`)
      .emit("rider_status_updated", {
        riderId: rider._id.toString(),
        name: rider.name || rider.phone,
        status: rider.status,
        todayOnlineMinutes: liveOnlineMinutes(rider),
        updatedAt: new Date().toISOString(),
        ...extra,
      });
  } catch (err) {
    console.warn("[socket] rider_status_updated emit failed:", err.message);
  }
}

export async function emitRiderDocumentUpdated(rider, documentType, verificationStatus) {
  const storeId = await resolveStoreIdForRider(rider);
  if (!storeId) return;

  try {
    getIO()
      .to(`store_${storeId}`)
      .emit("rider_document_updated", {
        riderId: rider._id.toString(),
        documentType,
        verificationStatus,
        updatedAt: new Date().toISOString(),
      });
  } catch (err) {
    console.warn("[socket] rider_document_updated emit failed:", err.message);
  }
}

export async function applyGigStatusChange(rider, nextStatus) {
  const now = new Date();
  ensureTodayOnlineTracking(rider);

  if (nextStatus === "online") {
    rider.todayOnlineMinutes = liveOnlineMinutes(rider, now);
    rider.lastOnlineAt = now;
    rider.status = "online";
  } else if (nextStatus === "offline") {
    if (rider.status === "on_delivery") {
      const err = new Error(
        "Complete your current delivery before going offline"
      );
      err.statusCode = 400;
      throw err;
    }
    rider.todayOnlineMinutes = liveOnlineMinutes(rider, now);
    rider.lastOfflineAt = now;
    rider.status = "offline";
  }

  rider.lastStatusAt = now;
  rider.lastSeenAt = now;
}

export async function buildStatusResponseExtras(rider) {
  const storeId = await resolveStoreIdForRider(rider);
  let isPeak = false;
  if (storeId) {
    isPeak = await isCurrentlyPeak(storeId);
    if (isPeak && rider.status === "online") {
      try {
        getIO().to(`rider_${rider._id}`).emit("peak_hours_active", {
          storeId,
          isPeak: true,
          message: "Peak hours right now — earn extra per order",
        });
      } catch (_) {
        /* non-fatal */
      }
    }
  }

  return { storeId, isPeak, todayOnlineMinutes: liveOnlineMinutes(rider) };
}

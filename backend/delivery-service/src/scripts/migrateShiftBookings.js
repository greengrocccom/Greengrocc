import "dotenv/config";
import mongoose from "mongoose";
import DeliveryBoy from "../models/DeliveryBoy.js";
import Shift from "../models/Shift.js";
import { formatDateStringIST, timeToMinutes } from "../controllers/shiftController.js";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function runMigration() {
  console.log("==================================================");
  console.log("[Migration] Starting shiftBooking -> currentBooking migration...");
  if (!MONGO_URI) throw new Error("Set MONGO_URI or MONGODB_URI before running the migration.");
  console.log("[Migration] Connecting to MongoDB.");
  console.log("==================================================");

  try {
    await mongoose.connect(MONGO_URI);
    console.log("[Migration] Database connection successful.");

    // Query all delivery boys using raw collection to catch legacy shiftBooking field
    const rawRiders = await mongoose.connection.collection("deliveryboys").find({
      $or: [
        { "shiftBooking.slot": { $exists: true, $ne: "" } },
        { "shiftBooking.date": { $exists: true, $ne: null } },
      ],
    }).toArray();

    console.log(`[Migration] Found ${rawRiders.length} rider(s) with legacy shiftBooking records.`);

    let migratedCount = 0;
    let unmatchedCount = 0;
    const unmatchedList = [];

    for (const rawRider of rawRiders) {
      const riderId = rawRider._id;
      const legacyBooking = rawRider.shiftBooking || {};
      const slotStr = String(legacyBooking.slot || "").trim();
      const bookingDate = legacyBooking.date ? new Date(legacyBooking.date) : new Date();
      const dateStr = formatDateStringIST(bookingDate);
      const managerId = rawRider.managerId;

      console.log(`\n[Processing Rider] ${rawRider.name || rawRider.phone || riderId} — Legacy Slot: '${slotStr}', Date: ${dateStr}`);

      if (!managerId) {
        console.warn(`  ↳ WARNING: Rider ${riderId} has no assigned managerId. Cannot match Shift.`);
        unmatchedCount++;
        unmatchedList.push({ riderId: riderId.toString(), name: rawRider.name, phone: rawRider.phone, slot: slotStr, date: dateStr, reason: "No assigned managerId" });
        continue;
      }

      // Locate Shift doc for this manager and date
      const shift = await Shift.findOne({
        managerId,
        dateString: dateStr,
      });

      if (!shift || !shift.slots || shift.slots.length === 0) {
        console.warn(`  ↳ UNMATCHED: No Shift document found for manager ${managerId} on date ${dateStr}.`);
        unmatchedCount++;
        unmatchedList.push({ riderId: riderId.toString(), name: rawRider.name, phone: rawRider.phone, slot: slotStr, date: dateStr, reason: "Shift document missing" });
        continue;
      }

      // Match slot by startTime / slot label string
      let matchedSlot = shift.slots.find((s) => {
        const fullRange = `${s.startTime} - ${s.endTime}`;
        return slotStr.includes(s.startTime) || fullRange.includes(slotStr) || slotStr.includes(fullRange);
      });

      if (!matchedSlot) {
        // Fallback to first available slot if exact string matching fails
        matchedSlot = shift.slots[0];
      }

      if (!matchedSlot) {
        console.warn(`  ↳ UNMATCHED: No slot in Shift ${shift._id} matched legacy slot string '${slotStr}'.`);
        unmatchedCount++;
        unmatchedList.push({ riderId: riderId.toString(), name: rawRider.name, phone: rawRider.phone, slot: slotStr, date: dateStr, reason: "Slot matching failed" });
        continue;
      }

      const bookingObjectId = new mongoose.Types.ObjectId();
      const newBookingSubdoc = {
        _id: bookingObjectId,
        bookingId: bookingObjectId.toString(),
        deliveryPartnerId: riderId,
        deliveryPartnerPhone: rawRider.phone || "",
        deliveryPartnerName: rawRider.name || "Delivery Partner",
        deliveryPartnerProfileImage: rawRider.selfie?.imageBase64 || "",
        bookedAt: legacyBooking.bookedAt || new Date(),
        status: "UPCOMING",
        notificationEnabled: false,
        notificationTimeMinutes: 15,
      };

      // Push booking into Shift subdocument array
      matchedSlot.bookings.push(newBookingSubdoc);
      matchedSlot.bookedCount = Math.max(matchedSlot.bookedCount || 0, matchedSlot.bookings.length);
      await shift.save();

      // Update Rider document with new currentBooking pointer and unset legacy shiftBooking
      await DeliveryBoy.findByIdAndUpdate(riderId, {
        $set: {
          currentBooking: {
            shiftId: shift._id,
            slotId: matchedSlot._id,
            bookingId: bookingObjectId,
          },
        },
        $unset: { shiftBooking: "" },
      });

      migratedCount++;
      console.log(`  ✓ SUCCESS: Migrated to Shift ${shift._id}, Slot ${matchedSlot._id} (${matchedSlot.startTime} - ${matchedSlot.endTime}).`);
    }

    console.log("\n==================================================");
    console.log("[Migration Summary]");
    console.log(`  • Total Legacy Bookings Scanned : ${rawRiders.length}`);
    console.log(`  • Successfully Migrated        : ${migratedCount}`);
    console.log(`  • Unmatched (Audit Required)   : ${unmatchedCount}`);
    console.log("==================================================");

    if (unmatchedList.length > 0) {
      console.log("\n[Unmatched Bookings Audit Log]:");
      console.table(unmatchedList);
    }
  } catch (err) {
    console.error("[Migration Error] Fatal error during migration execution:", err);
  } finally {
    await mongoose.disconnect();
    console.log("[Migration] Disconnected from MongoDB.");
    process.exit(0);
  }
}

runMigration();

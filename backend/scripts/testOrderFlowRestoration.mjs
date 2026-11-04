import "dotenv/config";
import mongoose from "mongoose";
import DeliveryManager from "../delivery-service/src/models/DeliveryManager.js";
import DeliveryBoy from "../delivery-service/src/models/DeliveryBoy.js";
import StoreOrder from "../delivery-service/src/models/StoreOrder.js";
import {
  findEligibleDrivers,
  assignNextDriver,
  acceptDriverOffer,
  declineDriverOffer,
} from "../delivery-service/src/services/OrderAssignmentService.js";
import { tryAutoAttachOnPack } from "../delivery-service/src/services/sameRouteAttachService.js";

async function runTests() {
  console.log("=== STARTING ORDER ASSIGNMENT FLOW RESTORATION TESTS ===");
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("Set MONGODB_URI before running the tests.");
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");

  const cleanupIds = {
    managers: [],
    drivers: [],
    orders: [],
  };

  try {
    // Setup Mock Dark Store at Pune (18.5590, 73.7868)
    const store = await DeliveryManager.create({
      name: "Test Manager",
      email: `test_mgr_${Date.now()}@greengrocc.com`,
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      password: "password123",
      state: "Maharashtra",
      city: "Pune",
      cityId: "pune",
      area: "Baner",
      storeName: "Baner Dark Store",
      latitude: 18.5590,
      longitude: 73.7868,
      geofenceRadius: 500, // 500 meters
    });
    cleanupIds.managers.push(store._id);
    console.log("✓ Created test dark store:", store.storeName, `(coords: ${store.latitude}, ${store.longitude}, radius: ${store.geofenceRadius}m)`);

    // Test 1 & 2: Order is not assigned before it is packed
    console.log("\n--- TEST 1 & 2: Order cannot be assigned before packed ---");
    const incomingOrder = await StoreOrder.create({
      orderNumber: `ORD-TEST-1-${Date.now()}`,
      managerId: store._id,
      darkStoreId: store._id,
      customerName: "Ramesh Sharma",
      customerPhone: "9876543210",
      customerAddress: "Baner Road, Pune",
      customerLat: 18.5600,
      customerLng: 73.7870,
      status: "order_received",
      assignmentStatus: "NONE",
      items: [{ sku: "SKU-TOMATO", name: "Tomatoes", quantity: 2, price: 40, department: "instant" }],
    });
    cleanupIds.orders.push(incomingOrder._id);

    const prematureAssignResult = await assignNextDriver(incomingOrder._id);
    console.log("Premature assign result on order_received:", prematureAssignResult);
    if (prematureAssignResult.success === false && prematureAssignResult.message?.includes("packed")) {
      console.log("✓ PASS: assignNextDriver properly rejected order in order_received status without mutating to packed");
    } else {
      throw new Error(`FAIL: Expected order_received assignment to be rejected, got: ${JSON.stringify(prematureAssignResult)}`);
    }

    const checkIncoming = await StoreOrder.findById(incomingOrder._id);
    if (checkIncoming.status !== "order_received") {
      throw new Error(`FAIL: Order status mutated to ${checkIncoming.status}! Expected order_received`);
    }
    console.log("✓ PASS: Order status remained order_received in incoming queue");

    // Test 7: Pre-order cannot be auto-assigned
    console.log("\n--- TEST 7: Pre-order cannot be auto-assigned ---");
    const preOrder = await StoreOrder.create({
      orderNumber: `PRE-TEST-${Date.now()}`,
      managerId: store._id,
      darkStoreId: store._id,
      customerName: "Preorder Customer",
      customerPhone: "9876543211",
      customerAddress: "Aundh, Pune",
      customerLat: 18.5610,
      customerLng: 73.7880,
      status: "packed",
      isPreOrder: true,
      preOrderSlot: "09:00 AM - 12:00 PM",
      assignmentStatus: "NONE",
      items: [{ sku: "SKU-EXOTIC", name: "Exotic Veg Box", quantity: 1, price: 300, department: "preorder" }],
    });
    cleanupIds.orders.push(preOrder._id);

    const preOrderAssignResult = await assignNextDriver(preOrder._id);
    console.log("Pre-order assign result:", preOrderAssignResult);
    if (preOrderAssignResult.manualOnly === true) {
      console.log("✓ PASS: Pre-order auto-assignment prevented (manualOnly: true)");
    } else {
      throw new Error(`FAIL: Pre-order auto-assignment was not prevented: ${JSON.stringify(preOrderAssignResult)}`);
    }

    // Test 8, 9, 10: Driver Eligibility Checks (500m radius, online status, employment type)
    console.log("\n--- TEST 8, 9, 10: Driver Eligibility Checks (500m radius, online status, employment type) ---");
    
    // Driver A: Offline, 55m from store
    const driverOffline = await DeliveryBoy.create({
      name: "Driver Offline",
      phone: `91${Math.floor(10000000 + Math.random() * 90000000)}`,
      password: "password123",
      managerId: store._id,
      status: "offline",
      isActive: true,
      verificationStatus: "approved",
      currentLocation: { lat: 18.5595, lng: 73.7868, updatedAt: new Date() }, // ~55m away
    });
    cleanupIds.drivers.push(driverOffline._id);

    // Driver B: Online, but 1200m away (outside 500m)
    // 18.5700, 73.7868 is ~1.2 km north of store
    const driverFar = await DeliveryBoy.create({
      name: "Driver Far",
      phone: `92${Math.floor(10000000 + Math.random() * 90000000)}`,
      password: "password123",
      managerId: store._id,
      status: "online",
      isActive: true,
      verificationStatus: "approved",
      currentLocation: { lat: 18.5700, lng: 73.7868, updatedAt: new Date() }, // ~1220m away
    });
    cleanupIds.drivers.push(driverFar._id);

    // Driver C: Online, Full-Time (should be skipped from automatic round robin)
    const driverFullTime = await DeliveryBoy.create({
      name: "Driver FullTime",
      phone: `93${Math.floor(10000000 + Math.random() * 90000000)}`,
      password: "password123",
      managerId: store._id,
      status: "online",
      isActive: true,
      employmentType: "FULL_TIME",
      verificationStatus: "approved",
      currentLocation: { lat: 18.5592, lng: 73.7868, updatedAt: new Date() }, // ~22m away
    });
    cleanupIds.drivers.push(driverFullTime._id);

    // Driver D: Online, missing GPS coordinates
    const driverNoGps = await DeliveryBoy.create({
      name: "Driver No GPS",
      phone: `94${Math.floor(10000000 + Math.random() * 90000000)}`,
      password: "password123",
      managerId: store._id,
      status: "online",
      isActive: true,
      verificationStatus: "approved",
      currentLocation: { lat: null, lng: null, updatedAt: null },
    });
    cleanupIds.drivers.push(driverNoGps._id);

    const eligibleNone = await findEligibleDrivers(store);
    console.log("Eligible drivers when no valid 500m online gig driver exists:", eligibleNone.length);
    if (eligibleNone.length === 0) {
      console.log("✓ PASS: Correctly skipped offline, outside 500m, full-time, and missing GPS drivers");
    } else {
      throw new Error(`FAIL: Expected 0 eligible drivers, got: ${eligibleNone.map(e => e.driver.name)}`);
    }

    // Now test order when no eligible driver exists -> remains packed, WAITING_FOR_DRIVER
    incomingOrder.stockDeductedAt = new Date();
    incomingOrder.status = "packed";
    await incomingOrder.save();
    const noDriverAssignResult = await assignNextDriver(incomingOrder._id);
    console.log("Assign result when no driver available:", noDriverAssignResult);
    const freshOrderWaiting = await StoreOrder.findById(incomingOrder._id);
    if (freshOrderWaiting.status === "packed" && freshOrderWaiting.assignmentStatus === "WAITING_FOR_DRIVER") {
      console.log("✓ PASS: Order safely remains in status 'packed' with assignmentStatus 'WAITING_FOR_DRIVER'");
    } else {
      throw new Error(`FAIL: Order status/assignmentStatus mismatch: ${freshOrderWaiting.status} / ${freshOrderWaiting.assignmentStatus}`);
    }

    // Driver 1: Online, 100m away, roundRobinPosition 1000
    const driver1 = await DeliveryBoy.create({
      name: "Rider One",
      phone: `95${Math.floor(10000000 + Math.random() * 90000000)}`,
      password: "password123",
      managerId: store._id,
      status: "online",
      isActive: true,
      employmentType: "PART_TIME",
      verificationStatus: "approved",
      roundRobinPosition: 1000,
      currentLocation: { lat: 18.5599, lng: 73.7868, updatedAt: new Date() }, // ~100m away
    });
    cleanupIds.drivers.push(driver1._id);

    // Driver 2: Online, 200m away, roundRobinPosition 2000
    const driver2 = await DeliveryBoy.create({
      name: "Rider Two",
      phone: `96${Math.floor(10000000 + Math.random() * 90000000)}`,
      password: "password123",
      managerId: store._id,
      status: "online",
      isActive: true,
      employmentType: "PART_TIME",
      verificationStatus: "approved",
      roundRobinPosition: 2000,
      currentLocation: { lat: 18.5608, lng: 73.7868, updatedAt: new Date() }, // ~200m away
    });
    cleanupIds.drivers.push(driver2._id);

    // Test 3, 4: Automatic assignment for Instant / Ready-to-Cook orders
    console.log("\n--- TEST 3 & 4: Automatic assignment on Packed order & Round-Robin Rotation ---");
    const eligibleWithTwo = await findEligibleDrivers(store);
    console.log("Eligible drivers found:", eligibleWithTwo.map(e => `${e.driver.name} (dist: ${Math.round(e.distanceM)}m, rrPos: ${e.driver.roundRobinPosition})`));
    if (eligibleWithTwo.length !== 2) {
      throw new Error(`FAIL: Expected 2 eligible drivers, got: ${eligibleWithTwo.length}`);
    }
    if (String(eligibleWithTwo[0].driver._id) !== String(driver1._id)) {
      throw new Error(`FAIL: Expected Rider One (rrPos: 1000) to be first in round-robin, got: ${eligibleWithTwo[0].driver.name}`);
    }
    console.log("✓ PASS: Round-robin properly ordered Rider One ahead of Rider Two");

    // Assign Order 1
    const assignOrder1 = await assignNextDriver(incomingOrder._id);
    console.log("Assign Order 1 result:", assignOrder1);
    if (!assignOrder1.success || assignOrder1.offeredRider?.id !== driver1._id.toString()) {
      throw new Error(`FAIL: Expected Order 1 to be offered to Rider One, got: ${JSON.stringify(assignOrder1)}`);
    }
    console.log("✓ PASS: Order 1 offered to Rider One");

    // Test 11: Concurrent assignment safety (Driver 1 has active offer, so Driver 2 gets Order 2)
    console.log("\n--- TEST 11: Prevent duplicate assignments when orders packed simultaneously ---");
    const order2 = await StoreOrder.create({
      orderNumber: `ORD-TEST-2-${Date.now()}`,
      managerId: store._id,
      darkStoreId: store._id,
      customerName: "Sunil Verma",
      customerPhone: "9876543212",
      customerAddress: "Near Baner Bridge, Pune",
      customerLat: 18.5605,
      customerLng: 73.7872,
      status: "packed",
      packedAt: new Date(),
      stockDeductedAt: new Date(),
      assignmentStatus: "SEARCHING_FOR_DRIVER",
      items: [{ sku: "SKU-APPLE", name: "Apples", quantity: 1, price: 120, department: "ready2cook" }],
    });
    cleanupIds.orders.push(order2._id);

    const assignOrder2 = await assignNextDriver(order2._id);
    console.log("Assign Order 2 result:", assignOrder2);
    if (!assignOrder2.success || assignOrder2.offeredRider?.id !== driver2._id.toString()) {
      throw new Error(`FAIL: Expected Order 2 to be offered to Rider Two, got: ${JSON.stringify(assignOrder2)}`);
    }
    console.log("✓ PASS: Order 2 offered to Rider Two without duplicate offer to Rider One");

    // Driver 1 accepts Order 1 -> starts 5-minute same-route batching window
    console.log("\n--- TEST 5 & 6: 5-minute same-route batching window ---");
    const acceptRes1 = await acceptDriverOffer(incomingOrder._id, driver1._id);
    console.log("Accept Order 1 result:", acceptRes1.success, "windowEndsAt:", acceptRes1.order?.routeBatchWindowEndsAt);
    if (!acceptRes1.success || !acceptRes1.order?.routeBatchWindowEndsAt) {
      throw new Error("FAIL: 5-minute same-route batch window was not opened on accept");
    }
    if (acceptRes1.order?.pickupQrUnlocked !== false) {
      throw new Error("FAIL: Pickup QR should be locked (false) during 5-minute same-route wait");
    }
    console.log("✓ PASS: 5-minute same-route window opened, pickup QR locked");

    // Pack a companion order (Order 3) on the same route during the 5-minute window
    const order3SameRoute = await StoreOrder.create({
      orderNumber: `ORD-TEST-3-BATCH-${Date.now()}`,
      managerId: store._id,
      darkStoreId: store._id,
      customerName: "Pooja Patil",
      customerPhone: "9876543213",
      customerAddress: "Baner Road 2nd Lane, Pune",
      customerLat: 18.5602, // very close to Order 1 (18.5600)
      customerLng: 73.7871,
      status: "order_received",
      assignmentStatus: "NONE",
      items: [{ sku: "SKU-MILK", name: "Milk", quantity: 2, price: 60, department: "instant" }],
    });
    cleanupIds.orders.push(order3SameRoute._id);

    // Simulate manager packing Order 3
    order3SameRoute.stockDeductedAt = new Date();
    order3SameRoute.status = "packed";
    order3SameRoute.packedAt = new Date();
    await order3SameRoute.save();

    const attachResult = await tryAutoAttachOnPack(order3SameRoute, store);
    console.log("Attach result for same-route companion:", attachResult);
    if (!attachResult.autoAttached) {
      throw new Error("FAIL: Order 3 should have auto-attached to Rider One during 5-minute window");
    }
    console.log("✓ PASS: Same-route companion successfully auto-attached to Rider One in 5-minute window!");

    const freshPrimary = await StoreOrder.findById(incomingOrder._id);
    const freshCompanion = await StoreOrder.findById(order3SameRoute._id);
    if (freshPrimary.pickupQrUnlocked !== true || freshCompanion.pickupQrUnlocked !== true) {
      throw new Error("FAIL: Pickup QR should be unlocked for both orders after batching!");
    }
    if (String(freshPrimary.assignedRiderId) !== String(driver1._id) || String(freshCompanion.assignedRiderId) !== String(driver1._id)) {
      throw new Error("FAIL: Both orders must be assigned to Rider One!");
    }
    if (!freshPrimary.batchId || freshPrimary.batchId !== freshCompanion.batchId) {
      throw new Error("FAIL: Both orders must share the same batchId!");
    }
    console.log("✓ PASS: Both orders batched to Rider One with shared batchId and unlocked QR codes");

    console.log("\n========================================================");
    console.log("ALL RESTORATION ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY!");
    console.log("========================================================");
  } finally {
    // Clean up test data
    console.log("\nCleaning up test records...");
    if (cleanupIds.orders.length) await StoreOrder.deleteMany({ _id: { $in: cleanupIds.orders } });
    if (cleanupIds.drivers.length) await DeliveryBoy.deleteMany({ _id: { $in: cleanupIds.drivers } });
    if (cleanupIds.managers.length) await DeliveryManager.deleteMany({ _id: { $in: cleanupIds.managers } });
    await mongoose.disconnect();
    console.log("Cleanup complete and disconnected from DB.");
  }
}

runTests().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});

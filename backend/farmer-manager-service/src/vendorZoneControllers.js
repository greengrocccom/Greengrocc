import crypto from "crypto";
import DeliveryManager from "../../delivery-service/src/models/DeliveryManager.js";
import { DarkStoreRequest, Vendor, VendorZone } from "./models.js";
import { serializeDarkStoreRequest } from "./darkStoreRequestControllers.js";

const vendorIdOf = (req) => String(req.user?.vendorId || req.user?.id || "");
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function serializeZone(doc) {
  const { _id, __v, ...rest } = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return rest;
}

function parseCities(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(list.map((c) => String(c || "").trim()).filter(Boolean))].slice(0, 50);
}

// ── Vendor ──────────────────────────────────────────────────────────────────

/** GET /api/vendor/zones — approved zones with their dark stores, plus every zone request. */
export async function listVendorZones(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const [zones, stores, storeRequests] = await Promise.all([
      VendorZone.find({ vendorId }).sort({ createdAt: -1 }).lean(),
      DeliveryManager.find({ vendorId }).sort({ storeName: 1 }),
      DarkStoreRequest.find({ vendorId, status: "Pending" }).sort({ createdAt: -1 }).lean(),
    ]);
    const storesByZone = new Map();
    for (const store of stores) {
      const key = store.zoneId || "";
      if (!storesByZone.has(key)) storesByZone.set(key, []);
      storesByZone.get(key).push(store.toSafeJSON());
    }
    const pendingByZone = new Map();
    for (const request of storeRequests) {
      const key = request.zoneId || "";
      if (!pendingByZone.has(key)) pendingByZone.set(key, []);
      pendingByZone.get(key).push(serializeDarkStoreRequest(request));
    }

    res.json({
      zones: zones
        .filter((z) => z.status === "Approved")
        .map((z) => ({
          ...serializeZone(z),
          darkStores: storesByZone.get(z.id) || [],
          pendingStoreRequests: pendingByZone.get(z.id) || [],
        })),
      requests: zones.map(serializeZone),
      unzonedDarkStores: storesByZone.get("") || [],
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load zones" });
  }
}

/** POST /api/vendor/zones  body { name, state, cities, description } — goes to admin for approval. */
export async function createVendorZone(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const name = String(req.body?.name || "").trim().slice(0, 80);
    const state = String(req.body?.state || "").trim().slice(0, 80);
    const cities = parseCities(req.body?.cities);
    if (!name) return res.status(400).json({ message: "Zone name is required" });
    if (!state) return res.status(400).json({ message: "State is required" });

    const duplicate = await VendorZone.exists({
      vendorId,
      name: new RegExp(`^${escapeRegex(name)}$`, "i"),
      status: { $in: ["Pending", "Approved"] },
    });
    if (duplicate) return res.status(409).json({ message: `You already have a zone named "${name}"` });

    const zone = await VendorZone.create({
      id: `zone-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      vendorId,
      name,
      state,
      cities,
      description: String(req.body?.description || "").trim().slice(0, 500),
      status: "Pending",
    });
    res.status(201).json(serializeZone(zone));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to send zone request" });
  }
}

/** POST /api/vendor/zones/:zoneId/cancel */
export async function cancelVendorZone(req, res) {
  try {
    const zone = await VendorZone.findOne({ id: req.params.zoneId, vendorId: vendorIdOf(req) });
    if (!zone) return res.status(404).json({ message: "Zone not found" });
    if (zone.status !== "Pending") return res.status(400).json({ message: `This zone is already ${zone.status.toLowerCase()}` });
    zone.status = "Cancelled";
    await zone.save();
    res.json(serializeZone(zone));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to cancel zone request" });
  }
}

// ── Admin ───────────────────────────────────────────────────────────────────

/** GET /api/admin-ops/zone-requests?status= */
export async function listZonesAdmin(req, res) {
  try {
    const filter = req.query.status && req.query.status !== "all" ? { status: String(req.query.status) } : {};
    const [zones, vendors, storeCounts, requestCounts, pending] = await Promise.all([
      VendorZone.find(filter).sort({ createdAt: -1 }).lean(),
      Vendor.find().select("id vendorName businessName ownerName mobile").lean(),
      DeliveryManager.aggregate([{ $match: { zoneId: { $ne: "" } } }, { $group: { _id: "$zoneId", n: { $sum: 1 } } }]),
      DarkStoreRequest.aggregate([
        { $match: { zoneId: { $ne: "" }, status: "Pending" } },
        { $group: { _id: "$zoneId", n: { $sum: 1 } } },
      ]),
      VendorZone.countDocuments({ status: "Pending" }),
    ]);
    const vendorById = new Map(vendors.map((v) => [v.id, v]));
    const stores = new Map(storeCounts.map((c) => [c._id, c.n]));
    const requests = new Map(requestCounts.map((c) => [c._id, c.n]));
    res.json({
      success: true,
      stats: { pending },
      data: zones.map((z) => {
        const vendor = vendorById.get(z.vendorId);
        return {
          ...serializeZone(z),
          vendorName: vendor ? vendor.vendorName || vendor.businessName || vendor.ownerName : "",
          vendorMobile: vendor?.mobile || "",
          darkStoreCount: stores.get(z.id) || 0,
          pendingStoreRequests: requests.get(z.id) || 0,
        };
      }),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to load zones" });
  }
}

/** POST /api/admin-ops/zone-requests/:zoneId/approve */
export async function approveZoneAdmin(req, res) {
  try {
    const zone = await VendorZone.findOneAndUpdate(
      { id: req.params.zoneId, status: "Pending" },
      { $set: { status: "Approved", reviewedAt: new Date(), adminRemarks: String(req.body?.remarks || "").trim().slice(0, 500) } },
      { returnDocument: 'after' }
    );
    if (!zone) return res.status(404).json({ success: false, message: "Pending zone not found" });
    res.json({ success: true, message: `Zone "${zone.name}" approved`, data: serializeZone(zone) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to approve zone" });
  }
}

/** POST /api/admin-ops/zone-requests/:zoneId/reject  body { remarks } */
export async function rejectZoneAdmin(req, res) {
  try {
    const remarks = String(req.body?.remarks || "").trim().slice(0, 500);
    if (!remarks) return res.status(400).json({ success: false, message: "Please give a reason for rejecting" });
    const zone = await VendorZone.findOneAndUpdate(
      { id: req.params.zoneId, status: "Pending" },
      { $set: { status: "Rejected", reviewedAt: new Date(), adminRemarks: remarks } },
      { returnDocument: 'after' }
    );
    if (!zone) return res.status(404).json({ success: false, message: "Pending zone not found" });
    res.json({ success: true, message: `Zone "${zone.name}" rejected`, data: serializeZone(zone) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to reject zone" });
  }
}

import crypto from "crypto";
import { FarmerManager, ManagerCrop, ManagerCropRequest, VendorCrop } from "./models.js";
import { catalogCropSummary, vendorCropsWithCatalog } from "./vendorCropRequestControllers.js";

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function managerIdOf(req) {
  return req.user?.managerId || req.user?.id || "";
}

function vendorIdOf(req) {
  return req.user?.vendorId || req.user?.id || "";
}

function cropKeyOf(crop) {
  return `${String(crop.cropName || "").trim().toLowerCase()}:::${String(crop.variety || "").trim().toLowerCase()}`;
}

function serializeDoc(doc) {
  const { _id, __v, ...rest } = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return rest;
}

function sameCropFilter(owner, crop) {
  return {
    ...owner,
    cropName: new RegExp(`^${escapeRegex(String(crop.cropName || "").trim())}$`, "i"),
    variety: new RegExp(`^${escapeRegex(String(crop.variety || "").trim())}$`, "i"),
  };
}

export function isCropInManagerCatalog(catalog, cropName, variety) {
  const name = String(cropName || "").trim().toLowerCase();
  const v = String(variety || "").trim().toLowerCase();
  return catalog.some(
    (c) =>
      String(c.cropName || "").trim().toLowerCase() === name &&
      (!String(c.variety || "").trim() || String(c.variety || "").trim().toLowerCase() === v)
  );
}

export async function managerApprovedCrops(managerId) {
  if (!managerId) return [];
  return ManagerCrop.find({ managerId }).sort({ cropName: 1, variety: 1 }).lean();
}

export async function listManagerVendorCatalogCrops(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const managerId = managerIdOf(req);
    if (!vendorId) return res.status(400).json({ message: "Your account is not linked to a collection centre." });
    const q = String(req.query.q || "").trim().toLowerCase();
    const category = String(req.query.category || "").trim();
    const [vendorCrops, added, pending] = await Promise.all([
      vendorCropsWithCatalog(vendorId),
      ManagerCrop.find({ managerId }).select("cropId cropName variety").lean(),
      ManagerCropRequest.find({ managerId, status: "Pending" }).select("cropId cropName variety").lean(),
    ]);
    const addedKeys = new Set(added.map(cropKeyOf));
    const pendingKeys = new Set(pending.map(cropKeyOf));
    const categories = [...new Set(vendorCrops.map((c) => c.category).filter(Boolean))].sort();
    const crops = vendorCrops
      .filter((c) => !c.catalogMissing)
      .filter((c) => !category || String(c.category || "") === category)
      .filter((c) => {
        if (!q) return true;
        return [c.cropName, c.variety, c.category, c.cropId, c.cropCode]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      })
      .map((c) => ({
        ...catalogCropSummary(c),
        added: addedKeys.has(cropKeyOf(c)),
        requested: pendingKeys.has(cropKeyOf(c)),
      }));
    res.json({ total: crops.length, categories, crops });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load collection centre crops" });
  }
}

export async function listManagerMyCrops(req, res) {
  try {
    const managerId = managerIdOf(req);
    const [crops, requests] = await Promise.all([
      ManagerCrop.find({ managerId }).sort({ createdAt: -1 }).lean(),
      ManagerCropRequest.find({ managerId }).sort({ createdAt: -1 }).lean(),
    ]);
    res.json({
      crops: crops.map(serializeDoc),
      requests: requests.map(serializeDoc),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load My Crops" });
  }
}

export async function createManagerCropRequest(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const managerId = managerIdOf(req);
    if (!vendorId) return res.status(400).json({ message: "Your account is not linked to a collection centre." });
    const cropId = String(req.body?.cropId || "").trim();
    if (!cropId) return res.status(400).json({ message: "Select a crop from All Crops" });

    const vendorCrop =
      (await VendorCrop.findOne({ vendorId, cropId }).lean()) ||
      (await VendorCrop.findOne({
        vendorId,
        cropId: new RegExp(`^${escapeRegex(cropId)}$`, "i"),
      }).lean());
    if (!vendorCrop) {
      return res.status(404).json({ message: "This crop is not in your collection centre crop list" });
    }

    const owner = { managerId };
    const same = sameCropFilter(owner, vendorCrop);
    const [alreadyAdded, pending] = await Promise.all([
      ManagerCrop.exists(same),
      ManagerCropRequest.exists({ ...same, status: "Pending" }),
    ]);
    if (alreadyAdded) return res.status(409).json({ message: "This crop is already in My Crops" });
    if (pending) return res.status(409).json({ message: "A request for this crop is already waiting for approval" });

    const manager = await FarmerManager.findOne({ id: managerId }).select("name").lean();
    const request = await ManagerCropRequest.create({
      id: `mcr-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      vendorId,
      managerId,
      managerName: manager?.name || req.user?.name || "",
      ...catalogCropSummary(vendorCrop),
      notes: String(req.body?.notes || "").trim().slice(0, 500),
      status: "Pending",
    });
    res.status(201).json(serializeDoc(request));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to send crop request" });
  }
}

export async function cancelManagerCropRequest(req, res) {
  try {
    const request = await ManagerCropRequest.findOne({
      id: req.params.requestId,
      managerId: managerIdOf(req),
    });
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (request.status !== "Pending") {
      return res.status(400).json({ message: `This request is already ${request.status.toLowerCase()}` });
    }
    request.status = "Cancelled";
    await request.save();
    res.json(serializeDoc(request));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to cancel request" });
  }
}

export async function listVendorManagerCropRequests(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const status = String(req.query.status || "Pending").trim();
    const filter = { vendorId };
    if (status && status !== "all") filter.status = status;
    const [requests, pending, approved, rejected] = await Promise.all([
      ManagerCropRequest.find(filter).sort({ createdAt: -1 }).lean(),
      ManagerCropRequest.countDocuments({ vendorId, status: "Pending" }),
      ManagerCropRequest.countDocuments({ vendorId, status: "Approved" }),
      ManagerCropRequest.countDocuments({ vendorId, status: "Rejected" }),
    ]);
    const managerIds = [...new Set(requests.map((r) => r.managerId).filter(Boolean))];
    const managers = managerIds.length
      ? await FarmerManager.find({ id: { $in: managerIds } }).select("id name mobile managerCode").lean()
      : [];
    const byId = new Map(managers.map((m) => [m.id, m]));
    res.json({
      stats: { pending, approved, rejected },
      requests: requests.map((row) => {
        const manager = byId.get(row.managerId) || {};
        return {
          ...serializeDoc(row),
          managerName: row.managerName || manager.name || "Farmer Manager",
          managerMobile: manager.mobile || "",
          managerCode: manager.managerCode || row.managerId,
        };
      }),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load manager crop requests" });
  }
}

export async function reviewManagerCropRequest(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const request = await ManagerCropRequest.findOne({ id: req.params.requestId, vendorId });
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (request.status !== "Pending") {
      return res.status(400).json({ message: `This request is already ${request.status.toLowerCase()}` });
    }
    const decision = String(req.body?.decision || "").trim().toLowerCase();
    const remarks = String(req.body?.remarks || req.body?.reason || "").trim().slice(0, 500);
    if (decision !== "approve" && decision !== "reject") {
      return res.status(400).json({ message: "Decision must be approve or reject" });
    }

    request.reviewedBy = req.user?.id || vendorId;
    request.reviewedAt = new Date();
    request.vendorRemarks = remarks;

    if (decision === "reject") {
      request.status = "Rejected";
      await request.save();
      return res.json(serializeDoc(request));
    }

    request.status = "Approved";
    await request.save();
    const snapshot = catalogCropSummary(request);
    await ManagerCrop.findOneAndUpdate(
      { managerId: request.managerId, cropId: request.cropId },
      {
        $setOnInsert: {
          id: `mcrop-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
          vendorId: request.vendorId,
          managerId: request.managerId,
        },
        $set: {
          ...snapshot,
          requestId: request.id,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );
    res.json({
      ...serializeDoc(request),
      message: "Crop added to the farmer manager's My Crops",
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to review request" });
  }
}

import crypto from "crypto";
import bcrypt from "bcrypt";
import DeliveryManager from "../../delivery-service/src/models/DeliveryManager.js";
import DeliveryBoy from "../../delivery-service/src/models/DeliveryBoy.js";
import { DarkStoreRequest, VendorZone, Vendor } from "./models.js";
import { checkPhoneConflict } from "../../shared/utils/phoneCheck.js";

function vendorIdOf(req) {
  return req.user?.vendorId || req.user?.id || "";
}

export function serializeDarkStoreRequest(doc) {
  const { passwordHash: _hash, _id, __v, ...rest } = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return rest;
}

function toCoord(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function listVendorDarkStoreRequests(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const [requests, stores] = await Promise.all([
      DarkStoreRequest.find({ vendorId }).sort({ createdAt: -1 }).lean(),
      DeliveryManager.find({ vendorId }).sort({ storeName: 1 }),
    ]);
    res.json({
      requests: requests.map(serializeDarkStoreRequest),
      darkStores: stores.map((store) => store.toSafeJSON()),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load dark stores" });
  }
}

export async function createVendorDarkStoreRequest(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    if (!(await Vendor.exists({ id: vendorId, status: "Active" }))) {
      return res.status(403).json({ message: "Admin must create and activate your multivendor before you can request a dark store." });
    }
    const body = req.body || {};
    const storeName = String(body.storeName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").replace(/\D/g, "").slice(-10);
    const password = String(body.password || "");
    const zoneId = String(body.zoneId || "").trim();
    const zone = zoneId ? await VendorZone.findOne({ id: zoneId, vendorId, status: "Approved" }).lean() : null;
    if (!zone) {
      return res.status(400).json({ message: "Select one of your approved zones. Create a zone first if you have none." });
    }
    const state = String(body.state || "").trim() || zone.state;
    const city = String(body.city || "").trim();
    const area = String(body.area || "").trim();

    if (!storeName) return res.status(400).json({ message: "Dark store name is required" });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: "Enter a valid manager email" });
    if (!/^[6-9]\d{9}$/.test(phone)) return res.status(400).json({ message: "Enter a valid 10-digit mobile number" });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
    if (!state || !city || !area) return res.status(400).json({ message: "State, city and area are required" });

    const latitude = toCoord(body.latitude);
    const longitude = toCoord(body.longitude);
    if ((latitude === null) !== (longitude === null)) {
      return res.status(400).json({ message: "Enter both latitude and longitude, or leave both empty" });
    }

    const [takenEmail, pendingEmail, phoneConflict] = await Promise.all([
      DeliveryManager.exists({ email }),
      DarkStoreRequest.exists({ status: "Pending", email }),
      checkPhoneConflict(phone),
    ]);
    if (takenEmail) return res.status(409).json({ message: "A dark store with this email already exists" });
    if (pendingEmail) {
      return res.status(409).json({ message: "A pending request with this email is already waiting for approval" });
    }
    if (phoneConflict.inUse) {
      return res.status(409).json({ message: phoneConflict.message });
    }

    const request = await DarkStoreRequest.create({
      id: `dsr-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      vendorId,
      storeName,
      managerName: String(body.managerName || "").trim(),
      email,
      phone,
      passwordHash: await bcrypt.hash(password, 10),
      state,
      city,
      area,
      storeAddress: String(body.storeAddress || "").trim(),
      pincode: String(body.pincode || "").trim(),
      latitude,
      longitude,
      notes: String(body.notes || "").trim(),
      zoneId: zone.id,
      zoneName: zone.name,
      status: "Pending",
    });
    res.status(201).json(serializeDarkStoreRequest(request));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to send dark store request" });
  }
}

export async function cancelVendorDarkStoreRequest(req, res) {
  try {
    const request = await DarkStoreRequest.findOne({ id: req.params.requestId, vendorId: vendorIdOf(req) });
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (request.status !== "Pending") return res.status(400).json({ message: `This request is already ${request.status.toLowerCase()}` });
    request.status = "Cancelled";
    await request.save();
    res.json(serializeDarkStoreRequest(request));
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to cancel request" });
  }
}

export async function listVendorDeliveryBoys(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const stores = await DeliveryManager.find({ vendorId }).lean();
    const storeIds = stores.map((s) => s._id.toString());
    const managerIds = stores.map((s) => s._id);

    const riders = await DeliveryBoy.find({
      $or: [
        { vendorId },
        { storeId: { $in: storeIds } },
        { managerId: { $in: managerIds } },
      ],
    }).sort({ createdAt: -1 });

    const storeMap = new Map(stores.map((s) => [s._id.toString(), s]));

    res.json({
      success: true,
      data: riders.map((r) => {
        const plain = typeof r.toSafeJSON === "function" ? r.toSafeJSON() : r;
        const sId = String(plain.storeId || plain.managerId || "");
        const store = storeMap.get(sId);
        return {
          ...plain,
          storeName: store?.storeName || store?.name || "Dark Store",
          storeAddress: store?.storeAddress || store?.area || "",
        };
      }),
      stores: stores.map((s) => ({
        id: s._id.toString(),
        storeName: s.storeName,
        city: s.city,
        area: s.area,
        address: s.storeAddress,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load delivery boys" });
  }
}

export async function createVendorDeliveryBoy(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const body = req.body || {};
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").replace(/\D/g, "").slice(-10);
    const password = String(body.password || "");
    const vehicleType = String(body.vehicleType || "motorcycle").trim();
    const storeId = String(body.storeId || "").trim();

    if (!name) return res.status(400).json({ message: "Delivery boy name is required" });
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ message: "Enter a valid 10-digit mobile number" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    let store = null;
    if (storeId) {
      store = await DeliveryManager.findOne({ _id: storeId, vendorId });
    } else {
      const stores = await DeliveryManager.find({ vendorId });
      if (stores.length === 1) store = stores[0];
      else if (stores.length === 0) {
        return res.status(400).json({
          message: "No approved dark store found. Admin must approve a dark store for your vendor account before you can create delivery boys.",
        });
      } else {
        return res.status(400).json({ message: "Please select an approved dark store for this delivery boy" });
      }
    }

    if (!store) {
      return res.status(404).json({ message: "Selected dark store not found or does not belong to your vendor account" });
    }

    const phoneConflict = await checkPhoneConflict(phone);
    if (phoneConflict.inUse) {
      return res.status(409).json({ message: phoneConflict.message });
    }

    const rider = await DeliveryBoy.create({
      phone,
      password,
      name,
      vehicleType,
      city: store.city || "",
      cityId: store.cityId || "",
      area: store.area || "",
      storeId: store._id.toString(),
      managerId: store._id,
      vendorId,
      verificationStatus: "verified",
      status: "offline",
    });

    res.status(201).json({
      success: true,
      message: "Delivery boy login created successfully",
      data: rider.toSafeJSON(),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to create delivery boy" });
  }
}

export async function deleteVendorDeliveryBoy(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const { boyId } = req.params;

    const rider = await DeliveryBoy.findById(boyId);
    if (!rider) return res.status(404).json({ message: "Delivery boy not found" });

    const ownsStore = await DeliveryManager.exists({ _id: rider.managerId || rider.storeId, vendorId });
    if (rider.vendorId !== vendorId && !ownsStore) {
      return res.status(403).json({ message: "Not authorized to manage this delivery boy" });
    }

    await DeliveryBoy.findByIdAndDelete(boyId);
    res.json({ success: true, message: "Delivery boy removed successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to delete delivery boy" });
  }
}

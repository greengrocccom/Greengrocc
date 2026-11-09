import crypto from "crypto";
import mongoose from "mongoose";
import Product from "../../legacy/models/Product.js";
import Category from "../../product-service/src/models/Category.js";
import Section from "../../product-service/src/models/Section.js";
import { createProductRecord, updateProductRecord } from "../../legacy/controllers/productController.js";
import { createCategory, updateCategory } from "../../product-service/src/controllers/categoryController.js";
import { VendorCatalogRequest, VendorProduct } from "./models.js";
import { syncVendorProductToStores } from "../../delivery-service/src/services/catalogStoreInventory.js";
import { removeCatalogProduct } from "../../legacy/services/productRemoval.js";

const KINDS = ["product", "category"];
const ACTIONS = ["create", "update", "delete"];
const PROTECTED_KEYS = ["_id", "__v", "id", "ownerVendorId", "ownerManagerId", "createdAt", "updatedAt"];

const vendorIdOf = (req) => String(req.user?.vendorId || req.user?.id || "");
const vendorNameOf = (req) => req.user?.vendorName || req.user?.name || "Vendor";
const nameKey = (value) => String(value || "").trim().toLowerCase();
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function cleanPayload(payload) {
  const out = payload && typeof payload === "object" && !Array.isArray(payload) ? { ...payload } : {};
  for (const key of PROTECTED_KEYS) delete out[key];
  return out;
}

function serializeRequest(doc) {
  const { _id, __v, ...rest } = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return rest;
}

/** Calls an Express-style (req, res) handler and resolves with { status, body }. */
function runHandler(handler, req) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        resolve({ status: this.statusCode, body });
        return this;
      },
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

function requestSummary(kind, payload, current) {
  if (kind === "product") {
    return {
      targetName: String(payload.name || current?.name || "").trim(),
      section: String(payload.section || payload.department || current?.section || "").trim().toLowerCase(),
      image: (Array.isArray(payload.productImages) && payload.productImages[0]) || current?.productImages?.[0] || "",
    };
  }
  return {
    targetName: String(payload.categoryName || current?.categoryName || "").trim(),
    section: String(payload.section || current?.section || "").trim().toLowerCase(),
    image: String(payload.categoryImage || current?.categoryImage || "").trim(),
  };
}

async function sectionExists(slug) {
  const key = nameKey(slug);
  if (!key) return true;
  const sections = await Section.find({}).select("slug sectionName").lean();
  if (!sections.length) return true;
  return sections.some((s) => nameKey(s.slug) === key || nameKey(s.sectionName) === key);
}

// ── Vendor ──────────────────────────────────────────────────────────────────

/** GET /api/vendor/catalog/products — products this vendor created (after admin approval). */
export async function listVendorCatalogProducts(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const [products, pending] = await Promise.all([
      Product.find({ ownerVendorId: vendorId }).sort({ createdAt: -1 }),
      VendorCatalogRequest.find({ vendorId, kind: "product", status: "Pending" }).select("id action targetId").lean(),
    ]);
    const pendingByTarget = new Map(pending.filter((r) => r.targetId).map((r) => [r.targetId, r]));
    const data = products.map((p) => {
      const json = p.toObject();
      const req = pendingByTarget.get(String(p._id));
      return { ...json, pendingRequest: req ? { id: req.id, action: req.action } : null };
    });
    res.json({ success: true, data, total: data.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to load products" });
  }
}

/** GET /api/vendor/catalog/categories — every category, flagged with whether this vendor owns it. */
export async function listVendorCatalogCategories(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const categories = await Category.find({}).sort({ order: 1, categoryName: 1 }).lean();
    res.json({
      success: true,
      data: categories.map((c) => ({ ...c, ownedByMe: Boolean(c.ownerVendorId) && c.ownerVendorId === vendorId })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to load categories" });
  }
}

/** GET /api/vendor/catalog/requests?status= */
export async function listVendorCatalogRequests(req, res) {
  try {
    const filter = { vendorId: vendorIdOf(req) };
    if (req.query.status) filter.status = String(req.query.status);
    const requests = await VendorCatalogRequest.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    res.json({ success: true, data: requests.map(serializeRequest) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to load requests" });
  }
}

/**
 * POST /api/vendor/catalog/requests  body { kind, action, targetId?, payload }
 * A further edit to something that already has a pending update is merged into that request.
 */
export async function createVendorCatalogRequest(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const kind = String(req.body?.kind || "").trim();
    const action = String(req.body?.action || "").trim();
    const targetId = String(req.body?.targetId || "").trim();
    const payload = cleanPayload(req.body?.payload);
    if (!KINDS.includes(kind) || !ACTIONS.includes(action)) {
      return res.status(400).json({ success: false, message: "Unknown catalog request" });
    }

    let current = null;
    if (action !== "create") {
      if (!mongoose.Types.ObjectId.isValid(targetId)) {
        return res.status(400).json({ success: false, message: "Invalid id" });
      }
      current = kind === "product" ? await Product.findById(targetId).lean() : await Category.findById(targetId).lean();
      if (!current) {
        return res.status(404).json({ success: false, message: `${kind === "product" ? "Product" : "Category"} not found` });
      }
      const owned = current.ownerVendorId && current.ownerVendorId === vendorId;
      // Vendors may propose edits to shared categories (e.g. a new subcategory), but only touch their own products.
      if (!owned && (kind === "product" || action === "delete")) {
        return res.status(403).json({ success: false, message: `You can only change your own ${kind === "product" ? "products" : "categories"}` });
      }
    }

    if (action !== "delete") {
      const section = kind === "product" ? payload.section || payload.department : payload.section;
      if (section !== undefined && !(await sectionExists(section))) {
        return res.status(400).json({ success: false, message: "Choose one of the existing sections" });
      }
    }

    if (action === "create") {
      if (kind === "product" && !String(payload.name || "").trim()) {
        return res.status(400).json({ success: false, message: "Product name is required" });
      }
      if (kind === "category") {
        const name = String(payload.categoryName || "").trim();
        if (!name) return res.status(400).json({ success: false, message: "Category name is required" });
        const [exists, pendingSame] = await Promise.all([
          Category.exists({ categoryName: new RegExp(`^${escapeRegex(name)}$`, "i") }),
          VendorCatalogRequest.exists({
            kind: "category",
            action: "create",
            status: "Pending",
            targetName: new RegExp(`^${escapeRegex(name)}$`, "i"),
          }),
        ]);
        if (exists) return res.status(409).json({ success: false, message: `Category "${name}" already exists` });
        if (pendingSame) {
          return res.status(409).json({ success: false, message: `A request for category "${name}" is already waiting for approval` });
        }
      }
    } else {
      const pending = await VendorCatalogRequest.findOne({ vendorId, kind, targetId, status: "Pending" });
      if (pending) {
        if (action === "update" && pending.action === "update") {
          pending.payload = { ...(pending.payload || {}), ...payload };
          Object.assign(pending, requestSummary(kind, pending.payload, current));
          pending.markModified("payload");
          await pending.save();
          return res.json({
            success: true,
            message: "Your changes were added to the request already waiting for admin approval",
            request: serializeRequest(pending),
          });
        }
        return res.status(409).json({
          success: false,
          message: `A ${pending.action} request for this ${kind} is already waiting for admin approval`,
        });
      }
    }

    const request = await VendorCatalogRequest.create({
      id: `vcr-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      vendorId,
      vendorName: vendorNameOf(req),
      kind,
      action,
      targetId: action === "create" ? "" : targetId,
      payload: action === "delete" ? {} : payload,
      ...requestSummary(kind, payload, current),
    });

    res.status(201).json({
      success: true,
      message: `Sent to admin for approval — the ${kind} will change once approved`,
      request: serializeRequest(request),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to send request" });
  }
}

/** POST /api/vendor/catalog/requests/:requestId/cancel */
export async function cancelVendorCatalogRequest(req, res) {
  try {
    const request = await VendorCatalogRequest.findOne({ id: req.params.requestId, vendorId: vendorIdOf(req) });
    if (!request) return res.status(404).json({ success: false, message: "Request not found" });
    if (request.status !== "Pending") {
      return res.status(400).json({ success: false, message: `This request is already ${request.status.toLowerCase()}` });
    }
    request.status = "Cancelled";
    await request.save();
    res.json({ success: true, request: serializeRequest(request) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to cancel request" });
  }
}

// ── Admin ───────────────────────────────────────────────────────────────────

/** GET /api/admin-ops/vendor-catalog-requests?status=&kind=&vendorId= */
export async function listAdminVendorCatalogRequests(req, res) {
  try {
    const filter = {};
    for (const key of ["status", "kind", "vendorId"]) {
      if (req.query[key] && req.query[key] !== "all") filter[key] = String(req.query[key]);
    }
    const requests = await VendorCatalogRequest.find(filter).sort({ createdAt: -1 }).limit(500).lean();

    const productIds = requests.filter((r) => r.kind === "product" && mongoose.Types.ObjectId.isValid(r.targetId)).map((r) => r.targetId);
    const categoryIds = requests.filter((r) => r.kind === "category" && mongoose.Types.ObjectId.isValid(r.targetId)).map((r) => r.targetId);
    const [products, categories] = await Promise.all([
      productIds.length ? Product.find({ _id: { $in: productIds } }).lean() : [],
      categoryIds.length ? Category.find({ _id: { $in: categoryIds } }).lean() : [],
    ]);
    const currentById = new Map([...products, ...categories].map((d) => [String(d._id), d]));

    const counts = await VendorCatalogRequest.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]);
    res.json({
      success: true,
      counts: Object.fromEntries(counts.map((c) => [c._id, c.n])),
      data: requests.map((r) => ({
        ...serializeRequest(r),
        current: r.status === "Pending" ? currentById.get(r.targetId) || null : null,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to load vendor catalog requests" });
  }
}

async function linkVendorProduct(request, product) {
  await VendorProduct.updateOne(
    { vendorId: request.vendorId, productId: String(product._id) },
    {
      $set: {
        productName: product.name || "",
        productImage: product.productImages?.[0] || "",
        category: product.categories?.[0] || "",
        unit: product.unit || "",
        requestId: request.id,
      },
      $setOnInsert: {
        id: `vp-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
        addedBy: "catalog-request",
      },
    },
    { upsert: true }
  );
  await syncVendorProductToStores(request.vendorId, product._id);
}

async function applyRequest(request) {
  const payload = cleanPayload(request.payload);

  if (request.kind === "product") {
    if (request.action === "create") {
      const result = await createProductRecord(payload);
      if (result.status >= 400) return { error: result.body?.message || "Could not create the product", status: result.status };
      const product = result.product || result.body?.data;
      await Product.updateOne({ _id: product._id }, { $set: { ownerVendorId: request.vendorId } });
      await linkVendorProduct(request, product);
      return { targetId: String(product._id) };
    }

    const product = await Product.findById(request.targetId).select("ownerVendorId");
    if (!product || product.ownerVendorId !== request.vendorId) {
      return { error: "The product no longer exists or is not owned by this vendor", status: 404 };
    }
    if (request.action === "update") {
      const result = await updateProductRecord(request.targetId, payload);
      if (result.status >= 400) return { error: result.body?.message || "Could not update the product", status: result.status };
      const updated = await Product.findById(request.targetId).lean();
      if (updated) await linkVendorProduct(request, updated);
      return { targetId: request.targetId };
    }
    const removed = await removeCatalogProduct(request.targetId, { ownerVendorId: request.vendorId });
    if (removed.status >= 400) return { error: removed.body?.message || "Could not delete the product", status: removed.status };
    return { targetId: request.targetId };
  }

  if (request.action === "create") {
    const result = await runHandler(createCategory, { body: payload });
    if (result.status >= 400) return { error: result.body?.message || "Could not create the category", status: result.status };
    const category = result.body?.data;
    await Category.updateOne({ _id: category._id }, { $set: { ownerVendorId: request.vendorId } });
    return { targetId: String(category._id) };
  }
  if (request.action === "update") {
    const result = await runHandler(updateCategory, { body: payload, params: { id: request.targetId } });
    if (result.status >= 400) return { error: result.body?.message || "Could not update the category", status: result.status };
    return { targetId: request.targetId };
  }
  const category = await Category.findById(request.targetId).select("ownerVendorId");
  if (!category || category.ownerVendorId !== request.vendorId) {
    return { error: "The category no longer exists or is not owned by this vendor", status: 404 };
  }
  await Category.deleteOne({ _id: request.targetId });
  return { targetId: request.targetId };
}

/** POST /api/admin-ops/vendor-catalog-requests/:requestId/approve  body { remarks? } */
export async function approveVendorCatalogRequest(req, res) {
  try {
    const request = await VendorCatalogRequest.findOneAndUpdate(
      { id: req.params.requestId, status: "Pending" },
      { $set: { status: "Approved", reviewedAt: new Date(), adminRemarks: String(req.body?.remarks || "").trim().slice(0, 500) } },
      { returnDocument: 'after' }
    );
    if (!request) return res.status(404).json({ success: false, message: "Pending request not found" });

    let outcome;
    try {
      outcome = await applyRequest(request);
    } catch (err) {
      outcome = { error: err.message || "Could not apply the request", status: 500 };
    }
    if (outcome.error) {
      await VendorCatalogRequest.updateOne({ id: request.id }, { $set: { status: "Pending", reviewedAt: null } });
      return res.status(outcome.status || 400).json({ success: false, message: outcome.error });
    }

    request.targetId = outcome.targetId;
    await request.save();
    res.json({
      success: true,
      message: `Approved — ${request.kind} "${request.targetName || request.targetId}" ${request.action === "delete" ? "deleted" : request.action === "create" ? "created" : "updated"}`,
      request: serializeRequest(request),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to approve request" });
  }
}

/** POST /api/admin-ops/vendor-catalog-requests/:requestId/reject  body { remarks } */
export async function rejectVendorCatalogRequest(req, res) {
  try {
    const remarks = String(req.body?.remarks || "").trim().slice(0, 500);
    if (!remarks) return res.status(400).json({ success: false, message: "A reason is required to reject" });
    const request = await VendorCatalogRequest.findOneAndUpdate(
      { id: req.params.requestId, status: "Pending" },
      { $set: { status: "Rejected", reviewedAt: new Date(), adminRemarks: remarks } },
      { returnDocument: 'after' }
    );
    if (!request) return res.status(404).json({ success: false, message: "Pending request not found" });
    res.json({ success: true, message: "Request rejected", request: serializeRequest(request) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed to reject request" });
  }
}

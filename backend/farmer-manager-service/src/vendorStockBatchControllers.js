import crypto from "crypto";
import mongoose from "mongoose";
import Product from "../../legacy/models/Product.js";
import {
  Vendor,
  VendorProduct,
  VendorProductRequest,
  VendorStockBatch,
  VendorStockTransaction,
} from "./models.js";
import { vendorProductsWithCatalog } from "./vendorProductRequestControllers.js";
import { syncVendorProductToStores, toObjectId } from "../../delivery-service/src/services/catalogStoreInventory.js";

const validProductIds = (ids) => ids.filter((id) => toObjectId(id));

function vendorIdOf(req) {
  return req.user?.vendorId || req.user?.id || "";
}

/**
 * Computes live batch status according to stock quantity and expiry date.
 */
export function computeBatchStatus(batch) {
  const qty = Number(batch.availableQuantity ?? 0);
  if (qty <= 0) return "Depleted";
  if (batch.expiryDate && new Date(batch.expiryDate) < new Date()) {
    return "Expired";
  }
  if (qty <= 10) return "Low Stock";
  return "Active";
}

/**
 * Safe transaction runner: uses MongoDB session transaction if supported,
 * or gracefully runs operations sequentially on single-node setups.
 */
async function withSafeTransaction(workFn) {
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch (_) {
    session = null;
  }

  if (!session) {
    return await workFn(null);
  }

  try {
    const result = await workFn(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction().catch(() => {});
    }
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * Generates unique Batch ID in format: GG-BAT-YYYYMMDD-XXXX
 * where YYYYMMDD is based on Stock Received Date, and XXXX is the sequential count of batches (0001, 0002...).
 */
export async function generateUniqueBatchId(receivedDateInput = null, session = null) {
  let d = new Date();
  if (receivedDateInput) {
    const raw = String(receivedDateInput).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      const [y, m, day] = raw.slice(0, 10).split("-");
      d = new Date(Number(y), Number(m) - 1, Number(day));
    } else {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) d = parsed;
    }
  }

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const datePart = `${yyyy}${mm}${dd}`;

  const regex = new RegExp(`^GG-BAT-${datePart}-`);
  const count = await VendorStockBatch.countDocuments({ batchId: regex }).session(session);

  let seq = count + 1;
  let candidate = `GG-BAT-${datePart}-${String(seq).padStart(4, "0")}`;

  while (await VendorStockBatch.exists({ batchId: candidate }).session(session)) {
    seq += 1;
    candidate = `GG-BAT-${datePart}-${String(seq).padStart(4, "0")}`;
  }

  return candidate;
}

/**
 * Controller to fetch the next sequential Batch ID for a given Stock Received Date.
 */
export async function getNextBatchId(req, res) {
  try {
    const receivedDate = req.query.receivedDate || "";
    const nextBatchId = await generateUniqueBatchId(receivedDate);
    return res.json({ success: true, batchId: nextBatchId });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to generate next Batch ID" });
  }
}

/**
 * Generates unique Transaction ID in format: GG-TXN-YYYYMMDD-XXXX
 */
async function generateUniqueTransactionId(session = null) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const datePart = `${yyyy}${mm}${dd}`;

  for (let attempt = 0; attempt < 20; attempt++) {
    const suffix = crypto.randomBytes(2).toString("hex").toUpperCase();
    const candidate = `GG-TXN-${datePart}-${suffix}`;
    const exists = await VendorStockTransaction.exists({ transactionId: candidate }).session(session);
    if (!exists) return candidate;
  }
  const ts = Date.now().toString().slice(-4);
  return `GG-TXN-${datePart}-${ts}`;
}

/**
 * Recalculates total product stock for a seller vendor across all valid batches.
 * Valid batches: availableQuantity > 0, status !== 'Expired' && status !== 'Depleted',
 * and expiryDate is either null or in the future.
 */
export async function syncVendorProductTotalStock(vendorId, productId, session = null) {
  const now = new Date();
  const batches = await VendorStockBatch.find({ vendorId, productId }).session(session);

  let totalValidStock = 0;
  for (const b of batches) {
    const newStatus = computeBatchStatus(b);
    if (b.status !== newStatus) {
      b.status = newStatus;
      await b.save({ session });
    }
    // Only count non-expired, non-depleted stock
    if (newStatus !== "Expired" && newStatus !== "Depleted" && Number(b.availableQuantity) > 0) {
      totalValidStock += Number(b.availableQuantity);
    }
  }

  const roundedStock = Math.floor(totalValidStock);

  // Find latest purchase cost from batches if available
  const batchesWithCost = batches
    .filter((b) => Number(b.purchaseCost) > 0)
    .sort((a, b) => new Date(a.receivedDate || a.createdAt) - new Date(b.receivedDate || b.createdAt));
  const latestBatch = batchesWithCost[batchesWithCost.length - 1];

  const updateFields = {
    stock: roundedStock,
    customInStock: roundedStock > 0,
  };
  if (latestBatch && Number(latestBatch.purchaseCost) > 0) {
    updateFields.purchaseCost = Number(latestBatch.purchaseCost);
  }

  if (toObjectId(productId)) {
    await VendorProduct.updateOne(
      { vendorId, productId },
      { $set: updateFields },
      { session }
    );
  }

  return roundedStock;
}

/* =========================================================================
   1. ADD STOCK (CREATES NEW BATCH & IMMUTABLE TRANSACTION)
   ========================================================================= */
export async function addVendorStockBatch(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const vendor = await Vendor.findOne({ id: vendorId }).lean();
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    if (vendor.vendorType !== "seller") {
      return res.status(403).json({ message: "Batch stock management is only available for Seller Vendors" });
    }

    const {
      productId,
      quantity,
      unit = "Kg",
      receivedDate,
      mfgDate,
      expiryDate,
      packagingType = "Box",
      numberOfPackages = 1,
      packageSize = "",
      qualityGrade = "Grade A",
      stockSource = "Supplier",
      purchaseCost = 0,
      storageLocation = "Main Darkstore",
      remarks = "",
      section,
      price,
      discountedPrice,
    } = req.body || {};

    if (!productId) {
      return res.status(400).json({ message: "Product selection is required" });
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ message: "Stock quantity must be a positive number greater than 0" });
    }

    const catalogProd = toObjectId(productId)
      ? await Product.findOne({ _id: productId, ownerManagerId: null }).lean()
      : null;
    if (!catalogProd) {
      return res.status(404).json({ message: "Catalog product not found" });
    }
    if (catalogProd.ownerVendorId && catalogProd.ownerVendorId !== vendorId) {
      return res.status(403).json({ message: "This product belongs to another vendor" });
    }

    // Optional update for catalog section if missing
    if (section && (!catalogProd.section || catalogProd.section === "general")) {
      await Product.findByIdAndUpdate(catalogProd._id, { section }).catch(() => {});
    }

    const parsedMfgDate = mfgDate ? new Date(mfgDate) : null;
    const parsedExpiryDate = expiryDate ? new Date(expiryDate) : null;
    const parsedReceivedDate = receivedDate ? new Date(receivedDate) : new Date();

    if (parsedMfgDate && parsedExpiryDate && parsedExpiryDate <= parsedMfgDate) {
      return res.status(400).json({ message: "Expiry date must be after manufacturing / harvest date" });
    }

    const result = await withSafeTransaction(async (session) => {
      // 1. Ensure VendorProduct row exists
      let vendorProd = await VendorProduct.findOne({ vendorId, productId: String(catalogProd._id) }).session(session);
      const prevProductStock = Number(vendorProd?.stock ?? 0);

      if (vendorProd) {
        if (price !== undefined && price !== null && price !== "") vendorProd.price = Number(price);
        if (discountedPrice !== undefined && discountedPrice !== null && discountedPrice !== "") {
          vendorProd.discountedPrice = Number(discountedPrice);
        }
        if (unit) vendorProd.customUnit = unit;
        await vendorProd.save({ session });
      } else {
        vendorProd = await VendorProduct.create(
          [
            {
              id: `vp-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
              vendorId,
              productId: String(catalogProd._id),
              productName: catalogProd.name,
              productImage: catalogProd.productImages?.[0] || "",
              category: catalogProd.categories?.[0] || "",
              unit: unit || catalogProd.unit || "Piece",
              price: price !== undefined && price !== null && price !== "" ? Number(price) : (catalogProd.price ?? 0),
              discountedPrice:
                discountedPrice !== undefined && discountedPrice !== null && discountedPrice !== ""
                  ? Number(discountedPrice)
                  : (catalogProd.discountedPrice ?? catalogProd.price ?? 0),
              stock: 0,
              customInStock: true,
              addedBy: "seller-batch-add",
            },
          ],
          { session }
        );
        vendorProd = vendorProd[0];
      }

      // 1b. Check existing batches to ensure previous product stock is NEVER lost
      const existingBatches = await VendorStockBatch.find({ vendorId, productId: String(catalogProd._id) }).session(session);
      const existingBatchesSum = existingBatches.reduce((sum, b) => {
        if (b.status !== "Expired" && b.status !== "Depleted") {
          return sum + Math.max(0, Number(b.availableQuantity || 0));
        }
        return sum;
      }, 0);

      const unbatchedStock = Math.max(0, prevProductStock - existingBatchesSum);
      if (unbatchedStock > 0) {
        // Create an opening baseline batch for previous stock so new additions properly add (+) to it
        const openingBatchId = await generateUniqueBatchId(new Date(), session);
        await VendorStockBatch.create(
          [
            {
              batchId: openingBatchId,
              vendorId,
              productId: String(catalogProd._id),
              sku: catalogProd.sku || vendorProd.sku || "",
              productName: catalogProd.name,
              category: catalogProd.categories?.[0] || vendorProd.category || "General",
              unit: String(unit || catalogProd.unit || vendorProd.customUnit || "Kg").trim(),
              quantity: Math.floor(unbatchedStock),
              availableQuantity: Math.floor(unbatchedStock),
              receivedDate: new Date(),
              mfgDate: null,
              expiryDate: null,
              packagingType: "Opening Stock",
              numberOfPackages: 1,
              packageSize: "",
              qualityGrade: "Standard",
              stockSource: "Purchase",
              purchaseCost: 0,
              storageLocation: "Main Darkstore",
              remarks: "Opening baseline stock carried forward",
              status: "Active",
              createdBy: vendor.ownerName || vendor.name || "System",
            },
          ],
          { session }
        );
      }

      // 2. Generate or accept unique Batch ID with Stock Received Date & Batch Count
      let batchId = String(req.body.batchId || "").trim().toUpperCase();
      if (batchId && /^GG-BAT-\d{8}-[A-Z0-9]{4,}$/i.test(batchId)) {
        const exists = await VendorStockBatch.exists({ batchId }).session(session);
        if (exists) {
          batchId = await generateUniqueBatchId(parsedReceivedDate, session);
        }
      } else {
        batchId = await generateUniqueBatchId(parsedReceivedDate, session);
      }

      // 3. Compute initial status
      const initialStatus = computeBatchStatus({
        availableQuantity: qty,
        expiryDate: parsedExpiryDate,
      });

      // 4. Create Batch
      const newBatch = await VendorStockBatch.create(
        [
          {
            batchId,
            vendorId,
            productId: String(catalogProd._id),
            sku: catalogProd.sku || vendorProd.sku || "",
            productName: catalogProd.name,
            category: catalogProd.categories?.[0] || vendorProd.category || "General",
            unit: String(unit || catalogProd.unit || "Kg").trim(),
            quantity: Math.floor(qty),
            availableQuantity: Math.floor(qty),
            receivedDate: parsedReceivedDate,
            mfgDate: parsedMfgDate,
            expiryDate: parsedExpiryDate,
            packagingType: String(packagingType || "Box").trim(),
            numberOfPackages: Math.max(1, Number(numberOfPackages) || 1),
            packageSize: String(packageSize || "").trim(),
            qualityGrade: String(qualityGrade || "Grade A").trim(),
            stockSource: ["Farmer", "Vendor", "Supplier", "Purchase", "Return", "Other"].includes(stockSource)
              ? stockSource
              : "Supplier",
            purchaseCost: Math.max(0, Number(purchaseCost) || 0),
            totalPurchaseCost: Math.max(0, Number(req.body.totalPurchaseCost) || (Number(purchaseCost) * qty) || 0),
            storageLocation: String(storageLocation || "Main Darkstore").trim(),
            remarks: String(remarks || "").trim(),
            status: initialStatus,
            createdBy: vendor.ownerName || vendor.name || "Seller Vendor",
          },
        ],
        { session }
      );

      // 5. Sync total product stock
      const updatedTotalStock = await syncVendorProductTotalStock(vendorId, String(catalogProd._id), session);

      // 6. Generate Unique Transaction ID & Record Immutable ADD Transaction
      const transactionId = await generateUniqueTransactionId(session);
      const newTxn = await VendorStockTransaction.create(
        [
          {
            transactionId,
            vendorId,
            productId: String(catalogProd._id),
            sku: catalogProd.sku || "",
            productName: catalogProd.name,
            batchId,
            transactionType: "ADD",
            quantity: Math.floor(qty),
            unit: String(unit || "Kg").trim(),
            previousStock: prevProductStock,
            updatedStock: updatedTotalStock,
            batchPreviousStock: 0,
            batchUpdatedStock: Math.floor(qty),
            receivedDate: parsedReceivedDate,
            mfgDate: parsedMfgDate,
            expiryDate: parsedExpiryDate,
            packagingType: String(packagingType || "Box").trim(),
            storageLocation: String(storageLocation || "Main Darkstore").trim(),
            purchaseCost: Math.max(0, Number(purchaseCost) || 0),
            totalPurchaseCost: Math.max(0, Number(req.body.totalPurchaseCost) || (Number(purchaseCost) * qty) || 0),
            reason: "New Purchase / Stock Addition",
            remarks: remarks || `Batch ${batchId} created with ${Math.floor(qty)} ${unit}`,
            userId: req.user?.id || "",
            createdBy: vendor.ownerName || vendor.name || "Seller Vendor",
          },
        ],
        { session }
      );

      // 7. Auto-approve any pending request for this product
      await VendorProductRequest.updateMany(
        { vendorId, productId: String(catalogProd._id), status: "Pending" },
        { $set: { status: "Approved", reviewedAt: new Date(), notes: `Added via Stock Batch ${batchId}` } },
        { session }
      );
      await syncVendorProductToStores(vendorId, catalogProd._id, { session });

      return {
        batch: newBatch[0],
        transaction: newTxn[0],
        updatedTotalStock,
      };
    });

    // Fetch updated products list
    const products = await vendorProductsWithCatalog(vendorId);
    const item = products.find((p) => p.productId === String(catalogProd._id));

    return res.status(201).json({
      success: true,
      message: `Batch ${result.batch.batchId} created and stock added successfully!`,
      batch: result.batch,
      transaction: result.transaction,
      product: item,
      products,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to add stock batch" });
  }
}

/* =========================================================================
   2. DEDUCT STOCK (UPDATES BATCH & CREATES IMMUTABLE TRANSACTION)
   ========================================================================= */
const ALLOWED_DEDUCT_REASONS = [
  "Order Fulfillment",
  "Damaged Stock",
  "Expired Stock",
  "Quality Rejection",
  "Internal Usage",
  "Stock Correction",
  "Return to Supplier",
  "Other",
];

export async function deductVendorStockBatch(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const vendor = await Vendor.findOne({ id: vendorId }).lean();
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    if (vendor.vendorType !== "seller") {
      return res.status(403).json({ message: "Batch stock deduction is only available for Seller Vendors" });
    }

    const { productId, batchId, quantity, unit, reason, remarks } = req.body || {};

    if (!productId) return res.status(400).json({ message: "Product selection is required" });
    if (!batchId) return res.status(400).json({ message: "Batch selection is required" });

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ message: "Deduction quantity must be a positive number greater than 0" });
    }

    if (!reason || !ALLOWED_DEDUCT_REASONS.includes(reason)) {
      return res.status(400).json({
        message: `Reason must be one of: ${ALLOWED_DEDUCT_REASONS.join(", ")}`,
      });
    }

    const result = await withSafeTransaction(async (session) => {
      // 1. Find Batch
      const batch = await VendorStockBatch.findOne({ vendorId, batchId, productId }).session(session);
      if (!batch) {
        throw new Error(`Batch "${batchId}" not found for this product.`);
      }

      // Recheck status
      const curStatus = computeBatchStatus(batch);
      batch.status = curStatus;

      // Check Depleted
      if (curStatus === "Depleted" || Number(batch.availableQuantity) <= 0) {
        throw new Error(`Batch "${batchId}" is depleted and has 0 available stock.`);
      }

      // Check Expired: expired batches cannot be deducted for regular Order Fulfillment
      if (curStatus === "Expired" && reason === "Order Fulfillment") {
        throw new Error(
          `Batch "${batchId}" has expired (${new Date(batch.expiryDate).toLocaleDateString()}). Expired stock cannot be used for Order Fulfillment. Please use "Expired Stock" write-off or "Return to Supplier".`
        );
      }

      // Validate Available Quantity
      if (qty > Number(batch.availableQuantity)) {
        throw new Error(
          `Requested deduction quantity (${qty} ${batch.unit}) exceeds available batch stock (${batch.availableQuantity} ${batch.unit}).`
        );
      }

      // Validate Unit Match
      if (unit && unit.toLowerCase().trim() !== batch.unit.toLowerCase().trim()) {
        throw new Error(
          `Deduction unit "${unit}" does not match the batch unit "${batch.unit}".`
        );
      }

      // 2. Fetch previous product total stock
      const vendorProd = toObjectId(productId)
        ? await VendorProduct.findOne({ vendorId, productId }).session(session)
        : null;
      const prevProductStock = Number(vendorProd?.stock ?? 0);
      const prevBatchStock = Number(batch.availableQuantity);

      // 3. Deduct from Batch
      batch.availableQuantity = Math.max(0, prevBatchStock - Math.floor(qty));
      batch.status = computeBatchStatus(batch);
      await batch.save({ session });

      // 4. Sync product total stock
      const updatedTotalStock = await syncVendorProductTotalStock(vendorId, productId, session);

      // 5. Generate Transaction ID and record immutable transaction
      const transactionId = await generateUniqueTransactionId(session);
      const newTxn = await VendorStockTransaction.create(
        [
          {
            transactionId,
            vendorId,
            productId,
            sku: batch.sku || vendorProd?.sku || "",
            productName: batch.productName,
            batchId,
            transactionType: "DEDUCT",
            quantity: Math.floor(qty),
            unit: batch.unit,
            previousStock: prevProductStock,
            updatedStock: updatedTotalStock,
            batchPreviousStock: prevBatchStock,
            batchUpdatedStock: batch.availableQuantity,
            receivedDate: batch.receivedDate || null,
            mfgDate: batch.mfgDate || null,
            expiryDate: batch.expiryDate || null,
            packagingType: batch.packagingType || "",
            storageLocation: batch.storageLocation || "",
            reason,
            remarks: remarks || `Deducted ${Math.floor(qty)} ${batch.unit} for ${reason}`,
            userId: req.user?.id || "",
            createdBy: vendor.ownerName || vendor.name || "Seller Vendor",
          },
        ],
        { session }
      );

      return {
        batch,
        transaction: newTxn[0],
        updatedTotalStock,
      };
    });

    const products = await vendorProductsWithCatalog(vendorId);
    const item = products.find((p) => p.productId === productId);

    return res.json({
      success: true,
      message: `Successfully deducted ${Math.floor(qty)} ${result.batch.unit} from batch ${batchId}.`,
      batch: result.batch,
      transaction: result.transaction,
      product: item,
      products,
    });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Failed to deduct stock" });
  }
}

/* =========================================================================
   3. LIST PRODUCT BATCHES (WITH FEFO RECOMMENDATION & STATUS)
   ========================================================================= */
export async function listVendorStockBatches(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const productId = String(req.query.productId || "").trim();
    const status = String(req.query.status || "").trim();
    const search = String(req.query.search || "").trim().toLowerCase();

    const filter = { vendorId };
    if (productId) filter.productId = productId;
    if (status && status !== "all") filter.status = status;

    let batches = await VendorStockBatch.find(filter).lean();

    // Recalculate status for live accuracy
    const now = new Date();
    const toUpdate = [];
    batches = batches.map((b) => {
      const computed = computeBatchStatus(b);
      if (computed !== b.status) {
        toUpdate.push({ id: b._id, status: computed });
        return { ...b, status: computed };
      }
      return b;
    });

    // Asynchronously sync any status changes
    if (toUpdate.length > 0) {
      Promise.all(
        toUpdate.map((u) => VendorStockBatch.updateOne({ _id: u.id }, { $set: { status: u.status } }))
      ).catch(() => {});
    }

    // Backfill any missing purchase cost from VendorProduct
    const missingCostBatches = batches.filter((b) => !b.purchaseCost || b.purchaseCost === 0);
    if (missingCostBatches.length > 0) {
      const pids = validProductIds([...new Set(missingCostBatches.map((b) => b.productId).filter(Boolean))]);
      const prodDocs = await VendorProduct.find({ vendorId, productId: { $in: pids } })
        .select("productId purchaseCost")
        .lean();
      const prodMap = new Map(prodDocs.map((p) => [String(p.productId), p]));
      for (const b of batches) {
        if (!b.purchaseCost || b.purchaseCost === 0) {
          const prod = prodMap.get(String(b.productId));
          if (prod && Number(prod.purchaseCost) > 0) {
            b.purchaseCost = Number(prod.purchaseCost);
          }
        }
        if (!b.totalPurchaseCost || b.totalPurchaseCost === 0) {
          b.totalPurchaseCost = Number(b.purchaseCost || 0) * Number(b.quantity || b.availableQuantity || 0);
        }
      }
    }

    // Apply text search if query provided
    if (search) {
      batches = batches.filter(
        (b) =>
          b.batchId.toLowerCase().includes(search) ||
          b.productName.toLowerCase().includes(search) ||
          (b.sku && b.sku.toLowerCase().includes(search)) ||
          (b.storageLocation && b.storageLocation.toLowerCase().includes(search))
      );
    }

    // FEFO Sorting:
    // Non-depleted, non-expired batches first, sorted by earliest expiry date.
    // If expiryDate is null, push to end of active batches.
    batches.sort((a, b) => {
      const aDepleted = a.status === "Depleted";
      const bDepleted = b.status === "Depleted";
      if (aDepleted !== bDepleted) return aDepleted ? 1 : -1;

      const aExpired = a.status === "Expired";
      const bExpired = b.status === "Expired";
      if (aExpired !== bExpired) return aExpired ? 1 : -1;

      // Both active: sort by earliest expiry date (FEFO)
      const aExp = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
      const bExp = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
      if (aExp !== bExp) return aExp - bExp;

      // Fallback: oldest received first (FIFO)
      const aCreated = new Date(a.createdAt || a.receivedDate).getTime();
      const bCreated = new Date(b.createdAt || b.receivedDate).getTime();
      return aCreated - bCreated;
    });

    // Find FEFO Recommended Batch (earliest expiry among active with stock > 0)
    let fefoRecommendedBatchId = null;
    const fefoCandidate = batches.find(
      (b) => b.status !== "Depleted" && b.status !== "Expired" && Number(b.availableQuantity) > 0
    );
    if (fefoCandidate) {
      fefoRecommendedBatchId = fefoCandidate.batchId;
    }

    // Enrich batches with fefoRecommended flag
    const enrichedBatches = batches.map((b) => ({
      ...b,
      fefoRecommended: b.batchId === fefoRecommendedBatchId,
    }));

    return res.json({
      success: true,
      batches: enrichedBatches,
      total: enrichedBatches.length,
      fefoRecommendedBatchId,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to list batches" });
  }
}

/* =========================================================================
   4. LIST STOCK TRANSACTIONS (IMMUTABLE AUDIT TRAIL)
   ========================================================================= */
export async function listVendorStockTransactions(req, res) {
  try {
    const vendorId = vendorIdOf(req);
    const productId = String(req.query.productId || "").trim();
    const batchId = String(req.query.batchId || "").trim();
    const transactionType = String(req.query.transactionType || "").trim().toUpperCase();
    const reason = String(req.query.reason || "").trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));

    const filter = { vendorId };
    if (productId) filter.productId = productId;
    if (batchId) filter.batchId = batchId;
    if (transactionType && ["ADD", "DEDUCT"].includes(transactionType)) {
      filter.transactionType = transactionType;
    }
    if (reason && reason !== "all") filter.reason = reason;

    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {};
      if (req.query.startDate) filter.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) {
        const end = new Date(req.query.endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const [transactions, total] = await Promise.all([
      VendorStockTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      VendorStockTransaction.countDocuments(filter),
    ]);

    // Backfill any missing dates or purchase costs from batch and product
    const batchIds = [...new Set(transactions.map((t) => t.batchId).filter(Boolean))];
    const productIds = validProductIds([...new Set(transactions.map((t) => t.productId).filter(Boolean))]);
    const [batchDocs, prodDocs] = await Promise.all([
      batchIds.length
        ? VendorStockBatch.find({ vendorId, batchId: { $in: batchIds } })
            .select("batchId receivedDate mfgDate expiryDate packagingType storageLocation purchaseCost totalPurchaseCost")
            .lean()
        : [],
      productIds.length
        ? VendorProduct.find({ vendorId, productId: { $in: productIds } })
            .select("productId purchaseCost")
            .lean()
        : [],
    ]);
    const batchMap = new Map(batchDocs.map((b) => [b.batchId, b]));
    const prodMap = new Map(prodDocs.map((p) => [String(p.productId), p]));

    for (const t of transactions) {
      const b = batchMap.get(t.batchId);
      if (b) {
        t.receivedDate = t.receivedDate || b.receivedDate;
        t.mfgDate = t.mfgDate || b.mfgDate;
        t.expiryDate = t.expiryDate || b.expiryDate;
        t.packagingType = t.packagingType || b.packagingType;
        t.storageLocation = t.storageLocation || b.storageLocation;
        if (!t.purchaseCost || t.purchaseCost === 0) {
          t.purchaseCost = Number(b.purchaseCost || 0);
        }
      }
      if (!t.purchaseCost || t.purchaseCost === 0) {
        const prod = prodMap.get(String(t.productId));
        if (prod && Number(prod.purchaseCost) > 0) {
          t.purchaseCost = Number(prod.purchaseCost);
        }
      }
      if (!t.totalPurchaseCost || t.totalPurchaseCost === 0) {
        t.totalPurchaseCost = Number(t.purchaseCost || 0) * Number(t.quantity || 0);
      }
    }

    return res.json({
      success: true,
      transactions,
      total,
      page,
      limit,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to list stock transactions" });
  }
}


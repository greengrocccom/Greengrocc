import mongoose from "mongoose";
import { Farmer, FarmerCrop, FarmerOrder, FarmerDocument, FarmerManager, QualityInspection, Pickup } from "../../../farmer-manager-service/src/models.js";
import Product from "../../../legacy/models/Product.js";
import Order from "../../../legacy/models/order/Order.js";
import StoreInventory from "../../../delivery-service/src/models/StoreInventory.js";
import DeliveryManager from "../../../delivery-service/src/models/DeliveryManager.js";
import { InventoryBatch, GoodsReceiptNote, StockAdjustmentLog, OmniInvoice } from "../../../admin-ops-service/src/models.js";
import { detectEntity } from "../config/idRegistry.js";
import { buildStorefrontOrderTrace, findStorefrontOrder } from "./orderTraceService.js";
import { RESOURCES, ENTITY_RESOURCE } from "../config/resources.js";
import {
  Farm,
  Crop,
  Article,
  Batch,
  Crate,
  QrCode,
  QualityCheck,
  CollectionCentreMaster,
  Warehouse,
  ColdStorage,
  DarkStoreMaster,
  Packaging,
  Dispatch,
  Delivery,
  Vehicle,
  DriverMaster,
  CustomerOrder,
  Customer,
  CrmActivity,
  Invoice,
  ErpPayment,
  Inventory,
  AuditLog,
  Procurement,
  PurchaseOrder,
  GoodsReceipt,
} from "../models/index.js";

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Search-card subtitle from the parts that actually have values. */
function subtitleOf(...parts) {
  return parts.filter(Boolean).join(" • ");
}

function idVariants(id) {
  const raw = String(id || "").trim();
  const noHash = raw.replace(/^#+/, "").trim();
  const variants = new Set([raw, noHash, noHash.toUpperCase(), noHash.toLowerCase()]);
  const ggOrder = noHash.match(/^GG[-_]?(\d+)$/i);
  if (ggOrder) {
    variants.add(ggOrder[1]);
    variants.add(ggOrder[1].padStart(6, "0"));
  }
  return [...variants].filter(Boolean);
}

async function findByBusinessId(resourceKey, id) {
  const spec = RESOURCES[resourceKey];
  if (!spec) return null;
  return spec.model.findOne({ [spec.idField]: id, isDeleted: { $ne: true } }).lean();
}

async function listBy(model, filter, limit = 50) {
  return model.find({ ...filter, isDeleted: { $ne: true } }).sort({ createdAt: -1 }).limit(limit).lean();
}

// ---------------------------------------------------------------------------
// FINDERS
// ---------------------------------------------------------------------------

// Every finder tries exact ID fields first. Pass { fuzzy: false } to skip the
// name/phone regex fallback, so an ID never resolves to an unrelated record
// whose name or mobile merely contains the same characters.

async function findFarmer(query, { fuzzy = true } = {}) {
  if (!query) return null;
  const ids = idVariants(query);
  const rx = new RegExp(escapeRegex(query), "i");

  let doc = await Farmer.findOne({
    $or: [{ farmerId: { $in: ids } }, { id: { $in: ids } }, { farmerCode: { $in: ids } }, { mobile: { $in: ids } }],
    isDeleted: { $ne: true },
  }).lean();

  if (doc || !fuzzy) return doc;

  doc = await Farmer.findOne({
    $or: [
      { mobile: rx },
      { name: rx },
      { "address.village": rx },
      { farmName: rx },
    ],
    isDeleted: { $ne: true },
  }).lean();

  return doc;
}

async function findBatch(query, { fuzzy = true } = {}) {
  if (!query) return null;
  const ids = idVariants(query);
  const rx = new RegExp(escapeRegex(query), "i");

  let doc = await InventoryBatch.findOne({ batchNumber: { $in: ids } }).lean();
  if (doc) return { ...doc, isLiveBatch: true };

  // ERP lot batch, or the trip-level collection batch ID printed on pickups.
  doc = await Batch.findOne({
    $or: [
      { batchId: { $in: ids } },
      { batchNumber: { $in: ids } },
      { id: { $in: ids } },
      { collectionBatchId: { $in: ids } },
    ],
    isDeleted: { $ne: true },
  }).lean();
  if (doc) return doc;

  const tripPickup = await Pickup.findOne({ collectionBatchId: { $in: ids } }).lean();
  if (tripPickup) {
    return {
      batchId: tripPickup.collectionBatchId,
      collectionBatchId: tripPickup.collectionBatchId,
      farmerId: tripPickup.farmerId,
      collectionCentreId: tripPickup.collectionCentreId,
      status: tripPickup.status,
      createdAt: tripPickup.createdAt,
      isCollectionBatch: true,
    };
  }

  if (!fuzzy) return null;

  doc = await InventoryBatch.findOne({ $or: [{ batchNumber: rx }, { grnNumber: { $in: ids } }] }).lean();
  if (doc) return { ...doc, isLiveBatch: true };

  return Batch.findOne({ batchId: rx, isDeleted: { $ne: true } }).lean();
}

async function findProduct(query, { fuzzy = true } = {}) {
  if (!query) return null;
  const ids = idVariants(query);
  const rx = new RegExp(escapeRegex(query), "i");

  let doc = await Product.findOne({
    $or: [{ sku: { $in: ids } }, { productId: { $in: ids } }],
    isDeleted: { $ne: true },
    deleted: { $ne: true },
  }).lean();
  if (doc) return doc;

  doc = await Article.findOne({
    $or: [{ articleId: { $in: ids } }, { sku: { $in: ids } }],
    isDeleted: { $ne: true },
  }).lean();
  if (doc || !fuzzy) return doc;

  doc = await Product.findOne({
    $or: [{ name: rx }, { sku: rx }],
    isDeleted: { $ne: true },
    deleted: { $ne: true },
  }).lean();
  if (doc) return doc;

  return Article.findOne({ articleName: rx, isDeleted: { $ne: true } }).lean();
}

async function findGrn(query, { fuzzy = true } = {}) {
  if (!query) return null;
  const ids = idVariants(query);
  const rx = new RegExp(escapeRegex(query), "i");

  let doc = await GoodsReceiptNote.findOne({
    $or: [{ grnNumber: { $in: ids } }, { poNumber: { $in: ids } }],
  }).lean();
  if (doc) return { ...doc, isLiveGrn: true };

  doc = await GoodsReceipt.findOne({ grnId: { $in: ids }, isDeleted: { $ne: true } }).lean();
  if (doc || !fuzzy) return doc;

  doc = await GoodsReceiptNote.findOne({ grnNumber: rx }).lean();
  if (doc) return { ...doc, isLiveGrn: true };

  return GoodsReceipt.findOne({ grnId: rx, isDeleted: { $ne: true } }).lean();
}

async function findOrder(query, { fuzzy = true } = {}) {
  if (!query) return null;
  const ids = idVariants(query);
  const rx = new RegExp(escapeRegex(query), "i");

  let doc = await CustomerOrder.findOne({
    $or: [{ orderId: { $in: ids } }, { sourceOrderId: { $in: ids } }],
    isDeleted: { $ne: true },
  }).lean();
  if (doc) return doc;

  doc = mongoose.isValidObjectId(query)
    ? await Order.findById(query).lean()
    : await Order.findOne({ $or: [{ orderNumber: { $in: ids } }, { orderId: { $in: ids } }] }).lean();
  if (doc) return doc;

  doc = await FarmerOrder.findOne({ $or: [{ id: { $in: ids } }, { orderId: { $in: ids } }] }).lean();
  if (doc) return { ...doc, isFarmerOrder: true };

  const pickup = await Pickup.findOne({ $or: [{ pickupId: { $in: ids } }, { id: { $in: ids } }] }).lean();
  if (pickup?.orderId) {
    doc = await FarmerOrder.findOne({ $or: [{ id: pickup.orderId }, { orderId: pickup.orderId }] }).lean();
    if (doc) return { ...doc, isFarmerOrder: true };
  }

  if (!fuzzy) return null;

  doc = await CustomerOrder.findOne({
    $or: [{ customerName: rx }, { customerPhone: rx }],
    isDeleted: { $ne: true },
  }).lean();
  if (doc) return doc;

  return Order.findOne({
    $or: [
      { orderNumber: rx },
      { "shippingAddress.phone": rx },
      { "customer.phone": rx },
    ],
  }).lean();
}

async function findInvoice(query, { fuzzy = true } = {}) {
  if (!query) return null;
  const ids = idVariants(query);
  const rx = new RegExp(escapeRegex(query), "i");

  let doc = await OmniInvoice.findOne({
    $or: [
      { invoiceNumber: { $in: ids } },
      ...(mongoose.isValidObjectId(query) ? [{ _id: query }] : []),
    ],
  }).lean();
  if (doc) return { ...doc, isLiveOmniInvoice: true };

  doc = await Invoice.findOne({
    $or: [{ invoiceId: { $in: ids } }, { invoiceNumber: { $in: ids } }, { orderId: { $in: ids } }],
    isDeleted: { $ne: true },
  }).lean();
  if (doc) return doc;

  doc = await findByBusinessId("invoices", query);
  if (doc || !fuzzy) return doc;

  doc = await OmniInvoice.findOne({
    $or: [{ invoiceNumber: rx }, { customerPhone: rx }, { customerName: rx }],
  }).lean();
  if (doc) return { ...doc, isLiveOmniInvoice: true };

  return Invoice.findOne({
    $or: [{ invoiceId: rx }, { invoiceNumber: rx }, { customerName: rx }],
    isDeleted: { $ne: true },
  }).lean();
}

// ---------------------------------------------------------------------------
// DEEP GRAPH BUILDERS
// ---------------------------------------------------------------------------

export async function getByFarmerId(farmerQuery, opts) {
  const farmer = await findFarmer(farmerQuery, opts);
  if (!farmer) return null;

  const ids = [
    ...new Set(
      [
        farmer.farmerId,
        farmer.id,
        farmer.farmerCode,
        ...(farmer.id ? idVariants(farmer.id) : []),
        ...(farmer.farmerId ? idVariants(farmer.farmerId) : []),
      ].filter(Boolean)
    ),
  ];

  const related = { farmerId: { $in: ids } };

  const [
    farms,
    crops,
    farmerCrops,
    articles,
    batches,
    inventoryBatches,
    crates,
    qrs,
    quality,
    procurements,
    orders,
    documents,
    manager,
  ] = await Promise.all([
    listBy(Farm, related),
    listBy(Crop, related),
    FarmerCrop.find({ farmerId: { $in: ids } }).lean(),
    listBy(Article, related),
    listBy(Batch, related),
    InventoryBatch.find({ supplierName: new RegExp(escapeRegex(farmer.name || farmer.farmName || ""), "i") }).lean(),
    listBy(Crate, related),
    listBy(QrCode, related),
    listBy(QualityCheck, related),
    listBy(Procurement, related),
    FarmerOrder.find({ farmerId: { $in: ids } }).limit(20).lean(),
    FarmerDocument.find({ farmerId: { $in: ids } }).lean(),
    farmer.managerId ? FarmerManager.findOne({ id: farmer.managerId }).lean() : null,
  ]);

  return {
    farmer,
    farms,
    crops: crops.length ? crops : farmerCrops,
    articles,
    batches: [...batches, ...inventoryBatches],
    crates,
    qrs,
    quality,
    procurements,
    orders,
    documents,
    manager,
  };
}

export async function getByBatchId(batchQuery, opts) {
  const batch = await findBatch(batchQuery, opts);
  if (!batch) return null;

  const batchId = batch.batchNumber || batch.batchId || batch.id;
  const sku = batch.sku;

  const tripId = batch.collectionBatchId;
  const pickups = tripId ? await Pickup.find({ collectionBatchId: tripId }).limit(50).lean() : [];
  const lotBatches = batch.isCollectionBatch && tripId
    ? await listBy(Batch, { collectionBatchId: tripId })
    : [];
  const farmerOrders = pickups.length
    ? await FarmerOrder.find({ id: { $in: pickups.map((p) => p.orderId).filter(Boolean) } }).lean()
    : [];

  const [
    product,
    storeInventory,
    grn,
    crates,
    qrs,
    quality,
    packaging,
    dispatch,
    warehouse,
    store,
  ] = await Promise.all([
    sku ? Product.findOne({ sku }).lean() : null,
    sku ? StoreInventory.find({ sku }).lean() : [],
    batch.grnNumber ? findGrn(batch.grnNumber) : null,
    listBy(Crate, { $or: [{ batchId }, { batchNumber: batchId }] }),
    QrCode.find({ $or: [{ batchId }, { batchNumber: batchId }] }).lean(),
    listBy(QualityCheck, { $or: [{ batchId }, { batchNumber: batchId }] }),
    listBy(Packaging, { $or: [{ batchId }, { batchNumber: batchId }] }),
    listBy(Dispatch, { $or: [{ batchId }, { batchNumber: batchId }] }),
    batch.warehouseId ? findByBusinessId("warehouses", batch.warehouseId) : null,
    batch.storeId && mongoose.isValidObjectId(batch.storeId)
      ? DeliveryManager.findById(batch.storeId).select("name area city storeName phone").lean()
      : null,
  ]);

  let farmer = null;
  let farm = null;
  let crop = null;

  if (batch.farmerId) {
    farmer = await findFarmer(batch.farmerId);
  } else if (batch.supplierName) {
    farmer = await findFarmer(batch.supplierName);
  }

  if (batch.farmId) {
    farm = await findByBusinessId("farms", batch.farmId);
  }
  if (batch.cropId) {
    crop = await findByBusinessId("crops", batch.cropId);
  }

  return {
    batch,
    batches: lotBatches,
    pickups,
    orders: farmerOrders,
    product,
    storeInventory,
    grn,
    farmer,
    farm,
    crop,
    crates,
    qr: qrs?.[0] || null,
    quality,
    packaging,
    dispatch,
    warehouse,
    store,
  };
}

export async function getByProductOrSku(prodQuery, opts) {
  const product = await findProduct(prodQuery, opts);
  if (!product) return null;

  const sku = product.sku || product.productId;

  const [
    batches,
    storeInventories,
    grns,
    crop,
  ] = await Promise.all([
    InventoryBatch.find({ sku }).lean(),
    StoreInventory.find({ sku }).populate("managerId", "name area city storeName").lean(),
    GoodsReceiptNote.find({ "items.sku": sku }).lean(),
    product.category ? Crop.findOne({ cropName: new RegExp(escapeRegex(product.category), "i") }).lean() : null,
  ]);

  let farmer = null;
  if (product.farmerId) {
    farmer = await findFarmer(product.farmerId);
  } else if (batches[0]?.supplierName) {
    farmer = await findFarmer(batches[0].supplierName);
  }

  return {
    product,
    sku,
    batches,
    storeInventories,
    grns,
    crop,
    farmer,
  };
}

export async function getByGrnNumber(grnQuery, opts) {
  const grn = await findGrn(grnQuery, opts);
  if (!grn) return null;

  const grnNumber = grn.grnNumber || grn.grnId;

  const [
    batches,
    store,
  ] = await Promise.all([
    InventoryBatch.find({ grnNumber }).lean(),
    grn.storeId && mongoose.isValidObjectId(grn.storeId)
      ? DeliveryManager.findById(grn.storeId).select("name area city storeName").lean()
      : null,
  ]);

  let supplier = null;
  if (grn.supplierName) {
    supplier = await findFarmer(grn.supplierName);
  }

  return {
    grn,
    batches,
    store,
    supplier,
  };
}

/** Graph for a website/app order, keeping the generic keys the overview cards read. */
async function storefrontOrderGraph(storefrontOrder, erpOrder = null) {
  const orderTrace = await buildStorefrontOrderTrace(storefrontOrder);
  const firstDelivery = orderTrace.deliveries[0] || null;
  const firstFarmer = orderTrace.farmers[0] || null;
  return {
    order: erpOrder || storefrontOrder,
    orderTrace,
    customer: {
      ...(orderTrace.customer.account || {}),
      name: orderTrace.customer.name,
      phone: orderTrace.customer.phone,
      email: orderTrace.customer.email,
    },
    store: firstDelivery?.darkStore || null,
    farmer: firstFarmer?.farmer || null,
    manager: firstFarmer?.fieldManager || null,
    batches: orderTrace.items.flatMap((line) => line.storeBatches.map((src) => src.batch)),
    payments: orderTrace.payment.records,
  };
}

export async function getByOrderId(orderQuery, opts) {
  const storefrontOrder = await findStorefrontOrder(orderQuery);
  if (storefrontOrder) return storefrontOrderGraph(storefrontOrder);

  const order = await findOrder(orderQuery, opts);
  if (!order) return null;

  if (order.sourceOrderId && !order.isFarmerOrder) {
    const mirrored = await findStorefrontOrder(order.sourceOrderId);
    if (mirrored) return storefrontOrderGraph(mirrored, order);
  }

  if (order.isFarmerOrder) {
    const orderIds = [order.id, order.orderId].filter(Boolean);
    const [pickup, inspection, quality, farmer] = await Promise.all([
      Pickup.findOne({ orderId: { $in: orderIds } }).lean(),
      QualityInspection.findOne({ orderId: { $in: orderIds } }).lean(),
      listBy(QualityCheck, { orderId: { $in: orderIds } }),
      findFarmer(order.farmerId, { fuzzy: false }),
    ]);
    const batches = pickup?.collectionBatchId
      ? await listBy(Batch, { collectionBatchId: pickup.collectionBatchId, farmerId: order.farmerId })
      : [];
    return {
      order,
      pickup,
      farmer,
      quality: [...(inspection ? [inspection] : []), ...quality],
      batches,
    };
  }

  const linkedOrderId = order.orderId || order.orderNumber || order.id || order._id?.toString() || orderQuery;

  const [customer, deliveries, dispatches, invoices, payments] = await Promise.all([
    order.customerId ? findByBusinessId("customers", order.customerId) : null,
    listBy(Delivery, { orderId: linkedOrderId }),
    listBy(Dispatch, { orderId: linkedOrderId }),
    listBy(Invoice, { orderId: linkedOrderId }),
    listBy(ErpPayment, { orderId: linkedOrderId }),
  ]);

  // Extract batch numbers or SKUs from items
  const skus = (order.items || []).map((i) => i.sku || i.productId).filter(Boolean);
  const batches = skus.length ? await InventoryBatch.find({ sku: { $in: skus } }).lean() : [];

  return {
    order,
    customer,
    deliveries,
    dispatches,
    invoices,
    payments,
    batches,
  };
}

export async function getByFarmId(farmId) {
  const farm = await findByBusinessId("farms", farmId);
  if (!farm) return null;
  const crops = await listBy(Crop, { farmId }) || [];
  const farmer = farm.farmerId ? await findFarmer(farm.farmerId) : null;
  const batches = await listBy(Batch, { farmId }) || [];
  return { farm, farmer, crops, batches };
}

export async function getByCropId(cropId) {
  const crop = await findByBusinessId("crops", cropId) || await FarmerCrop.findOne({ cropId }).lean();
  if (!crop) return null;
  const [farm, farmer, articles, batches] = await Promise.all([
    crop.farmId ? findByBusinessId("farms", crop.farmId) : null,
    crop.farmerId ? findFarmer(crop.farmerId) : null,
    listBy(Article, { cropId }),
    listBy(Batch, { cropId }),
  ]);
  return { crop, farm, farmer, articles, batches };
}

export async function getByCrateId(crateId) {
  const crate = await findByBusinessId("crates", crateId);
  if (!crate) return null;
  const batchChain = crate.batchId ? await getByBatchId(crate.batchId) : {};
  const qr = crate.qrId ? await findByBusinessId("qr_codes", crate.qrId) : await QrCode.findOne({ crateId }).lean();
  return { crate, qr, ...batchChain };
}

export async function getByQrId(qrId) {
  const qr = await QrCode.findOne({ $or: [{ qrId }, { qrValue: qrId }], isDeleted: { $ne: true } }).lean();
  if (!qr) return null;
  if (qr.crateId) {
    const crateChain = await getByCrateId(qr.crateId);
    return { qr, ...crateChain };
  }
  if (qr.batchId) {
    const batchChain = await getByBatchId(qr.batchId);
    return { qr, ...batchChain };
  }
  return { qr };
}

export async function getByCustomerId(customerId) {
  const customer = await findByBusinessId("customers", customerId);
  if (!customer) return null;
  const [orders, invoices, payments, crm] = await Promise.all([
    listBy(CustomerOrder, { customerId }),
    listBy(Invoice, { customerId }),
    listBy(ErpPayment, { $or: [{ payerId: customerId }, { receiverId: customerId }] }),
    listBy(CrmActivity, { customerId }),
  ]);
  return { customer, orders, invoices, payments, crm };
}

export async function getByInvoiceId(invoiceQuery, opts) {
  const invoice = await findInvoice(invoiceQuery, opts);
  if (!invoice) return null;

  const linkedOrderId = invoice.orderId || invoice.sourceOrderId || "";
  const [order, customer, payments] = await Promise.all([
    linkedOrderId ? getByOrderId(linkedOrderId) : null,
    invoice.customerId ? findByBusinessId("customers", invoice.customerId) : null,
    listBy(ErpPayment, { $or: [{ invoiceId: invoice.invoiceNumber }, { invoiceId: invoice.invoiceId }, { invoiceId: invoiceQuery }] }),
  ]);

  // Extract products and batches from invoice items
  const skus = (invoice.items || []).map((i) => i.sku || i.productId).filter(Boolean);
  const [batches, products, store] = await Promise.all([
    skus.length ? InventoryBatch.find({ sku: { $in: skus } }).lean() : [],
    skus.length ? Product.find({ sku: { $in: skus } }).lean() : [],
    invoice.storeId && mongoose.isValidObjectId(invoice.storeId)
      ? DeliveryManager.findById(invoice.storeId).select("name area city storeName").lean()
      : null,
  ]);

  let farmer = null;
  if (batches[0]?.supplierName) {
    farmer = await findFarmer(batches[0].supplierName);
  } else if (products[0]?.farmerId) {
    farmer = await findFarmer(products[0].farmerId);
  }

  let quality = null;
  if (batches[0]?.batchNumber) {
    quality = await QualityInspection.findOne({
      $or: [{ batchNumber: batches[0].batchNumber }, { sku: batches[0].sku }],
    }).lean();
  }

  return {
    invoice,
    order: order?.order || null,
    customer: customer || (invoice.customerName ? { name: invoice.customerName, phone: invoice.customerPhone, tier: invoice.customerTier } : null),
    payments: payments?.length ? payments : [{ paymentMethod: invoice.paymentMethod, paymentStatus: invoice.paymentStatus, amount: invoice.grandTotal }],
    items: invoice.items || [],
    batches,
    batch: batches[0] || null,
    products,
    product: products[0] || null,
    farmer,
    store: store || (invoice.storeName ? { storeName: invoice.storeName, area: invoice.area, zone: invoice.zone } : null),
    quality: quality ? [quality] : [],
    ...(order || {}),
  };
}

export async function getByPaymentId(paymentId) {
  const payment = await findByBusinessId("payments", paymentId);
  if (!payment) return null;
  const invoice = payment.invoiceId ? await findInvoice(payment.invoiceId) : null;
  const order = payment.orderId ? await getByOrderId(payment.orderId) : null;
  return { payment, invoice, ...(order || {}) };
}

// ---------------------------------------------------------------------------
// TIMELINE GENERATOR
// ---------------------------------------------------------------------------

function timelineEvent(at, title, entity, data) {
  return {
    at: at || data?.createdAt || data?.updatedAt || null,
    title,
    entity,
    id: data?.[`${entity}Id`] || data?.id || data?._id || data?.batchNumber || data?.grnNumber || data?.sku || data?.invoiceNumber || "",
    status: data?.status || data?.paymentStatus || data?.deliveryStatus || "",
    data,
  };
}

function buildTimeline(graph) {
  const events = [];
  if (graph.farmer) events.push(timelineEvent(graph.farmer.createdAt, "Farmer registered", "farmer", graph.farmer));
  (graph.farms || []).forEach((d) => events.push(timelineEvent(d.createdAt, "Farm registered", "farm", d)));
  if (graph.farm && !graph.farms?.length) events.push(timelineEvent(graph.farm.createdAt, "Farm", "farm", graph.farm));
  (graph.crops || []).forEach((d) => events.push(timelineEvent(d.createdAt || d.sowingDate, "Crop sowing", "crop", d)));
  if (graph.crop && !graph.crops?.length) events.push(timelineEvent(graph.crop.createdAt, "Crop", "crop", graph.crop));
  if (graph.product) events.push(timelineEvent(graph.product.createdAt, "Catalog product created", "product", graph.product));
  (graph.articles || []).forEach((d) => events.push(timelineEvent(d.createdAt, "Article created", "article", d)));
  (graph.quality || []).forEach((d) => events.push(timelineEvent(d.inspectionDate || d.createdAt, "Quality inspection", "qualityCheck", d)));
  (graph.batches || []).forEach((d) => events.push(timelineEvent(d.mfgDate || d.harvestDate || d.createdAt, `Batch Inwarded: ${d.batchNumber || d.batchId}`, "batch", d)));
  if (graph.batch && !graph.batches?.length) events.push(timelineEvent(graph.batch.mfgDate || graph.batch.createdAt, `Batch: ${graph.batch.batchNumber || graph.batch.batchId}`, "batch", graph.batch));
  if (graph.grn) events.push(timelineEvent(graph.grn.createdAt, `Goods Receipt Note: ${graph.grn.grnNumber}`, "grn", graph.grn));
  (graph.crates || []).forEach((d) => events.push(timelineEvent(d.createdAt, "Crate packed", "crate", d)));
  if (graph.crate && !graph.crates?.length) events.push(timelineEvent(graph.crate.createdAt, "Crate", "crate", graph.crate));
  if (graph.qr) events.push(timelineEvent(graph.qr.generatedAt || graph.qr.createdAt, "QR Code Generated", "qr", graph.qr));
  (graph.packaging || []).forEach((d) => events.push(timelineEvent(d.packingDate || d.createdAt, "Packaging & QC", "packaging", d)));
  (graph.dispatch || []).forEach((d) => events.push(timelineEvent(d.dispatchDate || d.createdAt, "Dispatch for store", "dispatch", d)));
  if (graph.store) events.push(timelineEvent(graph.store.createdAt, `Dark store stock: ${graph.store.storeName || graph.store.name}`, "store", graph.store));
  if (graph.order) events.push(timelineEvent(graph.order.createdAt, `Order Placed: ${graph.order.orderId || graph.order.orderNumber || graph.order.id || ""}`, "order", graph.order));
  (graph.orders || []).forEach((d) => events.push(timelineEvent(d.createdAt, `Order: ${d.orderId || d.orderNumber || d.id}`, "order", d)));
  if (graph.pickup) events.push(timelineEvent(graph.pickup.createdAt, `Farm pickup: ${graph.pickup.pickupId}`, "pickup", graph.pickup));
  (graph.pickups || []).forEach((d) => events.push(timelineEvent(d.createdAt, `Farm pickup: ${d.pickupId}`, "pickup", d)));
  if (graph.invoice) events.push(timelineEvent(graph.invoice.createdAt, `Tax Invoice Generated: ${graph.invoice.invoiceNumber || graph.invoice.invoiceId}`, "invoice", graph.invoice));
  (graph.invoices || []).forEach((d) => events.push(timelineEvent(d.createdAt, `Tax Invoice: ${d.invoiceNumber || d.invoiceId}`, "invoice", d)));
  (graph.payments || []).forEach((d) => events.push(timelineEvent(d.paymentDate || d.createdAt, "Payment completed", "payment", d)));

  return events.filter((e) => e.at).sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));
}

// ---------------------------------------------------------------------------
// OMNI-SEARCH ENGINE
// ---------------------------------------------------------------------------

export async function omniSearch(rawQuery) {
  const q = String(rawQuery || "").trim();
  if (!q) return [];

  const rx = new RegExp(escapeRegex(q), "i");
  const ids = idVariants(q);

  const [
    farmers,
    batches,
    products,
    grns,
    orders,
    crops,
    farms,
    stores,
    omniInvoices,
    erpInvoices,
    lotBatches,
    farmerOrders,
    pickups,
    shopOrders,
  ] = await Promise.all([
    Farmer.find({
      $or: [
        { farmerId: { $in: ids } },
        { id: { $in: ids } },
        { farmerCode: { $in: ids } },
        { name: rx },
        { mobile: rx },
        { "address.village": rx },
        { "address.district": rx },
        { farmName: rx },
      ],
      isDeleted: { $ne: true },
    }).limit(10).lean(),

    InventoryBatch.find({
      $or: [
        { batchNumber: { $in: ids } },
        { batchNumber: rx },
        { sku: { $in: ids } },
        { productName: rx },
        { supplierName: rx },
        { grnNumber: { $in: ids } },
      ],
    }).limit(10).lean(),

    Product.find({
      $or: [
        { sku: { $in: ids } },
        { sku: rx },
        { productId: { $in: ids } },
        { name: rx },
        { category: rx },
        { varietyName: rx },
      ],
      isDeleted: { $ne: true },
      deleted: { $ne: true },
    }).limit(10).lean(),

    GoodsReceiptNote.find({
      $or: [
        { grnNumber: { $in: ids } },
        { grnNumber: rx },
        { supplierName: rx },
        { poNumber: { $in: ids } },
      ],
    }).limit(8).lean(),

    CustomerOrder.find({
      $or: [
        { orderId: { $in: ids } },
        { orderId: rx },
        { customerName: rx },
        { customerPhone: rx },
      ],
      isDeleted: { $ne: true },
    }).limit(8).lean(),

    Crop.find({
      $or: [{ cropId: { $in: ids } }, { cropName: rx }, { variety: rx }],
      isDeleted: { $ne: true },
    }).limit(5).lean(),

    Farm.find({
      $or: [{ farmId: { $in: ids } }, { farmName: rx }, { farmLocation: rx }],
      isDeleted: { $ne: true },
    }).limit(5).lean(),

    DeliveryManager.find({
      $or: [{ storeName: rx }, { name: rx }, { area: rx }, { city: rx }, { phone: rx }],
    }).limit(6).lean(),

    OmniInvoice.find({
      $or: [
        { invoiceNumber: { $in: ids } },
        { invoiceNumber: rx },
        { customerName: rx },
        { customerPhone: rx },
        { storeName: rx },
      ],
    }).limit(8).lean(),

    Invoice.find({
      $or: [
        { invoiceId: { $in: ids } },
        { invoiceNumber: { $in: ids } },
        { invoiceId: rx },
        { invoiceNumber: rx },
        { customerName: rx },
      ],
      isDeleted: { $ne: true },
    }).limit(8).lean(),

    Batch.find({
      $or: [
        { batchId: { $in: ids } },
        { batchId: rx },
        { collectionBatchId: { $in: ids } },
      ],
      isDeleted: { $ne: true },
    }).limit(8).lean(),

    FarmerOrder.find({
      $or: [{ id: { $in: ids } }, { orderId: { $in: ids } }, { id: rx }, { orderId: rx }],
    }).limit(8).lean(),

    Pickup.find({
      $or: [{ pickupId: { $in: ids } }, { pickupId: rx }, { collectionBatchId: { $in: ids } }],
    }).limit(8).lean(),

    Order.find({
      $or: [
        { orderNumber: { $in: ids } },
        ...(mongoose.isValidObjectId(q) ? [{ _id: q }] : []),
      ],
    }).limit(8).lean(),
  ]);

  const matches = [];

  for (const f of farmers) {
    matches.push({
      id: f.farmerId || f.id || f.farmerCode,
      type: "farmer",
      title: f.name || f.farmerId || f.id,
      subtitle: subtitleOf(f.address?.village || f.farmName, f.mobile && `Mobile: ${f.mobile}`),
      badge: "Farmer",
      entityId: f.farmerId || f.id,
    });
  }

  for (const b of batches) {
    matches.push({
      id: b.batchNumber,
      type: "batch",
      title: `${b.batchNumber} • ${b.productName}`,
      subtitle: subtitleOf(b.supplierName && `Supplier: ${b.supplierName}`, b.currentQty != null && `Stock: ${b.currentQty} ${b.unit || ""}`.trim()),
      badge: "Batch",
      entityId: b.batchNumber,
    });
  }

  for (const p of products) {
    matches.push({
      id: p.sku || p.productId,
      type: "product",
      title: p.name,
      subtitle: subtitleOf(`SKU: ${p.sku || p.productId}`, p.category, p.price != null && `₹${p.price}`),
      badge: "Product / SKU",
      entityId: p.sku || p.productId,
    });
  }

  for (const g of grns) {
    matches.push({
      id: g.grnNumber,
      type: "grn",
      title: `GRN: ${g.grnNumber}`,
      subtitle: subtitleOf(g.supplierName && `Supplier: ${g.supplierName}`, `Items: ${g.totalItems || g.items?.length || 0}`),
      badge: "GRN Inwarding",
      entityId: g.grnNumber,
    });
  }

  for (const o of orders) {
    matches.push({
      id: o.orderId,
      type: "order",
      title: `Order: ${o.orderId}`,
      subtitle: subtitleOf(o.customerName && `Customer: ${o.customerName}`, o.totalAmount != null && `₹${o.totalAmount}`),
      badge: "Customer Order",
      entityId: o.orderId,
    });
  }

  for (const c of crops) {
    matches.push({
      id: c.cropId,
      type: "crop",
      title: `Crop: ${c.cropName}${c.variety ? ` (${c.variety})` : ""}`,
      subtitle: subtitleOf(c.procurementStatus && `Procurement: ${c.procurementStatus}`, `ID: ${c.cropId}`),
      badge: "Crop / Harvest",
      entityId: c.cropId,
    });
  }

  for (const fm of farms) {
    matches.push({
      id: fm.farmId,
      type: "farm",
      title: `Farm: ${fm.farmName || fm.farmId}`,
      subtitle: subtitleOf(fm.farmLocation && `Location: ${fm.farmLocation}`, fm.area && `${fm.area} ${fm.areaUnit || ""}`.trim()),
      badge: "Farm / Land",
      entityId: fm.farmId,
    });
  }

  for (const s of stores) {
    matches.push({
      id: s.storeName || s.name,
      type: "store",
      title: s.storeName || s.name,
      subtitle: subtitleOf([s.area, s.city].filter(Boolean).join(", "), "Dark Store"),
      badge: "Dark Store Hub",
      entityId: s._id?.toString(),
    });
  }

  for (const inv of (omniInvoices || [])) {
    matches.push({
      id: inv.invoiceNumber,
      type: "invoice",
      title: `Invoice: ${inv.invoiceNumber}`,
      subtitle: subtitleOf(inv.grandTotal != null && `₹${inv.grandTotal}`, `${inv.itemsCount || inv.items?.length || 0} items`, inv.customerName, inv.storeName),
      badge: "Tax Invoice",
      entityId: inv.invoiceNumber,
    });
  }

  for (const inv of (erpInvoices || [])) {
    matches.push({
      id: inv.invoiceId || inv.invoiceNumber,
      type: "invoice",
      title: `ERP Invoice: ${inv.invoiceId || inv.invoiceNumber}`,
      subtitle: subtitleOf((inv.amount ?? inv.grandTotal) != null && `₹${inv.amount ?? inv.grandTotal}`, (inv.customerName || inv.customerId) && `Customer: ${inv.customerName || inv.customerId}`),
      badge: "ERP Invoice",
      entityId: inv.invoiceId || inv.invoiceNumber,
    });
  }

  for (const b of lotBatches) {
    matches.push({
      id: b.batchId,
      type: "batch",
      title: `Lot: ${b.batchId}`,
      subtitle: subtitleOf(b.collectionBatchId && `Trip: ${b.collectionBatchId}`, b.quantity != null && `${b.quantity} ${b.unit || ""}`.trim(), b.status),
      badge: "Harvest Lot",
      entityId: b.batchId,
    });
  }

  for (const o of farmerOrders) {
    matches.push({
      id: o.id,
      type: "order",
      title: `Farmer Order: ${o.orderId || o.id}`,
      subtitle: subtitleOf(o.productName, o.farmerId && `Farmer: ${o.farmerId}`, o.status),
      badge: "Farmer Order",
      entityId: o.id,
    });
  }

  const seenOrderIds = new Set(farmerOrders.map((o) => o.id));
  for (const p of pickups) {
    if (seenOrderIds.has(p.orderId)) continue;
    matches.push({
      id: p.pickupId,
      type: "order",
      title: `Pickup: ${p.pickupId}`,
      subtitle: subtitleOf(`Order: ${p.orderId}`, p.collectionBatchId && `Trip batch: ${p.collectionBatchId}`, p.status),
      badge: "Farm Pickup",
      entityId: p.pickupId,
    });
  }

  for (const o of shopOrders) {
    matches.push({
      id: o.orderNumber || String(o._id),
      type: "order",
      title: `Order #${o.orderNumber || o._id}`,
      subtitle: subtitleOf(o.total != null && `₹${o.total}`, o.status),
      badge: "Customer Order",
      entityId: o.orderNumber || String(o._id),
    });
  }

  return dedupeMatches(matches);
}

function dedupeMatches(matches) {
  const seen = new Set();
  return matches.filter((m) => {
    const key = `${m.type}:${m.entityId || m.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// MAIN COMPLETE TRACEABILITY ENGINE
// ---------------------------------------------------------------------------

const LOADERS = {
  farmer: getByFarmerId,
  batch: getByBatchId,
  product: getByProductOrSku,
  grn: getByGrnNumber,
  order: getByOrderId,
  farm: getByFarmId,
  crop: getByCropId,
  crate: getByCrateId,
  qr: getByQrId,
  customer: getByCustomerId,
  invoice: getByInvoiceId,
  payment: getByPaymentId,
};

export async function getCompleteTraceability(id, options = {}) {
  const raw = String(id || "").trim();
  if (!raw) return { found: false, error: "ID or search query is required" };

  const lookupId = raw.replace(/^#+/, "").trim() || raw;
  const detected = detectEntity(lookupId) || detectEntity(raw);
  let entity = options.entity || detected?.entity || null;
  let graph = null;

  const tryLoad = async (loader, value, opts) => {
    try {
      return await loader(value, opts);
    } catch (err) {
      console.error(`[traceability] loader failed for ${value}:`, err.message);
      return null;
    }
  };

  // Storefront order numbers are bare 6 digits (or GG-123456).
  if (!entity && /^(GG[-_]?)?\d{6}$/i.test(lookupId)) entity = "order";

  const exactOnly = { fuzzy: false };
  if (entity && LOADERS[entity]) {
    graph = await tryLoad(LOADERS[entity], lookupId, exactOnly);
    if (!graph && lookupId !== raw) graph = await tryLoad(LOADERS[entity], raw, exactOnly);
  }

  const priorityLoaders = [
    ["batch", getByBatchId],
    ["order", getByOrderId],
    ["grn", getByGrnNumber],
    ["invoice", getByInvoiceId],
    ["farmer", getByFarmerId],
    ["product", getByProductOrSku],
    ["qr", getByQrId],
    ["crop", getByCropId],
    ["farm", getByFarmId],
    ["crate", getByCrateId],
    ["payment", getByPaymentId],
    ["customer", getByCustomerId],
  ];

  const runLoaders = async (opts) => {
    for (const [key, loader] of priorityLoaders) {
      let found = await tryLoad(loader, lookupId, opts);
      if (!found && lookupId !== raw) found = await tryLoad(loader, raw, opts);
      if (found) {
        entity = key;
        return found;
      }
    }
    return null;
  };

  // Exact ID pass across every entity before any name/phone matching.
  if (!graph) graph = await runLoaders(exactOnly);

  if (!graph && !options.exact) {
    const matches = await omniSearch(raw);
    if (matches.length === 1) {
      // Exactly 1 match found! Resolve it directly!
      const single = matches[0];
      if (LOADERS[single.type]) {
        graph = await tryLoad(LOADERS[single.type], single.entityId || single.id);
        if (graph) entity = single.type;
      }
    } else if (matches.length > 1) {
      return {
        found: true,
        isMultiMatch: true,
        query: raw,
        totalMatches: matches.length,
        matches,
      };
    }
  }

  if (!graph && !options.exact) graph = await runLoaders({ fuzzy: true });

  if (!graph) {
    return { found: false, id: raw, entity: entity || "unknown" };
  }

  const recordIds = collectRecordIds(graph);
  const audits = recordIds.length
    ? await AuditLog.find({ recordId: { $in: recordIds } }).sort({ dateTime: -1 }).limit(100).lean()
    : [];

  const current = summarizeCurrent(graph);

  return {
    found: true,
    isMultiMatch: false,
    id: raw,
    entity,
    module: detected?.module || null,
    current,
    graph,
    timeline: graph.orderTrace
      ? graph.orderTrace.timeline.map((ev) => ({ ...ev, entity: "order", id: ev.actor || "", status: ev.detail || "" }))
      : buildTimeline(graph),
    audits,
    rawPayload: graph,
  };
}

function collectRecordIds(graph) {
  const ids = new Set();
  const walk = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value === "object") {
      for (const k of Object.keys(value)) {
        if (/Id$/.test(k) && value[k]) ids.add(String(value[k]));
        if (k === "id" && value[k]) ids.add(String(value[k]));
        if (k === "batchNumber" && value[k]) ids.add(String(value[k]));
        if (k === "grnNumber" && value[k]) ids.add(String(value[k]));
        if (k === "invoiceNumber" && value[k]) ids.add(String(value[k]));
        if (k === "invoiceId" && value[k]) ids.add(String(value[k]));
      }
    }
  };
  walk(graph);
  return [...ids];
}

function summarizeCurrent(graph) {
  const invoice = graph.invoice;
  const batch = graph.batch || graph.batches?.[0];
  const crate = graph.crate || graph.crates?.[0];
  const quality = graph.quality?.[0] || graph.quality;
  const order = graph.order || graph.orders?.[0];
  const product = graph.product || graph.products?.[0];
  const farmer = graph.farmer;
  const store = graph.store || graph.storeInventories?.[0];

  const quantity = invoice
    ? invoice.itemsCount ?? invoice.items?.length ?? null
    : batch?.currentQty ?? batch?.quantity ?? order?.quantity ?? product?.stock ?? null;

  return {
    status: invoice?.status || batch?.status || order?.status || farmer?.status || "",
    locationType:
      invoice?.storeName ||
      crate?.currentLocationType ||
      batch?.storeName ||
      store?.managerId?.storeName ||
      store?.managerId?.name ||
      store?.storeName ||
      "",
    locationId: invoice?.storeId || crate?.currentLocationId || batch?.storeId || "",
    quantity,
    unit: quantity == null ? "" : invoice ? "items" : batch?.unit || product?.unit || "",
    grade: quality?.grade || batch?.grade || product?.specs?.find?.((s) => s[0] === "Grade")?.[1] || "",
    qualityStatus: quality?.status || "",
    orderId: invoice?.invoiceNumber || order?.orderId || order?.orderNumber || order?.id || "",
    customerId: invoice?.customerPhone || graph.customer?.phone || graph.customer?.customerId || order?.customerId || "",
    paymentStatus: invoice?.paymentStatus || order?.paymentStatus || graph.payments?.[0]?.paymentStatus || "",
    productName: invoice?.items?.[0]?.name ? `${invoice.items[0].name}${invoice.items.length > 1 ? ` (+${invoice.items.length - 1} items)` : ""}` : (product?.name || batch?.productName || ""),
    farmerName: farmer?.name || batch?.supplierName || "",
  };
}

export const TraceabilityService = {
  omniSearch,
  getByFarmerId,
  getByBatchId,
  getByProductOrSku,
  getByGrnNumber,
  getByOrderId,
  getByFarmId,
  getByCropId,
  getByCrateId,
  getByQrId,
  getByCustomerId,
  getByInvoiceId,
  getByPaymentId,
  getCompleteTraceability,
};

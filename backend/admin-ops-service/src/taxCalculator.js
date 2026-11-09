import mongoose from "mongoose";
import { OmniInvoice } from "./models.js";
import { FinanceTaxRate } from "./financeModels.js";
import { buildIstDateFilter, calculateAllVendorsCommission } from "./adminCommissionService.js";

/**
 * Admin tax calculator: tax on vendor sales (base fetched from the platform), tax on admin
 * sales (base typed or picked from a platform figure) and any number of extra taxes or
 * deductions. Every amount is recomputed on the server from fresh platform figures.
 */

const KINDS = ["vendor_sale", "admin_sale", "custom"];
const MAX_LINES = 50;
const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

const taxLineSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: KINDS, required: true },
    label: { type: String, required: true, trim: true, maxlength: 120 },
    effect: { type: String, enum: ["add", "deduct"], default: "add" },
    baseSource: { type: String, default: "manual", trim: true },
    baseAmount: { type: Number, default: 0, min: 0 },
    method: { type: String, enum: ["percent", "fixed"], default: "percent" },
    basis: { type: String, enum: ["inclusive", "exclusive"], default: "exclusive" },
    rate: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0 },
    note: { type: String, default: "", trim: true, maxlength: 300 },
  },
  { _id: false }
);

const taxCalculationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    period: {
      preset: { type: String, default: "month" },
      startDate: { type: String, default: "" },
      endDate: { type: String, default: "" },
    },
    lines: { type: [taxLineSchema], default: [] },
    totals: {
      taxOnVendorSales: { type: Number, default: 0 },
      taxOnAdminSales: { type: Number, default: 0 },
      additionalTaxes: { type: Number, default: 0 },
      deductions: { type: Number, default: 0 },
      grossTax: { type: Number, default: 0 },
      netTaxPayable: { type: Number, default: 0 },
      taxableSales: { type: Number, default: 0 },
      effectiveRate: { type: Number, default: 0 },
    },
    figuresSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    notes: { type: String, default: "", trim: true, maxlength: 2000 },
    status: { type: String, enum: ["draft", "final"], default: "draft", index: true },
    createdBy: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true, minimize: false }
);

export const TaxCalculation =
  mongoose.models.AdminTaxCalculation ||
  mongoose.model("AdminTaxCalculation", taxCalculationSchema, "admintaxcalculations");

const METRICS = [
  { key: "vendor_total_sale", group: "Vendor sales", label: "Total vendor sale", description: "Product sales + delivery charges on non-cancelled orders of all vendors' dark stores" },
  { key: "vendor_product_sales", group: "Vendor sales", label: "Vendor product sales", description: "Item value of non-cancelled vendor orders (excludes delivery charges)" },
  { key: "vendor_delivery_charges", group: "Vendor sales", label: "Delivery charges collected", description: "Delivery charges on non-cancelled vendor orders" },
  { key: "customer_paid_total", group: "Vendor sales", label: "Customer payments", description: "Total customers paid on vendor orders" },
  { key: "cancelled_orders_value", group: "Vendor sales", label: "Cancelled orders value", description: "Item value of cancelled orders" },
  { key: "admin_commission_earned", group: "Admin income", label: "Admin commission earned", description: "Commission due to admin from all vendors" },
  { key: "admin_commission_received", group: "Admin income", label: "Admin commission received", description: "Commission payments recorded from vendors" },
  { key: "admin_pos_sales", group: "Admin income", label: "Admin POS / counter sales", description: "Completed admin billing invoices (no vendor attached)" },
  { key: "admin_pos_gst_collected", group: "Admin income", label: "GST billed on admin POS", description: "GST recorded on admin billing invoices" },
  { key: "vendor_pos_sales", group: "Vendor sales", label: "Vendor POS / counter sales", description: "Completed billing invoices raised for vendors" },
  { key: "farmer_procurement", group: "Costs", label: "Farmer procurement", description: "Graded farmer purchase value" },
  { key: "vendor_expenses", group: "Costs", label: "Vendor expenses", description: "Expenses recorded by vendors" },
  { key: "delivery_expenses", group: "Costs", label: "Dark store / delivery expenses", description: "Expenses recorded by dark stores" },
];
const METRIC_KEYS = new Set(METRICS.map((m) => m.key));

export function periodFilter(period = {}) {
  const preset = String(period.preset || "month");
  return preset === "custom"
    ? buildIstDateFilter(null, period.startDate, period.endDate)
    : buildIstDateFilter(preset === "all" ? null : preset);
}

/** Platform amounts for one period that tax lines can use as their base. */
export async function getPlatformTaxFigures(dateFilter = null) {
  const invoiceMatch = { status: "completed", ...(dateFilter ? { createdAt: dateFilter } : {}) };
  const [{ vendors, totals }, posAgg, taxRates] = await Promise.all([
    calculateAllVendorsCommission(dateFilter),
    OmniInvoice.aggregate([
      { $match: invoiceMatch },
      {
        $group: {
          _id: { $cond: [{ $gt: [{ $ifNull: ["$vendorId", ""] }, ""] }, "vendor", "admin"] },
          sales: { $sum: "$grandTotal" },
          gst: { $sum: "$gstTax" },
          invoices: { $sum: 1 },
        },
      },
    ]),
    FinanceTaxRate.find({ status: "active" }).select("name rate type zone agency").sort({ rate: 1 }).lean(),
  ]);
  const pos = Object.fromEntries(posAgg.map((row) => [row._id, row]));

  const figures = {
    vendor_total_sale: round2(totals.totalSale),
    vendor_product_sales: round2(totals.totalGrossProductSales),
    vendor_delivery_charges: round2(totals.totalDeliveryCharges),
    customer_paid_total: round2(totals.totalCustomerPaid),
    cancelled_orders_value: round2(totals.totalCancelledCost),
    admin_commission_earned: round2(totals.totalAdminCommission),
    admin_commission_received: round2(totals.totalCommissionReceived),
    admin_pos_sales: round2(pos.admin?.sales),
    admin_pos_gst_collected: round2(pos.admin?.gst),
    vendor_pos_sales: round2(pos.vendor?.sales),
    farmer_procurement: round2(totals.totalFarmerProcurement),
    vendor_expenses: round2(totals.totalVendorExpenses),
    delivery_expenses: round2(totals.totalDeliveryExpenses),
  };

  return {
    figures,
    metrics: METRICS.map((m) => ({ ...m, amount: figures[m.key] })),
    vendorSales: vendors
      .map((v) => ({
        vendorId: v.vendor.id,
        vendorName: v.vendor.name,
        orders: v.totalOrders || 0,
        sales: round2(v.totalSale),
      }))
      .filter((v) => v.sales > 0 || v.orders > 0)
      .sort((a, b) => b.sales - a.sales),
    counts: {
      orders: totals.totalOrders || 0,
      adminInvoices: pos.admin?.invoices || 0,
      vendorInvoices: pos.vendor?.invoices || 0,
    },
    taxRates: taxRates.map((r) => ({
      id: String(r._id),
      name: r.name,
      rate: r.rate,
      type: r.type === "fixed" ? "fixed" : "percent",
      zone: r.zone,
      agency: r.agency,
    })),
  };
}

/** Validate lines and compute every tax amount + totals from the platform figures. */
export function computeTaxSheet(rawLines = [], figures = {}) {
  if (!Array.isArray(rawLines)) return { error: "Lines must be a list" };
  if (rawLines.length > MAX_LINES) return { error: `At most ${MAX_LINES} tax lines` };

  const lines = [];
  for (let i = 0; i < rawLines.length; i += 1) {
    const raw = rawLines[i] || {};
    const kind = KINDS.includes(raw.kind) ? raw.kind : "custom";
    const label = String(raw.label || "").trim();
    if (!label) return { error: `Line ${i + 1}: tax name is required` };

    // Vendor sale is always the platform's total vendor sale and always adds tax.
    const baseSource = kind === "vendor_sale"
      ? "vendor_total_sale"
      : METRIC_KEYS.has(raw.baseSource) ? raw.baseSource : "manual";
    const effect = kind === "custom" && raw.effect === "deduct" ? "deduct" : "add";
    const method = raw.method === "fixed" ? "fixed" : "percent";
    const basis = raw.basis === "inclusive" ? "inclusive" : "exclusive";
    const rate = Number(raw.rate);
    if (!Number.isFinite(rate) || rate < 0) return { error: `${label}: rate/amount must be 0 or more` };
    if (method === "percent" && rate > 100) return { error: `${label}: rate cannot exceed 100%` };

    const baseAmount = baseSource === "manual" ? Number(raw.baseAmount) : Number(figures[baseSource] || 0);
    if (method === "percent" && (!Number.isFinite(baseAmount) || baseAmount < 0)) {
      return { error: `${label}: amount must be 0 or more` };
    }

    let taxAmount;
    if (method === "fixed") taxAmount = rate;
    else if (basis === "inclusive") taxAmount = rate > 0 ? (baseAmount * rate) / (100 + rate) : 0;
    else taxAmount = (baseAmount * rate) / 100;

    lines.push({
      kind,
      label,
      effect,
      baseSource,
      baseAmount: round2(Number.isFinite(baseAmount) ? baseAmount : 0),
      method,
      basis,
      rate: round2(rate),
      taxAmount: round2(taxAmount),
      note: String(raw.note || "").trim().slice(0, 300),
    });
  }

  const sum = (pred) => round2(lines.filter(pred).reduce((s, l) => s + l.taxAmount, 0));
  const taxOnVendorSales = sum((l) => l.kind === "vendor_sale");
  const taxOnAdminSales = sum((l) => l.kind === "admin_sale");
  const additionalTaxes = sum((l) => l.kind === "custom" && l.effect === "add");
  const deductions = sum((l) => l.effect === "deduct");
  const grossTax = round2(taxOnVendorSales + taxOnAdminSales + additionalTaxes);
  const taxableSales = round2(
    lines.filter((l) => l.kind !== "custom" && l.method === "percent").reduce((s, l) => s + l.baseAmount, 0)
  );
  const netTaxPayable = round2(grossTax - deductions);

  return {
    lines,
    totals: {
      taxOnVendorSales,
      taxOnAdminSales,
      additionalTaxes,
      deductions,
      grossTax,
      netTaxPayable,
      taxableSales,
      effectiveRate: taxableSales > 0 ? round2((netTaxPayable / taxableSales) * 100) : 0,
    },
  };
}

const userId = (req) => String(req.user?._id || req.user?.id || "");

function cleanPeriod(raw = {}) {
  const preset = ["all", "today", "week", "month", "year", "custom"].includes(raw.preset) ? raw.preset : "month";
  const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : "");
  return { preset, startDate: preset === "custom" ? date(raw.startDate) : "", endDate: preset === "custom" ? date(raw.endDate) : "" };
}

async function buildSheet(body = {}) {
  const period = cleanPeriod(body.period || body);
  if (period.preset === "custom" && !period.startDate && !period.endDate) {
    return { error: "Choose a start or end date for a custom period" };
  }
  const platform = await getPlatformTaxFigures(periodFilter(period));
  const computed = computeTaxSheet(body.lines, platform.figures);
  if (computed.error) return { error: computed.error };
  return { period, platform, ...computed };
}

// ---------- controllers ----------

/** GET /api/admin/finance/tax/figures?preset=&startDate=&endDate= */
export async function getTaxFigures(req, res) {
  try {
    const period = cleanPeriod(req.query);
    const data = await getPlatformTaxFigures(periodFilter(period));
    return res.json({ success: true, period, ...data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to load platform figures" });
  }
}

/** POST /api/admin/finance/tax/preview { period, lines } — compute without saving. */
export async function previewTaxSheet(req, res) {
  try {
    const sheet = await buildSheet(req.body);
    if (sheet.error) return res.status(400).json({ success: false, message: sheet.error });
    return res.json({ success: true, period: sheet.period, lines: sheet.lines, totals: sheet.totals, figures: sheet.platform.figures });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to calculate tax" });
  }
}

/** GET /api/admin/finance/tax/calculations */
export async function listTaxCalculations(_req, res) {
  try {
    const rows = await TaxCalculation.find({})
      .select("title period totals status notes createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to load saved calculations" });
  }
}

/** GET /api/admin/finance/tax/calculations/:id */
export async function getTaxCalculation(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: "Calculation not found" });
    const row = await TaxCalculation.findById(req.params.id).lean();
    if (!row) return res.status(404).json({ success: false, message: "Calculation not found" });
    return res.json({ success: true, data: row });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to load calculation" });
  }
}

/** POST /api/admin/finance/tax/calculations { title, period, lines, notes, status } */
export async function createTaxCalculation(req, res) {
  try {
    const title = String(req.body.title || "").trim();
    if (!title) return res.status(400).json({ success: false, message: "Give this calculation a name" });
    const sheet = await buildSheet(req.body);
    if (sheet.error) return res.status(400).json({ success: false, message: sheet.error });
    const row = await TaxCalculation.create({
      title,
      period: sheet.period,
      lines: sheet.lines,
      totals: sheet.totals,
      figuresSnapshot: sheet.platform.figures,
      notes: String(req.body.notes || "").trim(),
      status: req.body.status === "final" ? "final" : "draft",
      createdBy: userId(req),
      updatedBy: userId(req),
    });
    return res.status(201).json({ success: true, message: "Tax calculation saved", data: row });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to save calculation" });
  }
}

/** PUT /api/admin/finance/tax/calculations/:id — final sheets must be reopened (status: "draft") first. */
export async function updateTaxCalculation(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: "Calculation not found" });
    const row = await TaxCalculation.findById(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: "Calculation not found" });

    const reopening = row.status === "final" && req.body.status === "draft";
    if (row.status === "final" && !reopening) {
      return res.status(409).json({ success: false, message: "This calculation is final. Reopen it as a draft to edit." });
    }
    if (reopening && !Array.isArray(req.body.lines)) {
      row.status = "draft";
      row.updatedBy = userId(req);
      await row.save();
      return res.json({ success: true, message: "Calculation reopened as draft", data: row });
    }

    const sheet = await buildSheet({ period: req.body.period || row.period, lines: req.body.lines ?? row.lines });
    if (sheet.error) return res.status(400).json({ success: false, message: sheet.error });
    if (req.body.title !== undefined) {
      const title = String(req.body.title || "").trim();
      if (!title) return res.status(400).json({ success: false, message: "Give this calculation a name" });
      row.title = title;
    }
    row.period = sheet.period;
    row.lines = sheet.lines;
    row.totals = sheet.totals;
    row.figuresSnapshot = sheet.platform.figures;
    if (req.body.notes !== undefined) row.notes = String(req.body.notes || "").trim();
    row.status = req.body.status === "final" ? "final" : "draft";
    row.updatedBy = userId(req);
    await row.save();
    return res.json({ success: true, message: "Tax calculation updated", data: row });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to update calculation" });
  }
}

/** DELETE /api/admin/finance/tax/calculations/:id — only drafts can be deleted. */
export async function deleteTaxCalculation(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: "Calculation not found" });
    const row = await TaxCalculation.findById(req.params.id).select("status");
    if (!row) return res.status(404).json({ success: false, message: "Calculation not found" });
    if (row.status === "final") {
      return res.status(409).json({ success: false, message: "Final calculations cannot be deleted. Reopen it as a draft first." });
    }
    await TaxCalculation.deleteOne({ _id: row._id });
    return res.json({ success: true, message: "Calculation deleted" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to delete calculation" });
  }
}

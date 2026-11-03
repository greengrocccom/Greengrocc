import {
  FinanceEstimation,
  FinanceTaxRate,
  FinanceTaxZone,
  FinanceTaxCategory,
  FinanceTaxAgency,
  FinanceTaxPayment,
  FinanceExpense,
  FinancePurchase,
  FinanceAccount,
  FinanceJournal,
  FinanceContact,
  FinanceTransfer,
} from "./financeModels.js";

const ok = (res, data, extra = {}) => res.json({ success: true, data, ...extra });
const fail = (res, status, message) => res.status(status).json({ success: false, message });

// Preloaded standard chart of accounts (initial zero balances; driven strictly by journal entries)
const PRELOADED_ACCOUNTS = [
  { code: "1010", name: "Cash on Hand", type: "asset", subType: "current", balance: 0, isPreloaded: true, description: "Physical cash in register and vault" },
  { code: "1020", name: "Operating Bank Account", type: "asset", subType: "current", balance: 0, isPreloaded: true, description: "Primary commercial checking account" },
  { code: "1030", name: "Accounts Receivable", type: "asset", subType: "current", balance: 0, isPreloaded: true, description: "Amounts due from B2B buyers and clients" },
  { code: "1040", name: "Produce & Grocery Inventory", type: "asset", subType: "current", balance: 0, isPreloaded: true, description: "Fresh produce and cold storage stock" },
  { code: "1510", name: "Cold Storage & Packhouse Equipment", type: "asset", subType: "fixed", balance: 0, isPreloaded: true, description: "Chilling plants, crates, and weighing scales" },
  { code: "2010", name: "Accounts Payable", type: "liability", subType: "current", balance: 0, isPreloaded: true, description: "Amounts owed to farmers and suppliers" },
  { code: "2020", name: "GST / Sales Tax Payable", type: "liability", subType: "current", balance: 0, isPreloaded: true, description: "Collected tax to be remitted to government" },
  { code: "2030", name: "Salaries & Payroll Payable", type: "liability", subType: "current", balance: 0, isPreloaded: true, description: "Staff wages due for disbursement" },
  { code: "3010", name: "Owner's Equity & Capital", type: "equity", subType: "equity", balance: 0, isPreloaded: true, description: "Initial and retained capital investment" },
  { code: "3020", name: "Retained Earnings", type: "equity", subType: "equity", balance: 0, isPreloaded: true, description: "Accumulated net earnings" },
  { code: "4010", name: "B2B Bulk Commercial Sales", type: "revenue", subType: "operating", balance: 0, isPreloaded: true, description: "Sales to hotels, supermarkets, and catering" },
  { code: "4020", name: "Retail Store & App Sales", type: "revenue", subType: "operating", balance: 0, isPreloaded: true, description: "Direct retail produce sales" },
  { code: "4030", name: "Delivery & Logistics Income", type: "revenue", subType: "other", balance: 0, isPreloaded: true, description: "Delivery fees and handling revenue" },
  { code: "5010", name: "Cost of Goods Sold (Farm Procurement)", type: "expense", subType: "cogs", balance: 0, isPreloaded: true, description: "Direct procurement cost paid to farmers" },
  { code: "5020", name: "Cold Chain Logistics & Fuel", type: "expense", subType: "operating", balance: 0, isPreloaded: true, description: "Reefer transport and delivery fleet fuel" },
  { code: "5030", name: "Packaging & Crate Materials", type: "expense", subType: "operating", balance: 0, isPreloaded: true, description: "Biodegradable bags and sorting crates" },
  { code: "5040", name: "Staff Salaries & Field Compensation", type: "expense", subType: "operating", balance: 0, isPreloaded: true, description: "Warehouse and management payroll" },
  { code: "5050", name: "Facility Rent & Utilities", type: "expense", subType: "operating", balance: 0, isPreloaded: true, description: "Darkstore electricity, water, and rent" },
];

const PRELOADED_TAX_ZONES = [
  { name: "North Zone (Delhi, Haryana, Punjab)", code: "ZONE-NORTH", regions: ["Delhi", "Haryana", "Punjab", "Chandigarh"], defaultRate: 18, status: "active", description: "Northern states tax branch" },
  { name: "South Zone (Karnataka, TN, Kerala)", code: "ZONE-SOUTH", regions: ["Karnataka", "Tamil Nadu", "Kerala", "Telangana"], defaultRate: 18, status: "active", description: "Southern states distribution" },
  { name: "West Zone (Maharashtra, Gujarat)", code: "ZONE-WEST", regions: ["Maharashtra", "Gujarat", "Goa"], defaultRate: 18, status: "active", description: "Western industrial belt" },
  { name: "Export & Special Economic Zone", code: "ZONE-SEZ", regions: ["SEZ", "Customs Bonded Area"], defaultRate: 0, status: "active", description: "Zero-rated export zone" },
];

const PRELOADED_TAX_CATEGORIES = [
  { name: "Fresh Produce & Raw Vegetables", code: "TC-RAW-PRODUCE", standardRate: 0, taxType: "GST Exempt", description: "Unprocessed organic agricultural produce" },
  { name: "Packaged Organic & Processed Food", code: "TC-PACKAGED-FOOD", standardRate: 5, taxType: "GST 5%", description: "Branded staples, honey, and pulses" },
  { name: "Standard Commercial Goods", code: "TC-STD-GOODS", standardRate: 18, taxType: "GST 18%", description: "Equipment, storage bins, and merchandise" },
  { name: "Logistics & Cold Storage Services", code: "TC-LOGISTICS-SVC", standardRate: 18, taxType: "GST Services", description: "Freight transport and cooling rental" },
];

const PRELOADED_TAX_RATES = [
  { name: "GST 0% (Exempt Produce)", rate: 0, type: "percentage", zone: "All Zones", agency: "CBIC", status: "active", description: "Fresh greens and grains" },
  { name: "GST 5% (Staples & Essentials)", rate: 5, type: "percentage", zone: "All Zones", agency: "CBIC", status: "active", description: "Packaged organic grains" },
  { name: "GST 12% (Processed Goods)", rate: 12, type: "percentage", zone: "All Zones", agency: "CBIC", status: "active", description: "Dried fruits and processed juices" },
  { name: "GST 18% (Standard Rate)", rate: 18, type: "percentage", zone: "All Zones", agency: "CBIC", status: "active", description: "Standard commercial rate" },
  { name: "IGST 18% (Inter-State)", rate: 18, type: "percentage", zone: "All Zones", agency: "CBIC", status: "active", description: "Cross-border interstate trade" },
  { name: "State VAT 5%", rate: 5, type: "percentage", zone: "West Zone (Maharashtra, Gujarat)", agency: "State Sales Tax Department", status: "active", description: "Regional state sales tax" },
];

const PRELOADED_TAX_AGENCIES = [
  { name: "Central Board of Indirect Taxes & Customs (CBIC)", registrationNumber: "GSTIN-CENTRAL-01", jurisdiction: "National", filingFrequency: "monthly", contactEmail: "cbic-portal@gov.in", contactPhone: "1800-1200-232", status: "active" },
  { name: "State GST Department (Maharashtra)", registrationNumber: "SGST-MH-4421", jurisdiction: "State", filingFrequency: "monthly", contactEmail: "sgst-mh@gov.in", contactPhone: "022-2659-1000", status: "active" },
  { name: "Income Tax Department (TDS Wing)", registrationNumber: "TAN-MUM-89211", jurisdiction: "National", filingFrequency: "quarterly", contactEmail: "tds-clearing@incometax.gov.in", contactPhone: "1800-180-1961", status: "active" },
];

export async function ensureFinanceSeeds() {
  try {
    const accCount = await FinanceAccount.countDocuments();
    if (accCount === 0) {
      await FinanceAccount.insertMany(PRELOADED_ACCOUNTS);
    }
    const zoneCount = await FinanceTaxZone.countDocuments();
    if (zoneCount === 0) {
      await FinanceTaxZone.insertMany(PRELOADED_TAX_ZONES);
    }
    const catCount = await FinanceTaxCategory.countDocuments();
    if (catCount === 0) {
      await FinanceTaxCategory.insertMany(PRELOADED_TAX_CATEGORIES);
    }
    const rateCount = await FinanceTaxRate.countDocuments();
    if (rateCount === 0) {
      await FinanceTaxRate.insertMany(PRELOADED_TAX_RATES);
    }
    const agencyCount = await FinanceTaxAgency.countDocuments();
    if (agencyCount === 0) {
      await FinanceTaxAgency.insertMany(PRELOADED_TAX_AGENCIES);
    }
    await syncAccountBalancesFromJournals();
  } catch (err) {
    console.warn("Failed to seed finance defaults:", err.message);
  }
}

export async function syncAccountBalancesFromJournals() {
  try {
    const accounts = await FinanceAccount.find({});
    const journals = await FinanceJournal.find({ status: "posted" }).lean();

    const balanceMap = {};
    for (const acc of accounts) {
      balanceMap[acc.code] = 0;
    }

    for (const j of journals) {
      for (const entry of j.entries || []) {
        const isDebit = entry.type === "debit";
        const amt = Number(entry.amount) || 0;
        const acc = accounts.find((a) => a.code === entry.accountCode);
        if (!acc) continue;
        if (["asset", "expense"].includes(acc.type)) {
          balanceMap[acc.code] = (balanceMap[acc.code] || 0) + (isDebit ? amt : -amt);
        } else {
          balanceMap[acc.code] = (balanceMap[acc.code] || 0) + (isDebit ? -amt : amt);
        }
      }
    }

    for (const acc of accounts) {
      const calcBal = balanceMap[acc.code] || 0;
      if (acc.balance !== calcBal) {
        acc.balance = calcBal;
        await acc.save();
      }
    }
  } catch (e) {
    console.warn("syncAccountBalancesFromJournals error:", e.message);
  }
}

// -------------------------------------------------------------
// 1. ESTIMATIONS & QUOTES
// -------------------------------------------------------------
export async function listEstimations(req, res) {
  try {
    const filter = {};
    if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
    if (req.query.search) {
      filter.$or = [
        { estimateNumber: { $regex: req.query.search, $options: "i" } },
        { customerName: { $regex: req.query.search, $options: "i" } },
        { company: { $regex: req.query.search, $options: "i" } },
      ];
    }
    const rows = await FinanceEstimation.find(filter).sort({ createdAt: -1 }).lean();
    return ok(res, rows);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function createEstimation(req, res) {
  try {
    const count = await FinanceEstimation.countDocuments();
    const estimateNumber = req.body.estimateNumber?.trim() || `EST-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
    const taxTotal = items.reduce((sum, item) => sum + (Number(item.taxAmount) || 0), 0);
    const discount = Number(req.body.discount) || 0;
    const grandTotal = Math.max(0, subtotal + taxTotal - discount);

    const doc = await FinanceEstimation.create({
      ...req.body,
      estimateNumber,
      subtotal,
      taxTotal,
      discount,
      grandTotal,
    });
    return ok(res, doc);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function updateEstimation(req, res) {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    let extra = {};
    if (items.length > 0) {
      const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
      const taxTotal = items.reduce((sum, item) => sum + (Number(item.taxAmount) || 0), 0);
      const discount = Number(req.body.discount) || 0;
      extra = { subtotal, taxTotal, discount, grandTotal: Math.max(0, subtotal + taxTotal - discount) };
    }
    const doc = await FinanceEstimation.findByIdAndUpdate(req.params.id, { ...req.body, ...extra }, { returnDocument: 'after' });
    if (!doc) return fail(res, 404, "Estimation not found");
    return ok(res, doc);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function deleteEstimation(req, res) {
  try {
    const doc = await FinanceEstimation.findByIdAndDelete(req.params.id);
    if (!doc) return fail(res, 404, "Estimation not found");
    return ok(res, { message: "Estimation deleted" });
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// -------------------------------------------------------------
// 2. TAX SUITE (Rates, Zones, Categories, Agencies, Payments)
// -------------------------------------------------------------
export async function listTaxRates(req, res) {
  try {
    await ensureFinanceSeeds();
    const rows = await FinanceTaxRate.find({}).sort({ rate: 1 }).lean();
    return ok(res, rows);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function createTaxRate(req, res) {
  try {
    const doc = await FinanceTaxRate.create(req.body);
    return ok(res, doc);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function updateTaxRate(req, res) {
  try {
    const doc = await FinanceTaxRate.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
    return ok(res, doc);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function deleteTaxRate(req, res) {
  try {
    await FinanceTaxRate.findByIdAndDelete(req.params.id);
    return ok(res, { message: "Tax rate deleted" });
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function listTaxZones(req, res) {
  try {
    await ensureFinanceSeeds();
    const rows = await FinanceTaxZone.find({}).sort({ name: 1 }).lean();
    return ok(res, rows);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function createTaxZone(req, res) {
  try {
    const doc = await FinanceTaxZone.create(req.body);
    return ok(res, doc);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function updateTaxZone(req, res) {
  try {
    const doc = await FinanceTaxZone.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
    return ok(res, doc);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function deleteTaxZone(req, res) {
  try {
    await FinanceTaxZone.findByIdAndDelete(req.params.id);
    return ok(res, { message: "Tax zone deleted" });
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function listTaxCategories(req, res) {
  try {
    await ensureFinanceSeeds();
    const rows = await FinanceTaxCategory.find({}).sort({ name: 1 }).lean();
    return ok(res, rows);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function createTaxCategory(req, res) {
  try {
    const doc = await FinanceTaxCategory.create(req.body);
    return ok(res, doc);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function updateTaxCategory(req, res) {
  try {
    const doc = await FinanceTaxCategory.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
    return ok(res, doc);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function deleteTaxCategory(req, res) {
  try {
    await FinanceTaxCategory.findByIdAndDelete(req.params.id);
    return ok(res, { message: "Tax category deleted" });
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function listTaxAgencies(req, res) {
  try {
    await ensureFinanceSeeds();
    const rows = await FinanceTaxAgency.find({}).sort({ name: 1 }).lean();
    return ok(res, rows);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function createTaxAgency(req, res) {
  try {
    const doc = await FinanceTaxAgency.create(req.body);
    return ok(res, doc);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function updateTaxAgency(req, res) {
  try {
    const doc = await FinanceTaxAgency.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
    return ok(res, doc);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function deleteTaxAgency(req, res) {
  try {
    await FinanceTaxAgency.findByIdAndDelete(req.params.id);
    return ok(res, { message: "Tax agency deleted" });
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function listTaxPayments(req, res) {
  try {
    const rows = await FinanceTaxPayment.find({}).sort({ paymentDate: -1 }).lean();
    return ok(res, rows);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function createTaxPayment(req, res) {
  try {
    const count = await FinanceTaxPayment.countDocuments();
    const paymentNumber = req.body.paymentNumber?.trim() || `TXP-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
    const doc = await FinanceTaxPayment.create({ ...req.body, paymentNumber });
    return ok(res, doc);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function deleteTaxPayment(req, res) {
  try {
    await FinanceTaxPayment.findByIdAndDelete(req.params.id);
    return ok(res, { message: "Tax payment deleted" });
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// -------------------------------------------------------------
// 3. EXPENSE & PURCHASE TRANSACTIONS
// -------------------------------------------------------------
export async function listExpenses(req, res) {
  try {
    const filter = {};
    if (req.query.paymentType && req.query.paymentType !== "all") filter.paymentType = req.query.paymentType;
    if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
    const rows = await FinanceExpense.find(filter).sort({ date: -1 }).lean();

    const stats = {
      totalAmount: rows.reduce((s, r) => s + (Number(r.amount) || 0), 0),
      cashCount: rows.filter((r) => r.paymentType === "cash").length,
      creditCount: rows.filter((r) => r.paymentType === "credit").length,
      installmentCount: rows.filter((r) => r.paymentType === "installment").length,
    };
    return ok(res, rows, { stats });
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function createExpense(req, res) {
  try {
    const title = req.body.title?.trim();
    if (!title) return fail(res, 400, "Expense title is required");

    const year = new Date().getFullYear();
    let seq = (await FinanceExpense.countDocuments()) + 1;
    let expenseNumber = req.body.expenseNumber?.trim() || `EXP-${year}-${String(seq).padStart(4, "0")}`;
    while (await FinanceExpense.exists({ expenseNumber })) {
      seq += 1;
      expenseNumber = `EXP-${year}-${String(seq).padStart(4, "0")}`;
    }

    const amount = Math.max(0, Number(req.body.amount) || 0);
    const taxAmount = Math.max(0, Number(req.body.taxAmount) || 0);
    const date = req.body.date && !isNaN(new Date(req.body.date).getTime()) ? new Date(req.body.date) : new Date();

    const doc = await FinanceExpense.create({
      ...req.body,
      title,
      expenseNumber,
      amount,
      taxAmount,
      date,
    });
    return ok(res, doc);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function updateExpense(req, res) {
  try {
    const doc = await FinanceExpense.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
    return ok(res, doc);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function deleteExpense(req, res) {
  try {
    await FinanceExpense.findByIdAndDelete(req.params.id);
    return ok(res, { message: "Expense deleted" });
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function listPurchases(req, res) {
  try {
    const rows = await FinancePurchase.find({}).sort({ purchaseDate: -1 }).lean();
    const summary = {
      totalPurchases: rows.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0),
      totalPaid: rows.reduce((s, r) => s + (Number(r.amountPaid) || 0), 0),
      totalBalanceDue: rows.reduce((s, r) => s + (Number(r.balanceDue) || 0), 0),
      counts: {
        paid: rows.filter((r) => r.status === "paid").length,
        partial: rows.filter((r) => r.status === "partial").length,
        outstanding: rows.filter((r) => r.status === "outstanding").length,
        overdue: rows.filter((r) => r.status === "overdue").length,
      },
      diagramData: [
        { name: "Paid In Full", value: rows.filter((r) => r.status === "paid").reduce((s, r) => s + (Number(r.amountPaid) || 0), 0), count: rows.filter((r) => r.status === "paid").length, color: "#10b981" },
        { name: "Partial Paid", value: rows.filter((r) => r.status === "partial").reduce((s, r) => s + (Number(r.amountPaid) || 0), 0), count: rows.filter((r) => r.status === "partial").length, color: "#3b82f6" },
        { name: "Outstanding", value: rows.filter((r) => r.status === "outstanding").reduce((s, r) => s + (Number(r.balanceDue) || 0), 0), count: rows.filter((r) => r.status === "outstanding").length, color: "#f59e0b" },
        { name: "Overdue", value: rows.filter((r) => r.status === "overdue").reduce((s, r) => s + (Number(r.balanceDue) || 0), 0), count: rows.filter((r) => r.status === "overdue").length, color: "#ef4444" },
      ],
    };
    return ok(res, rows, { summary });
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function createPurchase(req, res) {
  try {
    const vendorName = req.body.vendorName?.trim();
    if (!vendorName) {
      return fail(res, 400, "Vendor / Farmer Name is required");
    }

    const year = new Date().getFullYear();
    let seq = (await FinancePurchase.countDocuments()) + 1;
    let purchaseNumber = req.body.purchaseNumber?.trim() || `PO-${year}-${String(seq).padStart(4, "0")}`;
    while (await FinancePurchase.exists({ purchaseNumber })) {
      seq += 1;
      purchaseNumber = `PO-${year}-${String(seq).padStart(4, "0")}`;
    }

    const totalAmount = Math.max(0, Number(req.body.totalAmount) || 0);
    const amountPaid = Math.max(0, Number(req.body.amountPaid) || 0);
    const balanceDue = Math.max(0, totalAmount - amountPaid);

    let status = req.body.status || "outstanding";
    if (amountPaid >= totalAmount && totalAmount > 0) status = "paid";
    else if (amountPaid > 0 && amountPaid < totalAmount) status = "partial";

    const dueDate = req.body.dueDate && !isNaN(new Date(req.body.dueDate).getTime())
      ? new Date(req.body.dueDate)
      : null;

    const purchaseDate = req.body.purchaseDate && !isNaN(new Date(req.body.purchaseDate).getTime())
      ? new Date(req.body.purchaseDate)
      : new Date();

    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    const items = rawItems
      .filter((it) => it && it.name && it.name.trim())
      .map((it) => ({
        name: it.name.trim(),
        quantity: Math.max(1, Number(it.quantity) || 1),
        unitCost: Math.max(0, Number(it.unitCost) || 0),
        total: (Math.max(1, Number(it.quantity) || 1)) * (Math.max(0, Number(it.unitCost) || 0)),
      }));

    const doc = await FinancePurchase.create({
      ...req.body,
      vendorName,
      purchaseNumber,
      totalAmount,
      amountPaid,
      balanceDue,
      status,
      dueDate,
      purchaseDate,
      items,
    });
    return ok(res, doc);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function updatePurchase(req, res) {
  try {
    const updateData = { ...req.body };
    if ("totalAmount" in req.body || "amountPaid" in req.body) {
      const existing = await FinancePurchase.findById(req.params.id);
      if (!existing) return fail(res, 404, "Purchase not found");
      const totalAmount = "totalAmount" in req.body ? Math.max(0, Number(req.body.totalAmount) || 0) : existing.totalAmount;
      const amountPaid = "amountPaid" in req.body ? Math.max(0, Number(req.body.amountPaid) || 0) : existing.amountPaid;
      const balanceDue = Math.max(0, totalAmount - amountPaid);
      let status = req.body.status || existing.status;
      if (amountPaid >= totalAmount && totalAmount > 0) status = "paid";
      else if (amountPaid > 0 && amountPaid < totalAmount) status = "partial";
      updateData.totalAmount = totalAmount;
      updateData.amountPaid = amountPaid;
      updateData.balanceDue = balanceDue;
      updateData.status = status;
    }
    if ("dueDate" in req.body) {
      updateData.dueDate = req.body.dueDate && !isNaN(new Date(req.body.dueDate).getTime()) ? new Date(req.body.dueDate) : null;
    }
    if ("items" in req.body && Array.isArray(req.body.items)) {
      updateData.items = req.body.items
        .filter((it) => it && it.name && it.name.trim())
        .map((it) => ({
          name: it.name.trim(),
          quantity: Math.max(1, Number(it.quantity) || 1),
          unitCost: Math.max(0, Number(it.unitCost) || 0),
          total: (Math.max(1, Number(it.quantity) || 1)) * (Math.max(0, Number(it.unitCost) || 0)),
        }));
    }
    const doc = await FinancePurchase.findByIdAndUpdate(
      req.params.id,
      updateData,
      { returnDocument: 'after' }
    );
    return ok(res, doc);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function deletePurchase(req, res) {
  try {
    await FinancePurchase.findByIdAndDelete(req.params.id);
    return ok(res, { message: "Purchase deleted" });
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// -------------------------------------------------------------
// 4. CHART OF ACCOUNTS & DOUBLE-ENTRY JOURNALS
// -------------------------------------------------------------
export async function listAccounts(req, res) {
  try {
    await ensureFinanceSeeds();
    const rows = await FinanceAccount.find({ status: "active" }).sort({ code: 1 }).lean();
    return ok(res, rows);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function createAccount(req, res) {
  try {
    const doc = await FinanceAccount.create(req.body);
    return ok(res, doc);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function updateAccount(req, res) {
  try {
    const doc = await FinanceAccount.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
    return ok(res, doc);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function listJournals(req, res) {
  try {
    const rows = await FinanceJournal.find({}).sort({ date: -1, createdAt: -1 }).lean();
    return ok(res, rows);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function createJournal(req, res) {
  try {
    const entries = Array.isArray(req.body.entries) ? req.body.entries : [];
    if (entries.length < 2) {
      return fail(res, 400, "Double-entry journal requires at least one Debit and one Credit line entry");
    }

    const totalDebit = entries
      .filter((e) => e.type === "debit")
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalCredit = entries
      .filter((e) => e.type === "credit")
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const diff = Math.abs(totalDebit - totalCredit);
    if (diff > 0.01) {
      return fail(
        res,
        400,
        `Journal entry is out of balance! Total Debits (₹${totalDebit.toFixed(2)}) must exactly equal Total Credits (₹${totalCredit.toFixed(2)}). Discrepancy: ₹${diff.toFixed(2)}`
      );
    }

    const year = new Date().getFullYear();
    let seq = (await FinanceJournal.countDocuments()) + 1;
    let journalNumber = req.body.journalNumber?.trim() || `JRN-${year}-${String(seq).padStart(4, "0")}`;
    while (await FinanceJournal.exists({ journalNumber })) {
      seq += 1;
      journalNumber = `JRN-${year}-${String(seq).padStart(4, "0")}`;
    }

    const journal = await FinanceJournal.create({
      ...req.body,
      journalNumber,
      totalDebit,
      totalCredit,
      isBalanced: true,
      status: "posted",
    });

    // Update individual account balances
    for (const line of entries) {
      const isDebit = line.type === "debit";
      const amt = Number(line.amount) || 0;
      const acc = await FinanceAccount.findOne({ code: line.accountCode });
      if (acc) {
        // Normal balance: Asset & Expense increase with Debit. Liability, Equity, Revenue increase with Credit.
        if (["asset", "expense"].includes(acc.type)) {
          acc.balance += isDebit ? amt : -amt;
        } else {
          acc.balance += isDebit ? -amt : amt;
        }
        await acc.save();
      }
    }

    return ok(res, journal);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function deleteJournal(req, res) {
  try {
    const journal = await FinanceJournal.findById(req.params.id);
    if (!journal) return fail(res, 404, "Journal entry not found");

    // Revert account balances
    for (const line of journal.entries || []) {
      const isDebit = line.type === "debit";
      const amt = Number(line.amount) || 0;
      const acc = await FinanceAccount.findOne({ code: line.accountCode });
      if (acc) {
        if (["asset", "expense"].includes(acc.type)) {
          acc.balance -= isDebit ? amt : -amt;
        } else {
          acc.balance -= isDebit ? -amt : amt;
        }
        await acc.save();
      }
    }
    await FinanceJournal.findByIdAndDelete(req.params.id);
    return ok(res, { message: "Journal entry deleted and balances reversed" });
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// -------------------------------------------------------------
// 5. CUSTOMERS & VENDORS MASTER
// -------------------------------------------------------------
export async function listContacts(req, res) {
  try {
    const filter = {};
    if (req.query.type && req.query.type !== "all") filter.type = req.query.type;
    const rows = await FinanceContact.find(filter).sort({ name: 1 }).lean();
    return ok(res, rows);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function createContact(req, res) {
  try {
    const doc = await FinanceContact.create(req.body);
    return ok(res, doc);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function updateContact(req, res) {
  try {
    const doc = await FinanceContact.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
    return ok(res, doc);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function deleteContact(req, res) {
  try {
    await FinanceContact.findByIdAndDelete(req.params.id);
    return ok(res, { message: "Contact deleted" });
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// -------------------------------------------------------------
// 6. INTERNAL CASH TRANSFERS
// -------------------------------------------------------------
export async function listTransfers(req, res) {
  try {
    const rows = await FinanceTransfer.find({}).sort({ date: -1 }).lean();
    return ok(res, rows);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

export async function createTransfer(req, res) {
  try {
    const { fromAccountCode, toAccountCode, amount, transferFee = 0 } = req.body;
    if (!fromAccountCode || !toAccountCode || !amount) {
      return fail(res, 400, "Source account, destination account, and amount are required");
    }
    if (fromAccountCode === toAccountCode) {
      return fail(res, 400, "Source and destination account cannot be the same");
    }

    const count = await FinanceTransfer.countDocuments();
    const transferNumber = req.body.transferNumber?.trim() || `TRF-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const numAmount = Number(amount);
    const numFee = Number(transferFee) || 0;

    // Deduct from source and credit to destination
    const fromAcc = await FinanceAccount.findOne({ code: fromAccountCode });
    const toAcc = await FinanceAccount.findOne({ code: toAccountCode });

    if (!fromAcc || !toAcc) {
      return fail(res, 400, "Invalid bank or cash accounts selected");
    }

    fromAcc.balance -= (numAmount + numFee);
    toAcc.balance += numAmount;

    await Promise.all([fromAcc.save(), toAcc.save()]);

    const transfer = await FinanceTransfer.create({
      ...req.body,
      transferNumber,
      fromAccountName: fromAcc.name,
      toAccountName: toAcc.name,
      amount: numAmount,
      transferFee: numFee,
    });

    // Also auto-post double-entry journal for synchronization
    const jCount = await FinanceJournal.countDocuments();
    await FinanceJournal.create({
      journalNumber: `JRN-TRF-${String(jCount + 1).padStart(4, "0")}`,
      date: new Date(),
      reference: transferNumber,
      memo: `Internal Transfer from ${fromAcc.name} to ${toAcc.name}`,
      entries: [
        { accountCode: toAcc.code, accountName: toAcc.name, type: "debit", amount: numAmount, description: "Funds transferred in" },
        { accountCode: fromAcc.code, accountName: fromAcc.name, type: "credit", amount: numAmount, description: "Funds transferred out" },
      ],
      totalDebit: numAmount,
      totalCredit: numAmount,
      isBalanced: true,
      status: "posted",
      postedBy: "System (Internal Transfer)",
    });

    return ok(res, transfer);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// -------------------------------------------------------------
// 7. FINANCIAL STATEMENTS & REPORTS
// -------------------------------------------------------------

/**
 * 27. Ledger Reports: View transaction history and running balance for any account
 */
export async function getLedgerReport(req, res) {
  try {
    const { accountCode, startDate, endDate } = req.query;
    await ensureFinanceSeeds();

    const accounts = await FinanceAccount.find({ status: "active" }).sort({ code: 1 }).lean();
    const selectedCode = accountCode || accounts[0]?.code;
    const account = accounts.find((a) => a.code === selectedCode);

    if (!account) return fail(res, 404, "Account not found");

    const query = {
      status: "posted",
      "entries.accountCode": selectedCode,
    };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const journals = await FinanceJournal.find(query).sort({ date: 1, createdAt: 1 }).lean();

    let runningBalance = account.balance || 0;
    const isNormalDebit = ["asset", "expense"].includes(account.type);

    const movements = journals.map((j) => {
      const line = j.entries.find((e) => e.accountCode === selectedCode);
      const isDebit = line?.type === "debit";
      const amt = line?.amount || 0;

      if (isNormalDebit) {
        runningBalance += isDebit ? amt : -amt;
      } else {
        runningBalance += isDebit ? -amt : amt;
      }

      return {
        id: j._id,
        journalNumber: j.journalNumber,
        date: j.date,
        memo: j.memo,
        reference: j.reference,
        debit: isDebit ? amt : 0,
        credit: !isDebit ? amt : 0,
        runningBalance,
      };
    });

    return ok(res, {
      account,
      accounts: accounts.map((a) => ({ code: a.code, name: a.name, type: a.type, balance: a.balance })),
      movements,
      currentBalance: account.balance,
      totalDebits: movements.reduce((s, m) => s + m.debit, 0),
      totalCredits: movements.reduce((s, m) => s + m.credit, 0),
    });
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

/**
 * 28. Trial Balance: Mathematical verification that debits equal credits
 */
export async function getTrialBalance(req, res) {
  try {
    await ensureFinanceSeeds();
    const accounts = await FinanceAccount.find({ status: "active" }).sort({ code: 1 }).lean();

    const rows = accounts.map((acc) => {
      const bal = Number(acc.balance) || 0;
      const isDebitNature = ["asset", "expense"].includes(acc.type);
      return {
        code: acc.code,
        name: acc.name,
        type: acc.type,
        debit: isDebitNature ? Math.max(0, bal) : (bal < 0 ? Math.abs(bal) : 0),
        credit: !isDebitNature ? Math.max(0, bal) : (bal < 0 ? Math.abs(bal) : 0),
      };
    });

    const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    return ok(res, {
      rows,
      totalDebit,
      totalCredit,
      difference: Math.abs(totalDebit - totalCredit),
      isBalanced,
      verifiedAt: new Date(),
    });
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

/**
 * 29. Income Statement (Profit & Loss): Revenue - Expenses = Net Income
 */
export async function getIncomeStatement(req, res) {
  try {
    await ensureFinanceSeeds();
    const accounts = await FinanceAccount.find({
      type: { $in: ["revenue", "expense"] },
      status: "active",
    }).lean();

    const revenueAccounts = accounts.filter((a) => a.type === "revenue");
    const expenseAccounts = accounts.filter((a) => a.type === "expense");

    const totalRevenue = revenueAccounts.reduce((s, a) => s + Math.max(0, Number(a.balance) || 0), 0);
    const cogsTotal = expenseAccounts.filter((a) => a.subType === "cogs").reduce((s, a) => s + Math.max(0, Number(a.balance) || 0), 0);
    const grossProfit = totalRevenue - cogsTotal;

    const operatingExpenses = expenseAccounts.filter((a) => a.subType !== "cogs").reduce((s, a) => s + Math.max(0, Number(a.balance) || 0), 0);
    const totalExpenses = cogsTotal + operatingExpenses;
    const netIncome = totalRevenue - totalExpenses;

    return ok(res, {
      revenueAccounts,
      expenseAccounts,
      totalRevenue,
      cogsTotal,
      grossProfit,
      operatingExpenses,
      totalExpenses,
      netIncome,
      profitMargin: totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(1) : "0.0",
      period: `FY ${new Date().getFullYear()}`,
    });
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

/**
 * 30. Sales Tax Report: Output Tax collected vs Input Tax credit
 */
export async function getSalesTaxReport(req, res) {
  try {
    const [rates, agencies, payments, estimations, expenses, purchases] = await Promise.all([
      FinanceTaxRate.find({}).lean(),
      FinanceTaxAgency.find({}).lean(),
      FinanceTaxPayment.find({}).lean(),
      FinanceEstimation.find({ status: { $in: ["accepted", "converted"] } }).lean(),
      FinanceExpense.find({}).lean(),
      FinancePurchase.find({}).lean(),
    ]);

    // Output tax calculated from accepted client estimations
    let outputTax = 0;
    const rateTotals = {};
    for (const est of estimations) {
      outputTax += Number(est.taxTotal) || 0;
      for (const item of est.items || []) {
        const r = Number(item.taxRate) || 0;
        if (!rateTotals[r]) rateTotals[r] = { taxableAmount: 0, taxCollected: 0 };
        rateTotals[r].taxableAmount += (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
        rateTotals[r].taxCollected += Number(item.taxAmount) || 0;
      }
    }

    // Input tax credit calculated from actual expenses and purchases with tax
    let inputTaxCredit = 0;
    for (const exp of expenses) {
      inputTaxCredit += Number(exp.taxAmount) || 0;
    }
    for (const po of purchases) {
      for (const item of po.items || []) {
        if (item.taxAmount) inputTaxCredit += Number(item.taxAmount) || 0;
      }
    }

    const totalPaid = payments.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0);
    const netTaxPayable = Math.max(0, outputTax - inputTaxCredit - totalPaid);

    const breakdownByRate = rates.map((r) => {
      const found = rateTotals[r.rate] || { taxableAmount: 0, taxCollected: 0 };
      return {
        name: r.name,
        rate: r.rate,
        taxableAmount: found.taxableAmount,
        taxCollected: found.taxCollected,
      };
    });

    return ok(res, {
      outputTaxCollected: outputTax,
      inputTaxCredit,
      totalTaxPaidToAgencies: totalPaid,
      netTaxPayable,
      agencies,
      recentPayments: payments,
      breakdownByRate,
      filingStatus: netTaxPayable === 0 ? "Compliant / Nil Payable" : "Payment Due",
    });
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

/**
 * 31. Balance Sheet: Assets = Liabilities + Equity
 */
export async function getBalanceSheet(req, res) {
  try {
    await ensureFinanceSeeds();
    const accounts = await FinanceAccount.find({ status: "active" }).lean();

    const assets = accounts.filter((a) => a.type === "asset");
    const liabilities = accounts.filter((a) => a.type === "liability");
    const equityAccounts = accounts.filter((a) => a.type === "equity");

    const revenue = accounts.filter((a) => a.type === "revenue").reduce((s, a) => s + (Number(a.balance) || 0), 0);
    const expenses = accounts.filter((a) => a.type === "expense").reduce((s, a) => s + (Number(a.balance) || 0), 0);
    const currentPeriodNetIncome = revenue - expenses;

    const totalAssets = assets.reduce((s, a) => s + (Number(a.balance) || 0), 0);
    const totalLiabilities = liabilities.reduce((s, a) => s + (Number(a.balance) || 0), 0);
    const baseEquity = equityAccounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
    const totalEquity = baseEquity + currentPeriodNetIncome;

    const equity = [
      ...equityAccounts,
      ...(currentPeriodNetIncome !== 0 ? [{ code: "CURRENT-P&L", name: "Current Period Net Earnings (P&L)", type: "equity", balance: currentPeriodNetIncome }] : []),
    ];

    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
    const discrepancy = Math.abs(totalAssets - totalLiabilitiesAndEquity);
    const isBalanced = discrepancy < 0.01;

    return ok(res, {
      assets,
      liabilities,
      equity,
      currentPeriodNetIncome,
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalLiabilitiesAndEquity,
      discrepancy,
      isBalanced,
      asOfDate: new Date(),
    });
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

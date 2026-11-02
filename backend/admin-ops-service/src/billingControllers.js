import mongoose from "mongoose";
import Product from "../../legacy/models/Product.js";
import User from "../../legacy/models/user.js";
import Order from "../../legacy/models/order/Order.js";
import Category from "../../legacy/models/Category.js";
import DeliveryManager from "../../delivery-service/src/models/DeliveryManager.js";
import StoreInventory from "../../delivery-service/src/models/StoreInventory.js";
import { Vendor, VendorProduct } from "../../farmer-manager-service/src/models.js";
import { OmniInvoice, PosRegisterShift } from "./models.js";
import { notifyWriteRequest } from "../../shared/realtime/changeFeed.js";
import { generateId } from "../../erp-service/src/services/idGenerator.js";

function slugify(val) {
  return String(val || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function computeTier(spend, points) {
  if (spend >= 20000 || points >= 500) {
    return { tier: "Platinum", discount: 10 };
  }
  if (spend >= 5000 || points >= 150) {
    return { tier: "Gold", discount: 5 };
  }
  if (spend >= 1000 || points >= 50) {
    return { tier: "Silver", discount: 2 };
  }
  return { tier: "Bronze", discount: 0 };
}

/**
 * GET /api/admin-ops/billing/zones-and-stores
 * Real zones and dark stores with associated vendors from MongoDB
 */
export async function getBillingZonesAndStores(req, res) {
  try {
    const stores = await DeliveryManager.find({
      isActive: true,
      isDeleted: { $ne: true },
      deleted: { $ne: true },
    })
      .select("-password")
      .sort({ city: 1, area: 1, storeName: 1 })
      .lean();

    // Fetch vendors for all stores
    const vendorIds = [...new Set(stores.map((s) => s.vendorId).filter(Boolean))];
    const objectIds = vendorIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const vendors = await Vendor.find({
      $or: [{ id: { $in: vendorIds } }, { _id: { $in: objectIds } }],
      isDeleted: { $ne: true },
      deleted: { $ne: true },
      status: { $nin: ["deleted", "DELETED", "blocked", "BLOCKED"] },
    }).lean();

    const vendorMap = new Map();
    for (const v of vendors) {
      if (v.id) vendorMap.set(String(v.id), v);
      if (v._id) vendorMap.set(String(v._id), v);
    }

    // In-stock item count per store in StoreInventory
    const stockAggs = await StoreInventory.aggregate([
      {
        $match: {
          stockCount: { $gt: 0 },
          isActive: true,
          isDeleted: { $ne: true },
          deleted: { $ne: true },
        },
      },
      { $group: { _id: "$managerId", inStockCount: { $sum: 1 } } },
    ]);
    const stockMap = new Map(stockAggs.map((it) => [String(it._id), it.inStockCount]));

    const formattedStores = stores.map((s) => {
      const v = s.vendorId ? vendorMap.get(String(s.vendorId)) : null;
      const city = s.city || "Pune";
      const state = s.state || "Maharashtra";
      const zoneKey = slugify(`${city}-${state}`);
      const zoneName = `${city}, ${state}`;

      return {
        id: String(s._id),
        _id: String(s._id),
        storeName: s.storeName || `${s.area || "Store"} Dark Store`,
        area: s.area || "",
        city,
        state,
        storeAddress: s.storeAddress || `${s.storeName || s.area}, ${city}, ${state}`,
        pincode: s.pincode || "",
        zoneKey,
        zoneName,
        isActive: s.isActive !== false,
        vendorId: s.vendorId || "",
        vendor: v
          ? {
              id: v.id || s.vendorId,
              businessName: v.businessName || v.vendorName || "Vendor Enterprise",
              vendorName: v.vendorName || v.businessName || "",
              vendorCode: v.vendorCode || "",
              ownerName: v.ownerName || "",
              mobile: v.mobile || v.phone || "",
              city: v.city || "",
              state: v.state || "",
              status: v.status || "Active",
            }
          : null,
        inStockCount: stockMap.get(String(s._id)) || 0,
      };
    });

    // Group distinct zones
    const zoneMap = new Map();
    for (const store of formattedStores) {
      const existing = zoneMap.get(store.zoneKey) || {
        zoneKey: store.zoneKey,
        name: store.zoneName,
        city: store.city,
        state: store.state,
        storeCount: 0,
        areas: new Set(),
      };
      existing.storeCount += 1;
      if (store.area) existing.areas.add(store.area);
      zoneMap.set(store.zoneKey, existing);
    }

    const zones = [...zoneMap.values()].map((z) => ({
      zoneKey: z.zoneKey,
      name: z.name,
      city: z.city,
      state: z.state,
      storeCount: z.storeCount,
      areas: [...z.areas],
    }));

    res.status(200).json({
      success: true,
      zones,
      stores: formattedStores,
    });
  } catch (error) {
    console.error("[Billing API] getBillingZonesAndStores error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/admin-ops/billing/catalog
 * Real products & categories from DB.
 * If storeId is provided, filters strictly to products from that dark store and the vendor who created/supplies that dark store.
 */
export async function getBillingCatalog(req, res) {
  try {
    const { storeId } = req.query;

    if (storeId && mongoose.Types.ObjectId.isValid(storeId)) {
      const store = await DeliveryManager.findById(storeId).lean();
      if (!store) {
        return res.status(404).json({ success: false, message: "Dark store not found" });
      }

      // Fetch the vendor who created/supplies this dark store
      let vendor = null;
      if (store.vendorId) {
        const vFilter = mongoose.Types.ObjectId.isValid(store.vendorId)
          ? { $or: [{ id: store.vendorId }, { _id: store.vendorId }] }
          : { id: store.vendorId };
        vendor = await Vendor.findOne(vFilter).lean();
      }

      // Fetch real store inventory for this dark store (non-deleted)
      const storeInventories = await StoreInventory.find({
        managerId: store._id,
        isActive: true,
        isDeleted: { $ne: true },
        deleted: { $ne: true },
        status: { $nin: ["deleted", "DELETED"] },
      }).lean();

      // Fetch products supplied by this vendor
      const vendorProducts = store.vendorId
        ? await VendorProduct.find({
            vendorId: store.vendorId,
            isDeleted: { $ne: true },
            deleted: { $ne: true },
          }).lean()
        : [];

      // Match products from central Product collection for high-res images and metadata
      const skus = storeInventories.map((i) => i.sku).filter(Boolean);
      const names = storeInventories.map((i) => i.name).filter(Boolean);
      const centralProducts = await Product.find({
        $or: [
          { sku: { $in: skus } },
          { name: { $in: names } },
          { ownerManagerId: store._id },
        ],
        isDeleted: { $ne: true },
        deleted: { $ne: true },
        status: { $nin: ["deleted", "DELETED"] },
      })
        .select("_id name sku productId price discountedPrice stock unit categories subcategory productImages")
        .lean();

      const productMapBySku = new Map();
      const productMapByName = new Map();
      for (const p of centralProducts) {
        if (p.sku) productMapBySku.set(p.sku, p);
        if (p.name) productMapByName.set(p.name.toLowerCase().trim(), p);
      }

      // Format products strictly belonging to this dark store
      const formattedProducts = storeInventories.map((inv) => {
        const matched =
          productMapBySku.get(inv.sku) ||
          productMapByName.get(inv.name?.toLowerCase().trim());

        const stock = Math.max(0, Number(inv.stockCount) || 0);
        const primaryCategory =
          inv.category || matched?.categories?.[0] || matched?.subcategory || "General";
        const primaryImage =
          matched?.productImages?.[0] || "";

        return {
          id: String(inv._id),
          _id: String(inv._id),
          storeInventoryId: String(inv._id),
          productId: matched ? String(matched._id) : null,
          name: inv.name,
          sku: inv.sku,
          barcode: inv.sku || (matched?.sku || `890${String(inv._id).slice(-7).toUpperCase()}`),
          category: primaryCategory,
          price: Number(inv.price || matched?.discountedPrice || matched?.price || 0),
          mrp: Number(matched?.price || (inv.price ? Math.round(inv.price * 1.2) : 0)),
          unit: inv.unit || matched?.unit || "1 kg",
          stock,
          image: primaryImage,
          storeId: String(store._id),
          storeName: store.storeName,
          vendorId: store.vendorId || "",
          vendorName: vendor?.businessName || vendor?.vendorName || "Direct Store",
          channelStock: {
            store: stock,
            mall: Math.floor(stock * 0.3),
            ecom: Math.floor(stock * 0.4),
          },
        };
      });

      // Also append any vendor-specific products not in store inventory yet
      for (const vp of vendorProducts) {
        const vpName = vp.productName || vp.name;
        if (!vpName) continue;
        const already = formattedProducts.some(
          (p) =>
            p.name.toLowerCase().trim() === vpName.toLowerCase().trim() ||
            p.sku === vp.productId
        );
        if (!already) {
          const vpStock = Math.max(0, Number(vp.stock) || 0);
          formattedProducts.push({
            id: String(vp._id),
            _id: String(vp._id),
            storeInventoryId: null,
            productId: null,
            name: vpName,
            sku: vp.productId || `VP-${String(vp._id).slice(-6)}`,
            barcode: vp.productId || `VP-${String(vp._id).slice(-6)}`,
            category: vp.category || "Vendor Supply",
            price: Number(vp.price || 0),
            mrp: Math.round(Number(vp.price || 0) * 1.15),
            unit: vp.unit || "1 kg",
            stock: vpStock,
            image: "",
            storeId: String(store._id),
            storeName: store.storeName,
            vendorId: store.vendorId,
            vendorName: vendor?.businessName || vendor?.vendorName || "Vendor",
            channelStock: {
              store: vpStock,
              mall: 0,
              ecom: vpStock,
            },
          });
        }
      }

      const categoryNames = [
        "All",
        ...new Set(formattedProducts.map((p) => p.category?.trim()).filter(Boolean)),
      ];

      return res.status(200).json({
        success: true,
        store: {
          id: String(store._id),
          storeName: store.storeName,
          area: store.area,
          city: store.city,
          state: store.state,
          vendorId: store.vendorId || "",
        },
        vendor: vendor
          ? {
              id: vendor.id || store.vendorId,
              businessName: vendor.businessName || vendor.vendorName || "Vendor Enterprise",
              vendorName: vendor.vendorName || vendor.businessName || "",
              vendorCode: vendor.vendorCode || "",
              ownerName: vendor.ownerName || "",
              mobile: vendor.mobile || vendor.phone || "",
              city: vendor.city || "",
              state: vendor.state || "",
            }
          : null,
        products: formattedProducts,
        categories: categoryNames,
      });
    }

    // Fallback: Return central catalog if no storeId passed
    const [products, categories] = await Promise.all([
      Product.find({
        isActive: true,
        isDeleted: { $ne: true },
        deleted: { $ne: true },
        status: { $nin: ["deleted", "DELETED"] },
      })
        .select(
          "_id name sku productId price discountedPrice stock unit categories subcategory productImages section storeType"
        )
        .sort({ name: 1 })
        .limit(150)
        .lean(),
      Category.find({
        isActive: true,
        isDeleted: { $ne: true },
        deleted: { $ne: true },
      }).select("categoryName").sort({ categoryName: 1 }).lean(),
    ]);

    const formattedProducts = products.map((prod) => {
      const totalStock = Math.max(0, Number(prod.stock) || 0);
      const storeStock = Math.floor(totalStock * 0.5);
      const mallStock = Math.floor(totalStock * 0.25);
      const ecomStock = Math.max(0, totalStock - storeStock - mallStock);

      const barcode =
        prod.sku ||
        prod.productId ||
        `890${String(prod._id).slice(-7).toUpperCase()}`;

      const primaryCategory =
        Array.isArray(prod.categories) && prod.categories[0]
          ? prod.categories[0]
          : prod.subcategory || "Fresh Produce";

      const primaryImage =
        Array.isArray(prod.productImages) && prod.productImages[0]
          ? prod.productImages[0]
          : "";

      return {
        id: String(prod._id),
        _id: String(prod._id),
        name: prod.name,
        sku: prod.sku || prod.productId || `SKU-${String(prod._id).slice(-4)}`,
        barcode,
        category: primaryCategory,
        price: Number(prod.discountedPrice || prod.price || 0),
        mrp: Number(prod.price || prod.discountedPrice || 0),
        unit: prod.unit || "1 kg",
        stock: totalStock,
        image: primaryImage,
        channelStock: {
          store: storeStock,
          mall: mallStock,
          ecom: ecomStock,
        },
      };
    });

    const categoryNames = [
      "All",
      ...new Set(
        categories
          .map((c) => c.categoryName?.trim())
          .filter(Boolean)
          .concat(formattedProducts.map((p) => p.category))
      ),
    ];

    res.status(200).json({
      success: true,
      products: formattedProducts,
      categories: categoryNames,
    });
  } catch (error) {
    console.error("[Billing API] getBillingCatalog error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/admin-ops/billing/customers
 * Real customers from User collection with real points, lifetime spend & visits
 */
export async function getBillingCustomers(req, res) {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const filter = { role: { $ne: "admin" } };

    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: regex }, { phone: regex }, { email: regex }];
    }

    const users = await User.find(filter)
      .select("_id name phone email rewardPoints accountType createdAt")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const userIds = users.map((u) => u._id);

    // Aggregate lifetime spend and orders count for these users
    const orderAggregates = await Order.aggregate([
      {
        $match: {
          user: { $in: userIds },
          status: { $nin: ["attempted", "cancelled"] },
        },
      },
      {
        $group: {
          _id: "$user",
          totalSpend: { $sum: "$total" },
          visits: { $sum: 1 },
          lastOrderDate: { $max: "$createdAt" },
        },
      },
    ]);

    const orderStatsMap = new Map(
      orderAggregates.map((item) => [String(item._id), item])
    );

    const formattedCustomers = users.map((user) => {
      const stats = orderStatsMap.get(String(user._id)) || {
        totalSpend: 0,
        visits: 0,
        lastOrderDate: null,
      };

      const points = Number(user.rewardPoints) || 0;
      const { tier, discount } = computeTier(stats.totalSpend, points);

      return {
        id: String(user._id),
        _id: String(user._id),
        name: user.name || "Customer",
        phone: user.phone || "",
        email: user.email || "",
        accountType: user.accountType || "retail",
        points,
        lifetimeSpend: stats.totalSpend,
        visits: stats.visits,
        tier,
        tierDiscount: discount,
        lastVisit: stats.lastOrderDate
          ? new Date(stats.lastOrderDate).toLocaleDateString()
          : "Recently joined",
        notes:
          user.accountType === "bulk"
            ? "Bulk B2B purchaser. Prefers GST billing."
            : "Active retail shopper with loyalty privileges.",
      };
    });

    res.status(200).json({
      success: true,
      customers: formattedCustomers,
    });
  } catch (error) {
    console.error("[Billing API] getBillingCustomers error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * POST /api/admin-ops/billing/customers
 * Quick-add a new customer during checkout
 */
export async function createBillingCustomer(req, res) {
  try {
    const { name, phone, email } = req.body;
    if (!name?.trim() || !phone?.trim()) {
      return res.status(400).json({ success: false, message: "Name and 10-digit phone number are required" });
    }

    const cleanPhone = phone.trim().replace(/\D/g, "").slice(-10);
    const existing = await User.findOne({ phone: cleanPhone });
    if (existing) {
      return res.status(409).json({ success: false, message: "A customer with this phone number already exists" });
    }

    const newUser = await User.create({
      name: name.trim(),
      phone: cleanPhone,
      email: email?.trim() || undefined,
      rewardPoints: 50, // Welcome loyalty bonus!
      accountType: "retail",
      role: "user",
    });

    res.status(201).json({
      success: true,
      customer: {
        id: String(newUser._id),
        _id: String(newUser._id),
        name: newUser.name,
        phone: newUser.phone,
        email: newUser.email || "",
        points: newUser.rewardPoints,
        tier: "Bronze",
        tierDiscount: 0,
        lifetimeSpend: 0,
        visits: 1,
        notes: "Newly onboarded via POS terminal with 50 bonus loyalty points.",
      },
    });
  } catch (error) {
    console.error("[Billing API] createBillingCustomer error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * POST /api/admin-ops/billing/invoices
 * Process real invoice, deduct inventory, credit/redeem points, update shift
 */
export async function createBillingInvoice(req, res) {
  try {
    const {
      channel = "physical_store",
      counterName = "Counter #1 - GreenGroo Store",
      cashierName = "Admin Cashier",
      storeId,
      storeName = "",
      zone = "",
      area = "",
      vendorId = "",
      vendorName = "",
      customer,
      items = [],
      subtotal = 0,
      discount = 0,
      pointsRedeemed = 0,
      pointsEarned = 0,
      gstTax = 0,
      grandTotal = 0,
      paymentMethod = "UPI",
      cashTendered = 0,
      changeReturned = 0,
      notes = "",
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart cannot be empty" });
    }

    const invoiceNumber = await generateId({ module: "INVCE" });

    // Format items & deduct inventory
    const invoiceItems = [];
    for (const item of items) {
      const prodId = item.id || item._id || item.productId;
      const qty = Math.max(1, Number(item.qty) || 1);

      invoiceItems.push({
        productId: mongoose.Types.ObjectId.isValid(prodId) ? prodId : null,
        sku: item.sku || "",
        barcode: item.barcode || "",
        name: item.name,
        category: item.category || "",
        price: Number(item.price) || 0,
        mrp: Number(item.mrp) || Number(item.price) || 0,
        qty,
        unit: item.unit || "1 kg",
        image: item.image || "",
      });

      // Atomically decrement real stock in Product collection if applicable
      if (mongoose.Types.ObjectId.isValid(prodId)) {
        await Product.findByIdAndUpdate(prodId, {
          $inc: { stock: -qty },
        }).catch((err) => console.warn(`[Billing] Stock deduction error for ${prodId}:`, err.message));
      }

      // Atomically decrement real stock in dark store StoreInventory if storeId provided
      if (storeId && (item.sku || mongoose.Types.ObjectId.isValid(prodId))) {
        const deductStore = async () => {
          if (mongoose.Types.ObjectId.isValid(prodId)) {
            const linked = await StoreInventory.findOneAndUpdate(
              { managerId: storeId, productId: prodId },
              { $inc: { stockCount: -qty } }
            );
            if (linked || !item.sku) return;
          }
          await StoreInventory.findOneAndUpdate(
            { managerId: storeId, sku: item.sku, productId: null },
            { $inc: { stockCount: -qty } }
          );
        };
        await deductStore().catch((err) =>
          console.warn(`[Billing] Store inventory stock deduction error for ${item.sku || prodId}:`, err.message)
        );
      }
    }

    // Process customer reward points in DB
    const custId = customer?.id || customer?._id;
    if (custId && mongoose.Types.ObjectId.isValid(custId)) {
      const pointDelta = pointsEarned - pointsRedeemed;
      if (pointDelta !== 0) {
        await User.findByIdAndUpdate(custId, {
          $inc: { rewardPoints: pointDelta },
        }).catch((err) => console.warn(`[Billing] Loyalty points update error for ${custId}:`, err.message));
      }
    }

    // Create and save invoice in MongoDB
    const invoice = await OmniInvoice.create({
      invoiceNumber,
      channel,
      counterName,
      cashierName,
      storeId: storeId && mongoose.Types.ObjectId.isValid(storeId) ? storeId : null,
      storeName: storeName || "",
      zone: zone || "",
      area: area || "",
      vendorId: vendorId || "",
      vendorName: vendorName || "",
      userId: custId && mongoose.Types.ObjectId.isValid(custId) ? custId : null,
      customerName: customer?.name || "Walk-in Guest",
      customerPhone: customer?.phone || "",
      customerTier: customer?.tier || "Standard",
      items: invoiceItems,
      itemsCount: invoiceItems.reduce((acc, it) => acc + it.qty, 0),
      subtotal: Number(subtotal),
      discount: Number(discount),
      pointsRedeemed: Number(pointsRedeemed),
      pointsEarned: Number(pointsEarned),
      gstTax: Number(gstTax),
      grandTotal: Number(grandTotal),
      paymentMethod,
      paymentStatus: "paid",
      cashTendered: Number(cashTendered),
      changeReturned: Number(changeReturned),
      notes: notes || "",
      status: "completed",
    });

    // Update active register shift in DB
    const todayStr = new Date().toISOString().slice(0, 10);
    const shiftUpdate = {
      $inc: {
        billsCount: 1,
        totalSales: Number(grandTotal),
      },
    };

    if (paymentMethod === "Cash") shiftUpdate.$inc.cashSales = Number(grandTotal);
    else if (paymentMethod === "UPI") shiftUpdate.$inc.upiSales = Number(grandTotal);
    else if (paymentMethod === "Card") shiftUpdate.$inc.cardSales = Number(grandTotal);

    await PosRegisterShift.findOneAndUpdate(
      { registerName: counterName, shiftDate: todayStr, status: "open" },
      shiftUpdate,
      { upsert: true, new: true }
    ).catch(() => {});

    // Notify realtime feeds
    notifyWriteRequest();

    res.status(201).json({
      success: true,
      message: "Invoice created successfully",
      invoice: {
        id: invoice.invoiceNumber,
        _id: String(invoice._id),
        invoiceNumber: invoice.invoiceNumber,
        channel: invoice.channel,
        counter: invoice.counterName,
        cashier: invoice.cashierName,
        customerName: invoice.customerName,
        customerPhone: invoice.customerPhone,
        customerTier: invoice.customerTier,
        items: invoice.items,
        itemsCount: invoice.itemsCount,
        subtotal: invoice.subtotal,
        discount: invoice.discount,
        pointsRedeemed: invoice.pointsRedeemed,
        pointsEarned: invoice.pointsEarned,
        gstTax: invoice.gstTax,
        grandTotal: invoice.grandTotal,
        paymentMethod: invoice.paymentMethod,
        timestamp: new Date(invoice.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        date: new Date(invoice.createdAt).toLocaleDateString(),
        status: invoice.status,
      },
    });
  } catch (error) {
    console.error("[Billing API] createBillingInvoice error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/admin-ops/billing/invoices
 * Retrieve real past invoices from MongoDB
 */
export async function getBillingInvoices(req, res) {
  try {
    const { channel, q } = req.query;
    const filter = {};

    if (channel && channel !== "all") {
      filter.channel = channel;
    }

    if (q?.trim()) {
      const regex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ invoiceNumber: regex }, { customerName: regex }, { customerPhone: regex }];
    }

    const invoices = await OmniInvoice.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const formatted = invoices.map((inv) => ({
      id: inv.invoiceNumber,
      _id: String(inv._id),
      invoiceNumber: inv.invoiceNumber,
      channel:
        inv.channel === "physical_store"
          ? "Physical Store"
          : inv.channel === "mall_counter"
          ? "Mall Counter"
          : "E-Commerce",
      counter: inv.counterName,
      cashier: inv.cashierName,
      customerName: inv.customerName,
      customerPhone: inv.customerPhone,
      customerTier: inv.customerTier,
      items: inv.items,
      itemsCount: inv.itemsCount,
      subtotal: inv.subtotal,
      discount: inv.discount,
      pointsRedeemed: inv.pointsRedeemed,
      pointsEarned: inv.pointsEarned,
      gstTax: inv.gstTax,
      grandTotal: inv.grandTotal,
      paymentMethod: inv.paymentMethod,
      timestamp: new Date(inv.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      date: new Date(inv.createdAt).toLocaleDateString(),
      status: inv.status,
    }));

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayTotal = formatted
      .filter((inv) => new Date(inv.date) >= todayStart)
      .reduce((sum, inv) => sum + inv.grandTotal, 0);

    res.status(200).json({
      success: true,
      invoices: formatted,
      todayTotal,
    });
  } catch (error) {
    console.error("[Billing API] getBillingInvoices error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/admin-ops/billing/channels-overview
 * Live multi-channel stats computed from MongoDB
 */
export async function getOmnichannelOverview(req, res) {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Aggregate OmniInvoices by channel for today
    const invoiceStats = await OmniInvoice.aggregate([
      { $match: { createdAt: { $gte: todayStart }, isDeleted: { $ne: true }, deleted: { $ne: true }, status: { $nin: ["deleted", "DELETED"] } } },
      {
        $group: {
          _id: "$channel",
          totalSales: { $sum: "$grandTotal" },
          billsCount: { $sum: 1 },
        },
      },
    ]);

    // Aggregate Online E-commerce orders from Order model for today
    const [ecomOrderStats] = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: todayStart },
          status: { $nin: ["attempted", "cancelled", "deleted", "DELETED"] },
          isDeleted: { $ne: true },
          deleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$total" },
          billsCount: { $sum: 1 },
        },
      },
    ]);

    const statsMap = new Map(invoiceStats.map((item) => [item._id, item]));

    const storeStat = statsMap.get("physical_store") || { totalSales: 0, billsCount: 0 };
    const mallStat = statsMap.get("mall_counter") || { totalSales: 0, billsCount: 0 };
    const ecomOmniStat = statsMap.get("ecommerce") || { totalSales: 0, billsCount: 0 };

    const totalEcomSales = (ecomOmniStat.totalSales || 0) + (ecomOrderStats?.totalSales || 0);
    const totalEcomOrders = (ecomOmniStat.billsCount || 0) + (ecomOrderStats?.billsCount || 0);

    // Get register shifts
    const todayStr = new Date().toISOString().slice(0, 10);
    const shifts = await PosRegisterShift.find({ shiftDate: todayStr }).lean();

    res.status(200).json({
      success: true,
      channels: {
        physicalStore: {
          name: "Physical Stores",
          sub: "Flagship & Express Counters",
          salesToday: storeStat.totalSales,
          billsToday: storeStat.billsCount,
          status: "2 Counters Open",
        },
        mallCounter: {
          name: "Mall Counters & Kiosks",
          sub: "Phoenix Mall & Atrium Booths",
          salesToday: mallStat.totalSales,
          billsToday: mallStat.billsCount,
          status: "Active Footfall",
        },
        ecommerce: {
          name: "E-Commerce",
          sub: "App, Web & Dark Store Dispatch",
          salesToday: totalEcomSales,
          billsToday: totalEcomOrders,
          status: "Live Sync",
        },
      },
      shifts,
    });
  } catch (error) {
    console.error("[Billing API] getOmnichannelOverview error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

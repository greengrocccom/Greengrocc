import mongoose from "mongoose";
import DeliveryManager from "../../delivery-service/src/models/DeliveryManager.js";
import StoreOrder from "../../delivery-service/src/models/StoreOrder.js";
import Order from "../../legacy/models/order/Order.js";
import User from "../../legacy/models/user.js";
import UnblockRequest from "../../legacy/models/UnblockRequest.js";
import Address from "../../legacy/models/address/Address.js";

const ok = (res, data, extra = {}) => res.json({ success: true, data, ...extra });
const fail = (res, status, message) => res.status(status).json({ success: false, message });

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeAccountType(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "bulk" || raw === "b2b" || raw === "wholesale") return "bulk";
  if (raw === "retail" || raw === "normal") return "retail";
  return "";
}

function orderItemQty(items = []) {
  return (items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
}

function orderAmount(order) {
  const collect = Number(order.amountToCollect || 0);
  if (collect > 0) return collect;
  return (order.items || []).reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
    0
  );
}

function matchZone(manager, zoneKey) {
  const key = String(zoneKey || "").trim().toLowerCase();
  if (!key) return false;
  const cityId = String(manager.cityId || "").trim().toLowerCase();
  const citySlug = slugify(manager.city);
  const city = String(manager.city || "").trim().toLowerCase();
  return cityId === key || citySlug === key || city === key;
}

function serializeStore(manager, extras = {}) {
  return {
    id: String(manager._id),
    storeName: manager.storeName || manager.name || "Dark store",
    name: manager.name || "",
    phone: manager.phone || "",
    email: manager.email || "",
    city: manager.city || "",
    cityId: manager.cityId || slugify(manager.city),
    area: manager.area || "",
    state: manager.state || "",
    storeAddress: manager.storeAddress || "",
    pincode: manager.pincode || "",
    isActive: manager.isActive !== false,
    ...extras,
  };
}

/** Distinct cities (zones) with dark-store counts. */
export async function listUserMgmtZones(req, res, next) {
  try {
    const managers = await DeliveryManager.find()
      .select("city cityId area storeName name isActive")
      .lean();

    const byZone = new Map();
    for (const manager of managers) {
      const city = String(manager.city || "").trim();
      if (!city) continue;
      const zoneKey = String(manager.cityId || "").trim() || slugify(city);
      const existing = byZone.get(zoneKey) || {
        zoneKey,
        name: city,
        city,
        cityId: zoneKey,
        storeCount: 0,
        activeStoreCount: 0,
        areas: new Set(),
      };
      existing.storeCount += 1;
      if (manager.isActive !== false) existing.activeStoreCount += 1;
      if (manager.area) existing.areas.add(manager.area);
      byZone.set(zoneKey, existing);
    }

    const zones = [...byZone.values()]
      .map((zone) => ({
        zoneKey: zone.zoneKey,
        name: zone.name,
        city: zone.city,
        cityId: zone.cityId,
        storeCount: zone.storeCount,
        activeStoreCount: zone.activeStoreCount,
        areaCount: zone.areas.size,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return ok(res, zones, { count: zones.length });
  } catch (error) {
    next(error);
  }
}

/** Dark stores inside a zone (city). */
export async function listUserMgmtStores(req, res, next) {
  try {
    const zoneKey = String(req.params.zoneKey || req.query.zone || "").trim();
    if (!zoneKey) return fail(res, 400, "Zone is required");

    const managers = await DeliveryManager.find().select("-password").sort({ area: 1, storeName: 1 }).lean();
    const storesInZone = managers.filter((m) => matchZone(m, zoneKey));
    if (!storesInZone.length) return ok(res, [], { count: 0, zone: { zoneKey, name: zoneKey } });

    const storeIds = storesInZone.map((m) => m._id);
    const orderStats = await StoreOrder.aggregate([
      {
        $match: {
          $or: [{ darkStoreId: { $in: storeIds } }, { managerId: { $in: storeIds } }],
        },
      },
      {
        $group: {
          _id: { $ifNull: ["$darkStoreId", "$managerId"] },
          orderCount: { $sum: 1 },
          customerPhones: { $addToSet: "$customerPhone" },
        },
      },
    ]);
    const statsById = Object.fromEntries(
      orderStats.map((row) => [
        String(row._id),
        {
          orderCount: row.orderCount || 0,
          customerCount: (row.customerPhones || []).filter(Boolean).length,
        },
      ])
    );

    const zoneName = storesInZone[0]?.city || zoneKey;
    const data = storesInZone.map((manager) =>
      serializeStore(manager, statsById[String(manager._id)] || { orderCount: 0, customerCount: 0 })
    );

    return ok(res, data, {
      count: data.length,
      zone: {
        zoneKey: String(storesInZone[0]?.cityId || "").trim() || slugify(zoneName),
        name: zoneName,
        city: zoneName,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Users who ordered from a dark store, filtered by accountType (retail/bulk).
 * Supports search (name, phone, order id/number) and filters (area, qty, date).
 */
export async function listUserMgmtStoreUsers(req, res, next) {
  try {
    const storeId = String(req.params.storeId || "").trim();
    if (!mongoose.Types.ObjectId.isValid(storeId)) {
      return fail(res, 400, "Invalid dark store id");
    }

    const accountType = normalizeAccountType(req.query.accountType) || "retail";
    const search = String(req.query.search || req.query.q || "").trim();
    const areaFilter = String(req.query.area || "").trim().toLowerCase();
    const statusFilter = String(req.query.status || "all").trim().toLowerCase();
    const pincodeFilter = String(req.query.pincode || "").trim();
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : null;
    const minOrders = Number(req.query.minOrders);
    const maxOrders = Number(req.query.maxOrders);
    const minQty = Number(req.query.minQty);
    const maxQty = Number(req.query.maxQty);
    const sortBy = String(req.query.sort || "lastOrderAt").trim();
    const sortDir = String(req.query.sortDir || "desc").toLowerCase() === "asc" ? 1 : -1;

    const manager = await DeliveryManager.findById(storeId).select("-password").lean();
    if (!manager) return fail(res, 404, "Dark store not found");

    const storeFilter = {
      $or: [{ darkStoreId: manager._id }, { managerId: manager._id }],
    };
    if (dateFrom && !Number.isNaN(dateFrom.getTime())) {
      storeFilter.createdAt = { ...(storeFilter.createdAt || {}), $gte: dateFrom };
    }
    if (dateTo && !Number.isNaN(dateTo.getTime())) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      storeFilter.createdAt = { ...(storeFilter.createdAt || {}), $lte: end };
    }
    if (areaFilter) {
      storeFilter.area = new RegExp(`^${areaFilter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
    }

    const storeOrders = await StoreOrder.find(storeFilter)
      .select(
        "orderNumber sourceOrderId customerName customerPhone customerAddress area city createdAt items amountToCollect status"
      )
      .sort({ createdAt: -1 })
      .lean();

    const sourceIds = [
      ...new Set(
        storeOrders
          .map((o) => (o.sourceOrderId ? String(o.sourceOrderId) : ""))
          .filter(Boolean)
      ),
    ];

    const ecommerceOrders = sourceIds.length
      ? await Order.find({ _id: { $in: sourceIds } })
          .select("_id user orderNumber")
          .lean()
      : [];
    const orderUserBySource = new Map(
      ecommerceOrders.map((o) => [String(o._id), o.user ? String(o.user) : ""])
    );

    const phones = [
      ...new Set(storeOrders.map((o) => String(o.customerPhone || "").replace(/\D/g, "").slice(-10)).filter((p) => p.length === 10)),
    ];

    const userIdsFromOrders = [
      ...new Set([...orderUserBySource.values()].filter(Boolean)),
    ];
    const orClauses = [];
    if (userIdsFromOrders.length) {
      orClauses.push({ _id: { $in: userIdsFromOrders } });
    }
    if (phones.length) {
      orClauses.push({ phone: { $in: phones } });
    }

    const users = orClauses.length
      ? await User.find({
          role: { $ne: "admin" },
          $or: orClauses,
        })
          .select("name phone email accountType shopName shopAddress gstNumber addresses createdAt isActive status isBlocked blockReason blockedAt")
          .lean()
      : [];

    const userIds = users.map((u) => u._id);
    const userAddresses = userIds.length
      ? await Address.find({ user: { $in: userIds } })
          .select("user pincode city state area fullAddress isDefault")
          .sort({ isDefault: -1, updatedAt: -1 })
          .lean()
      : [];
    const addressByUserId = new Map();
    for (const a of userAddresses) {
      const uid = String(a.user);
      if (!addressByUserId.has(uid) || a.isDefault) {
        addressByUserId.set(uid, a);
      }
    }

    const userById = new Map(users.map((u) => [String(u._id), u]));
    const userByPhone = new Map(users.map((u) => [String(u.phone || "").replace(/\D/g, "").slice(-10), u]));

    const buckets = new Map();

    for (const order of storeOrders) {
      const sourceId = order.sourceOrderId ? String(order.sourceOrderId) : "";
      const linkedUserId = sourceId ? orderUserBySource.get(sourceId) : "";
      const phone = String(order.customerPhone || "").replace(/\D/g, "").slice(-10);
      let user = linkedUserId ? userById.get(linkedUserId) : null;
      if (!user && phone) user = userByPhone.get(phone) || null;

      if (!user) continue;
      if (normalizeAccountType(user.accountType || "retail") !== accountType) continue;

      const key = String(user._id);
      const qty = orderItemQty(order.items);
      const amount = orderAmount(order);
      const isBlocked =
        user.isBlocked === true ||
        user.blocked === true ||
        user.isActive === false ||
        user.active === false ||
        String(user.status || "").trim().toLowerCase() === "blocked" ||
        String(user.status || "").trim().toLowerCase() === "inactive";
      const existing = buckets.get(key) || {
        userId: key,
        name: user.name || order.customerName || "Customer",
        phone: user.phone || phone || "",
        email: user.email || "",
        accountType: user.accountType || accountType,
        shopName: user.shopName || "",
        shopAddress: user.shopAddress || "",
        gstNumber: user.gstNumber || "",
        isActive: !isBlocked,
        status: isBlocked ? "blocked" : (user.status || "active"),
        isBlocked,
        blockReason: user.blockReason || "",
        blockedAt: user.blockedAt || null,
        orderCount: 0,
        totalQuantity: 0,
        totalAmount: 0,
        areas: new Set(),
        orderIds: [],
        orderNumbers: [],
        lastOrderAt: null,
        firstOrderAt: null,
        lastOrderNumber: "",
        lastArea: "",
        lastAddress: "",
      };

      existing.orderCount += 1;
      existing.totalQuantity += qty;
      existing.totalAmount += amount;
      if (order.area) existing.areas.add(order.area);
      if (order.orderNumber) existing.orderNumbers.push(String(order.orderNumber));
      if (sourceId) existing.orderIds.push(sourceId);
      const createdAt = order.createdAt ? new Date(order.createdAt) : null;
      if (createdAt && (!existing.lastOrderAt || createdAt > existing.lastOrderAt)) {
        existing.lastOrderAt = createdAt;
        existing.lastOrderNumber = order.orderNumber || "";
        existing.lastArea = order.area || "";
        existing.lastAddress = order.customerAddress || "";
      }
      if (createdAt && (!existing.firstOrderAt || createdAt < existing.firstOrderAt)) {
        existing.firstOrderAt = createdAt;
      }
      buckets.set(key, existing);
    }

    let rows = [...buckets.values()].map((row) => {
      const addr = addressByUserId.get(row.userId) || null;
      let pincode = addr?.pincode || "";
      if (!pincode && row.shopAddress) {
        const pinMatch = row.shopAddress.match(/\b\d{6}\b/);
        if (pinMatch) pincode = pinMatch[0];
      }
      if (!pincode && row.lastAddress) {
        const pinMatch = row.lastAddress.match(/\b\d{6}\b/);
        if (pinMatch) pincode = pinMatch[0];
      }
      return {
        userId: row.userId,
        name: row.name,
        phone: row.phone,
        email: row.email,
        accountType: row.accountType,
        shopName: row.shopName,
        shopAddress: row.shopAddress,
        gstNumber: row.gstNumber,
        isBlocked: row.isBlocked,
        isActive: row.isActive,
        status: row.status,
        blockReason: row.blockReason,
        blockedAt: row.blockedAt,
        orderCount: row.orderCount,
        totalQuantity: row.totalQuantity,
        totalAmount: row.totalAmount,
        areas: [...row.areas],
        lastOrderAt: row.lastOrderAt,
        firstOrderAt: row.firstOrderAt,
        lastOrderNumber: row.lastOrderNumber,
        lastArea: row.lastArea,
        lastAddress: row.lastAddress,
        orderNumbers: row.orderNumbers.slice(0, 20),
        pincode: pincode || "",
        city: addr?.city || "",
      };
    });

    if (statusFilter === "active") {
      rows = rows.filter((r) => r.isActive && !r.isBlocked);
    } else if (statusFilter === "blocked" || statusFilter === "inactive") {
      rows = rows.filter((r) => !r.isActive || r.isBlocked);
    }

    if (pincodeFilter) {
      const pinRegex = new RegExp(pincodeFilter, "i");
      rows = rows.filter((r) =>
        pinRegex.test(r.pincode || "") ||
        pinRegex.test(r.lastAddress || "") ||
        pinRegex.test(r.shopAddress || "")
      );
    }

    if (search) {
      const needle = search.toLowerCase();
      const digits = search.replace(/\D/g, "");
      rows = rows.filter((row) => {
        const hay = [row.name, row.phone, row.email, row.shopName, row.lastOrderNumber, ...(row.orderNumbers || [])]
          .join(" ")
          .toLowerCase();
        if (hay.includes(needle)) return true;
        if (digits && String(row.phone || "").includes(digits)) return true;
        if (digits && (row.orderNumbers || []).some((n) => String(n).includes(digits))) return true;
        return false;
      });
    }

    if (Number.isFinite(minOrders) && minOrders > 0) {
      rows = rows.filter((row) => row.orderCount >= minOrders);
    }
    if (Number.isFinite(maxOrders) && maxOrders > 0) {
      rows = rows.filter((row) => row.orderCount <= maxOrders);
    }
    if (Number.isFinite(minQty) && minQty > 0) {
      rows = rows.filter((row) => row.totalQuantity >= minQty);
    }
    if (Number.isFinite(maxQty) && maxQty > 0) {
      rows = rows.filter((row) => row.totalQuantity <= maxQty);
    }

    rows.sort((a, b) => {
      const pick = (row) => {
        if (sortBy === "orderCount") return row.orderCount;
        if (sortBy === "totalQuantity") return row.totalQuantity;
        if (sortBy === "totalAmount") return row.totalAmount;
        if (sortBy === "name") return String(row.name || "").toLowerCase();
        return row.lastOrderAt ? new Date(row.lastOrderAt).getTime() : 0;
      };
      const av = pick(a);
      const bv = pick(b);
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir * av.localeCompare(bv);
      }
      return sortDir * ((Number(av) || 0) - (Number(bv) || 0));
    });

    const areas = [
      ...new Set(
        storeOrders
          .map((o) => String(o.area || "").trim())
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));

    return ok(res, rows, {
      count: rows.length,
      store: serializeStore(manager),
      filters: {
        accountType,
        areas,
        pincodes: [...new Set(rows.map((r) => r.pincode).filter((p) => /^\d{6}$/.test(p)))],
      },
      stats: {
        userCount: rows.length,
        orderCount: storeOrders.length,
        totalQuantity: rows.reduce((s, r) => s + r.totalQuantity, 0),
        totalAmount: rows.reduce((s, r) => s + r.totalAmount, 0),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update user active/blocked status (Admin authority).
 */
export async function updateUserStatus(req, res, next) {
  try {
    const userId = String(req.params.userId || "").trim();
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return fail(res, 400, "Invalid user ID");
    }

    const user = await User.findById(userId);
    if (!user) return fail(res, 404, "User not found");
    if (user.role === "admin") return fail(res, 403, "Cannot change status of an admin account");

    const { isActive, isBlocked, status, reason, blockReason } = req.body;
    const explicitReason = String(reason || blockReason || "").trim();

    if (isActive !== undefined) {
      user.isActive = Boolean(isActive);
      user.isBlocked = !user.isActive;
      user.status = user.isActive ? "active" : "blocked";
    } else if (isBlocked !== undefined) {
      user.isBlocked = Boolean(isBlocked);
      user.isActive = !user.isBlocked;
      user.status = user.isBlocked ? "blocked" : "active";
    } else if (status) {
      const normalizedStatus = String(status).trim().toLowerCase();
      user.status = normalizedStatus;
      if (normalizedStatus === "blocked" || normalizedStatus === "inactive") {
        user.isActive = false;
        user.isBlocked = true;
      } else if (normalizedStatus === "active") {
        user.isActive = true;
        user.isBlocked = false;
      }
    }

    if (user.isBlocked || user.isActive === false) {
      user.blockReason = explicitReason || user.blockReason || "Deactivated by administrator";
      user.blockedAt = user.blockedAt || new Date();
    } else {
      user.blockReason = "";
      user.blockedAt = null;
    }

    await user.save();

    return ok(res, {
      userId: String(user._id),
      name: user.name,
      phone: user.phone,
      email: user.email,
      accountType: user.accountType,
      isActive: user.isActive !== false && !user.isBlocked && user.status !== "blocked",
      status: user.status || "active",
      isBlocked: Boolean(user.isBlocked || user.isActive === false || user.status === "blocked"),
      blockReason: user.blockReason || "",
      blockedAt: user.blockedAt || null,
      updatedAt: user.updatedAt,
    }, {
      message: user.isActive ? "User activated successfully" : "User deactivated/blocked successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List all users across the system with status, role & search filters.
 */
export async function listAllUsersDirectory(req, res, next) {
  try {
    const search = String(req.query.search || req.query.q || "").trim();
    const accountType = normalizeAccountType(req.query.accountType);
    const statusFilter = String(req.query.status || "all").trim().toLowerCase();
    const pincodeFilter = String(req.query.pincode || "").trim();
    const cityFilter = String(req.query.city || "").trim();
    const userGroup = String(req.query.userGroup || "").trim().toLowerCase();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const query = { role: { $ne: "admin" } };

    // Account Type / Segment
    if (accountType) {
      query.accountType = accountType;
    } else if (userGroup === "retail" || userGroup === "bulk") {
      query.accountType = userGroup;
    }

    // Status Filter (active vs blocked/inactive)
    if (statusFilter === "active") {
      query.$and = [
        { $or: [{ isActive: true }, { isActive: { $exists: false } }] },
        { $or: [{ isBlocked: false }, { isBlocked: { $exists: false } }] },
        { $or: [{ status: "active" }, { status: { $exists: false } }] },
      ];
    } else if (statusFilter === "blocked" || statusFilter === "inactive") {
      query.$or = [
        { isActive: false },
        { isBlocked: true },
        { status: "blocked" },
        { status: "inactive" },
      ];
    }

    // User Group by Order Activity (with_orders vs no_orders)
    if (userGroup === "with_orders") {
      const orderUserIds = await Order.distinct("user");
      const validIds = orderUserIds.filter((id) => mongoose.Types.ObjectId.isValid(String(id)));
      query._id = { $in: validIds };
    } else if (userGroup === "no_orders") {
      const orderUserIds = await Order.distinct("user");
      const validIds = orderUserIds.filter((id) => mongoose.Types.ObjectId.isValid(String(id)));
      query._id = { $nin: validIds };
    } else if (userGroup === "frequent_orders") {
      const frequentOrders = await Order.aggregate([
        { $group: { _id: "$user", count: { $sum: 1 } } },
        { $match: { count: { $gte: 3 } } },
      ]).catch(() => []);
      const validIds = frequentOrders.map((o) => o._id).filter((id) => mongoose.Types.ObjectId.isValid(String(id)));
      query._id = { $in: validIds };
    }

    // Filter by Pincode and/or City (Address Grouping)
    if (pincodeFilter || cityFilter) {
      const addrQuery = {};
      if (pincodeFilter) {
        addrQuery.pincode = new RegExp(pincodeFilter, "i");
      }
      if (cityFilter) {
        addrQuery.city = new RegExp(cityFilter, "i");
      }

      const [matchingAddrs, matchingOrders, shopMatchingUsers] = await Promise.all([
        Address.find(addrQuery).select("user").lean(),
        Order.find({
          ...(pincodeFilter ? { "deliveryAddress.pincode": new RegExp(pincodeFilter, "i") } : {}),
          ...(cityFilter ? { "deliveryAddress.city": new RegExp(cityFilter, "i") } : {}),
        }).select("user").lean(),
        User.find({
          ...(pincodeFilter ? { shopAddress: new RegExp(pincodeFilter, "i") } : {}),
        }).select("_id").lean(),
      ]);

      const matchedUserIds = [
        ...matchingAddrs.map((a) => String(a.user)),
        ...matchingOrders.map((o) => String(o.user)),
        ...shopMatchingUsers.map((u) => String(u._id)),
      ].filter((id) => mongoose.Types.ObjectId.isValid(id));

      const uniqueObjectIds = [...new Set(matchedUserIds)].map((id) => new mongoose.Types.ObjectId(id));

      if (query._id?.$in) {
        const set = new Set(uniqueObjectIds.map(String));
        query._id.$in = query._id.$in.filter((id) => set.has(String(id)));
      } else if (query._id) {
        query._id = { ...query._id, $in: uniqueObjectIds };
      } else {
        query._id = { $in: uniqueObjectIds };
      }
    }

    // Search query
    if (search) {
      const escaped = search.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(escaped, "i");
      const digits = search.replace(/\D/g, "");

      const orSearch = [
        { name: searchRegex },
        { email: searchRegex },
        { shopName: searchRegex },
        { shopAddress: searchRegex },
      ];
      if (digits) {
        orSearch.push({ phone: new RegExp(digits, "i") });
      }

      if (query.$and) {
        query.$and.push({ $or: orSearch });
      } else if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: orSearch }];
        delete query.$or;
      } else {
        query.$or = orSearch;
      }
    }

    const [totalUsers, users, topPincodesAgg, topCitiesAgg] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .select("name phone email accountType shopName shopAddress gstNumber isActive status isBlocked blockReason blockedAt createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Address.aggregate([
        { $match: { pincode: { $exists: true, $ne: "" } } },
        { $group: { _id: "$pincode", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]).catch(() => []),
      Address.aggregate([
        { $match: { city: { $exists: true, $ne: "" } } },
        { $group: { _id: "$city", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]).catch(() => []),
    ]);

    // Attach addresses and order counts
    const userIds = users.map((u) => u._id);
    const [addresses, userOrderCounts] = await Promise.all([
      Address.find({ user: { $in: userIds } })
        .select("user pincode city state area fullAddress isDefault")
        .sort({ isDefault: -1, updatedAt: -1 })
        .lean(),
      Order.aggregate([
        { $match: { user: { $in: userIds } } },
        { $group: { _id: "$user", count: { $sum: 1 }, totalSpent: { $sum: "$total" } } },
      ]).catch(() => []),
    ]);

    const addressByUser = new Map();
    for (const a of addresses) {
      const uid = String(a.user);
      if (!addressByUser.has(uid) || a.isDefault) {
        addressByUser.set(uid, {
          pincode: a.pincode || "",
          city: a.city || "",
          state: a.state || "",
          area: a.area || "",
          fullAddress: a.fullAddress || "",
        });
      }
    }

    const ordersByUser = new Map();
    for (const o of userOrderCounts) {
      ordersByUser.set(String(o._id), {
        orderCount: o.count || 0,
        totalSpent: o.totalSpent || 0,
      });
    }

    const formatted = users.map((u) => {
      const uid = String(u._id);
      const blocked = Boolean(u.isBlocked || u.isActive === false || u.status === "blocked" || u.status === "inactive");
      const addr = addressByUser.get(uid) || null;
      const orderStats = ordersByUser.get(uid) || { orderCount: 0, totalSpent: 0 };
      return {
        userId: uid,
        name: u.name,
        phone: u.phone,
        email: u.email || "",
        accountType: u.accountType || "retail",
        shopName: u.shopName || "",
        shopAddress: u.shopAddress || "",
        gstNumber: u.gstNumber || "",
        address: addr,
        pincode: addr?.pincode || "",
        city: addr?.city || "",
        orderCount: orderStats.orderCount,
        totalSpent: orderStats.totalSpent,
        isActive: !blocked,
        status: blocked ? "blocked" : "active",
        isBlocked: blocked,
        blockReason: u.blockReason || "",
        blockedAt: u.blockedAt || null,
        createdAt: u.createdAt,
      };
    });

    const popularCities = (topCitiesAgg || [])
      .map((c) => ({ city: String(c._id).trim(), count: c.count }))
      .filter((c) => c.city && c.city !== "undefined");

    const popularPincodes = (topPincodesAgg || [])
      .map((p) => ({ pincode: String(p._id), count: p.count }))
      .filter((p) => /^\d{6}$/.test(p.pincode));

    return ok(res, formatted, {
      total: totalUsers,
      page,
      limit,
      totalPages: Math.ceil(totalUsers / limit),
      popularPincodes,
      popularCities,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List unblock requests submitted by blocked users.
 */
export async function listUnblockRequests(req, res, next) {
  try {
    const status = String(req.query.status || "all").trim().toLowerCase();
    const search = String(req.query.search || req.query.q || "").trim();

    const filter = {};
    if (status && status !== "all") {
      filter.status = status;
    }

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(escaped, "i");
      const digits = search.replace(/\D/g, "");
      const orClauses = [
        { name: searchRegex },
        { email: searchRegex },
        { reason: searchRegex },
      ];
      if (digits) {
        orClauses.push({ phone: new RegExp(digits, "i") });
      }
      filter.$or = orClauses;
    }

    const [requests, pendingCount] = await Promise.all([
      UnblockRequest.find(filter).sort({ createdAt: -1 }).lean(),
      UnblockRequest.countDocuments({ status: "pending" }),
    ]);

    const formatted = requests.map((item) => ({
      id: String(item._id),
      userId: String(item.userId),
      name: item.name || "Customer",
      phone: item.phone,
      email: item.email || "",
      accountType: item.accountType || "retail",
      reason: item.reason,
      status: item.status,
      adminNotes: item.adminNotes || "",
      reviewedAt: item.reviewedAt || null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    return ok(res, formatted, {
      count: formatted.length,
      pendingCount,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Review an unblock request (Approve & Unblock or Reject).
 */
export async function reviewUnblockRequest(req, res, next) {
  try {
    const id = String(req.params.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail(res, 400, "Invalid unblock request ID");
    }

    const action = String(req.body.action || "").trim().toLowerCase();
    if (action !== "approve" && action !== "reject") {
      return fail(res, 400, "Action must be either 'approve' or 'reject'");
    }

    const adminNotes = String(req.body.adminNotes || req.body.notes || "").trim();

    const request = await UnblockRequest.findById(id);
    if (!request) return fail(res, 404, "Unblock request not found");

    if (action === "approve") {
      request.status = "approved";
      request.adminNotes = adminNotes || "Approved and reactivated by administrator";
      request.reviewedAt = new Date();
      if (req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id)) {
        request.reviewedBy = req.user.id;
      }
      await request.save();

      // Automatically reactivate the user
      const user = await User.findById(request.userId);
      if (user) {
        user.isActive = true;
        user.isBlocked = false;
        user.status = "active";
        user.blockReason = "";
        user.blockedAt = null;
        await user.save();
      }

      return ok(res, request, {
        message: "Unblock request approved. User account has been reactivated.",
      });
    }

    if (action === "reject") {
      request.status = "rejected";
      request.adminNotes = adminNotes || "Appeal rejected by administrator";
      request.reviewedAt = new Date();
      if (req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id)) {
        request.reviewedBy = req.user.id;
      }
      await request.save();

      return ok(res, request, {
        message: "Unblock request rejected.",
      });
    }
  } catch (error) {
    next(error);
  }
}

/** Toggle block / unblock a customer */
export async function toggleUserMgmtBlock(req, res, next) {
  try {
    const userId = String(req.params.userId || "").trim();
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return fail(res, 400, "Invalid user id");
    }

    const user = await User.findById(userId);
    if (!user) return fail(res, 404, "User not found");
    if (user.role === "admin") return fail(res, 403, "Cannot block admin users");

    const currentBlocked =
      user.isBlocked === true ||
      user.blocked === true ||
      user.isActive === false ||
      user.active === false ||
      String(user.status || "").trim().toLowerCase() === "blocked" ||
      String(user.status || "").trim().toLowerCase() === "inactive";

    const blockRequested = typeof req.body.isBlocked === "boolean" ? req.body.isBlocked : !currentBlocked;

    user.isBlocked = blockRequested;
    user.isActive = !blockRequested;
    user.status = blockRequested ? "blocked" : "active";

    if (blockRequested) {
      user.blockReason = String(req.body.reason || req.body.blockReason || "Blocked by administrator").trim();
      user.blockedAt = user.blockedAt || new Date();
    } else {
      user.blockReason = "";
      user.blockedAt = null;
    }

    await user.save();

    return ok(
      res,
      {
        userId: String(user._id),
        name: user.name,
        phone: user.phone,
        email: user.email,
        accountType: user.accountType,
        isBlocked: user.isBlocked,
        isActive: user.isActive,
        status: user.status,
        blockReason: user.blockReason || "",
        blockedAt: user.blockedAt || null,
      },
      { message: blockRequested ? "User blocked successfully" : "User unblocked successfully" }
    );
  } catch (error) {
    next(error);
  }
}

import { RolePolicy, POLICY_ROLE_KEYS } from "./models.js";
import { ROLE_LABELS } from "../../staff-service/src/constants/roles.js";
import { createMemoryCache } from "../../shared/cache/memoryCache.js";
import {
  TERMS_BODY,
  PRIVACY_BODY,
  REFUND_BODY,
  SHIPPING_BODY,
  LEGACY_CUSTOMER_BODIES,
} from "./customerPolicyContent.js";

const livePoliciesCache = createMemoryCache({
  name: "role-policies-live",
  ttlMs: 10 * 60_000,
  collections: [RolePolicy.collection.collectionName],
  maxEntries: POLICY_ROLE_KEYS.length + 1,
});

const ok = (res, data, extra = {}) => res.json({ success: true, data, ...extra });
const fail = (res, status, message) => res.status(status).json({ success: false, message });

function roleLabel(value) {
  if (value === "admin") return "Admin";
  if (value === "customer") return "Users (Frontend site)";
  if (value === "all") return "All roles";
  return ROLE_LABELS[value] || String(value || "").replaceAll("_", " ");
}

export const POLICY_ROLES = POLICY_ROLE_KEYS.map((value) => ({
  value,
  label: roleLabel(value),
}));

function serializePolicy(doc) {
  if (!doc) return null;
  const row = doc.toObject ? doc.toObject() : doc;
  return {
    _id: String(row._id),
    id: String(row._id),
    title: row.title || "",
    body: row.body || "",
    pageKey: row.pageKey || "",
    roleKey: row.roleKey || "all",
    status: row.status || "draft",
    sortOrder: row.sortOrder ?? 0,
    createdBy: row.createdBy || "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const CUSTOMER_PAGE_KEYS = ["privacy", "terms", "refund", "shipping", "general"];

function normalizePageKey(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (CUSTOMER_PAGE_KEYS.includes(value)) return value;
  return "";
}

const PAGE_TITLE_PATTERNS = {
  privacy: /privacy\s*policy|^privacy\b/i,
  terms: /terms/i,
  refund: /refund|return/i,
  shipping: /shipping|delivery\s*policy/i,
};

function inferPageKeyFromTitle(title) {
  const t = String(title || "");
  for (const [key, pattern] of Object.entries(PAGE_TITLE_PATTERNS)) {
    if (pattern.test(t)) return key;
  }
  return "";
}

function normalizeRoleKey(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (!value || value === "all") return "all";
  if (value === "user" || value === "users" || value === "frontend" || value === "retail" || value === "bulk") {
    return "customer";
  }
  if (POLICY_ROLE_KEYS.includes(value)) return value;
  return null;
}

function defaultPoliciesForRole(roleKey) {
  if (roleKey === "customer") {
    return [
      { title: "Terms & Conditions", pageKey: "terms", body: TERMS_BODY, sortOrder: 1 },
      { title: "Privacy Policy", pageKey: "privacy", body: PRIVACY_BODY, sortOrder: 2 },
      { title: "Return & Refund Policy", pageKey: "refund", body: REFUND_BODY, sortOrder: 3 },
      { title: "Shipping & Delivery Policy", pageKey: "shipping", body: SHIPPING_BODY, sortOrder: 4 },
    ].map((row) => ({ ...row, roleKey, status: "published", createdBy: "system" }));
  }

  const label = roleLabel(roleKey);
  return [
    {
      title: "Code of Conduct",
      body: `GreenGrocc Code of Conduct for ${label}

1. Treat customers, partners, and teammates with respect.
2. Follow company instructions and local laws while working.
3. Do not share confidential customer or business data outside authorized channels.
4. Report safety issues, fraud, or misconduct to your manager immediately.
5. Maintain professional behaviour on the app, calls, and in person.`,
      roleKey,
      status: "published",
      sortOrder: 1,
      createdBy: "system",
    },
    {
      title: "Work Guidelines",
      body: `Work Guidelines for ${label}

1. Keep your profile, availability, and contact details up to date.
2. Complete assigned tasks within the expected timelines.
3. Use the GreenGrocc panel/app for official updates only.
4. Follow inventory, order, and handover processes carefully.
5. Ask your reporting manager when unsure about a process.`,
      roleKey,
      status: "published",
      sortOrder: 2,
      createdBy: "system",
    },
    {
      title: "Safety & Privacy Policy",
      body: `Safety & Privacy Policy for ${label}

1. Protect personal data of customers, farmers, and staff.
2. Do not take or share photos of documents or orders unless required by process.
3. Follow workplace safety rules at farms, stores, and hubs.
4. Never ask customers for OTPs, passwords, or payment credentials.
5. GreenGrocc may update this policy; check this page regularly.`,
      roleKey,
      status: "published",
      sortOrder: 3,
      createdBy: "system",
    },
  ];
}

/** Seed starter policies for every role when that role has none. */
export async function seedDefaultRolePoliciesIfEmpty() {
  try {
    let created = 0;
    let updated = 0;
    for (const roleKey of POLICY_ROLE_KEYS) {
      const count = await RolePolicy.countDocuments({ roleKey });
      if (count > 0) continue;
      const rows = defaultPoliciesForRole(roleKey);
      await RolePolicy.insertMany(rows);
      created += rows.length;
    }

    // Ensure the Users site always has Terms, Privacy, Refund and Shipping pages
    const customerDefaults = defaultPoliciesForRole("customer");
    for (const def of customerDefaults) {
      const exists = await RolePolicy.findOne({
        roleKey: "customer",
        $or: [{ pageKey: def.pageKey }, { title: { $regex: PAGE_TITLE_PATTERNS[def.pageKey] } }],
      }).lean();
      if (exists) {
        const $set = {};
        if (!exists.pageKey) $set.pageKey = def.pageKey;
        // Upgrade the old 5-line starter text, but never overwrite admin-edited content
        if (exists.createdBy === "system" && LEGACY_CUSTOMER_BODIES.includes(String(exists.body || "").trim())) {
          $set.title = def.title;
          $set.body = def.body;
        }
        if (Object.keys($set).length > 0) {
          await RolePolicy.updateOne({ _id: exists._id }, { $set });
          updated += 1;
        }
        continue;
      }
      await RolePolicy.create(def);
      created += 1;
    }

    // Backfill pageKey on existing rows from title so admins can rename titles freely
    const missingKeys = await RolePolicy.find({
      $or: [{ pageKey: { $exists: false } }, { pageKey: "" }],
    }).select("_id title");
    for (const row of missingKeys) {
      const key = inferPageKeyFromTitle(row.title);
      if (!key) continue;
      await RolePolicy.updateOne({ _id: row._id }, { $set: { pageKey: key } });
      updated += 1;
    }

    if (created > 0 || updated > 0) livePoliciesCache.invalidate();
    if (created > 0) {
      console.log(`[Policies] Seeded ${created} default role policies`);
    }
  } catch (error) {
    console.error("[Policies] Failed to seed default policies:", error.message);
  }
}

/** Public / role-panel: published policies for a role (plus "all"). */
export async function listLiveRolePolicies(req, res, next) {
  try {
    const roleKey = normalizeRoleKey(req.query.role || req.query.roleKey) || "all";
    const filter =
      roleKey === "all"
        ? { status: "published", roleKey: "all" }
        : { status: "published", roleKey: { $in: [roleKey, "all"] } };

    const data = await livePoliciesCache.get(`role-policies:live:${roleKey}`, async () => {
      const rows = await RolePolicy.find(filter).sort({ sortOrder: 1, updatedAt: -1 }).lean();
      return rows.map(serializePolicy);
    });
    return ok(res, data, { roleKey, count: data.length });
  } catch (error) {
    next(error);
  }
}

/** Admin: overview of all roles with policy counts. */
export async function listPolicyRoles(req, res, next) {
  try {
    await seedDefaultRolePoliciesIfEmpty();

    const grouped = await RolePolicy.aggregate([
      { $match: { roleKey: { $in: POLICY_ROLE_KEYS } } },
      {
        $group: {
          _id: "$roleKey",
          total: { $sum: 1 },
          published: {
            $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] },
          },
          draft: {
            $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] },
          },
          updatedAt: { $max: "$updatedAt" },
        },
      },
    ]);

    const byRole = Object.fromEntries(grouped.map((g) => [g._id, g]));
    const data = POLICY_ROLES.map((role) => {
      const stats = byRole[role.value] || {};
      return {
        roleKey: role.value,
        label: role.label,
        total: stats.total || 0,
        published: stats.published || 0,
        draft: stats.draft || 0,
        updatedAt: stats.updatedAt || null,
      };
    });

    return ok(res, data, { count: data.length });
  } catch (error) {
    next(error);
  }
}

/** Admin: list policies with optional role/status filters. */
export async function listRolePolicies(req, res, next) {
  try {
    await seedDefaultRolePoliciesIfEmpty();

    const filter = {};
    const roleKey = String(req.query.roleKey || req.query.role || "all").trim().toLowerCase();
    const status = String(req.query.status || "all").trim().toLowerCase();

    if (roleKey && roleKey !== "all") {
      const normalized = normalizeRoleKey(roleKey);
      if (!normalized || normalized === "all") return fail(res, 400, "Invalid role");
      filter.roleKey = normalized;
    }
    if (status && status !== "all") {
      if (!["draft", "published"].includes(status)) return fail(res, 400, "Invalid status");
      filter.status = status;
    }

    const rows = await RolePolicy.find(filter).sort({ roleKey: 1, sortOrder: 1, updatedAt: -1 }).lean();
    const roleMeta =
      roleKey && roleKey !== "all"
        ? { roleKey, label: roleLabel(roleKey) }
        : null;

    return ok(res, rows.map(serializePolicy), {
      roles: POLICY_ROLES,
      role: roleMeta,
      count: rows.length,
      stats: {
        total: rows.length,
        published: rows.filter((r) => r.status === "published").length,
        draft: rows.filter((r) => r.status === "draft").length,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createRolePolicy(req, res, next) {
  try {
    const title = String(req.body.title || "").trim();
    const body = String(req.body.body || "").trim();
    const roleKey = normalizeRoleKey(req.body.roleKey);
    const status = String(req.body.status || "published").trim().toLowerCase();
    const sortOrder = Number(req.body.sortOrder) || 0;
    const pageKey =
      normalizePageKey(req.body.pageKey) || inferPageKeyFromTitle(title);

    if (!title) return fail(res, 400, "Title is required");
    if (!roleKey || roleKey === "all" || !POLICY_ROLE_KEYS.includes(roleKey)) {
      return fail(res, 400, "Choose a valid role");
    }
    if (!["draft", "published"].includes(status)) return fail(res, 400, "Invalid status");

    const row = await RolePolicy.create({
      title,
      body,
      pageKey,
      roleKey,
      status,
      sortOrder,
      createdBy: req.user?.email || req.user?.name || req.user?.id || "",
    });

    livePoliciesCache.invalidate();
    return ok(res, serializePolicy(row), { message: "Policy created" });
  } catch (error) {
    next(error);
  }
}

export async function updateRolePolicy(req, res, next) {
  try {
    const row = await RolePolicy.findById(req.params.id);
    if (!row) return fail(res, 404, "Policy not found");

    if (req.body.title !== undefined) {
      const title = String(req.body.title || "").trim();
      if (!title) return fail(res, 400, "Title is required");
      row.title = title;
    }
    if (req.body.body !== undefined) row.body = String(req.body.body || "").trim();
    if (req.body.pageKey !== undefined) {
      row.pageKey = normalizePageKey(req.body.pageKey);
    } else if (req.body.title !== undefined && !row.pageKey) {
      row.pageKey = inferPageKeyFromTitle(row.title);
    }
    if (req.body.roleKey !== undefined) {
      const roleKey = normalizeRoleKey(req.body.roleKey);
      if (!roleKey || roleKey === "all" || !POLICY_ROLE_KEYS.includes(roleKey)) {
        return fail(res, 400, "Invalid role");
      }
      row.roleKey = roleKey;
    }
    if (req.body.status !== undefined) {
      const status = String(req.body.status || "").trim().toLowerCase();
      if (!["draft", "published"].includes(status)) return fail(res, 400, "Invalid status");
      row.status = status;
    }
    if (req.body.sortOrder !== undefined) {
      row.sortOrder = Number(req.body.sortOrder) || 0;
    }

    await row.save();
    livePoliciesCache.invalidate();
    return ok(res, serializePolicy(row), { message: "Policy updated" });
  } catch (error) {
    next(error);
  }
}

export async function deleteRolePolicy(req, res, next) {
  try {
    const row = await RolePolicy.findByIdAndDelete(req.params.id);
    if (!row) return fail(res, 404, "Policy not found");
    livePoliciesCache.invalidate();
    return ok(res, { id: String(row._id) }, { message: "Policy deleted" });
  } catch (error) {
    next(error);
  }
}

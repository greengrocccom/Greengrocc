import mongoose from "mongoose";
import SupportMessage, {
  SUPPORT_ISSUE_TYPES,
  SUPPORT_ROLE_KEYS,
} from "../models/support/SupportMessage.js";
import { resolveImageForStorage } from "../utils/imageValidation.js";
import { UPLOAD_FOLDERS } from "../utils/uploadFolders.js";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination.js";
import { buildSupportSearchFilter } from "../utils/adminSearch.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeSupportRoleKey(raw, fallback = "customer") {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "user" || value === "users" || value === "frontend" || value === "retail" || value === "bulk") {
    return "customer";
  }
  if (value === "driver") return "pickup_driver";
  if (SUPPORT_ROLE_KEYS.includes(value)) return value;
  return fallback;
}

export const submitSupportMessage = async (req, res) => {
  try {
    const name = normalizeText(req.body.name, 100);
    const email = normalizeText(req.body.email, 150).toLowerCase();
    const phone = normalizeText(req.body.phone, 20);
    const orderId = normalizeText(req.body.orderId, 50);
    const issueType = normalizeText(req.body.issueType, 50);
    const message = normalizeText(req.body.message, 2000);
    const attachment = typeof req.body.attachment === "string" ? req.body.attachment : "";
    const attachmentName = normalizeText(req.body.attachmentName, 200);
    const roleKey = normalizeSupportRoleKey(
      req.body.roleKey || req.body.role || req.user?.role,
      "customer"
    );

    if (!name) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }
    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ success: false, message: "Valid email is required" });
    }
    if (!phone) {
      return res.status(400).json({ success: false, message: "Phone is required" });
    }
    if (!issueType || !SUPPORT_ISSUE_TYPES.includes(issueType)) {
      return res.status(400).json({ success: false, message: "Valid issue type is required" });
    }
    if (!message) {
      return res.status(400).json({ success: false, message: "Message is required" });
    }
    let storedAttachment = "";
    if (attachment) {
      const resolved = await resolveImageForStorage(attachment, UPLOAD_FOLDERS.SUPPORT);
      if (resolved.error) {
        return res.status(400).json({ success: false, message: resolved.error });
      }
      storedAttachment = resolved.url;
    }

    const supportMessage = await SupportMessage.create({
      name,
      email,
      phone,
      orderId,
      issueType,
      message,
      attachment: storedAttachment,
      attachmentName,
      roleKey,
      user: req.user?._id || null,
    });

    return res.status(201).json({
      success: true,
      message: "Your support request has been submitted. We will get back to you soon.",
      data: { id: supportMessage._id, roleKey },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to submit support request",
    });
  }
};

export const getAllSupportMessages = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const { status } = req.query;
    const andClauses = [];

    if (status && status !== "all" && ["open", "resolved"].includes(status)) {
      andClauses.push({ status });
    }

    const searchClause = buildSupportSearchFilter(req.query.search);
    if (searchClause) andClauses.push(searchClause);

    const filter = andClauses.length ? { $and: andClauses } : {};

    const [total, messages] = await Promise.all([
      SupportMessage.countDocuments(filter),
      SupportMessage.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("name email phone orderId issueType message attachmentName status createdAt attachment")
        .lean(),
    ]);

    const data = messages.map(({ attachment, ...rest }) => ({
      ...rest,
      hasAttachment: Boolean(attachment),
    }));

    return res.json(buildPaginatedResponse(data, total, page, limit));
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load support messages",
    });
  }
};

export const getSupportUnreadCount = async (req, res) => {
  try {
    const { since } = req.query;
    const filter = {};

    if (since) {
      const sinceDate = new Date(since);
      if (Number.isNaN(sinceDate.getTime())) {
        return res.status(400).json({ success: false, message: "Invalid since date" });
      }
      filter.createdAt = { $gt: sinceDate };
    }

    const count = await SupportMessage.countDocuments(filter);

    return res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load unread support count",
    });
  }
};

export const getSupportMessageById = async (req, res) => {
  try {
    const message = await SupportMessage.findById(req.params.id).lean();

    if (!message) {
      return res.status(404).json({ success: false, message: "Support message not found" });
    }

    return res.json({ success: true, data: message });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load support message",
    });
  }
};

export const updateSupportMessageStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["open", "resolved"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const message = await SupportMessage.findByIdAndUpdate(
      req.params.id,
      { status },
      { returnDocument: 'after', runValidators: true }
    ).select("-attachment");

    if (!message) {
      return res.status(404).json({ success: false, message: "Support message not found" });
    }

    return res.json({
      success: true,
      message: "Status updated",
      data: message,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update support message",
    });
  }
};


export const getSupportContact = async (req, res) => {
  try {
    const { vendorId, darkStoreId } = req.query;
    let targetVendorId = vendorId;

    if (!targetVendorId && darkStoreId) {
      try {
        const DeliveryManager = mongoose.models.DeliveryManager || mongoose.model("DeliveryManager");
        const store = await DeliveryManager.findById(darkStoreId).lean();
        if (store?.vendorId) {
          targetVendorId = store.vendorId;
        }
      } catch (err) {
        // ignore
      }
    }

    let globalConfig = null;
    try {
      const GlobalSupportConfig = mongoose.models.GlobalSupportConfig || mongoose.model("GlobalSupportConfig");
      globalConfig = await GlobalSupportConfig.findOne({ key: "default" }).lean();
    } catch (err) {
      // ignore
    }

    const fallbackGlobal = {
      phone: "+91 74002 22233",
      phoneRaw: "7400222233",
      whatsapp: "+91 74002 22233",
      whatsappRaw: "917400222233",
      whatsappMessage: "Hi, I need support with my GreenGrocc order.",
      email: "greengrocc@gmail.com",
      hours: "Mon – Sat · 10 AM – 10 PM",
      address: "Mumbai Central, Mumbai, Maharashtra",
    };

    const global = { ...fallbackGlobal, ...(globalConfig || {}) };

    if (targetVendorId) {
      try {
        const Vendor = mongoose.models.Vendor || mongoose.model("Vendor");
        const vendor = await Vendor.findOne({
          $or: [
            { id: String(targetVendorId) },
            ...(mongoose.isValidObjectId(targetVendorId) ? [{ _id: targetVendorId }] : []),
          ],
        }).lean();

        if (vendor && vendor.support && vendor.support.isActive !== false) {
          const vSupport = vendor.support;
          const phone = (vSupport.phone || "").trim() || global.phone;
          const rawPhone = phone.replace(/[^\d+]/g, "");
          const whatsapp = (vSupport.whatsapp || "").trim() || global.whatsapp;
          let rawWhatsapp = whatsapp.replace(/\D/g, "");
          if (rawWhatsapp.length === 10) rawWhatsapp = "91" + rawWhatsapp;
          const whatsappMessage = (vSupport.whatsappMessage || "").trim() || global.whatsappMessage;
          const email = (vSupport.email || "").trim() || global.email;
          const hours = (vSupport.hours || "").trim() || global.hours;

          return res.json({
            success: true,
            isVendorSpecific: true,
            vendorId: vendor.id,
            vendorName: vendor.vendorName || vendor.ownerName || vendor.businessName || "Vendor Support",
            phone,
            phoneRaw: rawPhone,
            phoneTel: `tel:${rawPhone.startsWith("+") ? rawPhone : "+" + rawPhone}`,
            whatsapp,
            whatsappRaw: rawWhatsapp,
            whatsappMessage,
            whatsappHref: `https://wa.me/${rawWhatsapp}?text=${encodeURIComponent(whatsappMessage)}`,
            email,
            hours,
            address: global.address,
          });
        }
      } catch (err) {
        // fallback
      }
    }

    // Default platform support
    const rawPhone = global.phone.replace(/[^\d+]/g, "");
    let rawWhatsapp = (global.whatsappRaw || global.whatsapp).replace(/\D/g, "");
    if (rawWhatsapp.length === 10) rawWhatsapp = "91" + rawWhatsapp;

    return res.json({
      success: true,
      isVendorSpecific: false,
      vendorName: "GreenGrocc Support",
      phone: global.phone,
      phoneRaw: rawPhone,
      phoneTel: `tel:${rawPhone.startsWith("+") ? rawPhone : "+" + rawPhone}`,
      whatsapp: global.whatsapp,
      whatsappRaw: rawWhatsapp,
      whatsappMessage: global.whatsappMessage,
      whatsappHref: `https://wa.me/${rawWhatsapp}?text=${encodeURIComponent(global.whatsappMessage)}`,
      email: global.email,
      hours: global.hours,
      address: global.address,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to load support contact",
    });
  }
};

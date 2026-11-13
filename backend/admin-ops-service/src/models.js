import mongoose from "mongoose";

const giftCardSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    amount: { type: Number, required: true, min: 1 },
    balance: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["active", "redeemed", "disabled", "expired"],
      default: "active",
      index: true,
    },
    expiresAt: { type: Date, default: null },
    issuedToName: { type: String, default: "", trim: true },
    issuedToPhone: { type: String, default: "", trim: true },
    note: { type: String, default: "", trim: true },
    redeemedAt: { type: Date, default: null },
    orderId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

const pricingTierSlabSchema = new mongoose.Schema(
  {
    minQuantity: { type: Number, required: true, min: 1 },
    maxQuantity: { type: Number, default: null },
    discountType: { type: String, enum: ["percentage", "fixed"], default: "percentage" },
    discountValue: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const dynamicPricingRuleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    ruleType: {
      type: String,
      enum: [
        "quantity_discount",
        "bundle_pricing",
        "tiered_quantity",
        "free_addon",
        "loyalty_discount",
        "heavy_handling_fee",
      ],
      default: "quantity_discount",
      index: true,
    },
    enabled: { type: Boolean, default: true, index: true },
    applyTo: {
      type: String,
      enum: ["all", "products", "categories", "custom", "weight_threshold", "all_heavy"],
      default: "all",
    },
    productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "GreenGroccProduct" }],
    categoryNames: [{ type: String, trim: true }],
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },

    // 1. Quantity-based discounts
    minQuantity: { type: Number, default: 1, min: 1 },
    discountType: { type: String, enum: ["percentage", "fixed"], default: "percentage" },
    discountValue: { type: Number, default: 0, min: 0 },

    // 2. Bundle pricing (e.g., 3 t-shirts for fixed price, with exceptions)
    bundleQuantity: { type: Number, default: 3, min: 1 },
    bundlePrice: { type: Number, default: 0, min: 0 },
    exceptionProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "GreenGroccProduct" }],
    exceptionCategoryNames: [{ type: String, trim: true }],

    // 3. Tiered quantity discounts (e.g., 2–5 units at 10%, 6+ at 20%)
    tiers: { type: [pricingTierSlabSchema], default: [] },

    // 4. Free/discounted add-on items with a purchase
    triggerType: {
      type: String,
      enum: ["min_spend", "specific_products", "specific_categories", "any_order"],
      default: "min_spend",
    },
    minSpend: { type: Number, default: 0, min: 0 },
    triggerProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "GreenGroccProduct" }],
    triggerCategoryNames: [{ type: String, trim: true }],
    addonProductId: { type: mongoose.Schema.Types.ObjectId, ref: "GreenGroccProduct", default: null },
    addonProductName: { type: String, default: "", trim: true },
    addonQuantity: { type: Number, default: 1, min: 1 },
    addonDiscountType: {
      type: String,
      enum: ["free", "percentage", "fixed_price"],
      default: "free",
    },
    addonDiscountValue: { type: Number, default: 100, min: 0 },

    // 5. Lifetime loyalty discounts after a set number of orders
    minCompletedOrders: { type: Number, default: 5, min: 1 },
    maxDiscountAmount: { type: Number, default: 0, min: 0 },
    minOrderValue: { type: Number, default: 0, min: 0 },

    // 6. Extra handling fee for heavy items
    feeAmount: { type: Number, default: 0, min: 0 },
    feeType: {
      type: String,
      enum: ["per_item", "per_order", "per_kg_over_threshold"],
      default: "per_order",
    },
    heavyWeightThresholdKg: { type: Number, default: 5, min: 0 },
  },
  { timestamps: true }
);

const bulkSellingDealSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "GreenGroccProduct", required: true },
    productName: { type: String, default: "", trim: true },
    sku: { type: String, default: "", trim: true },
    minQuantity: { type: Number, required: true, min: 1, default: 10 },
    maxQuantity: { type: Number, default: null },
    discountPercent: { type: Number, default: 5, min: 0, max: 100 },
    pricePerUnit: { type: Number, default: null, min: 0 },
  },
  { timestamps: true }
);

const refundClaimSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    orderNumber: { type: String, default: "", trim: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "UserBulkMart", default: null, index: true },
    accountType: {
      type: String,
      enum: ["retail", "bulk"],
      default: "retail",
      index: true,
    },
    type: { type: String, enum: ["refund", "warranty"], default: "refund", index: true },
    reason: { type: String, required: true, trim: true },
    amount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "successful", "approved", "processed"],
      default: "pending",
      index: true,
    },
    customerName: { type: String, default: "", trim: true },
    customerPhone: { type: String, default: "", trim: true },
    customerAddress: { type: String, default: "", trim: true },
    productImage: { type: String, default: "", trim: true },
    adminNote: { type: String, default: "", trim: true },
    darkStoreId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryManager",
      default: null,
      index: true,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryManager",
      default: null,
      index: true,
    },
    returnPickupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReturnPickup",
      default: null,
    },
    acceptedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    successfulAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const financeLedgerSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["income", "expense", "payout", "settlement"],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    storeName: { type: String, default: "", trim: true },
    vendorName: { type: String, default: "", trim: true },
    reference: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const vendorCommissionPaymentSchema = new mongoose.Schema(
  {
    vendorId: { type: String, required: true, trim: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    paidAt: { type: Date, default: Date.now },
    method: { type: String, default: "", trim: true },
    reference: { type: String, default: "", trim: true },
    note: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

const HR_EMPLOYEE_TYPES = [
  "staff",
  "farmer_manager",
  "pickup_driver",
  "delivery_manager",
  "delivery_boy",
];

const hrAttendanceSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, trim: true, index: true },
    employeeType: {
      type: String,
      enum: HR_EMPLOYEE_TYPES,
      default: "staff",
      index: true,
    },
    name: { type: String, required: true, trim: true },
    role: { type: String, default: "", trim: true },
    date: { type: String, required: true, trim: true, index: true },
    clockIn: { type: Date, default: Date.now },
    clockOut: { type: Date, default: null },
    notes: { type: String, default: "", trim: true },
    source: { type: String, default: "staff_app", trim: true },
    status: {
      type: String,
      enum: ["present", "late", "half_day", "on_leave", "absent"],
      default: "present",
      index: true,
    },
    workDurationMinutes: { type: Number, default: 0 },
  },
  { timestamps: true }
);
hrAttendanceSchema.index({ date: 1, employeeId: 1 });

const hrEmploymentSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, trim: true, index: true },
    employeeType: { type: String, enum: HR_EMPLOYEE_TYPES, required: true, index: true },
    name: { type: String, default: "", trim: true },
    department: { type: String, default: "", trim: true },
    designation: { type: String, default: "", trim: true },
    joiningDate: { type: String, default: "", trim: true },
    salaryDate: { type: String, default: "", trim: true },
    monthlySalary: { type: Number, default: 0, min: 0 },
    salaryTax: { type: Number, default: 0, min: 0 },
    bankAccount: { type: String, default: "", trim: true },
    ifsc: { type: String, default: "", trim: true },
    upi: { type: String, default: "", trim: true },
    workNotes: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);
hrEmploymentSchema.index({ employeeType: 1, employeeId: 1 }, { unique: true });

if (mongoose.models.AdminHrEmployment) {
  mongoose.models.AdminHrEmployment.schema.add({
    salaryDate: { type: String, default: "", trim: true },
    salaryTax: { type: Number, default: 0, min: 0 },
    workNotes: { type: String, default: "", trim: true },
  });
}

const hrPayrollSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, trim: true, index: true },
    employeeType: { type: String, enum: HR_EMPLOYEE_TYPES, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, default: "", trim: true },
    roleKey: { type: String, default: "", trim: true, index: true },
    month: { type: String, required: true, trim: true, index: true },
    gross: { type: Number, required: true, min: 0 },
    deductions: { type: Number, default: 0, min: 0 },
    net: { type: Number, required: true, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    payrunId: { type: String, default: "", trim: true, index: true },
    status: { type: String, enum: ["pending", "paid"], default: "pending", index: true },
    paidAt: { type: Date, default: null },
    notes: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);
hrPayrollSchema.index({ employeeType: 1, employeeId: 1, month: 1 }, { unique: true });

const hrTaskSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, trim: true, index: true },
    employeeType: { type: String, enum: HR_EMPLOYEE_TYPES, required: true },
    name: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    details: { type: String, default: "", trim: true },
    dueDate: { type: String, default: "", trim: true },
    status: { type: String, enum: ["open", "in_progress", "done"], default: "open", index: true },
  },
  { timestamps: true }
);

export const GiftCard = mongoose.models.AdminGiftCard || mongoose.model("AdminGiftCard", giftCardSchema);
export const DynamicPricingRule =
  mongoose.models.AdminDynamicPricingRule ||
  mongoose.model("AdminDynamicPricingRule", dynamicPricingRuleSchema);
export const BulkSellingDeal =
  mongoose.models.AdminBulkSellingDeal || mongoose.model("AdminBulkSellingDeal", bulkSellingDealSchema);
export const RefundClaim =
  mongoose.models.AdminRefundClaim || mongoose.model("AdminRefundClaim", refundClaimSchema);
export const FinanceLedger =
  mongoose.models.AdminFinanceLedger || mongoose.model("AdminFinanceLedger", financeLedgerSchema);
export const VendorCommissionPayment =
  mongoose.models.AdminVendorCommissionPayment ||
  mongoose.model("AdminVendorCommissionPayment", vendorCommissionPaymentSchema);
export const HrAttendance =
  mongoose.models.AdminHrAttendance || mongoose.model("AdminHrAttendance", hrAttendanceSchema);
export const HrEmployment =
  mongoose.models.AdminHrEmployment || mongoose.model("AdminHrEmployment", hrEmploymentSchema);
export const HrPayroll =
  mongoose.models.AdminHrPayroll || mongoose.model("AdminHrPayroll", hrPayrollSchema);
export const HrTask = mongoose.models.AdminHrTask || mongoose.model("AdminHrTask", hrTaskSchema);

const HR_ROLE_KEYS = [
  "vendor",
  "segregation_manager",
  "product_manager",
  "farmer_manager",
  "farmer",
  "pickup_driver",
  "delivery_manager",
  "delivery_boy",
  "admin",
];

const hrAnnouncementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, default: "", trim: true },
    roleKey: { type: String, default: "all", trim: true, index: true },
    category: {
      type: String,
      enum: ["announcement", "holiday", "note"],
      default: "announcement",
      index: true,
    },
    status: { type: String, enum: ["draft", "scheduled", "published"], default: "draft", index: true },
    scheduledAt: { type: String, default: "", trim: true },
    publishedAt: { type: Date, default: null },
    createdBy: { type: String, default: "", trim: true },
    vendorId: { type: String, default: "", trim: true, index: true },
  },
  { timestamps: true }
);

const hrLeavePolicySchema = new mongoose.Schema(
  {
    roleKey: { type: String, required: true, unique: true, trim: true },
    casualDays: { type: Number, default: 12, min: 0 },
    sickDays: { type: Number, default: 12, min: 0 },
    earnedDays: { type: Number, default: 15, min: 0 },
    notes: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

const hrVendorLeavePolicySchema = new mongoose.Schema(
  {
    vendorId: { type: String, required: true, trim: true },
    roleKey: { type: String, required: true, trim: true },
    casualDays: { type: Number, default: 12, min: 0 },
    sickDays: { type: Number, default: 12, min: 0 },
    earnedDays: { type: Number, default: 15, min: 0 },
    notes: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);
hrVendorLeavePolicySchema.index({ vendorId: 1, roleKey: 1 }, { unique: true });

const hrLeaveRequestSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, trim: true, index: true },
    employeeType: { type: String, enum: HR_EMPLOYEE_TYPES, default: "staff" },
    name: { type: String, required: true, trim: true },
    role: { type: String, default: "", trim: true },
    roleKey: { type: String, default: "", trim: true, index: true },
    leaveType: { type: String, enum: ["casual", "sick", "earned", "unpaid"], default: "casual" },
    fromDate: { type: String, required: true, trim: true },
    toDate: { type: String, required: true, trim: true },
    days: { type: Number, default: 1, min: 0 },
    dates: { type: [String], default: [] },
    reason: { type: String, default: "", trim: true },
    adminNotes: { type: String, default: "", trim: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    assignedBy: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

const hrShiftSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, trim: true, index: true },
    employeeType: { type: String, enum: HR_EMPLOYEE_TYPES, default: "staff" },
    name: { type: String, required: true, trim: true },
    role: { type: String, default: "", trim: true },
    roleKey: { type: String, default: "", trim: true, index: true },
    date: { type: String, required: true, trim: true, index: true },
    startTime: { type: String, default: "09:00", trim: true },
    endTime: { type: String, default: "18:00", trim: true },
    shiftName: { type: String, default: "General", trim: true },
    notes: { type: String, default: "", trim: true },
    status: { type: String, enum: ["scheduled", "published"], default: "published", index: true },
  },
  { timestamps: true }
);

const hrVacancySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    roleKey: { type: String, required: true, trim: true, index: true },
    openings: { type: Number, default: 1, min: 1 },
    location: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
    status: { type: String, enum: ["open", "closed"], default: "open", index: true },
    vendorId: { type: String, default: "", trim: true, index: true },
  },
  { timestamps: true }
);

const hrCandidateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    roleKey: { type: String, required: true, trim: true, index: true },
    vacancyId: { type: String, default: "", trim: true, index: true },
    vendorId: { type: String, default: "", trim: true, index: true },
    /** Pipeline bucket: applied → selected → finalize → recruited */
    section: {
      type: String,
      enum: ["applied", "selected", "finalize", "recruited"],
      default: "applied",
      index: true,
    },
    /** Decision status while in Applied section */
    applicationStatus: {
      type: String,
      enum: ["pending", "in_review", "accepted", "rejected"],
      default: "pending",
      index: true,
    },
    /** Status while in Finalize section */
    finalizeStatus: {
      type: String,
      enum: [
        "",
        "selected_for_interview",
        "selected_for_training",
        "selected_for_offer",
        "on_hold",
        "cleared",
      ],
      default: "",
      index: true,
    },
    /** Legacy stage kept for compatibility */
    stage: {
      type: String,
      enum: [
        "applied",
        "screening",
        "interview",
        "shortlisted",
        "selected",
        "rejected",
        "in_review",
        "finalize",
        "recruited",
      ],
      default: "applied",
      index: true,
    },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    notes: { type: String, default: "", trim: true },
    adminNotes: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },
    city: { type: String, default: "", trim: true },
    experience: { type: String, default: "", trim: true },
    education: { type: String, default: "", trim: true },
    currentCompany: { type: String, default: "", trim: true },
    expectedCtc: { type: String, default: "", trim: true },
    noticePeriod: { type: String, default: "", trim: true },
    coverLetter: { type: String, default: "", trim: true },
    linkedin: { type: String, default: "", trim: true },
    resumeName: { type: String, default: "", trim: true },
    resumeUrl: { type: String, default: "", trim: true },
    resumeData: { type: String, default: "" },
    stageHistory: [
      {
        section: { type: String, default: "" },
        status: { type: String, default: "" },
        label: { type: String, default: "" },
        notes: { type: String, default: "" },
        by: { type: String, default: "" },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export const HrAnnouncement =
  mongoose.models.AdminHrAnnouncement || mongoose.model("AdminHrAnnouncement", hrAnnouncementSchema);
export const HrLeavePolicy =
  mongoose.models.AdminHrLeavePolicy || mongoose.model("AdminHrLeavePolicy", hrLeavePolicySchema);
export const HrVendorLeavePolicy =
  mongoose.models.AdminHrVendorLeavePolicy ||
  mongoose.model("AdminHrVendorLeavePolicy", hrVendorLeavePolicySchema);
export const HrLeaveRequest =
  mongoose.models.AdminHrLeaveRequest || mongoose.model("AdminHrLeaveRequest", hrLeaveRequestSchema);
export const HrShift = mongoose.models.AdminHrShift || mongoose.model("AdminHrShift", hrShiftSchema);
export const HrVacancy =
  mongoose.models.AdminHrVacancy || mongoose.model("AdminHrVacancy", hrVacancySchema);
export const HrCandidate =
  mongoose.models.AdminHrCandidate || mongoose.model("AdminHrCandidate", hrCandidateSchema);

const ASSET_ROLES = ["delivery_manager", "delivery_boy", "customer", "admin"];
const ASSET_TYPES = ["vehicle", "phone", "uniform", "bag", "tablet", "helmet", "id_card", "other"];
const ASSET_STATUSES = ["assigned", "returned", "lost", "damaged", "under_repair"];
const ASSET_CONDITIONS = ["new", "good", "fair", "damaged"];

const opsAssetSchema = new mongoose.Schema(
  {
    darkStoreId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryManager",
      required: true,
      index: true,
    },
    zoneKey: { type: String, required: true, trim: true, index: true },
    city: { type: String, default: "", trim: true, index: true },
    area: { type: String, default: "", trim: true },
    storeName: { type: String, default: "", trim: true },
    role: {
      type: String,
      enum: ASSET_ROLES,
      required: true,
      index: true,
    },
    assigneeName: { type: String, required: true, trim: true },
    assigneePhone: { type: String, required: true, trim: true },
    assigneeRefId: { type: String, default: "", trim: true, index: true },
    assetName: { type: String, required: true, trim: true },
    assetType: {
      type: String,
      enum: ASSET_TYPES,
      default: "other",
      index: true,
    },
    assetCode: { type: String, default: "", trim: true, index: true },
    serialNumber: { type: String, default: "", trim: true },
    quantity: { type: Number, default: 1, min: 1 },
    condition: {
      type: String,
      enum: ASSET_CONDITIONS,
      default: "good",
    },
    status: {
      type: String,
      enum: ASSET_STATUSES,
      default: "assigned",
      index: true,
    },
    assignedAt: { type: Date, default: Date.now },
    returnedAt: { type: Date, default: null },
    notes: { type: String, default: "", trim: true },
    createdBy: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

opsAssetSchema.index({ darkStoreId: 1, role: 1, createdAt: -1 });

export const OpsAsset =
  mongoose.models.AdminOpsAsset || mongoose.model("AdminOpsAsset", opsAssetSchema);
export { ASSET_ROLES, ASSET_TYPES, ASSET_STATUSES, ASSET_CONDITIONS };

/** Roles that can receive policies (Users/frontend first, then staff panels). */
const POLICY_ROLE_KEYS = ["customer", ...HR_ROLE_KEYS];

const rolePolicySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, default: "", trim: true },
    /** Stable key for customer pages (privacy/terms/refund/shipping) so admins can freely rename titles. */
    pageKey: {
      type: String,
      default: "",
      trim: true,
      index: true,
      enum: ["", "privacy", "terms", "refund", "shipping", "general", "about"],
    },
    roleKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
      enum: [...POLICY_ROLE_KEYS, "all"],
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "published",
      index: true,
    },
    sortOrder: { type: Number, default: 0 },
    createdBy: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

rolePolicySchema.index({ roleKey: 1, status: 1, sortOrder: 1 });

export const RolePolicy =
  mongoose.models.AdminRolePolicy || mongoose.model("AdminRolePolicy", rolePolicySchema);
export { POLICY_ROLE_KEYS };

const governmentSchemeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    shortName: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
    category: { type: String, default: "Financial Benefit", trim: true, index: true },
    govtLevel: { type: String, default: "Central", trim: true },
    status: {
      type: String,
      enum: ["active", "closing_soon", "upcoming", "closed"],
      default: "active",
      index: true,
    },
    subsidyAmount: { type: String, default: "", trim: true },
    maxBenefit: { type: String, default: "", trim: true },
    deadline: { type: String, default: "", trim: true },
    image: { type: String, default: "", trim: true },
    applyUrl: { type: String, default: "", trim: true },
    eligibility: { type: String, default: "", trim: true },
    documents: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const GovernmentScheme =
  mongoose.models.AdminGovernmentScheme ||
  mongoose.model("AdminGovernmentScheme", governmentSchemeSchema);

const farmerSchemeApplicationSchema = new mongoose.Schema(
  {
    farmerId: { type: String, required: true, trim: true, index: true },
    farmerName: { type: String, default: "", trim: true },
    farmerPhone: { type: String, default: "", trim: true },
    farmerVillage: { type: String, default: "", trim: true },
    farmerTaluka: { type: String, default: "", trim: true },
    farmerDistrict: { type: String, default: "", trim: true },
    landAcres: { type: String, default: "", trim: true },
    schemeId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminGovernmentScheme", required: true, index: true },
    schemeTitle: { type: String, required: true, trim: true },
    schemeCategory: { type: String, default: "", trim: true },
    subsidyAmount: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    notes: { type: String, default: "", trim: true },
    adminNotes: { type: String, default: "", trim: true },
    appliedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

farmerSchemeApplicationSchema.index({ farmerId: 1, schemeId: 1 });
farmerSchemeApplicationSchema.index({ status: 1, createdAt: -1 });

export const FarmerSchemeApplication =
  mongoose.models.AdminFarmerSchemeApplication ||
  mongoose.model("AdminFarmerSchemeApplication", farmerSchemeApplicationSchema);

const marketPriceSchema = new mongoose.Schema(
  {
    marketName: { type: String, required: true, trim: true, index: true },
    productName: { type: String, required: true, trim: true, index: true },
    variety: { type: String, required: true, trim: true, default: "Standard" },
    price: { type: Number, required: true, min: 0 },
    minPrice: { type: Number, default: 0, min: 0 },
    maxPrice: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: "Quintal", trim: true },
    priceDate: { type: String, default: () => new Date().toISOString().slice(0, 10), index: true },
    district: { type: String, default: "Pune", trim: true },
    state: { type: String, default: "Maharashtra", trim: true },
    trend: {
      type: String,
      enum: ["up", "stable", "down"],
      default: "stable",
    },
    arrivalQuantity: { type: Number, default: 0 },
    arrivalUnit: { type: String, default: "Quintal", trim: true },
    notes: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true, index: true },
    isGreenGroo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

marketPriceSchema.index({ marketName: 1, productName: 1, variety: 1, priceDate: 1 });

export const MarketPrice =
  mongoose.models.AdminMarketPrice ||
  mongoose.model("AdminMarketPrice", marketPriceSchema);

export { HR_EMPLOYEE_TYPES, HR_ROLE_KEYS };

const hrMeetingSchema = new mongoose.Schema(
  {
    roles: [{ type: String, required: true, trim: true }],
    link: { type: String, default: "", trim: true },
    meetingId: { type: String, default: "", trim: true },
    password: { type: String, default: "", trim: true },
    note: { type: String, default: "", trim: true },
    createdBy: { type: String, default: "", trim: true },
    vendorId: { type: String, default: "", trim: true, index: true },
  },
  { timestamps: true }
);

export const HrMeeting =
  mongoose.models.AdminHrMeeting ||
  mongoose.model("AdminHrMeeting", hrMeetingSchema);

const hrPromotionSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, trim: true, index: true },
    employeeType: { type: String, enum: HR_EMPLOYEE_TYPES, default: "staff", index: true },
    name: { type: String, required: true, trim: true },
    previousRole: { type: String, default: "", trim: true },
    newRole: { type: String, default: "", trim: true },
    previousDesignation: { type: String, default: "", trim: true },
    newDesignation: { type: String, required: true, trim: true },
    previousDepartment: { type: String, default: "", trim: true },
    newDepartment: { type: String, default: "", trim: true },
    effectiveDate: { type: String, required: true, trim: true, index: true },
    reason: { type: String, default: "", trim: true },
    approvedBy: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["pending", "approved", "effective", "rejected"],
      default: "effective",
      index: true,
    },
    vendorId: { type: String, default: "", trim: true, index: true },
  },
  { timestamps: true }
);

const hrIncrementSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, trim: true, index: true },
    employeeType: { type: String, enum: HR_EMPLOYEE_TYPES, default: "staff", index: true },
    name: { type: String, required: true, trim: true },
    previousSalary: { type: Number, required: true, min: 0 },
    newSalary: { type: Number, required: true, min: 0 },
    incrementAmount: { type: Number, default: 0 },
    incrementPercentage: { type: Number, default: 0 },
    effectiveDate: { type: String, required: true, trim: true, index: true },
    cycle: {
      type: String,
      default: "Annual Appraisal",
      trim: true,
      index: true,
    },
    reason: { type: String, default: "", trim: true },
    approvedBy: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["pending", "approved", "processed", "rejected"],
      default: "processed",
      index: true,
    },
    vendorId: { type: String, default: "", trim: true, index: true },
  },
  { timestamps: true }
);

const hrPerformanceLogSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, trim: true, index: true },
    employeeType: { type: String, enum: HR_EMPLOYEE_TYPES, default: "staff", index: true },
    name: { type: String, required: true, trim: true },
    reviewPeriod: { type: String, required: true, trim: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    kpis: [
      {
        metric: { type: String, required: true, trim: true },
        score: { type: Number, default: 5, min: 0, max: 5 },
        maxScore: { type: Number, default: 5 },
        comments: { type: String, default: "", trim: true },
      },
    ],
    achievements: { type: String, default: "", trim: true },
    improvementAreas: { type: String, default: "", trim: true },
    feedback: { type: String, default: "", trim: true },
    goals: { type: String, default: "", trim: true },
    reviewedBy: { type: String, default: "", trim: true },
    reviewDate: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["draft", "finalized", "shared_with_employee"],
      default: "finalized",
      index: true,
    },
    vendorId: { type: String, default: "", trim: true, index: true },
  },
  { timestamps: true }
);

export const HrPromotion =
  mongoose.models.AdminHrPromotion ||
  mongoose.model("AdminHrPromotion", hrPromotionSchema);

export const HrIncrement =
  mongoose.models.AdminHrIncrement ||
  mongoose.model("AdminHrIncrement", hrIncrementSchema);

export const HrPerformanceLog =
  mongoose.models.AdminHrPerformanceLog ||
  mongoose.model("AdminHrPerformanceLog", hrPerformanceLogSchema);


const omniInvoiceItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "GreenGroccProduct" },
    sku: { type: String, default: "", trim: true },
    barcode: { type: String, default: "", trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, default: "", trim: true },
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, default: 0 },
    qty: { type: Number, required: true, min: 1 },
    unit: { type: String, default: "1 kg", trim: true },
    image: { type: String, default: "" },
  },
  { _id: false }
);

const omniInvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    channel: {
      type: String,
      enum: ["physical_store", "mall_counter", "ecommerce"],
      default: "physical_store",
      index: true,
    },
    counterName: { type: String, default: "Main Register", trim: true },
    cashierName: { type: String, default: "Admin", trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "UserBulkMart", default: null, index: true },
    customerName: { type: String, default: "Walk-in Guest", trim: true },
    customerPhone: { type: String, default: "", trim: true, index: true },
    customerTier: { type: String, default: "Standard", trim: true },
    items: [omniInvoiceItemSchema],
    itemsCount: { type: Number, default: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    pointsRedeemed: { type: Number, default: 0, min: 0 },
    pointsEarned: { type: Number, default: 0, min: 0 },
    gstTax: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ["UPI", "Cash", "Card", "Wallet", "NetBanking", "Other", "Split", "Credit"],
      default: "UPI",
    },
    paymentStatus: { type: String, enum: ["paid", "pending", "refunded"], default: "paid" },
    cashTendered: { type: Number, default: 0 },
    changeReturned: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    status: { type: String, enum: ["completed", "cancelled", "returned"], default: "completed" },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryManager", default: null, index: true },
    storeName: { type: String, default: "", trim: true },
    zone: { type: String, default: "", trim: true },
    area: { type: String, default: "", trim: true },
    vendorId: { type: String, default: "", trim: true, index: true },
    vendorName: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

export const OmniInvoice =
  mongoose.models.AdminOmniInvoice ||
  mongoose.model("AdminOmniInvoice", omniInvoiceSchema);

const posRegisterShiftSchema = new mongoose.Schema(
  {
    registerId: { type: String, required: true, index: true },
    registerName: { type: String, required: true, trim: true },
    channel: { type: String, enum: ["physical_store", "mall_counter", "ecommerce"], default: "physical_store" },
    cashierName: { type: String, required: true, trim: true },
    shiftDate: { type: String, default: () => new Date().toISOString().slice(0, 10), index: true },
    openingCash: { type: Number, default: 2000, min: 0 },
    cashSales: { type: Number, default: 0, min: 0 },
    upiSales: { type: Number, default: 0, min: 0 },
    cardSales: { type: Number, default: 0, min: 0 },
    totalSales: { type: Number, default: 0, min: 0 },
    billsCount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["open", "closed"], default: "open" },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const PosRegisterShift =
  mongoose.models.AdminPosRegisterShift ||
  mongoose.model("AdminPosRegisterShift", posRegisterShiftSchema);

// =========================================================================
// INVENTORY & STOCK TOOLS MODELS
// =========================================================================

const inventoryBatchSchema = new mongoose.Schema(
  {
    batchNumber: { type: String, required: true, trim: true, unique: true },
    sku: { type: String, required: true, trim: true, index: true },
    productName: { type: String, required: true, trim: true },
    category: { type: String, default: "General", trim: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryManager", required: true, index: true },
    storeName: { type: String, default: "", trim: true },
    mfgDate: { type: Date, default: () => new Date() },
    expiryDate: { type: Date, required: true, index: true },
    initialQty: { type: Number, default: 0, min: 0 },
    currentQty: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: "pcs", trim: true },
    unitCost: { type: Number, default: 0, min: 0 },
    mrp: { type: Number, default: 0, min: 0 },
    supplierName: { type: String, default: "", trim: true },
    grnNumber: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["active", "near_expiry", "expired", "quarantined", "depleted"],
      default: "active",
      index: true,
    },
    quarantineReason: { type: String, default: "" },
    quarantinedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const InventoryBatch =
  mongoose.models.AdminInventoryBatch ||
  mongoose.model("AdminInventoryBatch", inventoryBatchSchema);

const goodsReceiptNoteSchema = new mongoose.Schema(
  {
    grnNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    poNumber: { type: String, default: "", trim: true },
    supplierType: { type: String, enum: ["vendor", "farmer", "distributor"], default: "vendor" },
    supplierId: { type: String, default: "" },
    supplierName: { type: String, required: true, trim: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryManager", required: true, index: true },
    storeName: { type: String, required: true, trim: true },
    invoiceNumber: { type: String, default: "", trim: true },
    invoiceDate: { type: Date, default: null },
    receivedDate: { type: Date, default: () => new Date() },
    items: [
      {
        sku: { type: String, required: true },
        name: { type: String, required: true },
        category: { type: String, default: "General" },
        orderedQty: { type: Number, default: 0, min: 0 },
        receivedQty: { type: Number, default: 0, min: 0 },
        acceptedQty: { type: Number, default: 0, min: 0 },
        rejectedQty: { type: Number, default: 0, min: 0 },
        unit: { type: String, default: "pcs" },
        unitCost: { type: Number, default: 0, min: 0 },
        totalCost: { type: Number, default: 0, min: 0 },
        batchNumber: { type: String, default: "" },
        mfgDate: { type: Date, default: null },
        expiryDate: { type: Date, default: null },
        rejectionReason: { type: String, default: "" },
      },
    ],
    totalItems: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    status: { type: String, enum: ["draft", "verified", "approved", "rejected"], default: "verified" },
    receivedBy: { type: String, default: "Store Manager" },
    verifiedBy: { type: String, default: "Quality Inspector" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

export const GoodsReceiptNote =
  mongoose.models.AdminGoodsReceiptNote ||
  mongoose.model("AdminGoodsReceiptNote", goodsReceiptNoteSchema);

const stockAdjustmentLogSchema = new mongoose.Schema(
  {
    adjustmentNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryManager", required: true, index: true },
    storeName: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true, index: true },
    productName: { type: String, required: true, trim: true },
    unit: { type: String, default: "pcs", trim: true },
    previousStock: { type: Number, required: true },
    adjustedQty: { type: Number, required: true }, // positive for add, negative for deduction
    newStock: { type: Number, required: true },
    reason: {
      type: String,
      enum: [
        "damage_spoilage",
        "cycle_count",
        "shrinkage_theft",
        "expired_writeoff",
        "vendor_return",
        "internal_transfer",
        "other",
      ],
      default: "cycle_count",
    },
    unitCost: { type: Number, default: 0 },
    financialImpact: { type: Number, default: 0 },
    batchNumber: { type: String, default: "" },
    adjustedBy: { type: String, default: "Admin" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

export const StockAdjustmentLog =
  mongoose.models.AdminStockAdjustmentLog ||
  mongoose.model("AdminStockAdjustmentLog", stockAdjustmentLogSchema);

const b2bRepresentativeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: "", trim: true },
    designation: { type: String, default: "Procurement Officer", trim: true },
    department: { type: String, default: "Procurement", trim: true },
    roleTag: {
      type: String,
      enum: [
        "authorized_signatory",
        "procurement_lead",
        "finance_lead",
        "receiving_dock",
        "store_manager",
        "general_contact",
      ],
      default: "procurement_lead",
    },
    isPrimary: { type: Boolean, default: false },
    portalAccess: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["active", "invited", "suspended", "inactive"],
      default: "active",
    },
    notes: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

const b2bClientSchema = new mongoose.Schema(
  {
    companyCode: { type: String, trim: true, uppercase: true, index: true },
    companyName: { type: String, required: true, trim: true, index: true },
    tradeName: { type: String, default: "", trim: true },
    clientType: {
      type: String,
      enum: ["client", "partner", "enterprise_buyer", "vendor_enterprise", "institutional"],
      default: "client",
      index: true,
    },
    category: {
      type: String,
      enum: [
        "Hospitality & HoReCa",
        "Modern Retail & Supermarkets",
        "Corporate Canteen & Catering",
        "Food Processing & Cloud Kitchen",
        "Institutional & Healthcare",
        "Export & Distribution",
        "Other",
      ],
      default: "Hospitality & HoReCa",
      index: true,
    },
    registrationNumber: { type: String, default: "", trim: true },
    gstin: { type: String, default: "", trim: true, uppercase: true, index: true },
    pan: { type: String, default: "", trim: true, uppercase: true },
    status: {
      type: String,
      enum: ["active", "pending_verification", "under_review", "suspended", "inactive"],
      default: "active",
      index: true,
    },
    creditLimit: { type: Number, default: 0, min: 0 },
    creditDays: { type: Number, default: 30, min: 0 },
    creditUsed: { type: Number, default: 0, min: 0 },
    assignedDarkStore: { type: String, default: "", trim: true },
    darkStoreId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryManager", default: null },
    billingAddress: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      pincode: { type: String, default: "" },
      country: { type: String, default: "India" },
    },
    shippingAddress: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      pincode: { type: String, default: "" },
    },
    representatives: [b2bRepresentativeSchema],
    contractDetails: {
      contractNumber: { type: String, default: "" },
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
      contractStatus: {
        type: String,
        enum: ["active", "pending_renewal", "expired", "negotiating"],
        default: "active",
      },
      pricingTier: {
        type: String,
        enum: ["Standard B2B", "Tier-1 Wholesale", "Enterprise Bulk", "Strategic Partner"],
        default: "Standard B2B",
      },
      slaTerms: { type: String, default: "" },
    },
    notes: { type: String, default: "" },
    totalOrdersCount: { type: Number, default: 0 },
    totalLifetimeSpend: { type: Number, default: 0 },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export const B2bClient =
  mongoose.models.AdminB2bClient || mongoose.model("AdminB2bClient", b2bClientSchema);

const b2bDealStageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true, lowercase: true, index: true },
    order: { type: Number, default: 0, index: true },
    color: { type: String, default: "emerald", trim: true },
    probability: { type: Number, default: 50, min: 0, max: 100 },
    isWon: { type: Boolean, default: false },
    isLost: { type: Boolean, default: false },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    description: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

export const B2bDealStage =
  mongoose.models.AdminB2bDealStage || mongoose.model("AdminB2bDealStage", b2bDealStageSchema);

const dealHistorySchema = new mongoose.Schema(
  {
    stageKey: { type: String, required: true },
    stageName: { type: String, required: true },
    movedAt: { type: Date, default: Date.now },
    movedBy: { type: String, default: "Admin" },
    notes: { type: String, default: "" },
  },
  { _id: false }
);

const b2bDealSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminB2bClient", required: true, index: true },
    clientName: { type: String, required: true, trim: true },
    companyCode: { type: String, default: "", trim: true },
    dealValue: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "INR", trim: true },
    stageId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminB2bDealStage", index: true },
    stageKey: { type: String, required: true, trim: true, index: true },
    stageName: { type: String, required: true, trim: true },
    probability: { type: Number, default: 50, min: 0, max: 100 },
    expectedCloseDate: { type: Date, default: null },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true,
    },
    status: {
      type: String,
      enum: ["open", "won", "lost"],
      default: "open",
      index: true,
    },
    assignedTo: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    lostReason: { type: String, default: "", trim: true },
    stageHistory: [dealHistorySchema],
    createdBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export const B2bDeal =
  mongoose.models.AdminB2bDeal || mongoose.model("AdminB2bDeal", b2bDealSchema);



import mongoose from "mongoose";

// ============================================================
// VENDOR
// ============================================================
const vendorSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    vendorCode: { type: String, default: "" },
    /** Notification keys ("announcement:<id>", "holiday:<id>", …) this vendor marked read; capped list. */
    readNotificationIds: { type: [String], default: [], select: false },
    vendorName: { type: String, default: "", trim: true },
    ownerName: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true, unique: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true },
    businessName: { type: String, default: "" },
    businessAddress: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" },
    profileImage: { type: String, default: "" },
    gstNumber: { type: String, default: "" },
    panNumber: { type: String, default: "" },
    bank: {
      accountHolder: { type: String, default: "" },
      bankName: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
      ifsc: { type: String, default: "" },
    },
    commissionRate: { type: Number, default: 10, min: 0, max: 100 },
    status: {
      type: String,
      enum: ["Pending", "Active", "Inactive", "Suspended"],
      default: "Pending",
    },
    password: { type: String, default: "" },
    role: { type: String, default: "VENDOR" },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
    vacation: {
      enabled: { type: Boolean, default: false },
      startDate: { type: String, default: "" },
      returnDate: { type: String, default: "" },
      reason: { type: String, default: "Annual Vacation" },
      noticeMessage: {
        type: String,
        default: "We are currently on vacation. Store operations and deliveries will resume upon our return!",
      },
      offlineMode: { type: String, enum: ["full_offline", "browse_only"], default: "browse_only" },
      autoReopen: { type: Boolean, default: true },
      emergencyPhone: { type: String, default: "" },
      emergencyEmail: { type: String, default: "" },
      lastUpdated: { type: Date, default: Date.now },
    },
  },
  { timestamps: true }
);

const farmerSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    farmerCode: { type: String, default: "" },
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    email: { type: String, default: "", trim: true },
    password: { type: String, default: "123456" },
    profileImage: { type: String, default: "" },
    farmName: { type: String, default: "" },
    farmLocation: { type: String, default: "" },
    farmAddress: { type: String, default: "" },
    farmArea: { type: String, default: "" },
    farmType: { type: String, default: "Organic" },
    address: {
      village: { type: String, default: "" },
      taluka: { type: String, default: "" },
      district: { type: String, default: "" },
      state: { type: String, default: "" },
      pincode: { type: String, default: "" },
    },
    bank: {
      accountHolder: { type: String, default: "" },
      bankName: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
      ifsc: { type: String, default: "" },
      branch: { type: String, default: "" },
      accountType: { type: String, default: "Savings" },
      upiId: { type: String, default: "" },
    },
    aadhaarNumber: { type: String, default: "", trim: true },
    panNumber: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["Pending", "Active", "Inactive", "Suspended"],
      default: "Pending",
    },
    verificationStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Not Uploaded"],
      default: "Approved",
    },
    verificationRequired: { type: Boolean, default: false },
    loginEnabled: { type: Boolean, default: true },
    vendorId: { type: String, default: "" },
    managerId: { type: String, default: "" },
    role: { type: String, default: "FARMER" },
    dateOfBirth: { type: String, default: "" },
    gender: { type: String, enum: ["", "Male", "Female", "Other"], default: "" },
    referralCode: { type: String, default: "", trim: true },
    farmerId: { type: String, default: "" },
    companyId: { type: String, default: "GGC" },
    stateId: { type: String, default: "" },
    districtId: { type: String, default: "" },
    talukaId: { type: String, default: "" },
    villageId: { type: String, default: "" },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: "" },
    registrationStatus: {
      type: String,
      enum: ["REGISTERED", "ACTIVE"],
      default: "REGISTERED",
    },
    kycStatus: {
      type: String,
      enum: ["PENDING", "SUBMITTED", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    preferredLanguage: { type: String, default: "" },
    // FCM tokens of the farmer app installs (see farmerPush.js); newest first, max 5.
    fcmTokens: [
      {
        _id: false,
        token: { type: String, required: true },
        platform: { type: String, default: "android" },
        language: { type: String, default: "mr" },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    bankVerificationStatus: {
      type: String,
      enum: ["PENDING", "VERIFIED", "REJECTED"],
      default: "PENDING",
    },
    farm: {
      farmId: { type: String, default: "" },
      farmName: { type: String, default: "" },
      totalFarmArea: { type: Number, default: 0 },
      totalFarmAreaUnit: { type: String, default: "Acre" },
      cultivatedArea: { type: Number, default: 0 },
      cultivatedAreaUnit: { type: String, default: "Acre" },
      soilType: { type: String, default: "" },
      irrigationType: { type: String, default: "" },
      waterSource: { type: String, default: "" },
      farmingMethod: { type: String, default: "" },
      farmingType: { type: String, default: "" },
      mainCrops: { type: String, default: "" },
      farmPhotos: [{ type: String }],
      farmVideos: [{ type: String }],
    },
    farmGeo: {
      village: { type: String, default: "" },
      taluka: { type: String, default: "" },
      district: { type: String, default: "" },
      pincode: { type: String, default: "" },
      farmAddress: { type: String, default: "" },
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      confirmed: { type: Boolean, default: false },
    },
    // Extension point for future mobile OTP login without changing registration flow.
    authType: { type: String, default: "direct" },
    mobileVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const farmerManagerSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    managerCode: { type: String, default: "" },
    collectionCentreId: { type: String, default: "" },
    vendorId: { type: String, required: true, default: "vendor-1" },
    name: { type: String, required: true, trim: true },
    profileImage: { type: String, default: "" },
    mobile: { type: String, required: true, trim: true },
    email: { type: String, default: "", trim: true },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" },
    location: { type: String, default: "" },
    joiningDate: { type: String, default: "" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    authType: { type: String, default: "password" },
    password: { type: String, default: "123456" },
    role: { type: String, default: "FARMER_MANAGER" },
  },
  { timestamps: true }
);

const farmerProductSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    productId: { type: String, default: "" },
    vendorId: { type: String, required: true, default: "vendor-1" },
    managerId: { type: String, default: "" },
    farmerId: { type: String, required: true },
    farmId: { type: String, default: "" },
    sku: { type: String, default: "" },
    name: { type: String, required: true, trim: true },
    productName: { type: String, default: "" },
    category: { type: String, default: "Vegetables" },
    subCategory: { type: String, default: "Fresh Produce" },
    description: { type: String, default: "" },
    image: { type: String, default: "" },
    images: [{ type: String }],
    unit: { type: String, default: "Kg" },
    harvestDate: { type: String, default: "" },
    produceType: { type: String, default: "organic" },
    farmLocation: { type: String, default: "" },
    cropId: { type: String, default: "" },
    cropName: { type: String, default: "" },
    previousProductId: { type: String, default: "" },
    variety: { type: String, default: "" },
    status: { type: String, default: "Draft" },
    rejectionReason: { type: String, default: "" },
    reviewedBy: { type: String, default: "" },
    reviewedAt: { type: Date, default: null },
    sellingPrice: { type: Number, default: 0 },
    pricePerKg: { type: Number, default: 0 },
    minimumOrderQuantity: { type: Number, default: 1 },
    mrp: { type: Number, default: 0 },
    lowStockLimit: { type: Number, default: 10 },
    stock: { type: Number, default: 0 },
    availableQuantity: { type: Number, default: 0 },
    reservedQuantity: { type: Number, default: 0 },
    farmingType: { type: String, default: "" },
    availableFrom: { type: String, default: "" },
    availableUntil: { type: String, default: "" },
    gradeAQty: { type: Number, default: 0 },
    gradeBQty: { type: Number, default: 0 },
    gradeCQty: { type: Number, default: 0 },
    gradeAPrice: { type: Number, default: 0 },
    gradeBPrice: { type: Number, default: 0 },
    gradeCPrice: { type: Number, default: 0 },
    grades: [
      {
        id: { type: String, default: "" },
        grade: { type: String, default: "" },
        label: { type: String, default: "" },
        quantity: { type: Number, default: 0 },
        price: { type: Number, default: 0 },
      },
    ],
    media: {
      mainPhoto: { type: String, default: "" },
      farmPhotos: [{ type: String }],
      cropPhotos: [{ type: String }],
      harvestPhotos: [{ type: String }],
      videos: [{ type: String }],
    },
    priceHistory: [
      {
        pricePerKg: { type: Number, default: 0 },
        grades: { type: Array, default: [] },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const farmerStockHistorySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    vendorId: { type: String, required: true, default: "vendor-1" },
    managerId: { type: String, default: "" },
    farmerId: { type: String, required: true },
    productId: { type: String, required: true },
    productName: { type: String, default: "" },
    grade: { type: String, default: "All Grades" },
    action: { type: String, default: "Stock Added" },
    previousStock: { type: Number, default: 0 },
    changedQuantity: { type: Number, default: 0 },
    newStock: { type: Number, default: 0 },
    reason: { type: String, default: "Manual Update" },
    updatedBy: { type: String, default: "Farmer" },
    reference: { type: String, default: "—" },
    at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const farmerOrderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    orderId: { type: String, default: "" },
    vendorId: { type: String, required: true, default: "vendor-1" },
    farmerId: { type: String, required: true },
    customerId: { type: String, default: "" },
    productId: { type: String, default: "" },
    cropId: { type: String, default: "" },
    productName: { type: String, default: "" },
    variety: { type: String, default: "" },
    grade: { type: String, default: "" },
    orderedQuantity: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
    orderValue: { type: Number, default: 0 },
    customerDeliveryArea: { type: String, default: "" },
    requiredDate: { type: String, default: "" },
    pickupDate: { type: String, default: "" },
    pickupTime: { type: String, default: "" },
    collectionCentre: { type: String, default: "" },
    reservedQuantity: { type: Number, default: 0 },
    packedQuantity: { type: Number, default: 0 },
    rejectionReason: { type: String, default: "" },
    rejectionNote: { type: String, default: "" },
    rejectedBy: { type: String, default: "" },
    preparationStatus: { type: String, default: "NOT_STARTED" },
    qrToken: { type: String, default: "" },
    packingDetails: {
      packageCount: { type: Number, default: 0 },
      packageType: { type: String, default: "" },
      packageWeight: { type: Number, default: 0 },
      packingDate: { type: String, default: "" },
      notes: { type: String, default: "" },
    },
    acceptedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    preparedAt: { type: Date, default: null },
    readyForPickupAt: { type: Date, default: null },
    customer: {
      name: { type: String, default: "Customer" },
      phone: { type: String, default: "" },
      address: { type: String, default: "" },
    },
    products: [
      {
        id: { type: String, default: "" },
        productId: { type: String, default: "" },
        name: { type: String, default: "" },
        grade: { type: String, default: "Grade A" },
        quantity: { type: Number, default: 1 },
        unit: { type: String, default: "Kg" },
        price: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
      },
    ],
    harvestDate: { type: String, default: "" },
    harvestTime: { type: String, default: "" },
    day: { type: String, default: "" },
    unit: { type: String, default: "Kg" },
    rejectionQty: { type: Number, default: 0 },
    totalQuantity: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    status: { type: String, default: "NEW" },
    deliveryStatus: { type: String, default: "Pending" },
    paymentStatus: { type: String, default: "Pending" },
    orderDate: { type: Date, default: Date.now },
    grades: [{ type: mongoose.Schema.Types.Mixed }],
    timeline: [
      {
        status: { type: String, default: "" },
        at: { type: Date, default: Date.now },
        note: { type: String, default: "" },
      },
    ],
    /** Customer pre-order (StoreOrder) the vendor raised this farmer request for. */
    sourceStoreOrderId: { type: String, default: "", index: true },
    sourceOrderNumber: { type: String, default: "" },
  },
  { timestamps: true, strict: false }
);

const farmerEarningSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    vendorId: { type: String, required: true, default: "vendor-1" },
    farmerId: { type: String, required: true },
    orderId: { type: String, default: "" },
    date: { type: String, default: "" },
    cropName: { type: String, default: "" },
    variety: { type: String, default: "" },
    pickupDate: { type: String, default: "" },
    pickupTime: { type: String, default: "" },
    unit: { type: String, default: "Kg" },
    quantity: { type: Number, default: 0 },
    ratePerKg: { type: Number, default: 0 },
    grossEarnings: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    netEarnings: { type: Number, default: 0 },
    grades: [{ type: mongoose.Schema.Types.Mixed }],
    status: { type: String, enum: ["Paid", "Pending", "Available"], default: "Pending" },
  },
  { timestamps: true }
);

const farmerDocumentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    vendorId: { type: String, default: "" },
    managerId: { type: String, default: "" },
    farmerId: { type: String, required: true },
    name: { type: String, default: "" },
    type: { type: String, default: "other" },
    fileName: { type: String, default: "" },
    fileUrl: { type: String, default: "" },
    uploadedAt: { type: Date, default: null },
    uploadedBy: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Not Uploaded"],
      default: "Not Uploaded",
    },
    adminRemarks: { type: String, default: "" },
    rejectionReason: { type: String, default: "" },
  },
  { timestamps: true }
);

const farmerHarvestOrderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    vendorId: { type: String, required: true, default: "vendor-1" },
    managerId: { type: String, default: "" },
    farmerId: { type: String, required: true },
    productId: { type: String, required: true },
    productName: { type: String, default: "" },
    category: { type: String, default: "Vegetables" },
    date: { type: String, required: true },
    day: { type: String, default: "" },
    unit: { type: String, default: "Kg" },
    grades: [
      {
        name: { type: String, default: "A Grade" },
        quantity: { type: Number, default: 0 },
        rate: { type: Number, default: null },
        amount: { type: Number, default: 0 },
      },
    ],
    rejectionQty: { type: Number, default: 0 },
    totalQuantity: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    status: { type: String, default: "Approved" },
  },
  { timestamps: true }
);

// ============================================================
// COMPOUND & QUERY OPTIMIZATION INDEXES
// ============================================================
// Vendor Indexes
vendorSchema.index({ status: 1 });

// Farmer Indexes
farmerSchema.index({ farmerId: 1 }, { unique: true, sparse: true });
farmerSchema.index({ managerId: 1, vendorId: 1 });
farmerSchema.index({ vendorId: 1, status: 1 });
farmerSchema.index({ mobile: 1 });
farmerSchema.index({ status: 1 });
farmerSchema.index({ createdAt: -1 });

// Farmer Manager Indexes
farmerManagerSchema.index({ vendorId: 1, status: 1 });
farmerManagerSchema.index({ mobile: 1 });
farmerManagerSchema.index({ createdAt: -1 });

// Farmer Product Indexes
farmerProductSchema.index({ farmerId: 1, createdAt: -1 });
farmerProductSchema.index({ farmerId: 1, productId: 1 });
farmerProductSchema.index({ farmerId: 1, status: 1 });
farmerProductSchema.index({ productId: 1 });
farmerProductSchema.index({ managerId: 1, status: 1 });
farmerProductSchema.index({ vendorId: 1, status: 1 });
farmerProductSchema.index({ category: 1 });

// Farmer Stock History Indexes
farmerStockHistorySchema.index({ farmerId: 1, productId: 1, at: -1 });
farmerStockHistorySchema.index({ farmerId: 1, at: -1 });
farmerStockHistorySchema.index({ at: -1 });

// Farmer Order Indexes
farmerOrderSchema.index({ farmerId: 1, orderDate: -1 });
farmerOrderSchema.index({ farmerId: 1, createdAt: -1 });
farmerOrderSchema.index({ orderId: 1 });
farmerOrderSchema.index({ farmerId: 1, productId: 1 });
farmerOrderSchema.index({ vendorId: 1, status: 1 });
farmerOrderSchema.index({ status: 1 });

// Farmer Earning Indexes
farmerEarningSchema.index({ farmerId: 1, date: -1 });
farmerEarningSchema.index({ farmerId: 1, status: 1 });
farmerEarningSchema.index({ farmerId: 1, orderId: 1 });
farmerEarningSchema.index({ vendorId: 1, status: 1 });

// Farmer Document Indexes
farmerDocumentSchema.index({ farmerId: 1, type: 1 });
farmerDocumentSchema.index({ farmerId: 1, status: 1 });
farmerDocumentSchema.index({ vendorId: 1 });

// Farmer Harvest Order Indexes
farmerHarvestOrderSchema.index({ farmerId: 1, date: -1 });
farmerHarvestOrderSchema.index({ farmerId: 1, createdAt: -1 });
farmerHarvestOrderSchema.index({ farmerId: 1, productId: 1 });
farmerHarvestOrderSchema.index({ managerId: 1, createdAt: -1 });
farmerHarvestOrderSchema.index({ vendorId: 1, createdAt: -1 });
farmerHarvestOrderSchema.index({ status: 1 });

export const CROP_STATUSES = [
  "Planning Created",
  "Land Preparation",
  "Soil Testing",
  "Land Preparation Completed",
  "Seed Selection",
  "Seed Treatment",
  "Sowing / Plantation",
  "Germination Started",
  "First Fertilizer Application",
  "Irrigation",
  "Crop Growth",
  "Spray / Pest Control",
  "Weeding / Intercultivation",
  "Second Fertilizer Application",
  "Spray / Disease Control",
  "Second Irrigation",
  "Crop Monitoring",
  "Nutrient / Micronutrient Spray",
  "Flowering / Fruiting",
  "Final Fertilizer / Required Treatment",
  "Pre-Harvest Stage",
  "Ready for Harvest",
  // Legacy aliases – keep for backward compat with older database records
  "Soil Testing Pending",
  "Soil Testing Completed",
  "Soil Report Uploaded",
  "Soil Report Under Review",
  "Soil Report Approved",
  "Crop & Variety Selected",
  "Seed/Input Planning",
  "Sowing/Plantation Started",
  "Sowing/Plantation Completed",
  "Crop Growing",
  "Irrigation in Progress",
  "Fertilizer Application",
  "Pesticide Application",
  "Pest/Disease Monitoring",
  "Field Inspection Pending",
  "Field Inspection Completed",
  "Crop Growth Monitoring",
  "Pre-Harvest Inspection",
  "Harvest Readiness",
  "Harvesting Started",
  "Harvesting In Progress",
  "Harvesting Completed",
  "Harvest Quantity Recorded",
  "Harvest Batch Created",
  "Completed",
  "Planned",
  "Growing",
  "Harvested",
];

const farmerCropSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    // Shared business ID for same crop+variety across farmers (not globally unique)
    cropId: { type: String, required: true, index: true },
    farmerId: { type: String, required: true },
    farmId: { type: String, default: "" },
    cropName: { type: String, required: true, trim: true },
    variety: { type: String, required: true, trim: true },
    category: { type: String, default: "Vegetables" },
    categoryCode: { type: String, default: "VEG" },
    area: { type: Number, required: true, default: 0 },
    areaUnit: { type: String, default: "Acre" },
    sowingDate: { type: String, required: true },
    expectedHarvestDate: { type: String, required: true },
    estimatedQuantity: { type: Number, required: true, default: 0 },
    unit: { type: String, default: "Kg" },
    farmingMethod: { type: String, default: "" },
    farmingType: { type: String, default: "" },
    irrigationType: { type: String, default: "" },
    photos: [{ type: String }],
    certificates: [
      {
        id: { type: String },
        type: { type: String, default: "Soil Testing Report" },
        fileName: { type: String, default: "" },
        fileUrl: { type: String, default: "" },
        certNumber: { type: String, default: "" },
        labName: { type: String, default: "" },
        issueDate: { type: String, default: "" },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    previousCropId: { type: String, default: "" },
    status: { type: String, enum: CROP_STATUSES, default: "Planning Created" },
    approvalStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Approved",
      index: true,
    },
    rejectionReason: { type: String, default: "" },
    requestedBy: { type: String, default: "" },
    reviewedBy: { type: String, default: "" },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const farmerCropPlanSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    planId: { type: String, required: true, unique: true },
    farmerId: { type: String, required: true },
    cropId: { type: String, required: true },
    harvestDate: { type: String, default: "" },
    estimatedProduction: { type: Number, default: 0 },
    expectedDemand: { type: Number, default: 0 },
    suggestedSaleQuantity: { type: Number, default: 0 },
    unit: { type: String, default: "Kg" },
    status: { type: String, default: "Planned" },
    certificates: [
      {
        id: { type: String },
        type: { type: String, default: "Soil Testing Report" },
        fileName: { type: String, default: "" },
        fileUrl: { type: String, default: "" },
        certNumber: { type: String, default: "" },
        labName: { type: String, default: "" },
        issueDate: { type: String, default: "" },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

farmerCropSchema.index({ farmerId: 1, createdAt: -1 });
farmerCropSchema.index({ farmerId: 1, cropId: 1 }, { unique: true });
farmerCropPlanSchema.index({ farmerId: 1, createdAt: -1 });
farmerCropPlanSchema.index({ farmerId: 1, cropId: 1 }, { unique: true });

const pickupDriverSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    vendorId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    vehicleNumber: { type: String, default: "" },
    vehicleType: { type: String, default: "Van" },
    vehicleId: { type: String, default: "", index: true },
    licenseNumber: { type: String, default: "" },
    assignedArea: { type: String, default: "" },
    address: { type: String, default: "" },
    documents: [{ type: String }],
    password: { type: String, default: "" },
    role: { type: String, default: "DRIVER" },
    status: { type: String, default: "Active" },
    fcmTokens: [
      {
        _id: false,
        token: { type: String, required: true },
        platform: { type: String, default: "android" },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const collectionCentreSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    vendorId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    contactMobile: { type: String, default: "" },
    stateCode: { type: String, default: "MH" },
    districtCode: { type: String, default: "" },
    talukaCode: { type: String, default: "" },
    villageCode: { type: String, default: "" },
    status: { type: String, default: "Active" },
  },
  { timestamps: true }
);

const pickupSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    pickupId: { type: String, required: true, unique: true },
    orderId: { type: String, required: true },
    vendorId: { type: String, required: true },
    managerId: { type: String, default: "" },
    farmerId: { type: String, required: true },
    driverId: { type: String, default: "" },
    collectionCentreId: { type: String, default: "" },
    scheduledDate: { type: String, default: "" },
    scheduledTime: { type: String, default: "" },
    pickupDate: { type: String, default: "" },
    pickupTime: { type: String, default: "" },
    pickupLocation: { type: String, default: "" },
    orderDate: { type: String, default: "" },
    driverName: { type: String, default: "" },
    driverMobile: { type: String, default: "" },
    vehicleNumber: { type: String, default: "" },
    expectedQuantity: { type: Number, default: 0 },
    packedQuantity: { type: Number, default: 0 },
    packageCount: { type: Number, default: 0 },
    unit: { type: String, default: "Kg" },
    productName: { type: String, default: "" },
    variety: { type: String, default: "" },
    grade: { type: String, default: "" },
    qrToken: { type: String, default: "" },
    qrPayload: { type: String, default: "" },
    pickupInstructions: { type: String, default: "" },
    assignedAt: { type: Date, default: null },
    dispatchStartedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    arrivedAt: { type: Date, default: null },
    inTransitAt: { type: Date, default: null },
    orderVerifiedAt: { type: Date, default: null },
    driverStatus: { type: String, default: "" },
    timeline: [
      {
        status: { type: String, default: "" },
        at: { type: Date, default: Date.now },
        note: { type: String, default: "" },
      },
    ],
    qrVerified: { type: Boolean, default: false },
    qrVerifiedBy: { type: String, default: "" },
    qrVerifiedAt: { type: Date, default: null },
    verification: {
      farmer: { type: Boolean, default: false },
      order: { type: Boolean, default: false },
      product: { type: Boolean, default: false },
      quantity: { type: Boolean, default: false },
      driver: { type: Boolean, default: false },
      vehicle: { type: Boolean, default: false },
    },
    pickupConfirmed: { type: Boolean, default: false },
    pickupConfirmedBy: { type: String, default: "" },
    pickupConfirmedAt: { type: Date, default: null },
    confirmedQuantity: { type: Number, default: 0 },
    confirmedPackageCount: { type: Number, default: 0 },
    confirmationPhotos: [{ type: String }],
    collectionBatchId: { type: String, default: "" },
    collectionBatchAssignedAt: { type: Date, default: null },
    status: { type: String, default: "READY_FOR_PICKUP" },
    receiving: {
      status: { type: String, default: "" },
      expectedWeight: { type: Number, default: 0 },
      actualWeight: { type: Number, default: 0 },
      acceptedWeight: { type: Number, default: 0 },
      difference: { type: Number, default: 0 },
      weightUnit: { type: String, default: "Kg" },
      grades: [
        {
          label: { type: String, default: "" },
          expectedWeight: { type: Number, default: 0 },
          actualWeight: { type: Number, default: 0 },
          acceptedWeight: { type: Number, default: 0 },
          difference: { type: Number, default: 0 },
        },
      ],
      photos: [{ type: String }],
      receiptId: { type: String, default: "" },
      receivedAt: { type: Date, default: null },
      receivedBy: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

pickupDriverSchema.index({ vendorId: 1, createdAt: -1 });
pickupDriverSchema.index({ vendorId: 1, mobile: 1 });
collectionCentreSchema.index({ vendorId: 1 });
pickupSchema.index({ vendorId: 1, status: 1, createdAt: -1 });
pickupSchema.index({ farmerId: 1, createdAt: -1 });
pickupSchema.index({ managerId: 1, createdAt: -1 });
pickupSchema.index({ driverId: 1, status: 1 });
pickupSchema.index({ orderId: 1 }, { unique: true });
pickupSchema.index({ qrToken: 1 });
pickupSchema.index({ collectionBatchId: 1 });

const QUALITY_STATUSES = [
  "QUALITY_PENDING",
  "INSPECTION",
  "GRADING",
  "GRADE_CONFIRMED",
  "ORDER_COMPLETED",
];

const qualityInspectionSchema = new mongoose.Schema(
  {
    inspectionId: { type: String, required: true, unique: true },
    orderId: { type: String, required: true },
    farmerId: { type: String, required: true },
    productId: { type: String, default: "" },
    batchId: { type: String, default: "" },
    collectionCentreId: { type: String, default: "" },
    pickupId: { type: String, default: "" },
    vendorId: { type: String, default: "" },
    inspectorId: { type: String, default: "" },
    inspectorRole: { type: String, default: "" },
    inspectorName: { type: String, default: "" },
    qualityParameters: {
      freshness: { type: String, default: "" },
      size: { type: String, default: "" },
      colour: { type: String, default: "" },
      appearance: { type: String, default: "" },
      cleanliness: { type: String, default: "" },
      damage: { type: String, default: "" },
      moisture: { type: String, default: "" },
      weight: { type: String, default: "" },
      overallQuality: { type: String, default: "" },
    },
    qualityRemarks: { type: String, default: "" },
    qualityPhotos: [
      {
        url: { type: String, default: "" },
        label: { type: String, default: "" },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    gradeQuality: { type: mongoose.Schema.Types.Mixed, default: {} },
    gradeAQuantity: { type: Number, default: 0 },
    gradeBQuantity: { type: Number, default: 0 },
    gradeCQuantity: { type: Number, default: 0 },
    labReports: [
      {
        id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
        reportName: { type: String, required: true },
        fileUrl: { type: String, required: true },
        fileName: { type: String, default: "" },
        fileType: { type: String, default: "" },
        fileSize: { type: Number, default: 0 },
        notes: { type: String, default: "" },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: String, default: "" },
      },
    ],
    rejectedQuantity: { type: Number, default: 0 },
    rejectionReason: { type: String, default: "" },
    rejectionRemarks: { type: String, default: "" },
    packagingDate: { type: String, default: "" },
    expiryDate: { type: String, default: "" },
    status: { type: String, enum: QUALITY_STATUSES, default: "QUALITY_PENDING" },
    inspectionStartedAt: { type: Date, default: null },
    inspectionCompletedAt: { type: Date, default: null },
    gradingConfirmedAt: { type: Date, default: null },
    lastActionBy: { type: String, default: "" },
    lastActionRole: { type: String, default: "" },
    lastActionAt: { type: Date, default: null },
    inventorySyncedAt: { type: Date, default: null },
    actions: [
      {
        action: { type: String, default: "" },
        userId: { type: String, default: "" },
        role: { type: String, default: "" },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

qualityInspectionSchema.index({ orderId: 1 }, { unique: true });
qualityInspectionSchema.index({ vendorId: 1, status: 1, createdAt: -1 });
qualityInspectionSchema.index({ farmerId: 1, status: 1 });
qualityInspectionSchema.index({ pickupId: 1 });
qualityInspectionSchema.index({ batchId: 1 });

export const Vendor =
  mongoose.models.Vendor || mongoose.model("Vendor", vendorSchema);
export const Farmer =
  mongoose.models.Farmer || mongoose.model("Farmer", farmerSchema);
export const FarmerManager =
  mongoose.models.FarmerManager || mongoose.model("FarmerManager", farmerManagerSchema);
export const FarmerProduct =
  mongoose.models.FarmerProduct || mongoose.model("FarmerProduct", farmerProductSchema);
export const FarmerStockHistory =
  mongoose.models.FarmerStockHistory || mongoose.model("FarmerStockHistory", farmerStockHistorySchema);
export const FarmerOrder =
  mongoose.models.FarmerOrder || mongoose.model("FarmerOrder", farmerOrderSchema);
export const FarmerEarning =
  mongoose.models.FarmerEarning || mongoose.model("FarmerEarning", farmerEarningSchema);
export const FarmerDocument =
  mongoose.models.FarmerDocument || mongoose.model("FarmerDocument", farmerDocumentSchema);
export const FarmerHarvestOrder =
  mongoose.models.FarmerHarvestOrder || mongoose.model("FarmerHarvestOrder", farmerHarvestOrderSchema);
export const FarmerCrop =
  mongoose.models.FarmerCrop || mongoose.model("FarmerCrop", farmerCropSchema);
export const FarmerCropPlan =
  mongoose.models.FarmerCropPlan || mongoose.model("FarmerCropPlan", farmerCropPlanSchema);
export const PickupDriver =
  mongoose.models.PickupDriver || mongoose.model("PickupDriver", pickupDriverSchema);
export const CollectionCentre =
  mongoose.models.CollectionCentre || mongoose.model("CollectionCentre", collectionCentreSchema);
export const Pickup =
  mongoose.models.Pickup || mongoose.model("Pickup", pickupSchema);
export const QualityInspection =
  mongoose.models.QualityInspection || mongoose.model("QualityInspection", qualityInspectionSchema);

// A limit of 0 means that check is off.
const vendorInventoryAlertSchema = new mongoose.Schema(
  {
    vendorId: { type: String, required: true },
    productKey: { type: String, required: true },
    productName: { type: String, default: "" },
    variety: { type: String, default: "" },
    minGradeA: { type: Number, default: 0, min: 0 },
    minGradeB: { type: Number, default: 0, min: 0 },
    minGradeC: { type: Number, default: 0, min: 0 },
    minTotal: { type: Number, default: 0, min: 0 },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);
vendorInventoryAlertSchema.index({ vendorId: 1, productKey: 1 }, { unique: true });

export const VendorInventoryAlert =
  mongoose.models.VendorInventoryAlert ||
  mongoose.model("VendorInventoryAlert", vendorInventoryAlertSchema);

// fileUrl holds the file inline as a data URL, so keep each upload well under MongoDB's 16 MB record cap.
const vendorDocumentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    vendorId: { type: String, required: true },
    type: { type: String, required: true },
    name: { type: String, default: "" },
    fileName: { type: String, default: "" },
    mimeType: { type: String, default: "" },
    fileUrl: { type: String, default: "" },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: String, default: "" },
    status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
  },
  { timestamps: true }
);
vendorDocumentSchema.index({ vendorId: 1, type: 1 }, { unique: true });

export const VendorDocument =
  mongoose.models.VendorDocument || mongoose.model("VendorDocument", vendorDocumentSchema);

// A vendor-proposed dark store; the DeliveryManager account is only created when admin approves it.
const darkStoreRequestSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    vendorId: { type: String, required: true, index: true },
    storeName: { type: String, required: true, trim: true },
    managerName: { type: String, default: "", trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    state: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    area: { type: String, required: true, trim: true },
    storeAddress: { type: String, default: "", trim: true },
    pincode: { type: String, default: "", trim: true },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    notes: { type: String, default: "", trim: true },
    zoneId: { type: String, default: "", index: true },
    zoneName: { type: String, default: "", trim: true },
    status: { type: String, enum: ["Pending", "Approved", "Rejected", "Cancelled"], default: "Pending", index: true },
    adminRemarks: { type: String, default: "" },
    darkStoreId: { type: String, default: "" },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const DarkStoreRequest =
  mongoose.models.DarkStoreRequest || mongoose.model("DarkStoreRequest", darkStoreRequestSchema);

// A vendor's delivery zone; only "Approved" zones can hold dark stores.
const vendorZoneSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    vendorId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    cities: { type: [String], default: [] },
    description: { type: String, default: "", trim: true },
    status: { type: String, enum: ["Pending", "Approved", "Rejected", "Cancelled"], default: "Pending", index: true },
    adminRemarks: { type: String, default: "" },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
vendorZoneSchema.index({ vendorId: 1, name: 1 });

export const VendorZone = mongoose.models.VendorZone || mongoose.model("VendorZone", vendorZoneSchema);

// productId refers to an admin catalog product (GreenGroccProduct); name/image/category are snapshots for history.
const catalogProductSnapshot = {
  productId: { type: String, required: true },
  productName: { type: String, default: "" },
  productImage: { type: String, default: "" },
  category: { type: String, default: "" },
  unit: { type: String, default: "" },
};

const vendorProductRequestSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    vendorId: { type: String, required: true, index: true },
    ...catalogProductSnapshot,
    notes: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Cancelled"],
      default: "Pending",
      index: true,
    },
    adminRemarks: { type: String, default: "" },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
vendorProductRequestSchema.index({ vendorId: 1, productId: 1, status: 1 });

export const VendorProductRequest =
  mongoose.models.VendorProductRequest || mongoose.model("VendorProductRequest", vendorProductRequestSchema);

const vendorProductSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    vendorId: { type: String, required: true, index: true },
    ...catalogProductSnapshot,
    requestId: { type: String, default: "" },
    addedBy: { type: String, default: "" },
    // Vendor-only overrides; null means "use the admin catalog value".
    price: { type: Number, default: null, min: 0 },
    discountedPrice: { type: Number, default: null, min: 0 },
    stock: { type: Number, default: null, min: 0 },
    // custom* fields: "" / null means "use the catalog value". Not named like the snapshot
    // fields above, which are overwritten from the catalog on re-approval.
    customDescription: { type: String, default: "", trim: true },
    customUnit: { type: String, default: "", trim: true },
    customInStock: { type: Boolean, default: null },
    // Full product-editor values (name, media, variants, farmer traceability…) for this vendor only.
    overrides: { type: mongoose.Schema.Types.Mixed, default: null },
    pricingUpdatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
vendorProductSchema.index({ vendorId: 1, productId: 1 }, { unique: true });

export const VendorProduct =
  mongoose.models.VendorProduct || mongoose.model("VendorProduct", vendorProductSchema);

// A vendor's proposed catalog change; nothing touches the live catalog until admin approves it.
const vendorCatalogRequestSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    vendorId: { type: String, required: true, index: true },
    vendorName: { type: String, default: "" },
    kind: { type: String, enum: ["product", "category"], required: true },
    action: { type: String, enum: ["create", "update", "delete"], required: true },
    // Product / Category _id for update and delete; set to the created _id once a create is approved.
    targetId: { type: String, default: "" },
    targetName: { type: String, default: "" },
    section: { type: String, default: "" },
    image: { type: String, default: "" },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Cancelled"],
      default: "Pending",
      index: true,
    },
    adminRemarks: { type: String, default: "" },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false }
);
vendorCatalogRequestSchema.index({ vendorId: 1, kind: 1, targetId: 1, status: 1 });

export const VendorCatalogRequest =
  mongoose.models.VendorCatalogRequest ||
  mongoose.model("VendorCatalogRequest", vendorCatalogRequestSchema);

// cropId refers to an admin crop master record (ErpCrop); name/variety/category are snapshots for history.
const catalogCropSnapshot = {
  cropId: { type: String, required: true },
  cropName: { type: String, default: "" },
  variety: { type: String, default: "" },
  category: { type: String, default: "" },
};

const vendorCropRequestSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    vendorId: { type: String, required: true, index: true },
    ...catalogCropSnapshot,
    notes: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Cancelled"],
      default: "Pending",
      index: true,
    },
    adminRemarks: { type: String, default: "" },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
vendorCropRequestSchema.index({ vendorId: 1, cropId: 1, status: 1 });

export const VendorCropRequest =
  mongoose.models.VendorCropRequest || mongoose.model("VendorCropRequest", vendorCropRequestSchema);

const vendorCropSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    vendorId: { type: String, required: true, index: true },
    ...catalogCropSnapshot,
    requestId: { type: String, default: "" },
    addedBy: { type: String, default: "" },
  },
  { timestamps: true }
);
vendorCropSchema.index({ vendorId: 1, cropId: 1 }, { unique: true });

export const VendorCrop = mongoose.models.VendorCrop || mongoose.model("VendorCrop", vendorCropSchema);

const vendorShippingMethodSchema = new mongoose.Schema(
  {
    vendorId: { type: String, required: true, unique: true, index: true },
    isActive: { type: Boolean, default: true },
    // 1. Shipping cost by quantity
    quantityRules: {
      enabled: { type: Boolean, default: true },
      baseCost: { type: Number, default: 30 },
      freeAboveQuantity: { type: Number, default: 15 },
      perExtraItemFee: { type: Number, default: 5 },
      slabs: [
        {
          minQty: { type: Number, default: 1 },
          maxQty: { type: Number, default: 5 },
          cost: { type: Number, default: 30 },
        },
        {
          minQty: { type: Number, default: 6 },
          maxQty: { type: Number, default: 10 },
          cost: { type: Number, default: 50 },
        },
        {
          minQty: { type: Number, default: 11 },
          maxQty: { type: Number, default: 20 },
          cost: { type: Number, default: 80 },
        },
      ],
    },
    // 2. Shipping cost by user
    userRules: {
      enabled: { type: Boolean, default: true },
      defaultCost: { type: Number, default: 40 },
      userTypes: [
        {
          userType: { type: String, default: "retail" },
          label: { type: String, default: "Retail Customer" },
          cost: { type: Number, default: 40 },
          freeAboveOrderAmount: { type: Number, default: 499 },
        },
        {
          userType: { type: String, default: "b2b" },
          label: { type: String, default: "B2B / Wholesale Buyer" },
          cost: { type: Number, default: 100 },
          freeAboveOrderAmount: { type: Number, default: 2999 },
        },
        {
          userType: { type: String, default: "vip" },
          label: { type: String, default: "VIP / Prime Member" },
          cost: { type: Number, default: 0 },
          freeAboveOrderAmount: { type: Number, default: 0 },
        },
        {
          userType: { type: String, default: "first_order" },
          label: { type: String, default: "First-Time Buyer" },
          cost: { type: Number, default: 0 },
          freeAboveOrderAmount: { type: Number, default: 199 },
        },
      ],
    },
    // 3. Shipping cost by pin code
    pincodeRules: {
      enabled: { type: Boolean, default: true },
      defaultCost: { type: Number, default: 50 },
      pincodes: [
        {
          code: { type: String, default: "411057" },
          areaName: { type: String, default: "Hinjawadi (Local Zone 1)" },
          cost: { type: Number, default: 25 },
          isServiceable: { type: Boolean, default: true },
        },
        {
          code: { type: String, default: "411045" },
          areaName: { type: String, default: "Baner (Local Zone 2)" },
          cost: { type: Number, default: 35 },
          isServiceable: { type: Boolean, default: true },
        },
        {
          code: { type: String, default: "411001" },
          areaName: { type: String, default: "Pune City Central" },
          cost: { type: Number, default: 60 },
          isServiceable: { type: Boolean, default: true },
        },
      ],
    },
    // 4. Shipping cost by category
    categoryRules: {
      enabled: { type: Boolean, default: true },
      defaultCost: { type: Number, default: 30 },
      categories: [
        {
          categoryName: { type: String, default: "Fresh Vegetables" },
          extraCost: { type: Number, default: 10 },
          isFreeShipping: { type: Boolean, default: false },
        },
        {
          categoryName: { type: String, default: "Fresh Fruits" },
          extraCost: { type: Number, default: 15 },
          isFreeShipping: { type: Boolean, default: false },
        },
        {
          categoryName: { type: String, default: "Dairy & Cold Chain" },
          extraCost: { type: Number, default: 25 },
          isFreeShipping: { type: Boolean, default: false },
        },
        {
          categoryName: { type: String, default: "Heavy Grains & Pulses" },
          extraCost: { type: Number, default: 40 },
          isFreeShipping: { type: Boolean, default: false },
        },
      ],
    },
    // 5. Shipping cost by weight
    weightRules: {
      enabled: { type: Boolean, default: true },
      baseWeightKg: { type: Number, default: 1 },
      baseCost: { type: Number, default: 30 },
      costPerExtraKg: { type: Number, default: 15 },
      slabs: [
        {
          minWeightKg: { type: Number, default: 0 },
          maxWeightKg: { type: Number, default: 2 },
          cost: { type: Number, default: 30 },
        },
        {
          minWeightKg: { type: Number, default: 2 },
          maxWeightKg: { type: Number, default: 5 },
          cost: { type: Number, default: 60 },
        },
        {
          minWeightKg: { type: Number, default: 5 },
          maxWeightKg: { type: Number, default: 10 },
          cost: { type: Number, default: 110 },
        },
        {
          minWeightKg: { type: Number, default: 10 },
          maxWeightKg: { type: Number, default: 25 },
          cost: { type: Number, default: 200 },
        },
      ],
    },
    // 6. Shipping cost by state
    stateRules: {
      enabled: { type: Boolean, default: true },
      defaultCost: { type: Number, default: 90 },
      states: [
        {
          stateName: { type: String, default: "Maharashtra" },
          cost: { type: Number, default: 40 },
          isServiceable: { type: Boolean, default: true },
        },
        {
          stateName: { type: String, default: "Gujarat" },
          cost: { type: Number, default: 80 },
          isServiceable: { type: Boolean, default: true },
        },
        {
          stateName: { type: String, default: "Karnataka" },
          cost: { type: Number, default: 90 },
          isServiceable: { type: Boolean, default: true },
        },
        {
          stateName: { type: String, default: "Madhya Pradesh" },
          cost: { type: Number, default: 110 },
          isServiceable: { type: Boolean, default: true },
        },
        {
          stateName: { type: String, default: "Goa" },
          cost: { type: Number, default: 70 },
          isServiceable: { type: Boolean, default: true },
        },
      ],
    },
    // Per-zone / per-dark-store rule sets: { scope: "zone"|"store", targetId, targetName, isActive, ...rules }.
    // Checkout uses store override → zone override → the vendor-wide rules above.
    overrides: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { timestamps: true }
);

export const VendorShippingMethod =
  mongoose.models.VendorShippingMethod || mongoose.model("VendorShippingMethod", vendorShippingMethodSchema);

// ============================================================
// VENDOR REVIEWS (1-5 Star Ratings & Text Feedback)
// Protected: Reviews cannot be edited or deleted by vendors.
// ============================================================
const vendorReviewSchema = new mongoose.Schema(
  {
    vendorId: { type: String, required: true, index: true },
    customerName: { type: String, required: true, trim: true },
    customerId: { type: String, default: "" },
    customerAvatar: { type: String, default: "" },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, default: "", trim: true },
    comment: { type: String, required: true, trim: true },
    productName: { type: String, default: "" },
    orderId: { type: String, default: "" },
    isVerifiedPurchase: { type: Boolean, default: true },
    helpfulCount: { type: Number, default: 0 },
    aspectRatings: {
      freshness: { type: Number, default: 5 },
      packaging: { type: Number, default: 5 },
      delivery: { type: Number, default: 5 },
    },
    vendorReply: {
      text: { type: String, default: "" },
      repliedAt: { type: Date, default: null },
      vendorName: { type: String, default: "" },
    },
    status: { type: String, enum: ["Approved", "Pending", "Flagged"], default: "Approved" },
  },
  { timestamps: true }
);

export const VendorReview =
  mongoose.models.VendorReview || mongoose.model("VendorReview", vendorReviewSchema);

/**
 * Ensures all MongoDB indexes for farmer-manager service are created in background
 */
export async function ensureFarmerIndexes() {
  try {
    // Allow shared cropId across farmers (drop old global unique if present)
    try {
      await FarmerCrop.collection.dropIndex("cropId_1");
    } catch (err) {
      if (err?.code !== 27 && !/index not found/i.test(String(err?.message || ""))) {
        console.warn("[Indexes] cropId_1 drop:", err.message);
      }
    }
    // Drop old non-sparse phone_1 index on vendors if present
    try {
      await Vendor.collection.dropIndex("phone_1");
    } catch (err) {
      if (err?.code !== 27 && !/index not found/i.test(String(err?.message || ""))) {
        console.warn("[Indexes] phone_1 drop:", err.message);
      }
    }

    const models = [
      Vendor,
      Farmer,
      FarmerManager,
      FarmerProduct,
      FarmerStockHistory,
      FarmerOrder,
      FarmerEarning,
      FarmerDocument,
      FarmerHarvestOrder,
      FarmerCrop,
      FarmerCropPlan,
      PickupDriver,
      CollectionCentre,
      Pickup,
      QualityInspection,
      VendorInventoryAlert,
      VendorDocument,
      DarkStoreRequest,
      VendorProductRequest,
      VendorProduct,
      VendorCropRequest,
      VendorCrop,
      VendorReview,
    ];

    await Promise.all(
      models.map((model) =>
        model.createIndexes().catch((err) => {
          console.warn(`[Indexes] Non-critical warning on ${model.modelName}:`, err.message);
        })
      )
    );
    console.log("[Indexes] Farmer-Manager indexes ensured successfully.");
  } catch (err) {
    console.warn("[Indexes] Error creating farmer indexes:", err.message);
  }
}

import mongoose from "mongoose";

const shippingSlabSchema = new mongoose.Schema(
  {
    orderAmount: {
      type: Number,
      required: true,
      min: [0, "Order amount must be 0 or more"],
    },
    shippingCharge: {
      type: Number,
      required: true,
      min: [0, "Shipping charge must be 0 or more"],
    },
  },
  { _id: false }
);


const preOrderSlotSchema = new mongoose.Schema(
  {
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    capacity: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const giftHamperGiftSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: "", trim: true, maxlength: 500 },
    image: { type: String, default: "", trim: true, maxlength: 500 },
  },
  { _id: false }
);

const giftHamperTierSchema = new mongoose.Schema(
  {
    minOrderAmount: {
      type: Number,
      required: true,
      min: [1, "Minimum order amount must be greater than 0"],
    },
    gift: {
      type: giftHamperGiftSchema,
      required: true,
    },
  },
  { _id: false }
);

const orderGiftHamperSchema = new mongoose.Schema(
  {
    minOrderAmount: { type: Number, required: true, min: 0 },
    gift: {
      type: giftHamperGiftSchema,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    reviewedAt: { type: Date, default: null },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserBulkMart",
      default: null,
    },
    adminNote: { type: String, default: "", trim: true, maxlength: 500 },
  },
  { _id: false }
);

const merchantUpiAccountSchema = new mongoose.Schema(
  {
    upiId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    label: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const enviaAddressSchema = new mongoose.Schema(
  {
    name: { type: String, default: "", trim: true, maxlength: 120 },
    company: { type: String, default: "", trim: true, maxlength: 120 },
    email: { type: String, default: "", trim: true, maxlength: 120 },
    phone: { type: String, default: "", trim: true, maxlength: 30 },
    addressLine1: { type: String, default: "", trim: true, maxlength: 200 },
    addressLine2: { type: String, default: "", trim: true, maxlength: 200 },
    landmark: { type: String, default: "", trim: true, maxlength: 200 },
    streetNumber: { type: String, default: "", trim: true, maxlength: 40 },
    street: { type: String, default: "", trim: true, maxlength: 400 },
    city: { type: String, default: "", trim: true, maxlength: 120 },
    state: { type: String, default: "", trim: true, maxlength: 120 },
    country: { type: String, default: "IN", trim: true, maxlength: 3 },
    postalCode: { type: String, default: "", trim: true, maxlength: 20 },
    isDefault: { type: Boolean, default: true },
  },
  { _id: false }
);

const enviaPackageDefaultsSchema = new mongoose.Schema(
  {
    type: { type: String, default: "box", trim: true, maxlength: 40 },
    content: { type: String, default: "Mobile accessories", trim: true, maxlength: 140 },
    amount: { type: Number, default: 1, min: 1 },
    weightUnit: { type: String, default: "KG", trim: true, maxlength: 5 },
    lengthUnit: { type: String, default: "CM", trim: true, maxlength: 5 },
    weight: { type: Number, default: 1, min: 0.01 },
    length: { type: Number, default: 20, min: 1 },
    width: { type: Number, default: 15, min: 1 },
    height: { type: Number, default: 10, min: 1 },
  },
  { _id: false }
);

const enviaConfigSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    useSandbox: { type: Boolean, default: true },
    apiToken: { type: String, default: "", trim: true, maxlength: 500 },
    defaultCarrier: { type: String, default: "", trim: true, maxlength: 80 },
    defaultService: { type: String, default: "", trim: true, maxlength: 120 },
    rateCarriers: { type: [String], default: () => [] },
    origin: { type: enviaAddressSchema, default: () => ({}) },
    packageDefaults: { type: enviaPackageDefaultsSchema, default: () => ({}) },
  },
  { _id: false }
);

const storeSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "store",
      unique: true,
      immutable: true,
    },
    preOrderSlots: {
      type: [
        {
          startTime: { type: String, required: true },
          endTime: { type: String, required: true },
          label: { type: String, required: true },
          isActive: { type: Boolean, default: true },
        },
      ],
      default: () => [
        { startTime: "09:00", endTime: "12:00", label: "9am to 12pm", isActive: true },
        { startTime: "12:00", endTime: "15:00", label: "12pm to 3pm", isActive: true },
      ],
    },
    minimumOrderValue: {
      type: Number,
      default: 0,
      min: [0, "Minimum order value must be 0 or more"],
    },
    minimumShippingCharge: {
      type: Number,
      default: 0,
      min: [0, "Minimum shipping charge must be 0 or more"],
    },
    shippingSlabs: {
      type: [shippingSlabSchema],
      default: () => [],
    },
    giftHamperTiers: {
      type: [giftHamperTierSchema],
      default: () => [],
    },
    giftHampersEnabled: {
      type: Boolean,
      default: false,
    },
    preOrderSlots: {
      type: [preOrderSlotSchema],
      default: () => [
        { startTime: "09:00 AM", endTime: "12:00 PM", capacity: 50, isActive: true },
        { startTime: "12:00 PM", endTime: "03:00 PM", capacity: 50, isActive: true },
        { startTime: "03:00 PM", endTime: "06:00 PM", capacity: 50, isActive: true },
      ],
    },
    merchantUpiId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    merchantUpiName: {
      type: String,
      default: "GreenGrocc",
      trim: true,
      maxlength: 100,
    },
    merchantUpiAccounts: {
      type: [merchantUpiAccountSchema],
      default: () => [],
    },
    cartNoticeEn: {
      type: [String],
      default: () => [
        "Please Verify Your Address Before Placing Your Order.",
        "Minimum order value ₹{{minOrder}}",
        "Parcel opening video is must for return.",
        "Shipping depends on parcel weight minimum Rs {{minShipping}}.",
        "User have to pay shipping charges in advance.",
      ],
    },
    cartNoticeHi: {
      type: [String],
      default: () => [
        "कृपया अपना पूरा पता ठीक से लिखें ऑर्डर करने से पहले। इसके बाद ऑर्डर करें।",
        "न्यूनतम ऑर्डर मूल्य {{minOrder}}.",
        "पार्सल वापसी के लिए पार्सल खोलने का वीडियो अनिवार्य है।",
        "शिपिंग पार्सल के वजन पर निर्भर करता है न्यूनतम {{minShipping}}/",
        "उपयोगकर्ता को शिपिंग शुल्क अग्रिम रूप से देना होगा।",
      ],
    },
    envia: {
      type: enviaConfigSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

const StoreSettings =
  mongoose.models.StoreSettings ||
  mongoose.model("StoreSettings", storeSettingsSchema);

export default StoreSettings;

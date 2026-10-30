import mongoose from "mongoose";

const bulkPricingSlabSchema = new mongoose.Schema(
  {
    minQuantity: {
      type: Number,
      required: [true, "Slab min quantity is required"],
      min: [1, "Slab min quantity must be at least 1"],
    },
    maxQuantity: {
      type: Number,
      default: null,
      validate: {
        validator(value) {
          return value == null || value >= 1;
        },
        message: "Slab max quantity must be at least 1",
      },
    },
    pricePerUnit: {
      type: Number,
      required: [true, "Slab price per unit is required"],
      min: [0, "Slab price cannot be negative"],
    },
    originalPricePerUnit: {
      type: Number,
      min: [0, "Original slab price cannot be negative"],
      default: null,
    },
  },
  { _id: false }
);

const bulkPricingSchema = new mongoose.Schema(
  {
    slabs: {
      type: [bulkPricingSlabSchema],
      default: [],
    },
  },
  { _id: false }
);

const productColorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Color name is required"],
      trim: true,
    },
    hex: {
      type: String,
      trim: true,
      default: "#cccccc",
    },
  },
  { _id: false }
);

const bulkGradeSchema = new mongoose.Schema(
  {
    grade: {
      type: String,
      enum: ["A", "B", "C"],
      required: true,
    },
    variety: {
      type: String,
      trim: true,
      default: "",
    },
    price: {
      type: Number,
      min: [0, "Grade price cannot be negative"],
      default: 0,
    },
    mrp: {
      type: Number,
      min: [0, "Grade MRP cannot be negative"],
      default: 0,
    },
    stock: {
      type: Number,
      min: [0, "Grade stock cannot be negative"],
      default: 0,
    },
    unit: {
      type: String,
      trim: true,
      default: "1 Kg",
    },
    isAvailable: {
      type: Boolean,
      default: false,
    },
    minOrderQuantity: {
      type: Number,
      min: [1, "Minimum order quantity must be at least 1"],
      default: 1,
    },
  },
  { _id: false }
);

const productSpecificationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Specification name is required"],
      trim: true,
    },
    value: {
      type: String,
      required: [true, "Specification value is required"],
      trim: true,
    },
  },
  { _id: false }
);

const productVariantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Variant name is required"],
      trim: true,
    },
    image: {
      type: String,
      trim: true,
      default: "",
    },
    quantity: {
      type: Number,
      default: 1,
    },
    unitType: {
      type: String,
      default: "Piece",
      trim: true,
    },
    pricingType: {
      type: String,
      enum: ["single", "bulk"],
      default: "single",
    },
    bulkPricing: {
      type: bulkPricingSchema,
      default: () => ({ slabs: [] }),
    },
    price: {
      type: Number,
      min: [0, "Price cannot be negative"],
      default: 0,
    },
    discountedPrice: {
      type: Number,
      min: [0, "Discounted price cannot be negative"],
      default: 0,
    },
    discountedPercent: {
      type: Number,
      min: [0, "Discounted percent cannot be negative"],
      max: [100, "Discounted percent cannot exceed 100"],
      default: 0,
    },
    stock: {
      type: Number,
      min: [0, "Stock cannot be negative"],
      default: 0,
    },
    inStock: {
      type: Boolean,
      default: true,
    },
    colors: {
      type: [productColorSchema],
      default: [],
    },
    minOrderQuantity: {
      type: Number,
      min: [1, "Minimum order quantity must be at least 1"],
      default: null,
    },
    maxOrderQuantity: {
      type: Number,
      min: [1, "Maximum order quantity must be at least 1"],
      default: null,
    },
    stepByQuantity: {
      type: Number,
      min: [1, "Step by quantity must be at least 1"],
      default: null,
    },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
      index: true,
    },
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },
    marathiName: {
      type: String,
      trim: true,
      default: "",
    },
    sku: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    categories: {
      type: [String],
      required: [true, "At least one category is required"],
      validate: [
        {
          validator(value) {
            return Array.isArray(value) && value.length >= 1;
          },
          message: "At least 1 category is required",
        },
        {
          validator(value) {
            return value.length <= 4;
          },
          message: "Maximum 4 categories allowed",
        },
      ],
    },
    subcategory: {
      type: String,
      required: [true, "Subcategory name is required"],
      trim: true,
    },
    subcategories: {
      type: [String],
      default: [],
    },
    brandName: {
      type: String,
      required: [true, "Brand name is required"],
      trim: true,
    },
    variantType: {
      type: String,
      enum: ["single", "multi"],
      default: "single",
    },
    variants: {
      type: [productVariantSchema],
      default: [],
    },
    pricingType: {
      type: String,
      enum: ["single", "bulk"],
      default: "single",
    },
    bulkPricing: {
      type: bulkPricingSchema,
      default: () => ({ slabs: [] }),
    },
    enableBulkGrades: {
      type: Boolean,
      default: false,
      index: true,
    },
    bulkGrades: {
      type: [bulkGradeSchema],
      default: [],
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    discountedPrice: {
      type: Number,
      required: [true, "Discounted price is required"],
      min: [0, "Discounted price cannot be negative"],
    },
    discountedPercent: {
      type: Number,
      required: [true, "Discounted percent is required"],
      min: [0, "Discounted percent cannot be negative"],
      max: [100, "Discounted percent cannot exceed 100"],
    },
    ratings: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    stock: {
      type: Number,
      min: [0, "Stock cannot be negative"],
      default: 0,
    },
    inStock: {
      type: Boolean,
      default: true,
    },
    colors: {
      type: [productColorSchema],
      default: [],
    },
    minOrderQuantity: {
      type: Number,
      min: [1, "Minimum order quantity must be at least 1"],
      default: null,
    },
    maxOrderQuantity: {
      type: Number,
      min: [1, "Maximum order quantity must be at least 1"],
      default: null,
    },
    stepByQuantity: {
      type: Number,
      min: [1, "Step by quantity must be at least 1"],
      default: null,
    },
    productImages: {
      type: [String],
      required: [true, "At least one product image is required"],
      validate: {
        validator(value) {
          return (
            Array.isArray(value) &&
            value.length > 0 &&
            value.every((img) => typeof img === "string" && img.trim())
          );
        },
        message: "At least one valid product image URL is required",
      },
    },
    videoUrl: {
      type: String,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    features: {
      type: [String],
      default: [],
    },
    specifications: {
      type: [productSpecificationSchema],
      default: [],
    },
    warranty: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    section: {
      type: String,
      trim: true,
      default: "greengrocc",
      index: true,
    },
    storeType: {
      type: String,
      trim: true,
      default: "main",
      index: true,
    },
    /** Optional department-wise number, e.g. 28 → "PR-28" */
    deptNumber: {
      type: String,
      trim: true,
      default: "",
    },
    /** Optional shelf position, e.g. row 2 / column 3 → "R2C3" */
    rackRow: {
      type: String,
      trim: true,
      default: "",
    },
    rackColumn: {
      type: String,
      trim: true,
      default: "",
    },
    /** Derived from section + deptNumber + rack, e.g. "PR-28-R2C3" */
    departmentId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    /**
     * Set when a Delivery Manager adds the product: it is only shown to customers
     * served by that dark store. Null = admin catalog product, visible everywhere.
     */
    ownerManagerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryManager",
      default: null,
      index: true,
    },
    /** Vendor (business id) whose approved catalog request created this product; "" = admin product. */
    ownerVendorId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    justArrived: {
      type: Boolean,
      default: false,
      index: true,
    },
    hotSelling: {
      type: Boolean,
      default: false,
      index: true,
    },
    cardGlowColor: {
      type: String,
      trim: true,
      default: "",
    },
    badge: {
      type: String,
      trim: true,
      default: "",
    },
    unit: {
      type: String,
      trim: true,
      default: "1 pc",
    },
    unitImage: {
      type: String,
      trim: true,
      default: "",
    },
    weight: {
      type: Number,
      default: null,
      min: 0,
    },
    isHeavy: {
      type: Boolean,
      default: false,
      index: true,
    },
    /** Parent shown on the category page: Section → Category → Base product → Product */
    baseProductId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    baseProductName: {
      type: String,
      trim: true,
      default: "",
    },
    baseProductImage: {
      type: String,
      trim: true,
      default: "",
    },
    /** Shared id linking full-product variety siblings (clone via admin "Add variety") */
    varietyGroupId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    /** Short label shown under Select Unit on PDP (e.g. Alphonso, Kesar) */
    varietyName: {
      type: String,
      trim: true,
      default: "",
    },
    /** When false, Meet Your Farmer / farm traceability is hidden on the product page. */
    showFarmerTraceability: {
      type: Boolean,
      default: true,
    },
    farmerName: {
      type: String,
      trim: true,
      default: "",
    },
    farmerLocation: {
      type: String,
      trim: true,
      default: "",
    },
    farmerImage: {
      type: String,
      trim: true,
      default: "",
    },
    farmImage: {
      type: String,
      trim: true,
      default: "",
    },
    harvestingDate: {
      type: String,
      trim: true,
      default: "",
    },
    packingDate: {
      type: String,
      trim: true,
      default: "",
    },
    certification: {
      type: String,
      trim: true,
      default: "",
    },
    nutritionNote: {
      type: String,
      trim: true,
      default: "",
    },
    nutritionFacts: {
      type: [
        {
          label: { type: String, trim: true, default: "" },
          value: { type: String, trim: true, default: "" },
        },
      ],
      default: [],
    },
    farmerDetails: {
      name: { type: String, trim: true, default: "" },
      location: { type: String, trim: true, default: "" },
      farmerImage: { type: String, trim: true, default: "" },
      farmImage: { type: String, trim: true, default: "" },
      totalArea: { type: String, trim: true, default: "" },
      cultivationArea: { type: String, trim: true, default: "" },
      cropCycle: { type: String, trim: true, default: "" },
      agricultureMethod: { type: String, trim: true, default: "" },
      lastCropTaken: { type: String, trim: true, default: "" },
      currentCrop: { type: String, trim: true, default: "" },
      waterSource: { type: String, trim: true, default: "" },
      soilType: { type: String, trim: true, default: "" },
      farmTools: { type: String, trim: true, default: "" },
      harvestingDate: { type: String, trim: true, default: "" },
      experience: { type: String, trim: true, default: "" },
      bio: { type: String, trim: true, default: "" },
      crops: {
        type: [
          {
            name: { type: String, trim: true, default: "" },
            variety: { type: String, trim: true, default: "" },
            area: { type: String, trim: true, default: "" },
            status: { type: String, trim: true, default: "" },
          },
        ],
        default: [],
      },
    },
  },
  { timestamps: true }
);

productSchema.index({ categories: 1, subcategory: 1 });
productSchema.index({ subcategories: 1 });
productSchema.index(
  { sku: 1 },
  {
    unique: true,
    partialFilterExpression: { sku: { $type: "string", $gt: "" } },
  }
);

const Product = mongoose.model(
  "GreenGroccProduct",
  productSchema,
  "GreenGroccproducts"
);

export default Product;

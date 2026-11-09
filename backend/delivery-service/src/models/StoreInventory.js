import mongoose from "mongoose";

/**
 * Per-store (per delivery manager) inventory.
 * `stockCount` is the physical stock on the shelf; it drops when an order goes out for
 * delivery. Until then the order's units sit in `heldCount`, so customers can buy only
 * stockCount − heldCount (see availableStock).
 * Restock happens when Product Manager approves an inventory request.
 */
const storeInventorySchema = new mongoose.Schema(
  {
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryManager",
      required: true,
    },
    /** Catalog product this row tracks; the fixed link used for all stock lookups. */
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GreenGroccProduct",
      default: null,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
      default: "General",
    },
    unit: {
      type: String,
      trim: true,
      default: "pcs",
    },
    /** Selling price this store charges (the vendor's price when it set one, else the catalog's). */
    price: {
      type: Number,
      min: 0,
      default: 0,
    },
    /** MRP shown struck-through; 0 = use the catalog MRP. */
    mrp: {
      type: Number,
      min: 0,
      default: 0,
    },
    stockCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    /** Units promised to open orders that have not left the store yet. */
    heldCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    /** Why the row was switched off, so only that cause can switch it back on. */
    inactiveReason: {
      type: String,
      enum: ["", "vendor_removed", "product_archived"],
      default: "",
    },
  },
  { timestamps: true }
);

storeInventorySchema.index({ managerId: 1, sku: 1 }, { unique: true });
storeInventorySchema.index(
  { managerId: 1, productId: 1 },
  {
    name: "managerId_productId_unique",
    unique: true,
    partialFilterExpression: { productId: { $type: "objectId" } },
  }
);

storeInventorySchema.virtual("inStock").get(function inStock() {
  return this.stockCount > 0;
});

/** Units customers can still buy: physical stock minus units held for open orders. */
export function availableStock(row) {
  if (!row) return 0;
  return Math.max(0, (Number(row.stockCount) || 0) - (Number(row.heldCount) || 0));
}

/** Mongo filter expression: at least `quantity` units are available to sell. */
export function hasAvailableExpr(quantity) {
  return {
    $expr: { $gte: [{ $subtract: ["$stockCount", { $ifNull: ["$heldCount", 0] }] }, quantity] },
  };
}

storeInventorySchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    managerId: this.managerId.toString(),
    productId: this.productId ? this.productId.toString() : null,
    sku: this.sku,
    name: this.name,
    category: this.category,
    unit: this.unit,
    price: this.price,
    mrp: this.mrp,
    stockCount: this.stockCount,
    heldCount: this.heldCount || 0,
    availableStock: availableStock(this),
    lowStockThreshold: this.lowStockThreshold,
    inStock: this.stockCount > 0,
    isLowStock: this.stockCount > 0 && this.stockCount <= this.lowStockThreshold,
    isActive: this.isActive,
    inactiveReason: this.inactiveReason || "",
    updatedAt: this.updatedAt,
  };
};

if (mongoose.models.StoreInventory) {
  delete mongoose.models.StoreInventory;
}

const StoreInventory = mongoose.model("StoreInventory", storeInventorySchema);

export default StoreInventory;

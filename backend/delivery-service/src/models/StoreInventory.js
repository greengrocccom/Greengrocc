import mongoose from "mongoose";

/**
 * Per-store (per delivery manager) inventory.
 * Stock is reduced when a dark-store order is confirmed/packed.
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

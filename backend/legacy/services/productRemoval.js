import mongoose from "mongoose";
import Product from "../models/Product.js";
import Order from "../models/order/Order.js";
import Cart from "../models/Cart.js";
import Wishlist from "../models/Wishlist.js";
import StoreOrder from "../../delivery-service/src/models/StoreOrder.js";
import StoreInventory from "../../delivery-service/src/models/StoreInventory.js";
import {
  VendorCatalogRequest,
  VendorProduct,
  VendorProductRequest,
  VendorStockBatch,
} from "../../farmer-manager-service/src/models.js";
import { INACTIVE_REASON, toObjectId } from "../../delivery-service/src/services/catalogStoreInventory.js";

const REMOVED_REMARK = "Product was removed from the catalog";

/**
 * Take a catalog product off sale everywhere, all-or-nothing. A product that orders,
 * vendor stock batches or store stock still refer to is archived (inactive, store rows
 * switched off, vendor links kept for history); an unused one is deleted with its store
 * rows and vendor links. Either way pending requests are cancelled and carts/wishlists cleaned.
 */
export async function removeCatalogProduct(productId, { ownerVendorId = null } = {}) {
  const pid = toObjectId(productId);
  if (!pid) return { status: 404, body: { success: false, message: "Product not found" } };
  const pidText = String(pid);

  const session = await mongoose.startSession();
  try {
    let outcome;
    await session.withTransaction(async () => {
      const product = await Product.findById(pid).session(session);
      if (!product || (ownerVendorId && product.ownerVendorId !== ownerVendorId)) {
        outcome = { status: 404, body: { success: false, message: "Product not found" } };
        return;
      }

      // Sequential: operations sharing a transaction session must not run in parallel.
      const archive = Boolean(
        (await Order.exists({ "items.product": pid }).session(session)) ||
          (await StoreOrder.exists({ "items.productId": pid }).session(session)) ||
          (await VendorStockBatch.exists({ productId: pidText }).session(session)) ||
          (await StoreInventory.exists({ productId: pid, stockCount: { $gt: 0 } }).session(session))
      );
      const now = new Date();

      await Cart.updateMany({ "items.product": pid }, { $pull: { items: { product: pid } } }, { session });
      await Wishlist.updateMany({ "items.product": pid }, { $pull: { items: { product: pid } } }, { session });
      await VendorProductRequest.updateMany(
        { productId: pidText, status: "Pending" },
        { $set: { status: "Cancelled", adminRemarks: REMOVED_REMARK, reviewedAt: now } },
        { session }
      );
      await VendorCatalogRequest.updateMany(
        { kind: "product", targetId: pidText, status: "Pending" },
        { $set: { status: "Cancelled", adminRemarks: REMOVED_REMARK, reviewedAt: now } },
        { session }
      );

      if (archive) {
        product.isActive = false;
        await product.save({ session });
        await StoreInventory.updateMany(
          { productId: pid, isActive: true },
          { $set: { isActive: false, inactiveReason: INACTIVE_REASON.PRODUCT_ARCHIVED } },
          { session }
        );
        outcome = {
          status: 200,
          body: {
            success: true,
            archived: true,
            message: `"${product.name}" is used by orders or stock, so it was archived and taken off sale`,
          },
        };
        return;
      }

      await StoreInventory.deleteMany({ productId: pid }, { session });
      await VendorProduct.deleteMany({ productId: pid }, { session });
      await Product.deleteOne({ _id: pid }, { session });
      outcome = { status: 200, body: { success: true, archived: false, message: `"${product.name}" deleted` } };
    });
    return outcome;
  } catch (error) {
    return { status: 500, body: { success: false, message: error.message } };
  } finally {
    await session.endSession();
  }
}

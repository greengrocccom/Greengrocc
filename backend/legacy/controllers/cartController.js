import mongoose from "mongoose";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import {
  getAvailableColors,
  getMaxOrderQuantity,
  getVariant,
  getVariantStock,
  isMultiVariant,
  PRODUCT_PRICING_SELECT,
} from "../utils/productPricing.js";
import { pruneUnavailableCartItems } from "../utils/orderHelpers.js";
import { getUserContactEmail } from "../utils/userContact.js";
import { respondWithControllerError } from "../utils/controllerErrors.js";
import Address from "../models/address/Address.js";
import {
  addressFromQuery,
  applyStorePriceForCheckout,
  hasLocationHint,
  loadNearestStoreCatalog,
  matchProductToItem,
} from "../../delivery-service/src/services/nearestStoreCatalog.js";

const normalizeVariantName = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeColorName = (value) =>
  typeof value === "string" ? value.trim() : "";

const matchesCartItem = (item, productId, variantName, colorName, preOrderSlot) =>
  String(item?.product || "") === String(productId || "") &&
  normalizeVariantName(item.variantName) === normalizeVariantName(variantName) &&
  normalizeColorName(item.colorName) === normalizeColorName(colorName) &&
  (item.preOrderSlot || "") === (preOrderSlot || "");

function validateCartQuantity(product, variantName, qty) {
  const maxQty = getMaxOrderQuantity(product, variantName);

  if (qty < 1) {
    return {
      valid: false,
      message: "Quantity must be at least 1",
    };
  }

  if (maxQty && qty > maxQty) {
    return {
      valid: false,
      message: `Maximum order quantity allowed is ${maxQty}`,
    };
  }

  return { valid: true };
}

const populateCart = (queryOrDoc) =>
  queryOrDoc.populate({
    path: "items.product",
    select: PRODUCT_PRICING_SELECT,
  });

/** Store serving the location in the query, else the customer's saved address. */
async function storeCatalogForCart(req) {
  const query = req.query || {};
  if (hasLocationHint(addressFromQuery(query))) return loadNearestStoreCatalog(query);
  const userId = req.user._id;
  const address =
    (await Address.findOne({ user: userId, isDefault: true }).lean()) ||
    (await Address.findOne({ user: userId }).sort({ updatedAt: -1 }).lean());
  if (!address) return null;
  return loadNearestStoreCatalog({
    lat: address.location?.lat,
    lng: address.location?.lng,
    city: address.city,
    area: address.area,
    pincode: address.pincode,
    address: address.fullAddress,
  });
}

/** Cart lines priced like the serving store sells them (the vendor's price where it set one). */
async function withStorePrices(cart, req) {
  if (!cart?.items?.length) return cart;
  try {
    const catalog = await storeCatalogForCart(req);
    if (!catalog?.manager || !catalog.items?.length) return cart;
    const doc = cart.toObject ? cart.toObject() : cart;
    return {
      ...doc,
      items: doc.items.map((item) =>
        item.product?._id
          ? { ...item, product: applyStorePriceForCheckout(item.product, matchProductToItem(item.product, catalog.items)) }
          : item
      ),
    };
  } catch (error) {
    console.warn("[Cart] store pricing skipped:", error.message);
    return cart;
  }
}

export const getCart = async (req, res) => {
  try {
    let cart = await populateCart(Cart.findOne({ user: req.user._id }));

    if (!cart) {
      return res.status(200).json({
        success: true,
        data: {
          user: req.user._id,
          email: getUserContactEmail(req.user),
          items: [],
        },
      });
    }

    const { changed } = await pruneUnavailableCartItems(cart);
    if (changed) {
      cart = await populateCart(Cart.findById(cart._id));
    }

    res.status(200).json({ success: true, data: await withStorePrices(cart, req) });
  } catch (error) {
    respondWithControllerError(res, error, "Get cart");
  }
};

export const addToCart = async (req, res) => {
  try {
    const { productId, quantity, variantName, colorName, preOrderSlot } = req.body;
    const normalizedVariantName = normalizeVariantName(variantName);
    const normalizedColorName = normalizeColorName(colorName);

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    if (quantity === undefined || quantity === null || quantity === "") {
      return res.status(400).json({
        success: false,
        message: "Quantity is required",
      });
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1",
      });
    }

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (isMultiVariant(product)) {
      if (!normalizedVariantName) {
        return res.status(400).json({
          success: false,
          message: "Variant selection is required for this product",
        });
      }

      if (!getVariant(product, normalizedVariantName)) {
        return res.status(400).json({
          success: false,
          message: "Selected variant is not available",
        });
      }
    }

    const availableColors = getAvailableColors(product, normalizedVariantName);
    let resolvedColorName = normalizedColorName;
    if (availableColors.length > 0 && !resolvedColorName) {
      resolvedColorName = availableColors[0].name?.trim() || "";
    }

    if (availableColors.length > 0) {
      if (!resolvedColorName) {
        return res.status(400).json({
          success: false,
          message: "Color selection is required for this product",
        });
      }

      const colorMatch = availableColors.some(
        (color) => color.name?.trim().toLowerCase() === resolvedColorName.toLowerCase()
      );

      if (!colorMatch) {
        return res.status(400).json({
          success: false,
          message: "Selected color is not available",
        });
      }
    }

    const qtyCheck = validateCartQuantity(product, normalizedVariantName, qty, req.user);
    if (!qtyCheck.valid) {
      return res.status(400).json({
        success: false,
        message: qtyCheck.message,
      });
    }

    const availableStock = getVariantStock(product, normalizedVariantName);
    if (qty > availableStock) {
      return res.status(400).json({
        success: false,
        message: `Only ${availableStock} units available in stock`,
      });
    }

    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      try {
        cart = await Cart.create({
          user: req.user._id,
          email: getUserContactEmail(req.user),
          items: [
            {
              product: productId,
              quantity: qty,
              variantName: normalizedVariantName,
              colorName: resolvedColorName,
              preOrderSlot: preOrderSlot || "",
            },
          ],
        });
      } catch (error) {
        if (error.code === 11000) {
          cart = await Cart.findOne({ user: req.user._id });
          if (!cart) throw error;

          cart.email = getUserContactEmail(req.user);
          const existingIndex = cart.items.findIndex((item) =>
            matchesCartItem(item, productId, normalizedVariantName, resolvedColorName, preOrderSlot)
          );

          if (existingIndex >= 0) {
            cart.items[existingIndex].quantity += qty;
          } else {
            cart.items.push({
              product: productId,
              quantity: qty,
              variantName: normalizedVariantName,
              colorName: resolvedColorName,
              preOrderSlot: preOrderSlot || "",
            });
          }

          await cart.save();
        } else {
          throw error;
        }
      }
    } else {
      cart.email = getUserContactEmail(req.user);
      const existingIndex = cart.items.findIndex((item) =>
        matchesCartItem(item, productId, normalizedVariantName, resolvedColorName, preOrderSlot)
      );

      if (existingIndex >= 0) {
        const nextQty = cart.items[existingIndex].quantity + qty;
        const nextQtyCheck = validateCartQuantity(
          product,
          normalizedVariantName,
          nextQty
        );
        if (!nextQtyCheck.valid) {
          return res.status(400).json({
            success: false,
            message: nextQtyCheck.message,
          });
        }
        if (nextQty > availableStock) {
          return res.status(400).json({
            success: false,
            message: `Only ${availableStock} units available in stock`,
          });
        }
        cart.items[existingIndex].quantity = nextQty;
      } else {
        cart.items.push({
          product: productId,
          quantity: qty,
          variantName: normalizedVariantName,
          colorName: resolvedColorName,
          preOrderSlot: preOrderSlot || "",
        });
      }

      await cart.save();
    }

    cart = await populateCart(cart);

    res.status(200).json({
      success: true,
      message: "Product added to cart",
      data: await withStorePrices(cart, req),
    });
  } catch (error) {
    respondWithControllerError(res, error, "Add to cart");
  }
};

export const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }
    // Match a single cart line, including its slot. Legacy lines may omit optional fields.
    const optionalField = (value) => {
      const normalized = normalizeVariantName(value);
      return normalized || { $in: ["", null] };
    };
    const line = {
      product: productId,
      variantName: optionalField(req.query.variantName),
      colorName: optionalField(req.query.colorName),
      preOrderSlot: optionalField(req.query.preOrderSlot),
    };
    // $pull operates on the current array, so overlapping removals never save a stale copy.
    // Bump the version so older read/modify/save writers cannot resurrect removed lines.
    const cart = await populateCart(Cart.findOneAndUpdate(
      { user: req.user._id },
      { $pull: { items: line }, $inc: { __v: 1 } },
      { returnDocument: "after" }
    ));
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }
    return res.status(200).json({
      success: true,
      message: "Product removed from cart",
      data: await withStorePrices(cart, req),
    });
  } catch (error) {
    respondWithControllerError(res, error, "Remove from cart");
  }
};

export const updateCartItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity, variantName, colorName } = req.body;
    const normalizedVariantName = normalizeVariantName(variantName);
    const normalizedColorName = normalizeColorName(colorName);

    const qty = Number(quantity);
    if (!Number.isFinite(qty)) {
      return res.status(400).json({
        success: false,
        message: "Valid quantity is required",
      });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Keep legacy carts valid if email field was missing previously.
    if (!cart.email && req.user?.email) {
      cart.email = getUserContactEmail(req.user);
    }

    const itemIndex = cart.items.findIndex((item) =>
      matchesCartItem(item, productId, normalizedVariantName, normalizedColorName)
    );

    if (itemIndex < 0) {
      return res.status(404).json({
        success: false,
        message: "Product not in cart",
      });
    }

    if (qty >= 1) {
      const product = await Product.findById(productId);
      if (!product || !product.isActive) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      const availableStock = getVariantStock(product, normalizedVariantName);
      const qtyCheck = validateCartQuantity(product, normalizedVariantName, qty);
      if (!qtyCheck.valid) {
        return res.status(400).json({
          success: false,
          message: qtyCheck.message,
        });
      }

      if (qty > availableStock) {
        return res.status(400).json({
          success: false,
          message: `Only ${availableStock} units available in stock`,
        });
      }
    }

    if (qty < 1) {
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].quantity = qty;
    }

    await cart.save();

    const updated = await populateCart(cart);

    res.status(200).json({
      success: true,
      message: "Cart updated",
      data: await withStorePrices(updated, req),
    });
  } catch (error) {
    respondWithControllerError(res, error, "Update cart");
  }
};

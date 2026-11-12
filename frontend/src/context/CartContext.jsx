import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { addToCartItem, getCart, removeFromCartItem, updateCartItemQty } from "../api/api";
import { isLocalProductId } from "../utils/localProductId";
import { useAuth } from "./AuthContext";
import FlyToCartOverlay from "../components/cart/FlyToCartOverlay";
import { buildFlyToCartAnimation } from "../utils/flyToCart";
import {
  addOrMergeLine,
  findCartLine,
  mapCartItems,
  removeLine,
  setLineQuantity,
} from "../utils/cartState";
import {
  clearGuestCart,
  loadGuestCart,
  saveGuestCart,
} from "../utils/guestCartStorage";

const CartContext = createContext(null);

/** Rapid +/- taps on one line are coalesced into a single request sent after this pause. */
const QTY_SYNC_DELAY_MS = 350;

const CART_ERROR_MESSAGE = "Could not update cart. Please try again.";

const lineKeyOf = (productId, variantName = "", colorName = "", preOrderSlot = "") =>
  [productId, variantName || "", colorName || "", preOrderSlot || ""].map(String).join("|");

function resolveMaxQuantity(line, maxQuantity) {
  if (Number.isFinite(Number(maxQuantity)) && maxQuantity !== null && maxQuantity !== undefined) {
    return Number(maxQuantity);
  }
  if (Number.isFinite(Number(line.maxOrderQuantity)) && Number(line.maxOrderQuantity) > 0) {
    return Number(line.maxOrderQuantity);
  }
  if (Number.isFinite(Number(line.stock)) && Number(line.stock) > 0) {
    return Number(line.stock);
  }
  return null;
}

export function CartProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [items, setItemsState] = useState([]);
  const [loading, setLoading] = useState(false);
  const [flyAnimation, setFlyAnimation] = useState(null);
  const [cartSidebarOpen, setCartSidebarOpen] = useState(false);
  const itemsRef = useRef([]);
  const queueRef = useRef(Promise.resolve());
  const guestMergedRef = useRef(false);
  const pendingLinesRef = useRef(new Map());
  const inflightRef = useRef(0);
  const needsResyncRef = useRef(false);

  // The ref is updated synchronously so taps landing before the next render build on the latest cart.
  const setItems = useCallback((nextItems) => {
    itemsRef.current = nextItems;
    setItemsState(nextItems);
  }, []);

  const isSyncIdle = () => pendingLinesRef.current.size === 0 && inflightRef.current === 0;

  const applyGuestCart = useCallback((nextItems) => {
    setItems(nextItems);
    saveGuestCart(nextItems);
  }, [setItems]);

  const mergeLocalCatalogLines = useCallback((baseItems, memoryItems = itemsRef.current) => {
    const remote = (baseItems || []).filter((item) => !isLocalProductId(item._id));
    const localFromMemory = (memoryItems || []).filter((item) =>
      isLocalProductId(item._id)
    );
    const localFromStorage = loadGuestCart().filter((item) =>
      isLocalProductId(item._id)
    );
    const local = localFromMemory.length ? localFromMemory : localFromStorage;
    return [...remote, ...local];
  }, []);

  const syncCartFromServer = useCallback(async () => {
    if (!user) {
      setItems(loadGuestCart());
      return;
    }

    const { data } = await getCart();
    // Local quantity edits are still being sent; the last write response will carry the fresh cart.
    if (!isSyncIdle()) {
      needsResyncRef.current = true;
      return;
    }
    setItems(mergeLocalCatalogLines(mapCartItems(data.data)));
  }, [user, mergeLocalCatalogLines, setItems]);

  // Server writes run one at a time: the backend saves the whole cart document per request.
  const enqueueWrite = useCallback((execute) => {
    inflightRef.current += 1;
    const task = queueRef.current.then(execute, execute);
    queueRef.current = task.then(
      () => undefined,
      () => undefined
    );
    return task;
  }, []);

  /** Only the write that leaves the cart idle may replace local state, so taps never flicker back. */
  const finishWrite = useCallback(
    async (response) => {
      inflightRef.current -= 1;
      if (!response) needsResyncRef.current = true;
      if (!isSyncIdle()) return;

      if (response && !needsResyncRef.current) {
        setItems(mergeLocalCatalogLines(mapCartItems(response.data.data)));
        return;
      }

      needsResyncRef.current = false;
      try {
        await syncCartFromServer();
      } catch {
        // Keep the local cart if the refresh fails; the next write or load will reconcile.
      }
    },
    [mergeLocalCatalogLines, setItems, syncCartFromServer]
  );

  const runServerWrite = useCallback(
    (apiCall) =>
      enqueueWrite(async () => {
        let response = null;
        let result;
        try {
          response = await apiCall();
          result = { success: true };
        } catch (error) {
          result = {
            success: false,
            message: error?.response?.data?.message || CART_ERROR_MESSAGE,
          };
        }
        await finishWrite(response);
        return result;
      }),
    [enqueueWrite, finishWrite]
  );

  const flushLine = useCallback(
    (key) => {
      const entry = pendingLinesRef.current.get(key);
      if (!entry) return Promise.resolve({ success: true });

      clearTimeout(entry.timer);
      pendingLinesRef.current.delete(key);

      const { productId, variantName, colorName, preOrderSlot } = entry.args;
      const task = runServerWrite(() =>
        entry.quantity < 1
          ? removeFromCartItem(productId, variantName, colorName, preOrderSlot)
          : updateCartItemQty(productId, entry.quantity, variantName, colorName, preOrderSlot)
      );
      task.then((result) => entry.resolvers.forEach((resolve) => resolve(result)));
      return task;
    },
    [runServerWrite]
  );

  /** Sends every debounced quantity change now and waits until the server has them all. */
  const flushCartUpdates = useCallback(async () => {
    [...pendingLinesRef.current.keys()].forEach((key) => flushLine(key));
    await queueRef.current;
  }, [flushLine]);

  const loadCart = useCallback(
    async ({ silent = false } = {}) => {
      if (!user) {
        setItems(loadGuestCart());
        return;
      }

      if (!silent) {
        setLoading(true);
      }

      try {
        await flushCartUpdates();
        await syncCartFromServer();
      } catch {
        if (isSyncIdle()) setItems(mergeLocalCatalogLines([]));
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [user, flushCartUpdates, syncCartFromServer, mergeLocalCatalogLines, setItems]
  );

  const mergeGuestCartToServer = useCallback(async () => {
    const guestItems = loadGuestCart();
    if (!guestItems.length) return;

    const remoteGuest = guestItems.filter((item) => !isLocalProductId(item._id));
    const localGuest = guestItems.filter((item) => isLocalProductId(item._id));

    for (const item of remoteGuest) {
      try {
        await addToCartItem({
          productId: item._id,
          quantity: item.quantity,
          variantName: item.variantName || "",
          colorName: item.colorName || "",
          preOrderSlot: item.preOrderSlot || "",
        });
      } catch {
        // Skip products that no longer exist / are out of stock
      }
    }

    saveGuestCart(localGuest);
    await syncCartFromServer();
  }, [syncCartFromServer]);

  useEffect(() => {
    if (authLoading) return;

    const bootstrap = async () => {
      if (user) {
        await loadCart({ silent: true });
        if (!guestMergedRef.current) {
          guestMergedRef.current = true;
          try {
            await mergeGuestCartToServer();
          } catch {
            // Keep server cart if merge fails.
          }
        }
      } else {
        guestMergedRef.current = false;
        setItems(loadGuestCart());
      }
    };

    bootstrap();
  }, [user, authLoading, loadCart, mergeGuestCartToServer, setItems]);

  // Changes queued for a signed-in cart must not be sent after that user signs out.
  const userId = user?._id || user?.id || null;
  useEffect(() => {
    const pending = pendingLinesRef.current;
    return () => {
      pending.forEach((entry) => {
        clearTimeout(entry.timer);
        entry.resolvers.forEach((resolve) => resolve({ success: false }));
      });
      pending.clear();
      needsResyncRef.current = false;
    };
  }, [userId]);

  const playFlyToCart = useCallback(
    (product, flySource) => {
      const animation = buildFlyToCartAnimation(
        flySource,
        product?.productImages?.[0] || ""
      );
      if (!animation) return;
      setFlyAnimation({ ...animation, id: Date.now() });
    },
    []
  );

  const clearFlyAnimation = useCallback(() => {
    setFlyAnimation(null);
  }, []);

  /** Applies a quantity change instantly and sends only the final quantity once tapping pauses. */
  const scheduleLineSync = useCallback(
    (args, nextQty, optimisticItems) => {
      setItems(optimisticItems);

      const lineArgs = {
        productId: args.productId,
        variantName: args.variantName || "",
        colorName: args.colorName || "",
        preOrderSlot: args.preOrderSlot || "",
      };
      const key = lineKeyOf(
        lineArgs.productId,
        lineArgs.variantName,
        lineArgs.colorName,
        lineArgs.preOrderSlot
      );
      const pending = pendingLinesRef.current;
      const entry = pending.get(key) || { resolvers: [] };
      clearTimeout(entry.timer);
      entry.args = lineArgs;
      entry.quantity = nextQty;
      entry.timer = setTimeout(() => flushLine(key), QTY_SYNC_DELAY_MS);
      pending.set(key, entry);

      return new Promise((resolve) => entry.resolvers.push(resolve));
    },
    [setItems, flushLine]
  );

  const hasPendingLine = (productId, variantName, colorName, preOrderSlot) =>
    pendingLinesRef.current.has(lineKeyOf(productId, variantName, colorName, preOrderSlot));

  const runCartMutation = useCallback(
    (buildMutation) => {
      const mutation = buildMutation(itemsRef.current);
      if (!mutation) {
        return Promise.resolve({ success: false });
      }

      setItems(mutation.optimisticItems);
      return runServerWrite(mutation.apiCall);
    },
    [setItems, runServerWrite]
  );

  const persistLocalCart = useCallback(
    (nextItems) => {
      setItems(nextItems);
      if (!user) {
        applyGuestCart(nextItems);
        return;
      }
      saveGuestCart(nextItems.filter((item) => isLocalProductId(item._id)));
    },
    [user, applyGuestCart, setItems]
  );

  const isLocalLine = useCallback(
    (productId) => !user || isLocalProductId(productId),
    [user]
  );

  /** Sets a line to `nextQty` (removing it below 1) locally or via a debounced server sync. */
  const changeLineQuantity = useCallback(
    (args, nextQty) => {
      const { productId, variantName = "", colorName = "", preOrderSlot = "" } = args;
      const current = itemsRef.current;
      const nextItems =
        nextQty < 1
          ? removeLine(current, productId, variantName, colorName, preOrderSlot)
          : setLineQuantity(current, productId, variantName, colorName, nextQty, preOrderSlot);

      if (isLocalLine(productId)) {
        persistLocalCart(nextItems);
        return Promise.resolve({ success: true });
      }

      return scheduleLineSync(args, nextQty, nextItems);
    },
    [isLocalLine, persistLocalCart, scheduleLineSync]
  );

  const addToCart = useCallback(
    async (product, quantity, options = {}) => {
      const qty = Number(quantity);
      if (!Number.isFinite(qty) || qty < 1) {
        return { success: false };
      }

      const variantName = options.variantName || "";
      const colorName = options.colorName || "";
      const preOrderSlot = options.preOrderSlot || "";

      if (options.flySource) {
        playFlyToCart(product, options.flySource);
      }

      const optimisticItems = addOrMergeLine(
        itemsRef.current,
        product,
        qty,
        variantName,
        colorName,
        preOrderSlot
      );

      if (isLocalLine(product?._id)) {
        persistLocalCart(optimisticItems);
        return { success: true };
      }

      // The server still has this line (its update is queued), so set the merged quantity instead.
      if (hasPendingLine(product._id, variantName, colorName, preOrderSlot)) {
        const line = findCartLine(optimisticItems, product._id, variantName, colorName, preOrderSlot);
        return scheduleLineSync(
          { productId: product._id, variantName, colorName, preOrderSlot },
          line?.quantity || qty,
          optimisticItems
        );
      }

      return runCartMutation(() => ({
        optimisticItems,
        apiCall: () =>
          addToCartItem({
            productId: product._id,
            quantity: qty,
            variantName,
            colorName,
            preOrderSlot,
          }),
      }));
    },
    [isLocalLine, playFlyToCart, runCartMutation, persistLocalCart, scheduleLineSync]
  );

  const removeFromCart = useCallback(
    (productId, variantName = "", colorName = "", preOrderSlot = "") => {
      if (isLocalLine(productId)) {
        persistLocalCart(
          removeLine(itemsRef.current, productId, variantName, colorName, preOrderSlot)
        );
        return Promise.resolve({ success: true });
      }

      if (hasPendingLine(productId, variantName, colorName, preOrderSlot)) {
        const task = changeLineQuantity({ productId, variantName, colorName, preOrderSlot }, 0);
        flushLine(lineKeyOf(productId, variantName, colorName, preOrderSlot));
        return task;
      }

      return runCartMutation((current) => {
        const line = findCartLine(current, productId, variantName, colorName, preOrderSlot);
        if (!line) return null;

        return {
          optimisticItems: removeLine(current, productId, variantName, colorName, preOrderSlot),
          apiCall: () => removeFromCartItem(productId, variantName, colorName, preOrderSlot),
        };
      });
    },
    [isLocalLine, runCartMutation, persistLocalCart, changeLineQuantity, flushLine]
  );

  const updateQuantity = useCallback(
    (productId, quantity, variantName = "", colorName = "", preOrderSlot = "") => {
      const qty = Number(quantity);
      if (!Number.isFinite(qty)) return Promise.resolve({ success: false });

      const line = findCartLine(itemsRef.current, productId, variantName, colorName, preOrderSlot);
      if (!line) return Promise.resolve({ success: false });
      if (qty === line.quantity) return Promise.resolve({ success: true });

      return changeLineQuantity({ productId, variantName, colorName, preOrderSlot }, qty);
    },
    [changeLineQuantity]
  );

  const incrementCartItem = useCallback(
    ({ productId, variantName = "", colorName = "", preOrderSlot = "", step = 1, maxQuantity }) => {
      const safeStep = Number(step) > 0 ? Number(step) : 1;
      const line = findCartLine(itemsRef.current, productId, variantName, colorName, preOrderSlot);
      if (!line) return Promise.resolve({ success: false });

      const effectiveMax = resolveMaxQuantity(line, maxQuantity);
      let nextQty = line.quantity + safeStep;
      if (effectiveMax != null) {
        nextQty = Math.min(effectiveMax, nextQty);
      }
      if (nextQty <= line.quantity) return Promise.resolve({ success: true });

      return changeLineQuantity({ productId, variantName, colorName, preOrderSlot }, nextQty);
    },
    [changeLineQuantity]
  );

  const decrementCartItem = useCallback(
    ({ productId, variantName = "", colorName = "", preOrderSlot = "", resolveNextQuantity }) => {
      const line = findCartLine(itemsRef.current, productId, variantName, colorName, preOrderSlot);
      if (!line) return Promise.resolve({ success: false });

      const nextQty =
        typeof resolveNextQuantity === "function"
          ? Number(resolveNextQuantity(line.quantity))
          : line.quantity - 1;

      if (!Number.isFinite(nextQty) || nextQty === line.quantity) {
        return Promise.resolve({ success: true });
      }

      return changeLineQuantity({ productId, variantName, colorName, preOrderSlot }, nextQty);
    },
    [changeLineQuantity]
  );

  const resetCart = useCallback(() => {
    setItems([]);
    if (!user) {
      clearGuestCart();
    }
  }, [user, setItems]);

  const cartCount = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    [items]
  );

  const openCartSidebar = useCallback(() => setCartSidebarOpen(true), []);
  const closeCartSidebar = useCallback(() => setCartSidebarOpen(false), []);

  const value = useMemo(
    () => ({
      items,
      addToCart,
      removeFromCart,
      updateQuantity,
      incrementCartItem,
      decrementCartItem,
      flushCartUpdates,
      playFlyToCart,
      cartCount,
      loadCart,
      resetCart,
      loading,
      cartSidebarOpen,
      openCartSidebar,
      closeCartSidebar,
    }),
    [
      items,
      addToCart,
      removeFromCart,
      updateQuantity,
      incrementCartItem,
      decrementCartItem,
      flushCartUpdates,
      playFlyToCart,
      cartCount,
      loadCart,
      resetCart,
      loading,
      cartSidebarOpen,
      openCartSidebar,
      closeCartSidebar,
    ]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <FlyToCartOverlay animation={flyAnimation} onComplete={clearFlyAnimation} />
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}

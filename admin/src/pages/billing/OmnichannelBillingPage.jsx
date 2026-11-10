import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Zap,
  Store,
  Users,
  Receipt,
  ShoppingCart,
  CreditCard,
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  QrCode,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Smartphone,
  Building2,
  ShoppingBag,
  Share2,
  RefreshCw,
  SlidersHorizontal,
  Filter,
  ShieldCheck,
  Check,
  X,
  Clock,
  Coins,
  Gift,
  BarChart3,
  ArrowUpDown,
  FileText,
  Tag,
  Laptop,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Flame,
  Award,
  Wallet,
  Globe,
  Radio,
  ChevronRight,
  TrendingUp,
  Loader2,
  UserPlus,
  Package,
  Bookmark,
  Percent,
  Split,
  FileCheck,
  MapPin,
} from 'lucide-react';
import {
  BTN,
  BTN_PRIMARY,
  INPUT,
  PAGE_KICKER,
  PAGE_SUB,
  PAGE_TITLE,
  PANEL,
  PANEL_HEAD,
  TH,
  TD,
} from '../../utils/ui';
import billingApi from '../../api/billingApi';

export default function OmnichannelBillingPage() {
  const { subTab } = useParams();
  const navigate = useNavigate();

  // Active Tab state
  const currentTab = useMemo(() => {
    if (subTab === 'omnichannel') return 'omnichannel';
    if (subTab === 'loyalty-crm') return 'loyalty';
    if (subTab === 'invoices') return 'invoices';
    return 'terminal'; // default
  }, [subTab]);

  const setTab = (tabKey) => {
    if (tabKey === 'terminal') navigate('/billing');
    else if (tabKey === 'omnichannel') navigate('/billing/omnichannel');
    else if (tabKey === 'loyalty') navigate('/billing/loyalty-crm');
    else if (tabKey === 'invoices') navigate('/billing/invoices');
  };

  // --- REAL DATA STATES ---
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(['All']);
  const [customers, setCustomers] = useState([]);
  const [invoicesList, setInvoicesList] = useState([]);
  const [channelOverview, setChannelOverview] = useState(null);

  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [submittingInvoice, setSubmittingInvoice] = useState(false);

  // --- TERMINAL ACTIVE STATE ---
  const [selectedChannel, setSelectedChannel] = useState('physical_store'); // 'physical_store' | 'mall_counter' | 'ecommerce'
  const [activeCounter, setActiveCounter] = useState('Counter #1 - GreenGrocc Store');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [cart, setCart] = useState([]);

  // CRM & Loyalty in Billing State
  const [customerSearch, setCustomerSearch] = useState('');
  const [activeCustomer, setActiveCustomer] = useState(null);
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('UPI'); // 'UPI' | 'Cash' | 'Card' | 'Wallet' | 'Split' | 'Credit'
  const [cashTendered, setCashTendered] = useState(0);

  // Missing Options: Packaging / Carry Bag
  const BAG_PRICES = useMemo(() => ({
    none: { label: 'No Bag', price: 0, icon: '🚫' },
    paper: { label: 'Paper Bag', price: 5, icon: '🛍️' },
    jute: { label: 'Jute Bag', price: 15, icon: '🌿' },
    cloth: { label: 'Cloth Bag', price: 25, icon: '👜' },
  }), []);
  const [packagingBag, setPackagingBag] = useState('none');

  // Missing Options: Cashier Discounts & Promo Coupon
  const [cashierDiscountType, setCashierDiscountType] = useState('none'); // 'none' | '5%' | '10%' | 'flat50'
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null); // { code, type: 'percent'|'flat', value, label }

  // Missing Options: Split Payment
  const [splitCashAmount, setSplitCashAmount] = useState(0);

  // Missing Options: Bill Remarks & B2B GSTIN
  const [billRemarks, setBillRemarks] = useState('');
  const [showRemarksInput, setShowRemarksInput] = useState(false);
  const [customerGstin, setCustomerGstin] = useState('');
  const [showGstinInput, setShowGstinInput] = useState(false);

  // Missing Options: Parked Bills (Hold / Recall)
  const [parkedBills, setParkedBills] = useState([]);
  const [showParkedModal, setShowParkedModal] = useState(false);

  // Completed Invoice Modal
  const [completedInvoice, setCompletedInvoice] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Quick Add Customer Modal
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', phone: '', email: '' });
  const [addingCustomer, setAddingCustomer] = useState(false);

  // Scanner autofocus ref & right panel scroll ref
  const barcodeInputRef = useRef(null);
  const rightPanelRef = useRef(null);

  const scrollToRightTop = () => {
    rightPanelRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    const mainEl = document.querySelector('.admin-panel main');
    mainEl?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Channels inventory sync toggle
  const [channelsSyncEnabled, setChannelsSyncEnabled] = useState(true);

  // --- REAL ZONE, DARK STORE & VENDOR FULFILLMENT STATES ---
  const [zonesList, setZonesList] = useState([]);
  const [storesList, setStoresList] = useState([]);
  const [selectedZoneKey, setSelectedZoneKey] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [activeStore, setActiveStore] = useState(null);
  const [activeVendor, setActiveVendor] = useState(null);
  const [loadingZones, setLoadingZones] = useState(false);
  const [isStoreConfirmed, setIsStoreConfirmed] = useState(false);

  // --- LOAD REAL CATALOG DATA (SCOPED TO DARK STORE & CREATOR VENDOR) ---
  const loadCatalog = useCallback(async (storeId = '') => {
    try {
      setLoadingCatalog(true);
      const params = storeId ? { storeId } : {};
      const res = await billingApi.getCatalog(params);
      if (res.success) {
        setProducts(res.products || []);
        if (res.categories?.length) {
          setCategories(res.categories);
        }
        if (res.store) {
          setActiveStore((prev) => ({ ...(prev || {}), ...res.store }));
        }
        if (res.vendor) {
          setActiveVendor(res.vendor);
        }
      }
    } catch (err) {
      console.error('Failed to load store catalog:', err);
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  // --- LOAD REAL ZONES & DARK STORES WITH VENDORS ---
  const loadZonesAndStores = useCallback(async () => {
    try {
      setLoadingZones(true);
      const res = await billingApi.getZonesAndStores();
      if (res.success) {
        const fetchedZones = res.zones || [];
        const fetchedStores = res.stores || [];
        setZonesList(fetchedZones);
        setStoresList(fetchedStores);

        if (fetchedZones.length > 0) {
          const firstZoneKey = fetchedZones[0].zoneKey;
          setSelectedZoneKey(firstZoneKey);

          const storesInZone = fetchedStores.filter((s) => s.zoneKey === firstZoneKey);
          if (storesInZone.length > 0) {
            const firstStore = storesInZone[0];
            setSelectedStoreId(firstStore.id);
            setActiveStore(firstStore);
            setActiveVendor(firstStore.vendor || null);
            setActiveCounter(`Counter #1 - ${firstStore.storeName}`);
            await loadCatalog(firstStore.id);
            return;
          }
        }
      }
      await loadCatalog();
    } catch (err) {
      console.error('Failed to load real zones and dark stores:', err);
      await loadCatalog();
    } finally {
      setLoadingZones(false);
    }
  }, [loadCatalog]);

  // Zone Change Handler: cascades to stores in that zone
  const handleZoneChange = (newZoneKey) => {
    setSelectedZoneKey(newZoneKey);
    const storesInZone = storesList.filter((s) => s.zoneKey === newZoneKey);
    if (storesInZone.length > 0) {
      const nextStore = storesInZone[0];
      if (cart.length > 0 && isStoreConfirmed) {
        const confirmClear = window.confirm(
          `Switching to ${nextStore.storeName} (${nextStore.area}) will clear current cart items to maintain store inventory consistency. Continue?`
        );
        if (!confirmClear) return;
        setCart([]);
      }
      setSelectedStoreId(nextStore.id);
      setActiveStore(nextStore);
      setActiveVendor(nextStore.vendor || null);
      setActiveCounter(`Counter #1 - ${nextStore.storeName}`);
      loadCatalog(nextStore.id);
    } else {
      setSelectedStoreId('');
      setActiveStore(null);
      setActiveVendor(null);
      setProducts([]);
    }
  };

  // Dark Store Select Handler (Screen 1 selection)
  const handleStoreSelect = (store) => {
    if (!store) return;
    if (cart.length > 0 && store.id !== selectedStoreId && isStoreConfirmed) {
      const confirmClear = window.confirm(
        `Switching to ${store.storeName} (${store.area}) will clear current cart items to maintain store inventory consistency. Continue?`
      );
      if (!confirmClear) return;
      setCart([]);
    }
    setSelectedStoreId(store.id);
    setActiveStore(store);
    setActiveVendor(store.vendor || null);
    setActiveCounter(`Counter #1 - ${store.storeName}`);
    loadCatalog(store.id);
  };

  // Confirm Store and Open Next Billing Page (POS Terminal)
  const handleConfirmStoreAndProceed = useCallback((storeToConfirm = null) => {
    const targetStore = storeToConfirm || activeStore;
    if (!targetStore) {
      alert('Please select a dark store to proceed to the billing terminal.');
      return;
    }
    setSelectedStoreId(targetStore.id);
    setActiveStore(targetStore);
    setActiveVendor(targetStore.vendor || null);
    setActiveCounter(`Counter #1 - ${targetStore.storeName}`);
    loadCatalog(targetStore.id);
    setIsStoreConfirmed(true);
  }, [activeStore, loadCatalog]);

  // Switch Store: returns from Billing Terminal back to Selection Screen
  const handleSwitchStore = () => {
    if (cart.length > 0) {
      const confirmClear = window.confirm(
        'Switching dark store or zone will reset current cart items to maintain store inventory consistency. Continue?'
      );
      if (!confirmClear) return;
      setCart([]);
    }
    setIsStoreConfirmed(false);
  };

  // --- LOAD REAL CUSTOMERS ---
  const loadCustomers = useCallback(async (query = '') => {
    try {
      setLoadingCustomers(true);
      const res = await billingApi.getCustomers(query);
      if (res.success) {
        setCustomers(res.customers || []);
        if (!activeCustomer && res.customers?.length && !query) {
          setActiveCustomer(res.customers[0]);
          setPointsToRedeem(Math.min(100, res.customers[0].points || 0));
        }
      }
    } catch (err) {
      console.error('Failed to load real customers:', err);
    } finally {
      setLoadingCustomers(false);
    }
  }, [activeCustomer]);

  // --- LOAD REAL INVOICES ---
  const loadInvoices = useCallback(async (channel = '') => {
    try {
      setLoadingInvoices(true);
      const res = await billingApi.getInvoices(channel ? { channel } : {});
      if (res.success) {
        setInvoicesList(res.invoices || []);
      }
    } catch (err) {
      console.error('Failed to load real invoices:', err);
    } finally {
      setLoadingInvoices(false);
    }
  }, []);

  // --- LOAD REAL CHANNEL STATS ---
  const loadChannelOverview = useCallback(async () => {
    try {
      const res = await billingApi.getOmnichannelOverview();
      if (res.success) {
        setChannelOverview(res);
      }
    } catch (err) {
      console.error('Failed to load real channel overview:', err);
    }
  }, []);

  // Initial Data Load
  useEffect(() => {
    loadZonesAndStores();
    loadCustomers();
    loadInvoices();
    loadChannelOverview();
  }, [loadZonesAndStores, loadCustomers, loadInvoices, loadChannelOverview]);

  // Real-time search customers on input change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (customerSearch.trim().length >= 2) {
        loadCustomers(customerSearch.trim());
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch, loadCustomers]);

  // Filtered products for POS terminal
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchCat = selectedCategory === 'All' || product.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchQuery =
        !q ||
        product.name.toLowerCase().includes(q) ||
        (product.sku && product.sku.toLowerCase().includes(q)) ||
        (product.barcode && product.barcode.includes(q));
      return matchCat && matchQuery;
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart Calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  }, [cart]);

  const bagPrice = BAG_PRICES[packagingBag]?.price || 0;
  const subtotalWithBag = cartSubtotal + bagPrice;

  const tierDiscountPercent = activeCustomer?.tierDiscount || 0;
  const tierDiscountAmount = Math.round((cartSubtotal * tierDiscountPercent) / 100);

  const cashierDiscountAmount = useMemo(() => {
    if (cashierDiscountType === '5%') return Math.round(cartSubtotal * 0.05);
    if (cashierDiscountType === '10%') return Math.round(cartSubtotal * 0.1);
    if (cashierDiscountType === 'flat50') return Math.min(50, cartSubtotal);
    return 0;
  }, [cashierDiscountType, cartSubtotal]);

  const couponDiscountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === 'percent') {
      return Math.round((cartSubtotal * appliedCoupon.value) / 100);
    }
    if (appliedCoupon.type === 'flat') {
      return Math.min(appliedCoupon.value, cartSubtotal);
    }
    return 0;
  }, [appliedCoupon, cartSubtotal]);

  const totalPromoDiscounts = tierDiscountAmount + cashierDiscountAmount + couponDiscountAmount;
  const maxRedeemablePoints = Math.max(0, subtotalWithBag - totalPromoDiscounts);

  // Loyalty points redemption: 1 Point = ₹1.00
  const loyaltyDeduction =
    redeemPoints && activeCustomer
      ? Math.min(pointsToRedeem, activeCustomer.points || 0, maxRedeemablePoints)
      : 0;

  const totalAllDiscounts = totalPromoDiscounts + loyaltyDeduction;
  const taxableAmount = Math.max(0, subtotalWithBag - totalAllDiscounts);

  // GST 5% breakdown: CGST 2.5% + SGST 2.5%
  const cgstTax = Math.round(taxableAmount * 0.025);
  const sgstTax = Math.round(taxableAmount * 0.025);
  const gstTax = cgstTax + sgstTax;

  const rawGrandTotal = taxableAmount + gstTax;
  const grandTotal = Math.max(0, Math.round(rawGrandTotal));
  const roundOff = Number((grandTotal - rawGrandTotal).toFixed(2));

  // Points earned on current bill: 5% back as loyalty points
  const pointsEarned = Math.round(grandTotal * 0.05);

  // Update cash tendered default when grandTotal changes
  useEffect(() => {
    if (grandTotal > 0 && cashTendered < grandTotal) {
      setCashTendered(Math.ceil(grandTotal / 100) * 100 || grandTotal);
    }
  }, [grandTotal]);

  // Quick coupon apply
  const handleApplyCoupon = (e) => {
    e?.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    if (code === 'GREEN10' || code === 'SAVE10') {
      setAppliedCoupon({ code, type: 'percent', value: 10, label: '10% Off' });
      setCouponInput('');
    } else if (code === 'SAVE50' || code === 'FLAT50') {
      setAppliedCoupon({ code, type: 'flat', value: 50, label: '₹50 Off' });
      setCouponInput('');
    } else if (code === 'FARM20' || code === 'SUPER20') {
      setAppliedCoupon({ code, type: 'percent', value: 20, label: '20% Off' });
      setCouponInput('');
    } else {
      alert(`Invalid coupon code "${code}". Try GREEN10, SAVE50, or FARM20.`);
    }
  };

  // Park & Recall bills
  const handleParkBill = () => {
    if (cart.length === 0) {
      alert('Cart is empty. Nothing to park.');
      return;
    }
    const newParked = {
      id: Date.now(),
      cart: [...cart],
      customer: activeCustomer,
      packagingBag,
      cashierDiscountType,
      appliedCoupon,
      billRemarks,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      total: grandTotal,
      itemCount: cart.reduce((acc, it) => acc + it.qty, 0),
    };
    setParkedBills((prev) => [newParked, ...prev]);
    setCart([]);
    setActiveCustomer(null);
    setPackagingBag('none');
    setCashierDiscountType('none');
    setAppliedCoupon(null);
    setBillRemarks('');
    alert(`Bill parked successfully with ${newParked.itemCount} items (₹${grandTotal}).`);
  };

  const handleRecallBill = (parkedItem) => {
    setCart(parkedItem.cart);
    setActiveCustomer(parkedItem.customer || null);
    setPackagingBag(parkedItem.packagingBag || 'none');
    setCashierDiscountType(parkedItem.cashierDiscountType || 'none');
    setAppliedCoupon(parkedItem.appliedCoupon || null);
    setBillRemarks(parkedItem.billRemarks || '');
    setParkedBills((prev) => prev.filter((p) => p.id !== parkedItem.id));
    setShowParkedModal(false);
  };

  // Quick Barcode Add
  const handleBarcodeSubmit = (e) => {
    e?.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    const found = products.find(
      (p) =>
        p.barcode === code ||
        (p.sku && p.sku.toLowerCase() === code.toLowerCase()) ||
        p.id === code
    );

    if (found) {
      addToCart(found);
      setBarcodeInput('');
    } else {
      alert(`Product with barcode/SKU "${code}" not found in real catalog.`);
    }
  };

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [{ ...product, qty: 1 }, ...prev];
    });
  };

  const updateQty = (id, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.qty + delta;
            return newQty > 0 ? { ...item, qty: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const removeItem = (id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
  };

  // Customer selection
  const handleSelectCustomer = (cust) => {
    setActiveCustomer(cust);
    setCustomerSearch('');
    if (cust) {
      setPointsToRedeem(Math.min(100, cust.points || 0));
    }
  };

  // Handle Quick Add New Customer into DB
  const handleQuickAddCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomerForm.name.trim() || !newCustomerForm.phone.trim()) {
      alert('Name and phone are required.');
      return;
    }

    try {
      setAddingCustomer(true);
      const res = await billingApi.createCustomer(newCustomerForm);
      if (res.success && res.customer) {
        setActiveCustomer(res.customer);
        setCustomers((prev) => [res.customer, ...prev]);
        setShowAddCustomerModal(false);
        setNewCustomerForm({ name: '', phone: '', email: '' });
        alert(`Customer ${res.customer.name} registered with 50 welcome loyalty points!`);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create customer');
    } finally {
      setAddingCustomer(false);
    }
  };

  // Complete real checkout with backend database insertion
  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      alert('Cart is empty. Scan barcode or click items to add.');
      return;
    }

    const payload = {
      channel: selectedChannel,
      counterName: activeCounter,
      cashierName: 'Rahul Sharma (Admin)',
      storeId: selectedStoreId || null,
      storeName: activeStore?.storeName || '',
      zone: activeStore?.zoneName || '',
      area: activeStore?.area || '',
      vendorId: activeStore?.vendorId || activeVendor?.id || '',
      vendorName: activeVendor?.businessName || activeVendor?.vendorName || '',
      customer: activeCustomer
        ? {
            id: activeCustomer.id || activeCustomer._id,
            name: activeCustomer.name,
            phone: activeCustomer.phone,
            tier: activeCustomer.tier,
          }
        : null,
      items: cart.map((it) => ({
        id: it.id || it._id,
        productId: it.id || it._id,
        sku: it.sku,
        barcode: it.barcode,
        name: it.name,
        category: it.category,
        price: it.price,
        mrp: it.mrp,
        qty: it.qty,
        unit: it.unit,
        image: it.image,
      })),
      subtotal: subtotalWithBag,
      discount: totalAllDiscounts,
      pointsRedeemed: loyaltyDeduction,
      pointsEarned,
      gstTax,
      grandTotal,
      paymentMethod,
      cashTendered:
        paymentMethod === 'Cash'
          ? cashTendered
          : paymentMethod === 'Split'
          ? Number(splitCashAmount) || 0
          : grandTotal,
      changeReturned:
        paymentMethod === 'Cash' ? Math.max(0, cashTendered - grandTotal) : 0,
      notes: [
        billRemarks ? `Remarks: ${billRemarks}` : null,
        customerGstin ? `GSTIN: ${customerGstin}` : null,
        packagingBag !== 'none' ? `Bag: ${BAG_PRICES[packagingBag]?.label}` : null,
        appliedCoupon ? `Coupon: ${appliedCoupon.code} (${appliedCoupon.label})` : null,
        cashierDiscountType !== 'none' ? `Cashier Disc: ${cashierDiscountType}` : null,
        paymentMethod === 'Split'
          ? `Split: Cash ₹${splitCashAmount} + Online ₹${Math.max(0, grandTotal - (Number(splitCashAmount) || 0))}`
          : null,
        `Billed at ${activeCounter} via ${selectedChannel}`,
      ]
        .filter(Boolean)
        .join(' • '),
    };

    try {
      setSubmittingInvoice(true);
      const res = await billingApi.createInvoice(payload);

      if (res.success && res.invoice) {
        setCompletedInvoice(res.invoice);
        setShowReceiptModal(true);

        // Update local customer points state immediately
        if (activeCustomer && (loyaltyDeduction > 0 || pointsEarned > 0)) {
          setActiveCustomer((prev) => ({
            ...prev,
            points: Math.max(0, (prev.points || 0) - loyaltyDeduction + pointsEarned),
            visits: (prev.visits || 0) + 1,
            lifetimeSpend: (prev.lifetimeSpend || 0) + grandTotal,
          }));
        }

        // Reset Cart & options
        setCart([]);
        setRedeemPoints(false);
        setPackagingBag('none');
        setCashierDiscountType('none');
        setAppliedCoupon(null);
        setBillRemarks('');
        setCustomerGstin('');
        setSplitCashAmount(0);

        // Refresh live data from DB
        loadCatalog();
        loadInvoices();
        loadChannelOverview();
      }
    } catch (err) {
      console.error('Invoice creation failed:', err);
      alert(err.response?.data?.message || 'Failed to complete invoice in backend database');
    } finally {
      setSubmittingInvoice(false);
    }
  };

  // Keyboard Hotkey Listener for F8 (Complete Sale), F4 (Park Bill / Recall), Escape (Clear Cart / Close Modal), and Enter (Proceed to Billing)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const targetTag = e.target?.tagName?.toLowerCase();
      const isInput = targetTag === 'input' || targetTag === 'textarea';

      if (e.key === 'Enter' && !isStoreConfirmed && currentTab === 'terminal') {
        if (!isInput && activeStore) {
          e.preventDefault();
          handleConfirmStoreAndProceed();
        }
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length > 0 && !submittingInvoice) {
          handleCompleteSale();
        }
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) {
          handleParkBill();
        } else if (parkedBills.length > 0) {
          setShowParkedModal(true);
        }
      } else if (e.key === 'Escape') {
        if (showReceiptModal) {
          setShowReceiptModal(false);
        } else if (showParkedModal) {
          setShowParkedModal(false);
        } else if (!isInput && cart.length > 0) {
          clearCart();
        }
      } else if (e.key === 'Home') {
        scrollToRightTop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    cart,
    submittingInvoice,
    handleCompleteSale,
    showReceiptModal,
    showParkedModal,
    parkedBills.length,
    isStoreConfirmed,
    currentTab,
    activeStore,
    handleConfirmStoreAndProceed,
  ]);

  return (
    <div className="space-y-3 pb-0">
      {/* Top Header - Clean, Compact & Simple */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 leading-tight">
              Omnichannel Billing Terminal
            </h1>
          </div>
        </div>

        {/* Quick Channel & Cashier Chips */}
        <div className="flex items-center gap-2 text-xs">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
            <Store className="h-3.5 w-3.5 text-slate-500" />
            <span className="font-medium">
              {selectedChannel === 'physical_store'
                ? 'Physical Store'
                : selectedChannel === 'mall_counter'
                ? 'Mall Counter'
                : 'E-Commerce'}
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-medium">Rahul Sharma (#04)</span>
          </div>

          {parkedBills.length > 0 && (
            <button
              type="button"
              onClick={() => setShowParkedModal(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold transition cursor-pointer"
            >
              <Bookmark className="h-3 w-3" />
              <span>{parkedBills.length} Hold</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Navigation - Compact */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setTab('terminal')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
            currentTab === 'terminal'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          <span>Billing (POS)</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('omnichannel')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
            currentTab === 'omnichannel'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Store className="h-3.5 w-3.5" />
          <span>Selling Hub</span>
          <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800">
            Live
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab('loyalty')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
            currentTab === 'loyalty'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>Loyalty & CRM</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-medium text-slate-600">
            {customers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab('invoices')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
            currentTab === 'invoices'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Receipt className="h-3.5 w-3.5" />
          <span>Invoices</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-medium text-slate-600">
            {invoicesList.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SCREEN 1 - FULFILLMENT DARK STORE & VENDOR SCOPING GATEWAY */}
      {/* ========================================================================= */}
      {currentTab === 'terminal' && !isStoreConfirmed && (
        <div className="space-y-3 max-w-6xl">
          {/* Compact Scoping Header with Top Action */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                <Store className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Dark Store & Vendor Scoping</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    (Step 1: Zone ➔ Step 2: Store)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Billing catalog will strictly display products from that store and supplying vendor
                </p>
              </div>
            </div>

            {activeStore && (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block text-xs">
                  <div className="font-bold text-slate-900">
                    {activeStore.storeName} ({activeStore.area})
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Vendor: {activeVendor?.businessName || 'Direct'} • {products.length} in stock
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleConfirmStoreAndProceed()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  <span>Proceed to Billing ➔</span>
                  <span className="text-[10px] bg-emerald-800/80 px-1.5 py-0.5 rounded font-mono">[Enter]</span>
                </button>
              </div>
            )}
          </div>

          {/* Step 1: Select Zone (Compact horizontal pill bar) */}
          <div className="bg-white p-2.5 px-3 rounded-xl border border-slate-200 flex flex-wrap items-center gap-2.5 shadow-sm">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1 shrink-0">
              <MapPin className="h-3.5 w-3.5 text-emerald-600" />
              Step 1: Zone:
            </span>
            {loadingZones ? (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin text-emerald-600" /> Loading zones...
              </span>
            ) : zonesList.length === 0 ? (
              <span className="text-xs text-slate-400">No active zones in DB</span>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {zonesList.map((zone) => {
                  const isSelected = selectedZoneKey === zone.zoneKey;
                  return (
                    <button
                      key={zone.zoneKey}
                      type="button"
                      onClick={() => handleZoneChange(zone.zoneKey)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-emerald-700 text-white font-semibold shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      <span>📍 {zone.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          isSelected ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {zone.storeCount} store{zone.storeCount !== 1 ? 's' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 2: Select Dark Store (Clean, compact cards) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Store className="h-3.5 w-3.5 text-emerald-600" />
                Step 2: Select Store in {zonesList.find((z) => z.zoneKey === selectedZoneKey)?.name || 'Selected Zone'}:
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {storesList.filter((s) => s.zoneKey === selectedZoneKey).length} store(s) available
              </span>
            </div>

            {storesList.filter((s) => s.zoneKey === selectedZoneKey).length === 0 ? (
              <div className="py-6 bg-white rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
                No dark stores found in this zone.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {storesList
                  .filter((s) => s.zoneKey === selectedZoneKey)
                  .map((store) => {
                    const isSelected = selectedStoreId === store.id;
                    const vendor = store.vendor;

                    return (
                      <div
                        key={store.id}
                        onClick={() => handleStoreSelect(store)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'border-emerald-600 ring-2 ring-emerald-600/20 bg-emerald-50/20 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                                <Store className="h-3.5 w-3.5 text-emerald-600" />
                                {store.storeName}
                              </h4>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                📍 {store.area}, {store.city} {store.pincode ? `• ${store.pincode}` : ''}
                              </div>
                            </div>
                            {isSelected ? (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shrink-0">
                                <Check className="h-3 w-3 stroke-[3]" />
                              </span>
                            ) : (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-transparent shrink-0">
                                •
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              {store.inStockCount || 0} in-stock
                            </span>
                          </div>

                          {/* Vendor Info Box - Clean light gray */}
                          <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs space-y-0.5">
                            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                              Supplying Vendor
                            </div>
                            {vendor ? (
                              <>
                                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                                  <span>{vendor.businessName || vendor.vendorName}</span>
                                  {vendor.vendorCode && (
                                    <span className="font-mono text-[9px] bg-slate-200 px-1 py-0.2 rounded text-slate-700">
                                      {vendor.vendorCode}
                                    </span>
                                  )}
                                </div>
                                {vendor.ownerName && (
                                  <div className="text-[11px] text-slate-500">
                                    {vendor.ownerName} {vendor.mobileNumber ? `• ${vendor.mobileNumber}` : ''}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="text-slate-600 font-medium">Direct GreenGrocc Dark Store</div>
                            )}
                          </div>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConfirmStoreAndProceed(store);
                            }}
                            className={`w-full py-1.5 px-2.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            {isSelected ? 'Open Billing ➔' : 'Select Store'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Compact bottom confirmation strip */}
          {activeStore && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 px-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                <span className="text-slate-800">
                  Ready to bill from <strong>{activeStore.storeName}</strong> ({activeStore.area}) • Vendor: <strong>{activeVendor?.businessName || activeVendor?.vendorName || 'Direct'}</strong> • <strong>{products.length}</strong> items in catalog
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleConfirmStoreAndProceed()}
                className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold transition shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                <span>Proceed to Billing ➔</span>
                <span className="text-[10px] bg-emerald-800/80 px-1 py-0.2 rounded font-mono">[Enter]</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: SCREEN 2 - LIGHTNING-FAST BILLING (POS TERMINAL) */}
      {/* ========================================================================= */}
      {currentTab === 'terminal' && isStoreConfirmed && (
        <div className="space-y-3">
          {/* Active Fulfillment Scope Bar at the Top - Clean & Compact */}
          <div className="bg-white p-2 px-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs shadow-sm">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <Store className="h-3.5 w-3.5 text-emerald-600" />
                {activeStore?.storeName}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-medium">
                📍 {activeStore?.area}, {zonesList.find((z) => z.zoneKey === selectedZoneKey)?.name || 'Pune'}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-600">
                Vendor: <strong className="text-slate-800">{activeVendor?.businessName || activeVendor?.vendorName || 'Direct'}</strong>
                {activeVendor?.vendorCode && (
                  <span className="ml-1 font-mono text-[10px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded border border-slate-200">
                    {activeVendor.vendorCode}
                  </span>
                )}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-emerald-700 font-semibold">
                {products.length} Products Scoped
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => loadCatalog(selectedStoreId)}
                title="Sync real inventory from database"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
              >
                <RefreshCw className={`h-3 w-3 ${loadingCatalog ? 'animate-spin text-emerald-600' : ''}`} />
                <span>Sync</span>
              </button>

              <button
                type="button"
                onClick={handleSwitchStore}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-medium transition cursor-pointer"
              >
                <ArrowUpDown className="h-3 w-3" />
                <span>Switch Store</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            {/* Left / Middle Column: Fast Catalog & Quick Barcode Scanner (7 cols) */}
            <div className="xl:col-span-7 space-y-3.5 pr-2">
              {/* Channel & Counter Quick Switcher Bar */}
              <div className={`${PANEL} p-3 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Channel Mode:</span>
                  <div className="inline-flex rounded-xl bg-slate-200/70 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedChannel('physical_store');
                      setActiveCounter('Counter #1 - Flagship Store');
                    }}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      selectedChannel === 'physical_store'
                        ? 'bg-white text-emerald-800 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Store className="h-3.5 w-3.5" />
                    Physical Store
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedChannel('mall_counter');
                      setActiveCounter('Phoenix Mall Atrium Kiosk #2');
                    }}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      selectedChannel === 'mall_counter'
                        ? 'bg-white text-emerald-800 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    Mall Counter
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedChannel('ecommerce');
                      setActiveCounter('E-Commerce Fast Fulfillment');
                    }}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      selectedChannel === 'ecommerce'
                        ? 'bg-white text-emerald-800 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    E-Commerce Desk
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-600 font-medium">
                Register: <span className="font-bold text-slate-800">{activeCounter}</span>
              </div>
            </div>

            {/* Quick Barcode Scanner & Search Bar */}
            <div className={`${PANEL} p-3.5 space-y-2.5`}>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                {/* Barcode Scanner Input */}
                <form onSubmit={handleBarcodeSubmit} className="sm:col-span-6 relative">
                  <div className="relative">
                    <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      placeholder="Scan Barcode / SKU (Press Enter)..."
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      className={`${INPUT} pl-9 font-mono text-sm`}
                    />
                    <button
                      type="submit"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-emerald-700 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-800"
                    >
                      Scan [↵]
                    </button>
                  </div>
                </form>

                {/* Instant Name / Keyword Search */}
                <div className="sm:col-span-6 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search real products in DB..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`${INPUT} pl-9 text-sm`}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Real Category Pills from Database */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      selectedCategory === cat
                        ? 'bg-emerald-800 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Quick-Pick Grid from Real Database */}
            {loadingCatalog ? (
              <div className={`${PANEL} p-12 text-center text-slate-500`}>
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-700 mb-2" />
                <p className="text-sm font-semibold">Loading real catalog from database...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className={`${PANEL} p-12 text-center text-slate-400`}>
                <Package className="h-10 w-10 mx-auto text-slate-300 mb-2 stroke-[1.5]" />
                <p className="text-sm font-bold text-slate-700">No matching products found in this Dark Store</p>
                <p className="text-xs text-slate-400 mt-1">
                  Only products belonging to {activeStore?.storeName || 'this dark store'} and{' '}
                  {activeVendor?.businessName || 'its creator vendor'} are listed.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredProducts.map((prod) => {
                  const inCart = cart.find((it) => it.id === prod.id);
                  const currentChannelStock =
                    selectedChannel === 'physical_store'
                      ? prod.channelStock?.store || prod.stock
                      : selectedChannel === 'mall_counter'
                      ? prod.channelStock?.mall || Math.floor(prod.stock / 2)
                      : prod.channelStock?.ecom || Math.floor(prod.stock / 2);

                  return (
                    <div
                      key={prod.id}
                      onClick={() => addToCart(prod)}
                      className={`${PANEL} p-3 cursor-pointer select-none transition-all hover:border-emerald-500 hover:shadow-md flex flex-col justify-between group relative overflow-hidden`}
                    >
                      {/* In-cart indicator badge */}
                      {inCart && (
                        <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-700 text-[11px] font-bold text-white shadow-sm">
                          {inCart.qty}
                        </span>
                      )}

                      <div>
                        {prod.image && (
                          <div className="h-24 w-full mb-2 rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center">
                            <img
                              src={prod.image}
                              alt={prod.name}
                              className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-mono truncate max-w-[120px]">{prod.sku}</span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 font-medium truncate max-w-[80px]">
                            {prod.category}
                          </span>
                        </div>

                        <h3 className="font-bold text-slate-900 text-sm mt-1 line-clamp-1 group-hover:text-emerald-700 transition">
                          {prod.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">{prod.unit}</p>

                        <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-800 font-medium truncate">
                          <span className="truncate">🏬 {prod.storeName || activeStore?.storeName}</span>
                          {(prod.vendorName || activeVendor?.businessName) && (
                            <span className="truncate text-slate-500">• 👤 {prod.vendorName || activeVendor?.businessName}</span>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <div className="text-base font-extrabold text-slate-900">₹{prod.price}</div>
                          {prod.mrp > prod.price && (
                            <div className="text-[11px] text-slate-400 line-through">₹{prod.mrp}</div>
                          )}
                        </div>

                        <div className="text-right">
                          <div className="text-[10px] text-slate-400">Live Stock</div>
                          <div className="text-xs font-semibold text-emerald-700">
                            {currentChannelStock} left
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Embedded CRM + Cart + Missing Options + Totals + Tender (5 cols - INDEPENDENT SCROLLBAR) */}
          <div
            ref={rightPanelRef}
            className="xl:col-span-5 xl:sticky xl:top-2 xl:max-h-[calc(100dvh-88px)] xl:overflow-y-auto admin-scrollbar pl-1 pr-1.5 space-y-3.5 flex flex-col"
          >
            {/* 1. Embedded Loyalty and CRM Bar (Real Data from MongoDB User Collection) */}
            <div className={`${PANEL} p-3.5 border-2 border-emerald-500/30 bg-gradient-to-b from-emerald-50/50 to-white shrink-0`}>
              <div className="flex items-center justify-between pb-2 border-b border-emerald-100">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-700 text-white">
                    <Users className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                      Real Customer CRM & Loyalty
                    </h3>
                    <p className="text-[11px] text-emerald-700">Scan phone or select customer</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddCustomerModal(true)}
                    className="flex items-center gap-1 rounded-lg bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-200 transition"
                  >
                    <UserPlus className="h-3 w-3" />
                    <span>+ New</span>
                  </button>

                  {activeCustomer && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        activeCustomer.tier === 'Platinum'
                          ? 'bg-purple-100 text-purple-800 ring-1 ring-purple-200'
                          : activeCustomer.tier === 'Gold'
                          ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-200'
                          : activeCustomer.tier === 'Silver'
                          ? 'bg-sky-100 text-sky-800 ring-1 ring-sky-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      ★ {activeCustomer.tier}
                    </span>
                  )}
                </div>
              </div>

              {/* Customer Lookup Input with auto suggestions from MongoDB */}
              <div className="mt-2.5 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Enter customer mobile no. (e.g. 9876543210)..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className={`${INPUT} pl-9 text-xs`}
                />

                {/* Quick Customer Selection Dropdown */}
                {customerSearch && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border border-slate-200 bg-white shadow-xl max-h-48 overflow-y-auto">
                    {loadingCustomers ? (
                      <div className="p-3 text-center text-xs text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1 text-emerald-600" />
                        Searching customer database...
                      </div>
                    ) : customers.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400">
                        No customer found.{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setNewCustomerForm((prev) => ({ ...prev, phone: customerSearch }));
                            setShowAddCustomerModal(true);
                          }}
                          className="font-bold text-emerald-700 underline"
                        >
                          Add new customer?
                        </button>
                      </div>
                    ) : (
                      customers.map((cust) => (
                        <div
                          key={cust.id}
                          onClick={() => handleSelectCustomer(cust)}
                          className="p-2.5 hover:bg-emerald-50 cursor-pointer border-b border-slate-100 last:border-none flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-bold text-slate-900">{cust.name}</p>
                            <p className="text-slate-500 font-mono">{cust.phone}</p>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-emerald-700">{cust.points} Pts</span>
                            <p className="text-[10px] text-slate-400">{cust.tier} Tier</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Active Customer Profile Card */}
              {activeCustomer ? (
                <div className="mt-2.5 rounded-xl bg-white p-2.5 border border-emerald-200 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{activeCustomer.name}</p>
                      <p className="text-xs font-mono text-slate-500">{activeCustomer.phone}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-slate-500">Available Points</div>
                      <div className="text-base font-black text-emerald-700 flex items-center gap-1 justify-end">
                        <Coins className="h-4 w-4 text-amber-500" />
                        {activeCustomer.points || 0} Pts
                        <span className="text-xs font-normal text-slate-500">
                          (₹{activeCustomer.points || 0})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* CRM Insight & Customer Preference */}
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50/70 p-1.5 text-[11px] text-emerald-900">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                    <span className="line-clamp-1 italic">
                      Lifetime Spend: ₹{(activeCustomer.lifetimeSpend || 0).toLocaleString()} • Visits:{' '}
                      {activeCustomer.visits || 0}
                    </span>
                  </div>

                  {/* Loyalty Points Redemption Slider / Toggle */}
                  <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                      <input
                        type="checkbox"
                        checked={redeemPoints}
                        onChange={(e) => setRedeemPoints(e.target.checked)}
                        disabled={!activeCustomer.points || activeCustomer.points <= 0}
                        className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 disabled:opacity-40"
                      />
                      <span>Redeem {pointsToRedeem} Loyalty Points</span>
                    </label>
                    <span className="text-xs font-bold text-emerald-700">
                      -₹{loyaltyDeduction}.00 Off
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-center py-1 text-xs text-slate-400">
                  Walk-in Guest • Enter customer phone to unlock loyalty benefits.
                </div>
              )}
            </div>

            {/* 2. Lightning Cart Pane */}
            <div className={`${PANEL} p-3.5 space-y-2.5 flex flex-col shrink-0`}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <ShoppingCart className="h-4 w-4 text-emerald-700" />
                  <span>Current Bill</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 font-extrabold">
                    {cart.reduce((a, b) => a + b.qty, 0)} items
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleParkBill}
                    disabled={cart.length === 0}
                    className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 font-semibold disabled:opacity-40"
                    title="Park / Hold current bill to attend next customer"
                  >
                    <Bookmark className="h-3 w-3" />
                    <span>Park [F4]</span>
                  </button>

                  <button
                    type="button"
                    onClick={clearCart}
                    disabled={cart.length === 0}
                    className="text-xs text-rose-600 hover:text-rose-800 font-semibold disabled:opacity-40"
                  >
                    Clear [Esc]
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="max-h-52 overflow-y-auto admin-scrollbar divide-y divide-slate-100 pr-1">
                {cart.length === 0 ? (
                  <div className="py-6 text-center text-slate-400">
                    <ShoppingCart className="h-7 w-7 mx-auto text-slate-300 stroke-[1.5]" />
                    <p className="mt-1.5 text-xs font-medium">No items added yet.</p>
                    <p className="text-[11px] text-slate-400">Scan barcode or click items in catalog.</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.id} className="py-2 flex items-center justify-between gap-2.5 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-800 truncate">{item.name}</p>
                        <p className="text-slate-400 text-[11px]">
                          ₹{item.price} × {item.qty} {item.unit}
                        </p>
                      </div>

                      {/* Qty Stepper */}
                      <div className="flex items-center gap-1 shrink-0 bg-slate-100 rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, -1)}
                          className="h-5 w-5 flex items-center justify-center rounded bg-white text-slate-700 hover:bg-slate-200"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="font-bold text-slate-900 w-5 text-center">{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, 1)}
                          className="h-5 w-5 flex items-center justify-center rounded bg-white text-slate-700 hover:bg-slate-200"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      <div className="w-14 text-right font-extrabold text-slate-900">
                        ₹{item.price * item.qty}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 3. Missing Option: Carry Bag / Packaging Selection */}
            <div className={`${PANEL} p-3 space-y-2 shrink-0`}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <ShoppingBag className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Carry Bag / Packaging:</span>
                </span>
                {bagPrice > 0 && (
                  <span className="font-extrabold text-emerald-800">+₹{bagPrice}</span>
                )}
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {Object.entries(BAG_PRICES).map(([key, val]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPackagingBag(key)}
                    className={`py-1.5 px-1 rounded-xl border text-[11px] font-bold text-center transition flex flex-col items-center justify-center ${
                      packagingBag === key
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{val.icon} {val.label}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      {val.price > 0 ? `+₹${val.price}` : 'Free'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Missing Option: Cashier Discount & Promo Coupon */}
            <div className={`${PANEL} p-3 space-y-2 shrink-0`}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Percent className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Discounts & Promo Coupons:</span>
                </span>
                {(cashierDiscountAmount > 0 || couponDiscountAmount > 0) && (
                  <span className="font-extrabold text-emerald-700">
                    -₹{cashierDiscountAmount + couponDiscountAmount} Saved
                  </span>
                )}
              </div>

              {/* Quick Cashier Preset Buttons */}
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'none', label: 'No Disc' },
                  { id: '5%', label: '5% Off' },
                  { id: '10%', label: '10% Off' },
                  { id: 'flat50', label: 'Flat ₹50' },
                ].map((disc) => (
                  <button
                    key={disc.id}
                    type="button"
                    onClick={() => setCashierDiscountType(disc.id)}
                    className={`py-1 rounded-lg border text-xs font-semibold transition ${
                      cashierDiscountType === disc.id
                        ? 'border-emerald-600 bg-emerald-100 text-emerald-800 font-bold'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {disc.label}
                  </button>
                ))}
              </div>

              {/* Promo Coupon Form */}
              <form onSubmit={handleApplyCoupon} className="flex items-center gap-1.5 pt-0.5">
                <div className="relative flex-1">
                  <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Coupon code (e.g. GREEN10, SAVE50)..."
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    className={`${INPUT} pl-8 py-1 text-xs uppercase`}
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-xl bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 text-xs font-bold transition"
                >
                  Apply
                </button>
              </form>

              {appliedCoupon && (
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800 font-semibold">
                  <span>✓ Coupon "{appliedCoupon.code}" applied ({appliedCoupon.label})</span>
                  <button
                    type="button"
                    onClick={() => setAppliedCoupon(null)}
                    className="text-rose-600 hover:text-rose-800 font-bold ml-2"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* 5. Missing Option: Remarks & B2B GSTIN Toggles */}
            <div className={`${PANEL} p-3 space-y-2 shrink-0`}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRemarksInput(!showRemarksInput)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition flex items-center gap-1 ${
                    showRemarksInput || billRemarks
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <FileText className="h-3 w-3" />
                  <span>{billRemarks ? 'Note Added ✓' : '+ Bill Note'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowGstinInput(!showGstinInput)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition flex items-center gap-1 ${
                    showGstinInput || customerGstin
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <FileCheck className="h-3 w-3" />
                  <span>{customerGstin ? 'GSTIN Added ✓' : '+ B2B GSTIN'}</span>
                </button>
              </div>

              {showRemarksInput && (
                <input
                  type="text"
                  placeholder="Enter order remark, delivery note, or token #..."
                  value={billRemarks}
                  onChange={(e) => setBillRemarks(e.target.value)}
                  className={`${INPUT} text-xs py-1`}
                />
              )}

              {showGstinInput && (
                <input
                  type="text"
                  placeholder="Customer GSTIN (e.g. 27AABCS1429B1Z1)..."
                  value={customerGstin}
                  onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                  className={`${INPUT} text-xs py-1 font-mono uppercase`}
                />
              )}
            </div>

            {/* 6. Bill Summary Breakdown (Full Indian GST Compliance) */}
            <div className={`${PANEL} p-4 space-y-2 text-xs text-slate-600 shrink-0`}>
              <div className="flex justify-between">
                <span>Items Subtotal</span>
                <span className="font-semibold text-slate-900">₹{cartSubtotal}</span>
              </div>

              {bagPrice > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>Carry Bag ({BAG_PRICES[packagingBag]?.label})</span>
                  <span className="font-semibold">+₹{bagPrice}</span>
                </div>
              )}

              {tierDiscountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Loyalty Member Discount ({tierDiscountPercent}%)</span>
                  <span className="font-semibold">-₹{tierDiscountAmount}</span>
                </div>
              )}

              {cashierDiscountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Cashier Discount ({cashierDiscountType})</span>
                  <span className="font-semibold">-₹{cashierDiscountAmount}</span>
                </div>
              )}

              {couponDiscountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Promo Coupon ({appliedCoupon?.code})</span>
                  <span className="font-semibold">-₹{couponDiscountAmount}</span>
                </div>
              )}

              {loyaltyDeduction > 0 && (
                <div className="flex justify-between text-amber-700 font-medium">
                  <span>Reward Points Redeemed</span>
                  <span>-₹{loyaltyDeduction}</span>
                </div>
              )}

              <div className="pt-1 border-t border-slate-100 flex justify-between text-slate-500">
                <span>Taxable Amount</span>
                <span>₹{taxableAmount}</span>
              </div>

              <div className="flex justify-between text-slate-500">
                <span>CGST (2.5%) + SGST (2.5%)</span>
                <span className="font-semibold text-slate-800">+₹{gstTax}</span>
              </div>

              {roundOff !== 0 && (
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Round Off</span>
                  <span>{roundOff > 0 ? `+₹${roundOff}` : `-₹${Math.abs(roundOff)}`}</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-base">
                <span className="font-extrabold text-slate-900">Grand Total</span>
                <span className="font-black text-2xl text-emerald-800">₹{grandTotal}</span>
              </div>

              {/* Points Earned Preview */}
              <div className="flex items-center justify-between text-[11px] text-emerald-700 font-semibold bg-emerald-50/70 p-2 rounded-lg">
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Points Earned on this Bill:
                </span>
                <span>+{pointsEarned} Pts</span>
              </div>
            </div>

            {/* 7. Select Tender / Payment (Expanded: UPI, Cash, Card, Wallet, Split, Credit) */}
            <div className={`${PANEL} p-4 space-y-2.5 shrink-0`}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                <span>Select Tender / Payment</span>
                <span className="text-emerald-700 font-semibold">{paymentMethod} Selected</span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {[
                  { id: 'UPI', icon: QrCode, label: 'UPI' },
                  { id: 'Cash', icon: Wallet, label: 'Cash' },
                  { id: 'Card', icon: CreditCard, label: 'Card' },
                  { id: 'Wallet', icon: Coins, label: 'Wallet' },
                  { id: 'Split', icon: Split, label: 'Split' },
                  { id: 'Credit', icon: Clock, label: 'Credit' },
                ].map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-bold transition ${
                        paymentMethod === m.id
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm ring-1 ring-emerald-500'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="h-4 w-4 mb-0.5" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Cash Tender Details & Quick Denomination Presets */}
              {paymentMethod === 'Cash' && (
                <div className="p-3 bg-slate-50 rounded-xl space-y-2.5 text-xs border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Quick Cash Presets:
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCashTendered(grandTotal)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white font-bold text-xs hover:bg-emerald-800"
                    >
                      Exact (₹{grandTotal})
                    </button>
                    {[50, 100, 200, 500].map((inc) => (
                      <button
                        key={inc}
                        type="button"
                        onClick={() => setCashTendered((prev) => Math.max(0, (Number(prev) || 0) + inc))}
                        className="px-2 py-1 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-100 text-xs"
                      >
                        +{inc}
                      </button>
                    ))}
                    {[500, 1000, 2000].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setCashTendered(val)}
                        className="px-2 py-1 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 hover:bg-slate-100 text-xs"
                      >
                        ₹{val}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-600 font-bold">Cash Received:</span>
                    <div className="flex items-center gap-1 font-mono font-bold">
                      <span className="text-sm">₹</span>
                      <input
                        type="number"
                        value={cashTendered}
                        onChange={(e) => setCashTendered(Number(e.target.value))}
                        className="w-24 px-2 py-1 rounded-lg border border-slate-300 text-right font-extrabold text-sm focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between font-bold text-slate-900 bg-emerald-100/70 p-2 rounded-lg border border-emerald-200">
                    <span className="text-emerald-900">Change to Return:</span>
                    <span className="text-lg font-black text-emerald-800">
                      ₹{Math.max(0, cashTendered - grandTotal)}
                    </span>
                  </div>
                </div>
              )}

              {/* Split Tender Details */}
              {paymentMethod === 'Split' && (
                <div className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Split Tender (Cash + Digital)
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Cash Paid:</span>
                    <div className="flex items-center gap-1 font-mono font-bold">
                      <span>₹</span>
                      <input
                        type="number"
                        value={splitCashAmount}
                        onChange={(e) => setSplitCashAmount(Number(e.target.value))}
                        className="w-24 px-2 py-1 rounded-lg border border-slate-300 text-right font-extrabold text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 font-bold">
                    <span className="text-slate-700">Balance to Pay via UPI / Card:</span>
                    <span className="text-emerald-800 text-sm font-black">
                      ₹{Math.max(0, grandTotal - (Number(splitCashAmount) || 0))}
                    </span>
                  </div>
                </div>
              )}

              {/* Credit Tender Details */}
              {paymentMethod === 'Credit' && (
                <div className="p-3 bg-amber-50 rounded-xl text-xs border border-amber-200 text-amber-900">
                  <div className="font-bold flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-amber-700" />
                    Store Credit / Pay Later Ledger
                  </div>
                  <p className="mt-1 text-[11px] text-amber-800">
                    Total amount of <strong>₹{grandTotal}</strong> will be debited to{' '}
                    <strong>{activeCustomer?.name || 'Walk-in Guest'}</strong>'s customer ledger account.
                  </p>
                </div>
              )}

              {/* 8. COMPLETE SALE & PRINT INVOICE [F8] BUTTON */}
              <button
                type="button"
                onClick={handleCompleteSale}
                disabled={cart.length === 0 || submittingInvoice}
                className="w-full py-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm shadow-xl shadow-emerald-700/30 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer active:scale-[0.99] mt-2"
              >
                {submittingInvoice ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>RECORDING INVOICE IN DATABASE...</span>
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 text-amber-300" />
                    <span>COMPLETE SALE & PRINT INVOICE [F8]</span>
                  </>
                )}
              </button>

              {/* Quick Jump Back to Top */}
              <button
                type="button"
                onClick={scrollToRightTop}
                className="w-full py-1 text-center text-[11px] font-semibold text-slate-400 hover:text-emerald-700 flex items-center justify-center gap-1 transition cursor-pointer"
              >
                <span>↑ Scroll back to top of bill [Home]</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ========================================================================= */}
      {/* PARKED BILLS MODAL */}
      {/* ========================================================================= */}
      {showParkedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowParkedModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-600 text-white">
                <Bookmark className="h-4 w-4" />
              </span>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Parked / On-Hold Bills</h3>
                <p className="text-xs text-slate-500">Resume any paused bill to complete checkout.</p>
              </div>
            </div>

            {parkedBills.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <Bookmark className="h-8 w-8 mx-auto text-slate-300 stroke-[1.5]" />
                <p className="mt-2 text-xs font-semibold">No parked bills right now.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {parkedBills.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100/70 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{p.customer?.name || 'Walk-in Guest'}</span>
                        <span className="text-[10px] text-slate-400">({p.time})</span>
                      </div>
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        {p.itemCount} items • Bag: {BAG_PRICES[p.packagingBag]?.label || 'None'}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-extrabold text-emerald-800 text-sm">₹{p.total}</div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRecallBill(p)}
                        className="rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 text-xs font-bold transition shadow-sm"
                      >
                        Resume →
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteParkedBill(p.id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        title="Discard parked bill"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowParkedModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: OMNI-CHANNEL SELLING HUB */}
      {/* ========================================================================= */}
      {currentTab === 'omnichannel' && (
        <div className="space-y-6">
          {/* Omni-Channel Overview Cards with Real DB Aggregations */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. E-Commerce Channel */}
            <div className={`${PANEL} p-5 border-l-4 border-l-sky-500 space-y-3`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                    <Globe className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">E-Commerce Channel</h3>
                    <p className="text-xs text-slate-500">Website & Mobile App</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-bold">
                  ● Realtime Sync
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <div>
                  <div className="text-[11px] text-slate-400">Today Orders</div>
                  <div className="text-lg font-black text-slate-900">
                    {channelOverview?.channels?.ecommerce?.billsToday || 0}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Today GMV</div>
                  <div className="text-lg font-black text-slate-900">
                    ₹{(channelOverview?.channels?.ecommerce?.salesToday || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Automatic stock hold on cart checkout with click & collect BOPIS support.
              </p>
            </div>

            {/* 2. Physical Store Channel */}
            <div className={`${PANEL} p-5 border-l-4 border-l-emerald-600 space-y-3`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Store className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Physical Stores</h3>
                    <p className="text-xs text-slate-500">Flagship & Dark Stores</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-bold">
                  ● 2 Counters Open
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <div>
                  <div className="text-[11px] text-slate-400">Walk-in Bills</div>
                  <div className="text-lg font-black text-slate-900">
                    {channelOverview?.channels?.physicalStore?.billsToday || 0}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Counter Sales</div>
                  <div className="text-lg font-black text-slate-900">
                    ₹{(channelOverview?.channels?.physicalStore?.salesToday || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Lightning POS terminals equipped with barcode scanners and thermal printers.
              </p>
            </div>

            {/* 3. Mall Counters & Kiosks Channel */}
            <div className={`${PANEL} p-5 border-l-4 border-l-amber-500 space-y-3`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Mall Counters & Kiosks</h3>
                    <p className="text-xs text-slate-500">Phoenix & Atrium Counters</p>
                  </div>
                </div>
                <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-bold">
                  ● Active Footfall
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <div>
                  <div className="text-[11px] text-slate-400">Kiosk Bills</div>
                  <div className="text-lg font-black text-slate-900">
                    {channelOverview?.channels?.mallCounter?.billsToday || 0}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Counter Sales</div>
                  <div className="text-lg font-black text-slate-900">
                    ₹{(channelOverview?.channels?.mallCounter?.salesToday || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Lightweight tablet billing with instant UPI QR stand and digital WhatsApp bills.
              </p>
            </div>
          </div>

          {/* Unified Real Inventory Sync Matrix from MongoDB */}
          <div className={`${PANEL} p-6 space-y-4`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-emerald-700" />
                  Real Multi-Channel Inventory Allocation from MongoDB
                </h3>
                <p className="text-xs text-slate-500">
                  Every bill processed dynamically decrements real product stock in the database.
                </p>
              </div>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                <span>Real-Time Sync Engine:</span>
                <input
                  type="checkbox"
                  checked={channelsSyncEnabled}
                  onChange={(e) => setChannelsSyncEnabled(e.target.checked)}
                  className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    channelsSyncEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {channelsSyncEnabled ? 'ACTIVE (Zero Overselling)' : 'PAUSED'}
                </span>
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500">
                    <th className={TH}>Product</th>
                    <th className={TH}>SKU</th>
                    <th className={TH}>Central Stock (DB)</th>
                    <th className={TH}>🏬 Physical Store</th>
                    <th className={TH}>🛍️ Mall Counter</th>
                    <th className={TH}>🌐 E-Commerce</th>
                    <th className={TH}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.slice(0, 8).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className={`${TD} font-bold text-slate-900`}>
                        <div className="flex items-center gap-2">
                          {item.image && (
                            <img
                              src={item.image}
                              alt=""
                              className="h-6 w-6 rounded object-cover"
                              onError={(e) => (e.target.style.display = 'none')}
                            />
                          )}
                          <span>{item.name}</span>
                        </div>
                      </td>
                      <td className={`${TD} font-mono text-slate-500`}>{item.sku}</td>
                      <td className={`${TD} font-extrabold text-slate-900`}>
                        {item.stock} {item.unit}
                      </td>
                      <td className={`${TD} font-semibold text-emerald-700`}>
                        {item.channelStock?.store || Math.floor(item.stock * 0.5)}
                      </td>
                      <td className={`${TD} font-semibold text-amber-700`}>
                        {item.channelStock?.mall || Math.floor(item.stock * 0.25)}
                      </td>
                      <td className={`${TD} font-semibold text-sky-700`}>
                        {item.channelStock?.ecom || Math.floor(item.stock * 0.25)}
                      </td>
                      <td className={TD}>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <CheckCircle className="h-3 w-3" /> In Sync
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: LOYALTY & CRM IN BILLING FLOW */}
      {/* ========================================================================= */}
      {currentTab === 'loyalty' && (
        <div className="space-y-6">
          {/* CRM Program Metric Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className={`${PANEL} p-4 text-center`}>
              <div className="text-xs text-slate-500 font-medium">Real Registered Members</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{customers.length}</div>
              <div className="text-[11px] text-emerald-700 font-semibold mt-1">Live MongoDB Users</div>
            </div>
            <div className={`${PANEL} p-4 text-center`}>
              <div className="text-xs text-slate-500 font-medium">Total Loyalty Points Active</div>
              <div className="text-2xl font-black text-emerald-700 mt-1">
                {customers.reduce((acc, c) => acc + (c.points || 0), 0).toLocaleString()} Pts
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Across all user wallets</div>
            </div>
            <div className={`${PANEL} p-4 text-center`}>
              <div className="text-xs text-slate-500 font-medium">Total Member Lifetime GMV</div>
              <div className="text-2xl font-black text-amber-600 mt-1">
                ₹{customers.reduce((acc, c) => acc + (c.lifetimeSpend || 0), 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Real historical purchases</div>
            </div>
            <div className={`${PANEL} p-4 text-center`}>
              <div className="text-xs text-slate-500 font-medium">Avg Member Spend</div>
              <div className="text-2xl font-black text-slate-900 mt-1">
                ₹
                {customers.length
                  ? Math.round(
                      customers.reduce((acc, c) => acc + (c.lifetimeSpend || 0), 0) / customers.length
                    )
                  : 0}
              </div>
              <div className="text-[11px] text-emerald-700 font-semibold mt-1">Higher retention rate</div>
            </div>
          </div>

          {/* Membership Tiers & Auto Perks */}
          <div className={`${PANEL} p-6 space-y-4`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Award className="h-5 w-5 text-amber-500" />
                  Loyalty Tiers Embedded in POS Flow
                </h3>
                <p className="text-xs text-slate-500">
                  When cashier inputs customer phone, billing automatically applies their tier discount and prompts redemption.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border-2 border-slate-200 p-4 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-700 text-sm">🥈 Silver Tier</span>
                  <span className="text-xs font-bold text-slate-500">Spend &gt; ₹1,000</span>
                </div>
                <p className="text-xs text-slate-600">
                  • <strong>2% Instant Discount</strong> applied at billing
                  <br />• 1x Reward Point per ₹100 spent
                  <br />• SMS & WhatsApp receipt notification
                </p>
              </div>

              <div className="rounded-2xl border-2 border-amber-300 p-4 bg-amber-50/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-amber-800 text-sm">🥇 Gold Tier</span>
                  <span className="text-xs font-bold text-amber-700">Spend &gt; ₹5,000</span>
                </div>
                <p className="text-xs text-amber-900">
                  • <strong>5% Instant Discount</strong> on fresh vegetables & fruits
                  <br />• 2x Reward Points on weekend billing
                  <br />• Free reusable jute bag on every mall visit
                </p>
              </div>

              <div className="rounded-2xl border-2 border-purple-300 p-4 bg-purple-50/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-purple-900 text-sm">💎 Platinum VIP Tier</span>
                  <span className="text-xs font-bold text-purple-700">Spend &gt; ₹20,000</span>
                </div>
                <p className="text-xs text-purple-950">
                  • <strong>10% Flat Discount</strong> on artisanal dairy & oils
                  <br />• Priority express checkout at physical stores
                  <br />• Dedicated farm batch reservations
                </p>
              </div>
            </div>
          </div>

          {/* Real Customer CRM Profiles from MongoDB */}
          <div className={`${PANEL} p-6 space-y-4`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Real Customer CRM Profiles</h3>
                <p className="text-xs text-slate-500">
                  Search customer lifetime value, reward points balance, and shopping history directly from database.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddCustomerModal(true)}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-700 text-white px-3 py-2 text-xs font-bold hover:bg-emerald-800 transition"
              >
                <UserPlus className="h-4 w-4" />
                <span>+ Register New Customer</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500">
                    <th className={TH}>Customer Name</th>
                    <th className={TH}>Phone</th>
                    <th className={TH}>Tier</th>
                    <th className={TH}>Points Balance</th>
                    <th className={TH}>Lifetime Spend</th>
                    <th className={TH}>Visits</th>
                    <th className={TH}>Account Type</th>
                    <th className={TH}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.map((cust) => (
                    <tr key={cust.id} className="hover:bg-slate-50">
                      <td className={`${TD} font-bold text-slate-900`}>{cust.name}</td>
                      <td className={`${TD} font-mono text-slate-600`}>{cust.phone}</td>
                      <td className={TD}>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            cust.tier === 'Platinum'
                              ? 'bg-purple-100 text-purple-800'
                              : cust.tier === 'Gold'
                              ? 'bg-amber-100 text-amber-800'
                              : cust.tier === 'Silver'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {cust.tier}
                        </span>
                      </td>
                      <td className={`${TD} font-extrabold text-emerald-700`}>{cust.points} Pts</td>
                      <td className={`${TD} font-semibold text-slate-800`}>
                        ₹{(cust.lifetimeSpend || 0).toLocaleString()}
                      </td>
                      <td className={TD}>{cust.visits} visits</td>
                      <td className={`${TD} uppercase font-semibold text-slate-500 text-[10px]`}>
                        {cust.accountType}
                      </td>
                      <td className={TD}>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCustomer(cust);
                            setTab('terminal');
                          }}
                          className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100"
                        >
                          Bill Now →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: INVOICES & REGISTER LOGS */}
      {/* ========================================================================= */}
      {currentTab === 'invoices' && (
        <div className="space-y-4">
          <div className={`${PANEL} p-4 flex flex-wrap items-center justify-between gap-3`}>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Past Invoices & Register Transactions</h3>
              <p className="text-xs text-slate-500">
                Real billing logs stored in MongoDB with reprint & WhatsApp export.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => loadInvoices()}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Refresh</span>
              </button>

              <div className="text-xs text-slate-500">
                Total Billed Today:{' '}
                <span className="font-extrabold text-slate-900 text-sm">
                  ₹{invoicesList.reduce((acc, it) => acc + it.grandTotal, 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className={`${PANEL} overflow-hidden`}>
            {loadingInvoices ? (
              <div className="p-12 text-center text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-700 mb-2" />
                <p className="text-xs font-bold text-slate-600">Loading real invoices from database...</p>
              </div>
            ) : invoicesList.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Receipt className="h-10 w-10 mx-auto text-slate-300 mb-2 stroke-[1.5]" />
                <p className="text-sm font-bold text-slate-700">No invoices recorded yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Complete a checkout in the Lightning Billing POS terminal to generate real invoices!
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500">
                      <th className={TH}>Invoice No.</th>
                      <th className={TH}>Channel</th>
                      <th className={TH}>Counter / Register</th>
                      <th className={TH}>Customer</th>
                      <th className={TH}>Items</th>
                      <th className={TH}>Points Used</th>
                      <th className={TH}>Total</th>
                      <th className={TH}>Tender</th>
                      <th className={TH}>Time</th>
                      <th className={TH}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoicesList.map((inv) => (
                      <tr key={inv.id || inv._id} className="hover:bg-slate-50">
                        <td className={`${TD} font-mono font-bold text-emerald-800`}>
                          {inv.id || inv.invoiceNumber}
                        </td>
                        <td className={TD}>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              inv.channel === 'physical_store' || inv.channel === 'Physical Store'
                                ? 'bg-emerald-100 text-emerald-800'
                                : inv.channel === 'mall_counter' || inv.channel === 'Mall Counter'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {inv.channel}
                          </span>
                        </td>
                        <td className={`${TD} text-slate-600`}>{inv.counter || inv.counterName}</td>
                        <td className={TD}>
                          <div className="font-bold text-slate-900">{inv.customerName}</div>
                          <div className="font-mono text-[10px] text-slate-400">{inv.customerPhone}</div>
                        </td>
                        <td className={TD}>{inv.itemsCount}</td>
                        <td className={`${TD} text-amber-700 font-semibold`}>
                          {inv.pointsRedeemed > 0 ? `${inv.pointsRedeemed} Pts` : '-'}
                        </td>
                        <td className={`${TD} font-extrabold text-slate-900`}>₹{inv.grandTotal}</td>
                        <td className={TD}>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                            {inv.paymentMethod}
                          </span>
                        </td>
                        <td className={`${TD} text-slate-400`}>{inv.timestamp}</td>
                        <td className={TD}>
                          <button
                            type="button"
                            onClick={() => {
                              setCompletedInvoice(inv);
                              setShowReceiptModal(true);
                            }}
                            className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900"
                          >
                            <Printer className="h-3 w-3" /> Slip
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* QUICK ADD CUSTOMER MODAL */}
      {/* ========================================================================= */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-4">
            <button
              type="button"
              onClick={() => setShowAddCustomerModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-700 text-white">
                <UserPlus className="h-4 w-4" />
              </span>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Quick Register Customer</h3>
                <p className="text-xs text-slate-500">Adds user into database with 50 welcome points.</p>
              </div>
            </div>

            <form onSubmit={handleQuickAddCustomer} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                  className={`${INPUT} mt-1`}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Phone Number (10 digits) *</label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="e.g. 9876543210"
                  value={newCustomerForm.phone}
                  onChange={(e) =>
                    setNewCustomerForm({ ...newCustomerForm, phone: e.target.value.replace(/\D/g, '') })
                  }
                  className={`${INPUT} mt-1 font-mono`}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Email Address (Optional)</label>
                <input
                  type="email"
                  placeholder="e.g. ramesh@example.com"
                  value={newCustomerForm.email}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                  className={`${INPUT} mt-1`}
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingCustomer}
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {addingCustomer ? 'Registering...' : 'Save & Select Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* THERMAL RECEIPT / INVOICE MODAL */}
      {/* ========================================================================= */}
      {showReceiptModal && completedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowReceiptModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Thermal Print Slip Preview */}
            <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl font-mono text-xs space-y-3 text-slate-800">
              <div className="text-center space-y-1">
                <div className="font-extrabold text-base tracking-wider text-slate-900">
                  GREENGROCC FRESH MARKET
                </div>
                <div className="text-[11px] text-slate-500">Omni-Channel Retail Network</div>
                <div className="text-[10px] text-slate-400">
                  {completedInvoice.channel} • {completedInvoice.counter || completedInvoice.counterName}
                </div>
                {(completedInvoice.storeName || activeStore?.storeName) && (
                  <div className="text-[10px] text-emerald-800 font-bold">
                    Store: {completedInvoice.storeName || activeStore?.storeName} ({completedInvoice.area || activeStore?.area})
                  </div>
                )}
                {(completedInvoice.vendorName || activeVendor?.businessName) && (
                  <div className="text-[10px] text-slate-500">
                    Vendor: {completedInvoice.vendorName || activeVendor?.businessName} {activeVendor?.vendorCode ? `[${activeVendor.vendorCode}]` : ''}
                  </div>
                )}
                <div className="text-[10px] text-slate-400">GSTIN: 27AABCG1234F1Z5</div>
              </div>

              <div className="border-t border-b border-dashed border-slate-300 py-1.5 text-[11px] space-y-0.5">
                <div className="flex justify-between">
                  <span>Bill No:</span>
                  <span className="font-bold">{completedInvoice.id || completedInvoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date/Time:</span>
                  <span>
                    {completedInvoice.date} {completedInvoice.timestamp}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span>{completedInvoice.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Phone:</span>
                  <span>{completedInvoice.customerPhone || 'Walk-in'}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-1 text-[11px]">
                {completedInvoice.items?.map((it, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>
                      {it.qty} × {it.name}
                    </span>
                    <span className="font-bold">₹{it.price * it.qty}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{completedInvoice.subtotal}</span>
                </div>
                {completedInvoice.discount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Loyalty Member Discount:</span>
                    <span>-₹{completedInvoice.discount}</span>
                  </div>
                )}
                {completedInvoice.pointsRedeemed > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span>Points Redeemed:</span>
                    <span>-₹{completedInvoice.pointsRedeemed}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>GST (5%):</span>
                  <span>₹{completedInvoice.gstTax || 0}</span>
                </div>
                <div className="border-t border-slate-300 pt-1 flex justify-between font-extrabold text-sm text-slate-900">
                  <span>GRAND TOTAL:</span>
                  <span>₹{completedInvoice.grandTotal}</span>
                </div>
                <div className="flex justify-between text-slate-500 text-[10px]">
                  <span>Paid Via:</span>
                  <span>{completedInvoice.paymentMethod}</span>
                </div>
              </div>

              {/* Loyalty CRM Barcode & Points Earned */}
              <div className="border-t border-dashed border-slate-300 pt-2 text-center space-y-1">
                <div className="text-[11px] font-bold text-emerald-800">
                  🎉 Points Earned on this Bill: +{completedInvoice.pointsEarned || 0} Pts
                </div>
                <div className="text-[10px] text-slate-400">
                  Thank you for shopping organic with GreenGrocc!
                </div>
                <div className="pt-1 text-[9px] text-slate-400">Scan for e-bill copy</div>
                <QrCode className="h-10 w-10 mx-auto text-slate-600" />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow"
              >
                <Printer className="h-4 w-4" />
                <span>Print Thermal Slip</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  alert(
                    `Invoice ${completedInvoice.id || completedInvoice.invoiceNumber} sent to WhatsApp number ${
                      completedInvoice.customerPhone
                    }!`
                  );
                }}
                className="py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Share2 className="h-4 w-4 text-emerald-600" />
                <span>Send WhatsApp</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowReceiptModal(false)}
              className="w-full py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Close & Ready for Next Customer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

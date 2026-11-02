import { useCallback, useEffect, useState } from "react";
import {
  Boxes,
  Package,
  Calculator,
  CheckCircle2,
  DollarSign,
  Layers,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Scale,
  ShieldCheck,
  Tag,
  Trash2,
  Truck,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { vendorApi } from "../../api/vendorApi";
import { ShippingScopePicker, useShippingScopes } from "./shippingScopes";

const TABS = [
  { id: "quantity", label: "By Quantity", icon: Boxes, desc: "Tiered delivery fees based on order item count" },
  { id: "user", label: "By User", icon: Users, desc: "Customer tier rates (Retail, B2B, VIP, First-Time)" },
  { id: "pincode", label: "By Pin Code", icon: MapPin, desc: "Pincode zones & hyper-local delivery rates" },
  { id: "category", label: "By Category", icon: Tag, desc: "Category surcharges (Perishables, Cold chain, Bulky)" },
  { id: "weight", label: "By Weight", icon: Scale, desc: "Weight slabs in kg and extra weight pricing" },
  { id: "state", label: "By State", icon: Layers, desc: "State-specific rates and regional boundaries" },
  { id: 'packaging', label: 'Packaging Fee', icon: Package, desc: 'Base packaging, box tiers, and free packaging rules' },
];

export default function ShippingMethodsPage() {
  const [activeTab, setActiveTab] = useState("quantity");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const scope = useShippingScopes();
  const { config, setConfig, load: loadScopes } = scope;

  // Simulator state
  const [simQuantity, setSimQuantity] = useState(3);
  const [simUserType, setSimUserType] = useState("retail");
  const [simOrderAmount, setSimOrderAmount] = useState(350);
  const [simPincode, setSimPincode] = useState("411057");
  const [simWeight, setSimWeight] = useState(2.5);
  const [simState, setSimState] = useState("Maharashtra");
  const [simCategory, setSimCategory] = useState("Fresh Vegetables");
  const [simResult, setSimResult] = useState(null);
  const [simLoading, setSimLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await vendorApi.getShippingMethods();
      if (res.data?.data) loadScopes(res.data.data, res.data.scopes);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load shipping methods");
    } finally {
      setLoading(false);
    }
  }, [loadScopes]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Save
  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await vendorApi.saveShippingMethods(scope.payload());
      setSuccessMsg("Shipping methods saved successfully!");
      if (res.data?.data) loadScopes(res.data.data, res.data.scopes);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save shipping methods");
    } finally {
      setSaving(false);
    }
  };

  // Run Rate Simulator
  const runSimulator = useCallback(async () => {
    setSimLoading(true);
    try {
      const res = await vendorApi.calculateShipping({
        rules: config,
        quantity: Number(simQuantity) || 1,
        orderAmount: Number(simOrderAmount) || 0,
        userType: simUserType,
        pincode: simPincode,
        weightKg: Number(simWeight) || 1,
        state: simState,
        categories: simCategory ? [simCategory] : [],
      });
      setSimResult(res.data);
    } catch {
      // ignore
    } finally {
      setSimLoading(false);
    }
  }, [config, simQuantity, simOrderAmount, simUserType, simPincode, simWeight, simState, simCategory]);

  useEffect(() => {
    if (loading) return undefined;
    const timer = setTimeout(runSimulator, 300);
    return () => clearTimeout(timer);
  }, [runSimulator, loading]);

  // Helpers for editing sub-rules
  const updateRuleToggle = (ruleKey, enabled) => {
    setConfig((prev) => ({
      ...prev,
      [ruleKey]: { ...prev[ruleKey], enabled },
    }));
  };

  // 1. Quantity helpers
  const addQuantitySlab = () => {
    const slabs = config.quantityRules?.slabs || [];
    const last = slabs[slabs.length - 1];
    const minQty = last ? last.maxQty + 1 : 1;
    const maxQty = minQty + 4;
    const cost = last ? last.cost + 20 : 30;
    setConfig((prev) => ({
      ...prev,
      quantityRules: {
        ...prev.quantityRules,
        slabs: [...slabs, { minQty, maxQty, cost }],
      },
    }));
  };

  const removeQuantitySlab = (idx) => {
    setConfig((prev) => ({
      ...prev,
      quantityRules: {
        ...prev.quantityRules,
        slabs: prev.quantityRules.slabs.filter((_, i) => i !== idx),
      },
    }));
  };

  // 2. User type helpers
  const addUserType = () => {
    const userTypes = config.userRules?.userTypes || [];
    setConfig((prev) => ({
      ...prev,
      userRules: {
        ...prev.userRules,
        userTypes: [
          ...userTypes,
          { userType: `custom_${Date.now()}`, label: "Special Customer Group", cost: 35, freeAboveOrderAmount: 799 },
        ],
      },
    }));
  };

  const removeUserType = (idx) => {
    setConfig((prev) => ({
      ...prev,
      userRules: {
        ...prev.userRules,
        userTypes: prev.userRules.userTypes.filter((_, i) => i !== idx),
      },
    }));
  };

  // 3. Pincode helpers
  const addPincode = () => {
    const pincodes = config.pincodeRules?.pincodes || [];
    setConfig((prev) => ({
      ...prev,
      pincodeRules: {
        ...prev.pincodeRules,
        pincodes: [
          ...pincodes,
          { code: "411000", areaName: "New Delivery Zone", cost: 40, isServiceable: true },
        ],
      },
    }));
  };

  const removePincode = (idx) => {
    setConfig((prev) => ({
      ...prev,
      pincodeRules: {
        ...prev.pincodeRules,
        pincodes: prev.pincodeRules.pincodes.filter((_, i) => i !== idx),
      },
    }));
  };

  // 4. Category helpers
  const addCategory = () => {
    const categories = config.categoryRules?.categories || [];
    setConfig((prev) => ({
      ...prev,
      categoryRules: {
        ...prev.categoryRules,
        categories: [
          ...categories,
          { categoryName: "Special Item Category", extraCost: 20, isFreeShipping: false },
        ],
      },
    }));
  };

  const removeCategory = (idx) => {
    setConfig((prev) => ({
      ...prev,
      categoryRules: {
        ...prev.categoryRules,
        categories: prev.categoryRules.categories.filter((_, i) => i !== idx),
      },
    }));
  };

  // 5. Weight helpers
  const addWeightSlab = () => {
    const slabs = config.weightRules?.slabs || [];
    const last = slabs[slabs.length - 1];
    const minWeightKg = last ? last.maxWeightKg : 0;
    const maxWeightKg = minWeightKg + 5;
    const cost = last ? last.cost + 40 : 40;
    setConfig((prev) => ({
      ...prev,
      weightRules: {
        ...prev.weightRules,
        slabs: [...slabs, { minWeightKg, maxWeightKg, cost }],
      },
    }));
  };

  const removeWeightSlab = (idx) => {
    setConfig((prev) => ({
      ...prev,
      weightRules: {
        ...prev.weightRules,
        slabs: prev.weightRules.slabs.filter((_, i) => i !== idx),
      },
    }));
  };

  // 6. State helpers
  const addState = () => {
    const states = config.stateRules?.states || [];
    setConfig((prev) => ({
      ...prev,
      stateRules: {
        ...prev.stateRules,
        states: [
          ...states,
          { stateName: "New State", cost: 100, isServiceable: true },
        ],
      },
    }));
  };

  const removeState = (idx) => {
    setConfig((prev) => ({
      ...prev,
      stateRules: {
        ...prev.stateRules,
        states: prev.stateRules.states.filter((_, i) => i !== idx),
      },
    }));
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#217346] uppercase tracking-wide mb-1">
            <Truck className="h-4 w-4" />
            <span>Multi-Vendor Logistics & Fulfillment</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Shipping Methods</h1>
          <p className="mt-1 text-xs text-gray-500 max-w-2xl">
            Delivery charges customers pay when their order is served by your dark stores. Set default rules for all
            your zones, then customise any zone or dark store. Fees combine 6 methods: Quantity, Customer Type,
            Pin Code, Category, Weight, and State.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 rounded-md transition shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-1.5 bg-[#217346] px-5 py-2 text-xs font-bold text-white hover:bg-[#1a5c37] rounded-md transition shadow-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Save Changes
          </button>
        </div>
      </div>

      {successMsg ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="font-semibold">{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg("")} className="text-emerald-600 hover:text-emerald-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 flex items-center justify-between shadow-2xs">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} className="text-rose-600 hover:text-rose-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {!loading ? <ShippingScopePicker state={scope} /> : null}

      {/* 6 Tabs Grid Navigation */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          const ruleObj = config[`${tab.id}Rules`];
          const isEnabled = ruleObj?.enabled;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`p-3.5 rounded-xl border text-left transition relative flex flex-col justify-between ${
                isSelected
                  ? "border-[#217346] bg-emerald-50/50 shadow-xs ring-2 ring-[#217346]/20"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/60"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    isSelected ? "bg-[#217346] text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    isEnabled
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {isEnabled ? "Active" : "Off"}
                </span>
              </div>
              <div>
                <h3 className={`text-xs font-bold leading-tight ${isSelected ? "text-[#217346]" : "text-gray-900"}`}>
                  {tab.label}
                </h3>
                <p className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{tab.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Content Area: Active Method Settings + Live Rate Calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Method Config Card (Takes 2 cols) */}
        <div className="lg:col-span-2 border border-gray-200 bg-white rounded-xl shadow-xs overflow-hidden">
          {/* Method Header with Toggle */}
          <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900 capitalize">
                Shipping Cost {TABS.find((t) => t.id === activeTab)?.label}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {TABS.find((t) => t.id === activeTab)?.desc}
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs font-medium text-gray-700">Enable this method</span>
              <input
                type="checkbox"
                checked={Boolean(config[`${activeTab}Rules`]?.enabled)}
                onChange={(e) => updateRuleToggle(`${activeTab}Rules`, e.target.checked)}
                className="h-4 w-4 rounded text-[#217346] focus:ring-[#217346]"
              />
            </label>
          </div>

          <div className="p-5 space-y-5">
            {/* 1. QUANTITY RULES */}
            {activeTab === "quantity" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">Base Cost (₹)</label>
                    <input
                      type="number"
                      value={config.quantityRules.baseCost}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          quantityRules: { ...config.quantityRules, baseCost: Number(e.target.value) || 0 },
                        })
                      }
                      className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-xs outline-none focus:border-[#217346]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                      Free Above Quantity (0 = none)
                    </label>
                    <input
                      type="number"
                      value={config.quantityRules.freeAboveQuantity}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          quantityRules: { ...config.quantityRules, freeAboveQuantity: Number(e.target.value) || 0 },
                        })
                      }
                      className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-xs outline-none focus:border-[#217346]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">Per Extra Item Fee (₹)</label>
                    <input
                      type="number"
                      value={config.quantityRules.perExtraItemFee}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          quantityRules: { ...config.quantityRules, perExtraItemFee: Number(e.target.value) || 0 },
                        })
                      }
                      className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-xs outline-none focus:border-[#217346]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-800">Quantity Slabs</span>
                    <button
                      type="button"
                      onClick={addQuantitySlab}
                      className="text-xs font-semibold text-[#217346] hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Slab
                    </button>
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full text-xs text-left">
                      <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 border-b">
                        <tr>
                          <th className="px-3 py-2">Min Qty</th>
                          <th className="px-3 py-2">Max Qty</th>
                          <th className="px-3 py-2">Shipping Cost (₹)</th>
                          <th className="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {config.quantityRules.slabs.map((slab, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={slab.minQty}
                                onChange={(e) => {
                                  const slabs = [...config.quantityRules.slabs];
                                  slabs[i].minQty = Number(e.target.value) || 0;
                                  setConfig({ ...config, quantityRules: { ...config.quantityRules, slabs } });
                                }}
                                className="w-20 border rounded px-2 py-1 text-xs"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={slab.maxQty}
                                onChange={(e) => {
                                  const slabs = [...config.quantityRules.slabs];
                                  slabs[i].maxQty = Number(e.target.value) || 0;
                                  setConfig({ ...config, quantityRules: { ...config.quantityRules, slabs } });
                                }}
                                className="w-20 border rounded px-2 py-1 text-xs"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={slab.cost}
                                onChange={(e) => {
                                  const slabs = [...config.quantityRules.slabs];
                                  slabs[i].cost = Number(e.target.value) || 0;
                                  setConfig({ ...config, quantityRules: { ...config.quantityRules, slabs } });
                                }}
                                className="w-24 border rounded px-2 py-1 text-xs font-bold text-gray-800"
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeQuantitySlab(i)}
                                className="text-gray-400 hover:text-rose-600 p-1"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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

            {/* 2. USER RULES */}
            {activeTab === "user" && (
              <div className="space-y-4">
                <div className="w-48">
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">Default Fallback Cost (₹)</label>
                  <input
                    type="number"
                    value={config.userRules.defaultCost}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        userRules: { ...config.userRules, defaultCost: Number(e.target.value) || 0 },
                      })
                    }
                    className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-xs outline-none focus:border-[#217346]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-800">User Types & Loyalty Tiers</span>
                    <button
                      type="button"
                      onClick={addUserType}
                      className="text-xs font-semibold text-[#217346] hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add User Tier
                    </button>
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full text-xs text-left">
                      <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 border-b">
                        <tr>
                          <th className="px-3 py-2">Customer Group</th>
                          <th className="px-3 py-2">Shipping Cost (₹)</th>
                          <th className="px-3 py-2">Free Delivery Above (₹)</th>
                          <th className="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {config.userRules.userTypes.map((u, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={u.label}
                                onChange={(e) => {
                                  const userTypes = [...config.userRules.userTypes];
                                  userTypes[i].label = e.target.value;
                                  setConfig({ ...config, userRules: { ...config.userRules, userTypes } });
                                }}
                                className="w-48 border rounded px-2 py-1 text-xs font-medium"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={u.cost}
                                onChange={(e) => {
                                  const userTypes = [...config.userRules.userTypes];
                                  userTypes[i].cost = Number(e.target.value) || 0;
                                  setConfig({ ...config, userRules: { ...config.userRules, userTypes } });
                                }}
                                className="w-24 border rounded px-2 py-1 text-xs font-bold text-gray-800"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={u.freeAboveOrderAmount}
                                onChange={(e) => {
                                  const userTypes = [...config.userRules.userTypes];
                                  userTypes[i].freeAboveOrderAmount = Number(e.target.value) || 0;
                                  setConfig({ ...config, userRules: { ...config.userRules, userTypes } });
                                }}
                                className="w-28 border rounded px-2 py-1 text-xs"
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeUserType(i)}
                                className="text-gray-400 hover:text-rose-600 p-1"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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

            {/* 3. PINCODE RULES */}
            {activeTab === "pincode" && (
              <div className="space-y-4">
                <div className="w-48">
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">Standard Other Pincodes Cost (₹)</label>
                  <input
                    type="number"
                    value={config.pincodeRules.defaultCost}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        pincodeRules: { ...config.pincodeRules, defaultCost: Number(e.target.value) || 0 },
                      })
                    }
                    className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-xs outline-none focus:border-[#217346]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-800">Pin Code Delivery Zones</span>
                    <button
                      type="button"
                      onClick={addPincode}
                      className="text-xs font-semibold text-[#217346] hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Pincode
                    </button>
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full text-xs text-left">
                      <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 border-b">
                        <tr>
                          <th className="px-3 py-2">Pin Code</th>
                          <th className="px-3 py-2">Area / Locality</th>
                          <th className="px-3 py-2">Delivery Cost (₹)</th>
                          <th className="px-3 py-2">Serviceable</th>
                          <th className="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {config.pincodeRules.pincodes.map((pin, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                maxLength={6}
                                value={pin.code}
                                onChange={(e) => {
                                  const pincodes = [...config.pincodeRules.pincodes];
                                  pincodes[i].code = e.target.value.replace(/\D/g, "");
                                  setConfig({ ...config, pincodeRules: { ...config.pincodeRules, pincodes } });
                                }}
                                className="w-24 border rounded px-2 py-1 text-xs font-mono"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={pin.areaName}
                                onChange={(e) => {
                                  const pincodes = [...config.pincodeRules.pincodes];
                                  pincodes[i].areaName = e.target.value;
                                  setConfig({ ...config, pincodeRules: { ...config.pincodeRules, pincodes } });
                                }}
                                className="w-44 border rounded px-2 py-1 text-xs"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={pin.cost}
                                onChange={(e) => {
                                  const pincodes = [...config.pincodeRules.pincodes];
                                  pincodes[i].cost = Number(e.target.value) || 0;
                                  setConfig({ ...config, pincodeRules: { ...config.pincodeRules, pincodes } });
                                }}
                                className="w-24 border rounded px-2 py-1 text-xs font-bold text-gray-800"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={pin.isServiceable !== false}
                                onChange={(e) => {
                                  const pincodes = [...config.pincodeRules.pincodes];
                                  pincodes[i].isServiceable = e.target.checked;
                                  setConfig({ ...config, pincodeRules: { ...config.pincodeRules, pincodes } });
                                }}
                                className="h-4 w-4 rounded text-[#217346]"
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removePincode(i)}
                                className="text-gray-400 hover:text-rose-600 p-1"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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

            {/* 4. CATEGORY RULES */}
            {activeTab === "category" && (
              <div className="space-y-4">
                <div className="w-48">
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">Standard Category Base (₹)</label>
                  <input
                    type="number"
                    value={config.categoryRules.defaultCost}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        categoryRules: { ...config.categoryRules, defaultCost: Number(e.target.value) || 0 },
                      })
                    }
                    className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-xs outline-none focus:border-[#217346]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-800">Category Surcharges & Handling</span>
                    <button
                      type="button"
                      onClick={addCategory}
                      className="text-xs font-semibold text-[#217346] hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Category Surcharge
                    </button>
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full text-xs text-left">
                      <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 border-b">
                        <tr>
                          <th className="px-3 py-2">Category Name</th>
                          <th className="px-3 py-2">Extra Shipping / Packaging (₹)</th>
                          <th className="px-3 py-2">Free Shipping Category</th>
                          <th className="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {config.categoryRules.categories.map((cat, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={cat.categoryName}
                                onChange={(e) => {
                                  const categories = [...config.categoryRules.categories];
                                  categories[i].categoryName = e.target.value;
                                  setConfig({ ...config, categoryRules: { ...config.categoryRules, categories } });
                                }}
                                className="w-52 border rounded px-2 py-1 text-xs font-medium"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={cat.extraCost}
                                onChange={(e) => {
                                  const categories = [...config.categoryRules.categories];
                                  categories[i].extraCost = Number(e.target.value) || 0;
                                  setConfig({ ...config, categoryRules: { ...config.categoryRules, categories } });
                                }}
                                className="w-24 border rounded px-2 py-1 text-xs font-bold text-gray-800"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={Boolean(cat.isFreeShipping)}
                                onChange={(e) => {
                                  const categories = [...config.categoryRules.categories];
                                  categories[i].isFreeShipping = e.target.checked;
                                  setConfig({ ...config, categoryRules: { ...config.categoryRules, categories } });
                                }}
                                className="h-4 w-4 rounded text-[#217346]"
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeCategory(i)}
                                className="text-gray-400 hover:text-rose-600 p-1"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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

            {/* 5. WEIGHT RULES */}
            {activeTab === "weight" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">Base Weight (kg)</label>
                    <input
                      type="number"
                      value={config.weightRules.baseWeightKg}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weightRules: { ...config.weightRules, baseWeightKg: Number(e.target.value) || 1 },
                        })
                      }
                      className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-xs outline-none focus:border-[#217346]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">Base Cost (₹)</label>
                    <input
                      type="number"
                      value={config.weightRules.baseCost}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weightRules: { ...config.weightRules, baseCost: Number(e.target.value) || 0 },
                        })
                      }
                      className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-xs outline-none focus:border-[#217346]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">Cost Per Extra kg (₹)</label>
                    <input
                      type="number"
                      value={config.weightRules.costPerExtraKg}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weightRules: { ...config.weightRules, costPerExtraKg: Number(e.target.value) || 0 },
                        })
                      }
                      className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-xs outline-none focus:border-[#217346]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-800">Weight Slabs</span>
                    <button
                      type="button"
                      onClick={addWeightSlab}
                      className="text-xs font-semibold text-[#217346] hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Weight Slab
                    </button>
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full text-xs text-left">
                      <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 border-b">
                        <tr>
                          <th className="px-3 py-2">Min Weight (kg)</th>
                          <th className="px-3 py-2">Max Weight (kg)</th>
                          <th className="px-3 py-2">Delivery Cost (₹)</th>
                          <th className="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {config.weightRules.slabs.map((slab, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                step="0.5"
                                value={slab.minWeightKg}
                                onChange={(e) => {
                                  const slabs = [...config.weightRules.slabs];
                                  slabs[i].minWeightKg = Number(e.target.value) || 0;
                                  setConfig({ ...config, weightRules: { ...config.weightRules, slabs } });
                                }}
                                className="w-20 border rounded px-2 py-1 text-xs"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                step="0.5"
                                value={slab.maxWeightKg}
                                onChange={(e) => {
                                  const slabs = [...config.weightRules.slabs];
                                  slabs[i].maxWeightKg = Number(e.target.value) || 0;
                                  setConfig({ ...config, weightRules: { ...config.weightRules, slabs } });
                                }}
                                className="w-20 border rounded px-2 py-1 text-xs"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={slab.cost}
                                onChange={(e) => {
                                  const slabs = [...config.weightRules.slabs];
                                  slabs[i].cost = Number(e.target.value) || 0;
                                  setConfig({ ...config, weightRules: { ...config.weightRules, slabs } });
                                }}
                                className="w-24 border rounded px-2 py-1 text-xs font-bold text-gray-800"
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeWeightSlab(i)}
                                className="text-gray-400 hover:text-rose-600 p-1"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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

            {/* 6. STATE RULES */}
            {activeTab === "state" && (
              <div className="space-y-4">
                <div className="w-48">
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">Standard Other States Cost (₹)</label>
                  <input
                    type="number"
                    value={config.stateRules.defaultCost}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        stateRules: { ...config.stateRules, defaultCost: Number(e.target.value) || 0 },
                      })
                    }
                    className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-xs outline-none focus:border-[#217346]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-800">State Shipping Rates</span>
                    <button
                      type="button"
                      onClick={addState}
                      className="text-xs font-semibold text-[#217346] hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add State
                    </button>
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full text-xs text-left">
                      <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 border-b">
                        <tr>
                          <th className="px-3 py-2">State Name</th>
                          <th className="px-3 py-2">Delivery Cost (₹)</th>
                          <th className="px-3 py-2">Serviceable</th>
                          <th className="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {config.stateRules.states.map((st, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={st.stateName}
                                onChange={(e) => {
                                  const states = [...config.stateRules.states];
                                  states[i].stateName = e.target.value;
                                  setConfig({ ...config, stateRules: { ...config.stateRules, states } });
                                }}
                                className="w-48 border rounded px-2 py-1 text-xs font-medium"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={st.cost}
                                onChange={(e) => {
                                  const states = [...config.stateRules.states];
                                  states[i].cost = Number(e.target.value) || 0;
                                  setConfig({ ...config, stateRules: { ...config.stateRules, states } });
                                }}
                                className="w-24 border rounded px-2 py-1 text-xs font-bold text-gray-800"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={st.isServiceable !== false}
                                onChange={(e) => {
                                  const states = [...config.stateRules.states];
                                  states[i].isServiceable = e.target.checked;
                                  setConfig({ ...config, stateRules: { ...config.stateRules, states } });
                                }}
                                className="h-4 w-4 rounded text-[#217346]"
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeState(i)}
                                className="text-gray-400 hover:text-rose-600 p-1"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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
          </div>
        </div>

        {/* Live Simulator & Rate Estimator (Takes 1 col) */}
        <div className="border border-gray-200 bg-white rounded-xl shadow-xs overflow-hidden flex flex-col justify-between">
          <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-[#217346]" />
              <h2 className="text-sm font-bold text-gray-900">Live Rate Simulator</h2>
            </div>
            <span className="text-[10px] uppercase font-bold text-gray-400">Testing Tool</span>
          </div>

          <div className="p-5 space-y-3.5 text-xs flex-1">
            <p className="text-[11px] text-gray-500">
              Test how your 6 shipping rules calculate final delivery fees for different customer orders in real-time.
            </p>

            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">Item Quantity</label>
              <input
                type="number"
                min={1}
                value={simQuantity}
                onChange={(e) => setSimQuantity(e.target.value)}
                className="w-full border border-gray-200 rounded px-2.5 py-1 text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">Customer Type</label>
              <select
                value={simUserType}
                onChange={(e) => setSimUserType(e.target.value)}
                className="w-full border border-gray-200 rounded px-2.5 py-1 text-xs"
              >
                <option value="retail">Retail Customer</option>
                <option value="b2b">B2B / Wholesale Buyer</option>
                <option value="vip">VIP / Prime Member</option>
                <option value="first_order">First-Time Buyer</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">Order Amount (₹)</label>
              <input
                type="number"
                value={simOrderAmount}
                onChange={(e) => setSimOrderAmount(e.target.value)}
                className="w-full border border-gray-200 rounded px-2.5 py-1 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Pincode</label>
                <input
                  type="text"
                  maxLength={6}
                  value={simPincode}
                  onChange={(e) => setSimPincode(e.target.value)}
                  className="w-full border border-gray-200 rounded px-2.5 py-1 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Weight (kg)</label>
                <input
                  type="number"
                  step="0.5"
                  value={simWeight}
                  onChange={(e) => setSimWeight(e.target.value)}
                  className="w-full border border-gray-200 rounded px-2.5 py-1 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Destination State</label>
                <input
                  type="text"
                  value={simState}
                  onChange={(e) => setSimState(e.target.value)}
                  className="w-full border border-gray-200 rounded px-2.5 py-1 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Product Category</label>
                <select
                  value={simCategory}
                  onChange={(e) => setSimCategory(e.target.value)}
                  className="w-full border border-gray-200 rounded px-2.5 py-1 text-xs"
                >
                  <option value="Fresh Vegetables">Fresh Vegetables</option>
                  <option value="Fresh Fruits">Fresh Fruits</option>
                  <option value="Dairy & Cold Chain">Dairy & Cold Chain</option>
                  <option value="Heavy Grains & Pulses">Heavy Grains & Pulses</option>
                  <option value="General Grocery">General Grocery</option>
                </select>
              </div>
            </div>
          </div>

          {/* Result Box */}
          <div className="border-t border-gray-100 bg-gray-50/70 p-4">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-xs font-semibold text-gray-600">Calculated Shipping:</span>
              <span className="text-2xl font-black text-[#217346]">
                ₹{simResult?.shippingCost ?? 0}
              </span>
            </div>
            {simResult?.breakdown ? (
              <div className="space-y-1 text-[10px] text-gray-500 border-t border-gray-200/60 pt-2">
                {Object.entries(simResult.breakdown).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="capitalize">{k}:</span>
                    <span className="font-semibold text-gray-700">
                      ₹{v.cost} <span className="text-gray-400 font-normal">({v.reason})</span>
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import {
  Boxes,
  Package,
  Building2,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Globe,
  Layers,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Scale,
  Tag,
  Trash2,
  Truck,
  Users,
  X,
} from 'lucide-react';
import opsApi from '../../api/opsApi';
import apiClient from '../../api/client';
import { BTN, BTN_PRIMARY, INPUT, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL } from '../../utils/ui';
import { ShippingScopePicker, useShippingScopes } from './shippingScopes';

const TABS = [
  { id: 'quantity', label: 'By Quantity', icon: Boxes, desc: 'Tiered delivery fees based on order item count' },
  { id: 'user', label: 'By User', icon: Users, desc: 'Customer tier rates (Retail, B2B, VIP, First-Time)' },
  { id: 'pincode', label: 'By Pin Code', icon: MapPin, desc: 'Pincode zones & hyper-local delivery rates' },
  { id: 'category', label: 'By Category', icon: Tag, desc: 'Category surcharges (Perishables, Cold chain, Bulky)' },
  { id: 'weight', label: 'By Weight', icon: Scale, desc: 'Weight slabs in kg and extra weight pricing' },
  { id: 'state', label: 'By State', icon: Layers, desc: 'State-specific rates and regional boundaries' },
  { id: 'packaging', label: 'Packaging Fee', icon: Package, desc: 'Base packaging, box tiers, and free packaging rules' },
];

export default function ShippingMethodsPage() {
  const [activeTab, setActiveTab] = useState('quantity');
  const [selectedVendorId, setSelectedVendorId] = useState(
    () => new URLSearchParams(window.location.search).get('vendorId') || ''
  );
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const scope = useShippingScopes();
  const { config, setConfig, load: loadScopes } = scope;

  // Simulator state
  const [simQuantity, setSimQuantity] = useState(3);
  const [simUserType, setSimUserType] = useState('retail');
  const [simOrderAmount, setSimOrderAmount] = useState(350);
  const [simPincode, setSimPincode] = useState('411057');
  const [simWeight, setSimWeight] = useState(2.5);
  const [simState, setSimState] = useState('Maharashtra');
  const [simCategory, setSimCategory] = useState('Fresh Vegetables');
  const [simResult, setSimResult] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get('/admin-ops/shipping-methods', {
        params: selectedVendorId ? { vendorId: selectedVendorId } : {},
      });
      if (Array.isArray(res.data?.vendors)) setVendors(res.data.vendors);
      if (res.data?.data) loadScopes(res.data.data, res.data.scopes);
      if (res.data?.vendorId && res.data.vendorId !== selectedVendorId) setSelectedVendorId(res.data.vendorId);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load shipping methods');
    } finally {
      setLoading(false);
    }
  }, [selectedVendorId, loadScopes]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Save
  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await apiClient.put(
        '/admin-ops/shipping-methods',
        { ...scope.payload(), vendorId: selectedVendorId },
        { params: { vendorId: selectedVendorId } }
      );
      if (res.data?.data) loadScopes(res.data.data, res.data.scopes);
      setSuccessMsg('Shipping methods updated successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save shipping methods');
    } finally {
      setSaving(false);
    }
  };

  // Run Rate Simulator
  const runSimulator = useCallback(async () => {
    try {
      const res = await apiClient.post('/vendor/shipping-methods/calculate', {
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
    }
  }, [config, simQuantity, simOrderAmount, simUserType, simPincode, simWeight, simState, simCategory]);

  useEffect(() => {
    if (loading) return undefined;
    const timer = setTimeout(runSimulator, 300);
    return () => clearTimeout(timer);
  }, [runSimulator, loading]);

  const updateRuleToggle = (ruleKey, enabled) => {
    setConfig((prev) => ({
      ...prev,
      [ruleKey]: { ...prev[ruleKey], enabled },
    }));
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className={PAGE_KICKER}>Multi-Vendor Operations</p>
          <h1 className={PAGE_TITLE}>Shipping Methods</h1>
          <p className={PAGE_SUB}>
            Each vendor's delivery charges for their zones and dark stores. Vendors manage these from their panel;
            changes here update the same rules.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Vendor Selector */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
            <Building2 className="h-4 w-4 text-slate-400" />
            <select
              value={selectedVendorId}
              onChange={(e) => setSelectedVendorId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 outline-none cursor-pointer"
            >
              {!vendors.length ? <option value="">No vendors</option> : null}
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.location || v.id.slice(-6)})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className={`${BTN} text-xs gap-1.5`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || !selectedVendorId}
            className={`${BTN_PRIMARY} text-xs gap-1.5`}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Save Settings
          </button>
        </div>
      </div>

      {successMsg ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="text-rose-600 hover:text-rose-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {!loading && selectedVendorId ? <ShippingScopePicker state={scope} /> : null}

      {/* 6 Tabs Grid Navigation */}
      <div className="grid grid-cols-2 md:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3">
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
              className={`p-3.5 rounded-2xl border text-left transition relative flex flex-col justify-between ${
                isSelected
                  ? 'border-emerald-600 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-500/20'
                  : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                    isSelected ? 'bg-emerald-700 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {isEnabled ? 'Active' : 'Off'}
                </span>
              </div>
              <div>
                <h3 className={`text-xs font-bold leading-tight ${isSelected ? 'text-emerald-800' : 'text-slate-900'}`}>
                  {tab.label}
                </h3>
                <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{tab.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`lg:col-span-2 ${PANEL} overflow-hidden`}>
          <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 capitalize">
                Shipping Cost {TABS.find((t) => t.id === activeTab)?.label}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {TABS.find((t) => t.id === activeTab)?.desc}
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs font-medium text-slate-700">Enable method</span>
              <input
                type="checkbox"
                checked={Boolean(config[`${activeTab}Rules`]?.enabled)}
                onChange={(e) => updateRuleToggle(`${activeTab}Rules`, e.target.checked)}
                className="h-4 w-4 rounded text-emerald-700 focus:ring-emerald-600"
              />
            </label>
          </div>

          <div className="p-5 space-y-5">
            {/* 1. QUANTITY RULES */}
            {activeTab === 'quantity' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Base Cost (₹)</label>
                    <input
                      type="number"
                      value={config.quantityRules?.baseCost ?? 30}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          quantityRules: { ...config.quantityRules, baseCost: Number(e.target.value) || 0 },
                        })
                      }
                      className={INPUT}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Free Above Quantity
                    </label>
                    <input
                      type="number"
                      value={config.quantityRules?.freeAboveQuantity ?? 15}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          quantityRules: { ...config.quantityRules, freeAboveQuantity: Number(e.target.value) || 0 },
                        })
                      }
                      className={INPUT}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Per Extra Item Fee (₹)</label>
                    <input
                      type="number"
                      value={config.quantityRules?.perExtraItemFee ?? 5}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          quantityRules: { ...config.quantityRules, perExtraItemFee: Number(e.target.value) || 0 },
                        })
                      }
                      className={INPUT}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800">Quantity Slabs</span>
                    <button
                      type="button"
                      onClick={() => {
                        const slabs = config.quantityRules?.slabs || [];
                        const last = slabs[slabs.length - 1];
                        const minQty = last ? last.maxQty + 1 : 1;
                        setConfig({
                          ...config,
                          quantityRules: {
                            ...config.quantityRules,
                            slabs: [...slabs, { minQty, maxQty: minQty + 4, cost: last ? last.cost + 20 : 30 }],
                          },
                        });
                      }}
                      className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Slab
                    </button>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="min-w-full text-xs text-left">
                      <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b">
                        <tr>
                          <th className="px-3 py-2">Min Qty</th>
                          <th className="px-3 py-2">Max Qty</th>
                          <th className="px-3 py-2">Shipping Cost (₹)</th>
                          <th className="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {config.quantityRules?.slabs?.map((slab, i) => (
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
                                className="w-24 border rounded px-2 py-1 text-xs font-bold text-slate-800"
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setConfig({
                                    ...config,
                                    quantityRules: {
                                      ...config.quantityRules,
                                      slabs: config.quantityRules.slabs.filter((_, idx) => idx !== i),
                                    },
                                  });
                                }}
                                className="text-slate-400 hover:text-rose-600 p-1"
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
            {activeTab === 'user' && (
              <div className="space-y-4">
                <div className="w-48">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Default Fallback Cost (₹)</label>
                  <input
                    type="number"
                    value={config.userRules?.defaultCost ?? 40}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        userRules: { ...config.userRules, defaultCost: Number(e.target.value) || 0 },
                      })
                    }
                    className={INPUT}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800">User Types & Loyalty Tiers</span>
                    <button
                      type="button"
                      onClick={() => {
                        const userTypes = config.userRules?.userTypes || [];
                        setConfig({
                          ...config,
                          userRules: {
                            ...config.userRules,
                            userTypes: [
                              ...userTypes,
                              { userType: `custom_${Date.now()}`, label: 'Special Group', cost: 35, freeAboveOrderAmount: 799 },
                            ],
                          },
                        });
                      }}
                      className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Tier
                    </button>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="min-w-full text-xs text-left">
                      <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b">
                        <tr>
                          <th className="px-3 py-2">Customer Group</th>
                          <th className="px-3 py-2">Shipping Cost (₹)</th>
                          <th className="px-3 py-2">Free Delivery Above (₹)</th>
                          <th className="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {config.userRules?.userTypes?.map((u, i) => (
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
                                className="w-24 border rounded px-2 py-1 text-xs font-bold text-slate-800"
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
                                onClick={() => {
                                  setConfig({
                                    ...config,
                                    userRules: {
                                      ...config.userRules,
                                      userTypes: config.userRules.userTypes.filter((_, idx) => idx !== i),
                                    },
                                  });
                                }}
                                className="text-slate-400 hover:text-rose-600 p-1"
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
            {activeTab === 'pincode' && (
              <div className="space-y-4">
                <div className="w-48">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Standard Other Pincodes Cost (₹)</label>
                  <input
                    type="number"
                    value={config.pincodeRules?.defaultCost ?? 50}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        pincodeRules: { ...config.pincodeRules, defaultCost: Number(e.target.value) || 0 },
                      })
                    }
                    className={INPUT}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800">Pin Code Delivery Zones</span>
                    <button
                      type="button"
                      onClick={() => {
                        const pincodes = config.pincodeRules?.pincodes || [];
                        setConfig({
                          ...config,
                          pincodeRules: {
                            ...config.pincodeRules,
                            pincodes: [...pincodes, { code: '411000', areaName: 'Zone', cost: 40, isServiceable: true }],
                          },
                        });
                      }}
                      className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Pincode
                    </button>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="min-w-full text-xs text-left">
                      <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b">
                        <tr>
                          <th className="px-3 py-2">Pin Code</th>
                          <th className="px-3 py-2">Area / Locality</th>
                          <th className="px-3 py-2">Delivery Cost (₹)</th>
                          <th className="px-3 py-2">Serviceable</th>
                          <th className="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {config.pincodeRules?.pincodes?.map((pin, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                maxLength={6}
                                value={pin.code}
                                onChange={(e) => {
                                  const pincodes = [...config.pincodeRules.pincodes];
                                  pincodes[i].code = e.target.value.replace(/\D/g, '');
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
                                className="w-24 border rounded px-2 py-1 text-xs font-bold text-slate-800"
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
                                className="h-4 w-4 rounded text-emerald-700"
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setConfig({
                                    ...config,
                                    pincodeRules: {
                                      ...config.pincodeRules,
                                      pincodes: config.pincodeRules.pincodes.filter((_, idx) => idx !== i),
                                    },
                                  });
                                }}
                                className="text-slate-400 hover:text-rose-600 p-1"
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
            {activeTab === 'category' && (
              <div className="space-y-4">
                <div className="w-48">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Category Standard Base (₹)</label>
                  <input
                    type="number"
                    value={config.categoryRules?.defaultCost ?? 30}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        categoryRules: { ...config.categoryRules, defaultCost: Number(e.target.value) || 0 },
                      })
                    }
                    className={INPUT}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800">Category Surcharges & Handling</span>
                    <button
                      type="button"
                      onClick={() => {
                        const categories = config.categoryRules?.categories || [];
                        setConfig({
                          ...config,
                          categoryRules: {
                            ...config.categoryRules,
                            categories: [...categories, { categoryName: 'Special Item', extraCost: 20, isFreeShipping: false }],
                          },
                        });
                      }}
                      className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Surcharge
                    </button>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="min-w-full text-xs text-left">
                      <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b">
                        <tr>
                          <th className="px-3 py-2">Category Name</th>
                          <th className="px-3 py-2">Extra Shipping (₹)</th>
                          <th className="px-3 py-2">Free Delivery Category</th>
                          <th className="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {config.categoryRules?.categories?.map((cat, i) => (
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
                                className="w-24 border rounded px-2 py-1 text-xs font-bold text-slate-800"
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
                                className="h-4 w-4 rounded text-emerald-700"
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setConfig({
                                    ...config,
                                    categoryRules: {
                                      ...config.categoryRules,
                                      categories: config.categoryRules.categories.filter((_, idx) => idx !== i),
                                    },
                                  });
                                }}
                                className="text-slate-400 hover:text-rose-600 p-1"
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
            {activeTab === 'weight' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Base Weight (kg)</label>
                    <input
                      type="number"
                      value={config.weightRules?.baseWeightKg ?? 1}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weightRules: { ...config.weightRules, baseWeightKg: Number(e.target.value) || 1 },
                        })
                      }
                      className={INPUT}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Base Cost (₹)</label>
                    <input
                      type="number"
                      value={config.weightRules?.baseCost ?? 30}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weightRules: { ...config.weightRules, baseCost: Number(e.target.value) || 0 },
                        })
                      }
                      className={INPUT}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cost Per Extra kg (₹)</label>
                    <input
                      type="number"
                      value={config.weightRules?.costPerExtraKg ?? 15}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weightRules: { ...config.weightRules, costPerExtraKg: Number(e.target.value) || 0 },
                        })
                      }
                      className={INPUT}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800">Weight Slabs</span>
                    <button
                      type="button"
                      onClick={() => {
                        const slabs = config.weightRules?.slabs || [];
                        const last = slabs[slabs.length - 1];
                        const minWeightKg = last ? last.maxWeightKg : 0;
                        setConfig({
                          ...config,
                          weightRules: {
                            ...config.weightRules,
                            slabs: [...slabs, { minWeightKg, maxWeightKg: minWeightKg + 5, cost: last ? last.cost + 40 : 40 }],
                          },
                        });
                      }}
                      className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Slab
                    </button>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="min-w-full text-xs text-left">
                      <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b">
                        <tr>
                          <th className="px-3 py-2">Min Weight (kg)</th>
                          <th className="px-3 py-2">Max Weight (kg)</th>
                          <th className="px-3 py-2">Delivery Cost (₹)</th>
                          <th className="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {config.weightRules?.slabs?.map((slab, i) => (
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
                                className="w-24 border rounded px-2 py-1 text-xs font-bold text-slate-800"
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setConfig({
                                    ...config,
                                    weightRules: {
                                      ...config.weightRules,
                                      slabs: config.weightRules.slabs.filter((_, idx) => idx !== i),
                                    },
                                  });
                                }}
                                className="text-slate-400 hover:text-rose-600 p-1"
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
            {activeTab === 'state' && (
              <div className="space-y-4">
                <div className="w-48">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Standard Other States Cost (₹)</label>
                  <input
                    type="number"
                    value={config.stateRules?.defaultCost ?? 90}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        stateRules: { ...config.stateRules, defaultCost: Number(e.target.value) || 0 },
                      })
                    }
                    className={INPUT}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800">State Shipping Rates</span>
                    <button
                      type="button"
                      onClick={() => {
                        const states = config.stateRules?.states || [];
                        setConfig({
                          ...config,
                          stateRules: {
                            ...config.stateRules,
                            states: [...states, { stateName: 'New State', cost: 100, isServiceable: true }],
                          },
                        });
                      }}
                      className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add State
                    </button>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="min-w-full text-xs text-left">
                      <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b">
                        <tr>
                          <th className="px-3 py-2">State Name</th>
                          <th className="px-3 py-2">Delivery Cost (₹)</th>
                          <th className="px-3 py-2">Serviceable</th>
                          <th className="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {config.stateRules?.states?.map((st, i) => (
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
                                className="w-24 border rounded px-2 py-1 text-xs font-bold text-slate-800"
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
                                className="h-4 w-4 rounded text-emerald-700"
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setConfig({
                                    ...config,
                                    stateRules: {
                                      ...config.stateRules,
                                      states: config.stateRules.states.filter((_, idx) => idx !== i),
                                    },
                                  });
                                }}
                                className="text-slate-400 hover:text-rose-600 p-1"
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

            {/* 7. PACKAGING RULES */}
            {activeTab === 'packaging' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Base Packaging Cost (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={config.packagingRules?.baseCost ?? 15}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          packagingRules: { ...config.packagingRules, baseCost: Number(e.target.value) || 0 },
                        })
                      }
                      className={INPUT}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Default packaging fee for regular orders</p>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Free Packaging Above (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={config.packagingRules?.freeAboveOrderAmount ?? 499}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          packagingRules: { ...config.packagingRules, freeAboveOrderAmount: Number(e.target.value) || 0 },
                        })
                      }
                      className={INPUT}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Free packaging when order reaches this amount (0 to disable)</p>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Per Extra Item Fee (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={config.packagingRules?.perExtraItemFee ?? 2}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          packagingRules: { ...config.packagingRules, perExtraItemFee: Number(e.target.value) || 0 },
                        })
                      }
                      className={INPUT}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Fee per item exceeding highest packaging slab</p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800">Packaging Slabs by Item Quantity</span>
                    <button
                      type="button"
                      onClick={() => {
                        const slabs = config.packagingRules?.slabs || [];
                        const last = slabs[slabs.length - 1];
                        const minQty = last ? last.maxQty + 1 : 1;
                        setConfig({
                          ...config,
                          packagingRules: {
                            ...config.packagingRules,
                            slabs: [...slabs, { minQty, maxQty: minQty + 4, cost: last ? last.cost + 10 : 15 }],
                          },
                        });
                      }}
                      className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Slab
                    </button>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="min-w-full text-xs text-left">
                      <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b">
                        <tr>
                          <th className="px-3 py-2">Min Items</th>
                          <th className="px-3 py-2">Max Items</th>
                          <th className="px-3 py-2">Packaging Fee (₹)</th>
                          <th className="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {config.packagingRules?.slabs?.map((slab, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="1"
                                value={slab.minQty}
                                onChange={(e) => {
                                  const slabs = [...(config.packagingRules?.slabs || [])];
                                  slabs[i].minQty = Number(e.target.value) || 1;
                                  setConfig({ ...config, packagingRules: { ...config.packagingRules, slabs } });
                                }}
                                className="w-20 border rounded px-2 py-1 text-xs"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="1"
                                value={slab.maxQty}
                                onChange={(e) => {
                                  const slabs = [...(config.packagingRules?.slabs || [])];
                                  slabs[i].maxQty = Number(e.target.value) || 1;
                                  setConfig({ ...config, packagingRules: { ...config.packagingRules, slabs } });
                                }}
                                className="w-20 border rounded px-2 py-1 text-xs"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                value={slab.cost}
                                onChange={(e) => {
                                  const slabs = [...(config.packagingRules?.slabs || [])];
                                  slabs[i].cost = Number(e.target.value) || 0;
                                  setConfig({ ...config, packagingRules: { ...config.packagingRules, slabs } });
                                }}
                                className="w-24 border rounded px-2 py-1 text-xs font-bold text-slate-800"
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setConfig({
                                    ...config,
                                    packagingRules: {
                                      ...config.packagingRules,
                                      slabs: config.packagingRules.slabs.filter((_, idx) => idx !== i),
                                    },
                                  });
                                }}
                                className="text-slate-400 hover:text-rose-600 p-1"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {(!config.packagingRules?.slabs || config.packagingRules.slabs.length === 0) && (
                          <tr>
                            <td colSpan={4} className="px-3 py-4 text-center text-slate-400 text-xs">
                              No item quantity slabs configured. All orders will use the Base Packaging Cost.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-3.5 text-xs text-amber-900">
                  <span className="font-bold">💡 How Packaging Fee applies:</span>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-amber-800 text-[11px]">
                    <li>If order amount reaches or exceeds <b>₹{config.packagingRules?.freeAboveOrderAmount ?? 499}</b>, packaging fee is <b>₹0 (FREE)</b>.</li>
                    <li>If item count falls within a slab, that slab's fee applies. Otherwise, base fee applies.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live Simulator Card */}
        <div className={`${PANEL} overflow-hidden flex flex-col justify-between`}>
          <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-emerald-700" />
              <h2 className="text-sm font-bold text-slate-900">Live Rate Simulator</h2>
            </div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Testing Tool</span>
          </div>

          <div className="p-5 space-y-3.5 text-xs flex-1">
            <p className="text-[11px] text-slate-500">
              Calculate live delivery fees for different cart combinations under the selected vendor.
            </p>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Item Quantity</label>
              <input
                type="number"
                min={1}
                value={simQuantity}
                onChange={(e) => setSimQuantity(e.target.value)}
                className={INPUT}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Customer Group</label>
              <select
                value={simUserType}
                onChange={(e) => setSimUserType(e.target.value)}
                className={INPUT}
              >
                <option value="retail">Retail Customer</option>
                <option value="b2b">B2B / Wholesale Buyer</option>
                <option value="vip">VIP / Prime Member</option>
                <option value="first_order">First-Time Buyer</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Order Amount (₹)</label>
              <input
                type="number"
                value={simOrderAmount}
                onChange={(e) => setSimOrderAmount(e.target.value)}
                className={INPUT}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Pincode</label>
                <input
                  type="text"
                  maxLength={6}
                  value={simPincode}
                  onChange={(e) => setSimPincode(e.target.value)}
                  className={`${INPUT} font-mono`}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Weight (kg)</label>
                <input
                  type="number"
                  step="0.5"
                  value={simWeight}
                  onChange={(e) => setSimWeight(e.target.value)}
                  className={INPUT}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Destination State</label>
                <input
                  type="text"
                  value={simState}
                  onChange={(e) => setSimState(e.target.value)}
                  className={INPUT}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={simCategory}
                  onChange={(e) => setSimCategory(e.target.value)}
                  className={INPUT}
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

          <div className="border-t border-slate-100 bg-slate-50/70 p-4">
            <div className="space-y-1.5 mb-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-600">Shipping Fee:</span>
                <span className="text-sm font-bold text-slate-800">
                  ₹{simResult?.shippingCost ?? 0}
                </span>
              </div>
              {simResult?.packagingCost !== undefined && (
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-slate-600">Packaging Fee:</span>
                  <span className="text-sm font-bold text-slate-800">
                    ₹{simResult?.packagingCost ?? 0}
                  </span>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-slate-200/60 pt-1.5">
                <span className="text-xs font-bold text-slate-700">Total Delivery &amp; Packaging:</span>
                <span className="text-2xl font-black text-emerald-700">
                  ₹{(simResult?.totalCharges ?? ((simResult?.shippingCost ?? 0) + (simResult?.packagingCost ?? 0)))}
                </span>
              </div>
            </div>
            {simResult?.breakdown ? (
              <div className="space-y-1 text-[10px] text-slate-500 border-t border-slate-200/60 pt-2">
                {Object.entries(simResult.breakdown).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="capitalize">{k}:</span>
                    <span className="font-semibold text-slate-700">
                      ₹{v.cost} <span className="text-slate-400 font-normal">({v.reason})</span>
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

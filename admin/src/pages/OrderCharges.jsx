import React, { useEffect, useState } from 'react';
import { IndianRupee, Plus, Trash2, Check, X, Loader2, Package } from 'lucide-react';
import { PAGE_TITLE, PAGE_SUB, PANEL, BTN_PRIMARY } from '../utils/ui';
import apiClient, { API_ORIGIN as API_BASE } from '../api/client';

const INPUT =
  'w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('greengrocc_admin_token')}`,
});

const toAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
};

const fmt = (value) => `₹${toAmount(value).toLocaleString('en-IN')}`;

export default function OrderCharges() {
  const [minimumOrderValue, setMinimumOrderValue] = useState('');
  const [minimumShippingCharge, setMinimumShippingCharge] = useState('');
  const [packagingFee, setPackagingFee] = useState('');
  const [freePackagingAbove, setFreePackagingAbove] = useState('');
  const [slabs, setSlabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: body } = await apiClient.get('/settings/admin');
        const settings = body.data || body;
        if (cancelled) return;
        setMinimumOrderValue(String(settings.minimumOrderValue ?? 0));
        setMinimumShippingCharge(String(settings.minimumShippingCharge ?? 0));
        setPackagingFee(String(settings.packagingFee ?? 0));
        setFreePackagingAbove(String(settings.freePackagingAbove ?? 0));
        setSlabs(
          (settings.shippingSlabs || []).map((slab) => ({
            orderAmount: String(slab.orderAmount),
            shippingCharge: String(slab.shippingCharge),
          }))
        );
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('Failed to load settings. Make sure backend is running.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSlab = (index, field, value) => {
    setSlabs((prev) => prev.map((slab, i) => (i === index ? { ...slab, [field]: value } : slab)));
  };

  const addSlab = () => setSlabs((prev) => [...prev, { orderAmount: '', shippingCharge: '' }]);

  const removeSlab = (index) => setSlabs((prev) => prev.filter((_, i) => i !== index));

  const handleSave = async () => {
    const cleanedSlabs = slabs
      .filter((slab) => slab.orderAmount !== '' && slab.shippingCharge !== '')
      .map((slab) => ({
        orderAmount: toAmount(slab.orderAmount),
        shippingCharge: toAmount(slab.shippingCharge),
      }))
      .sort((a, b) => a.orderAmount - b.orderAmount);

    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          minimumOrderValue: toAmount(minimumOrderValue),
          minimumShippingCharge: toAmount(minimumShippingCharge),
          packagingFee: toAmount(packagingFee),
          freePackagingAbove: toAmount(freePackagingAbove),
          shippingSlabs: cleanedSlabs,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Failed to save settings');
      setSlabs(
        cleanedSlabs.map((slab) => ({
          orderAmount: String(slab.orderAmount),
          shippingCharge: String(slab.shippingCharge),
        }))
      );
      setSavedAt(new Date());
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-emerald-600" />
      </div>
    );
  }

  const sortedPreview = slabs
    .filter((slab) => slab.orderAmount !== '' && slab.shippingCharge !== '')
    .map((slab) => ({ orderAmount: toAmount(slab.orderAmount), shippingCharge: toAmount(slab.shippingCharge) }))
    .sort((a, b) => a.orderAmount - b.orderAmount);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className={`${PAGE_TITLE} flex items-center gap-2`}>
            <IndianRupee className="w-6 h-6 text-emerald-600" />
            Order, Shipping &amp; Packaging Charges
          </h1>
          <p className={PAGE_SUB}>
            Used by checkout on the website and app. Set 0 to turn a charge off.
          </p>
        </div>
        <button onClick={handleSave} disabled={saving} className={`${BTN_PRIMARY} flex items-center gap-2`}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-start gap-2">
          <X className="w-5 h-5 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {savedAt && !error && (
        <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg text-sm">
          Saved at {savedAt.toLocaleTimeString()}.
        </div>
      )}

      {/* 1. Minimum Order & Base Shipping Charges */}
      <div className={`${PANEL} p-6`}>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Order &amp; Shipping Charges</h2>
        <p className="text-sm text-gray-500 mb-4">Core thresholds for minimum order value and baseline delivery fees.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Minimum order value (₹)</label>
            <input
              type="number"
              min="0"
              value={minimumOrderValue}
              onChange={(e) => setMinimumOrderValue(e.target.value)}
              className={INPUT}
            />
            <p className="mt-1 text-xs text-gray-500">Customers can’t place orders below this subtotal.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base delivery charge (₹)</label>
            <input
              type="number"
              min="0"
              value={minimumShippingCharge}
              onChange={(e) => setMinimumShippingCharge(e.target.value)}
              className={INPUT}
            />
            <p className="mt-1 text-xs text-gray-500">Charged until the subtotal reaches the first slab below.</p>
          </div>
        </div>
      </div>

      {/* 2. NEW PACKAGING CHARGES SECTION */}
      <div className={`${PANEL} p-6`}>
        <div className="flex items-center gap-2 mb-1">
          <Package className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base font-semibold text-gray-900">Packaging Charges</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Packaging &amp; handling charges applied per order during checkout.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Packaging Fee (₹)</label>
            <input
              type="number"
              min="0"
              value={packagingFee}
              onChange={(e) => setPackagingFee(e.target.value)}
              className={INPUT}
            />
            <p className="mt-1 text-xs text-gray-500">Standard packaging &amp; handling charge added to orders (0 for free).</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Free Packaging Above (₹)</label>
            <input
              type="number"
              min="0"
              value={freePackagingAbove}
              onChange={(e) => setFreePackagingAbove(e.target.value)}
              className={INPUT}
            />
            <p className="mt-1 text-xs text-gray-500">Orders with subtotal at or above this amount get free packaging (0 to disable).</p>
          </div>
        </div>
        {toAmount(packagingFee) > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-50/60 border border-emerald-100 text-xs text-emerald-800">
            💡 Customers pay <b>{fmt(packagingFee)}</b> packaging fee.
            {toAmount(freePackagingAbove) > 0
              ? ` Orders above ${fmt(freePackagingAbove)} get FREE packaging.`
              : ' Appears on all orders.'}
          </div>
        )}
      </div>

      {/* 3. Delivery Charge Slabs */}
      <div className={`${PANEL} p-6`}>
        <h2 className="text-base font-semibold text-gray-900">Delivery charge slabs</h2>
        <p className="text-sm text-gray-500 mb-4">
          The highest slab the subtotal reaches wins. Use a charge of 0 for free delivery.
        </p>

        <div className="space-y-3">
          {slabs.map((slab, i) => (
            <div key={i} className="flex items-end gap-3 p-3 border border-gray-100 rounded-lg bg-gray-50/50">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Subtotal from (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={slab.orderAmount}
                  onChange={(e) => updateSlab(i, 'orderAmount', e.target.value)}
                  className={INPUT}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Delivery charge (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={slab.shippingCharge}
                  onChange={(e) => updateSlab(i, 'shippingCharge', e.target.value)}
                  className={INPUT}
                />
              </div>
              <button
                onClick={() => removeSlab(i)}
                className="p-2 mb-0.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Remove slab"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}

          {slabs.length === 0 && (
            <div className="text-center py-6 text-gray-500 text-sm">
              No slabs. Every order pays the base delivery charge.
            </div>
          )}
        </div>

        <button
          onClick={addSlab}
          className="mt-4 w-full py-3 border-2 border-dashed border-gray-200 text-gray-600 rounded-xl hover:border-emerald-600 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2 font-medium"
        >
          <Plus className="w-5 h-5" />
          Add slab
        </button>

        <div className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
          <p className="font-medium mb-2">Customers will pay</p>
          <ul className="space-y-1">
            <li>
              {sortedPreview[0] ? `Below ${fmt(sortedPreview[0].orderAmount)}` : 'All orders'}:{' '}
              {toAmount(minimumShippingCharge) === 0 ? 'Free delivery' : fmt(minimumShippingCharge)}
            </li>
            {sortedPreview.map((slab, i) => (
              <li key={i}>
                {fmt(slab.orderAmount)}
                {sortedPreview[i + 1] ? ` – ${fmt(sortedPreview[i + 1].orderAmount - 1)}` : ' and above'}:{' '}
                {slab.shippingCharge === 0 ? 'Free delivery' : fmt(slab.shippingCharge)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Clock, Plus, Trash2, Check, X, Loader2 } from 'lucide-react';
import { PAGE_TITLE, PAGE_SUB, PANEL, BTN_PRIMARY } from '../utils/ui';
import { API_ORIGIN as API_BASE } from '../api/client';

export default function PreOrderSlots() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const token = (localStorage.getItem('greengrocc_admin_token') || (() => { try { return JSON.parse(localStorage.getItem('greengrocc_vendor_auth'))?.token; } catch { return ''; } })());
      // Use /api/settings/admin or /api/settings based on the routes
      const res = await fetch(`${API_BASE}/api/settings/admin`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();
      // data might be wrapped in { data: settings } or direct
      const settings = data.data || data;
      if (settings.preOrderSlots) {
        setSlots(settings.preOrderSlots);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load pre-order slots. Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const token = (localStorage.getItem('greengrocc_admin_token') || (() => { try { return JSON.parse(localStorage.getItem('greengrocc_vendor_auth'))?.token; } catch { return ''; } })());
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ preOrderSlots: slots })
      });
      if (!res.ok) throw new Error('Failed to save settings');
      alert('Pre-order slots saved successfully!');
    } catch (err) {
      console.error(err);
      setError('Failed to save slots.');
    } finally {
      setSaving(false);
    }
  };

  const addSlot = () => {
    setSlots([...slots, { startTime: '', endTime: '', capacity: 0, isActive: true }]);
  };

  const updateSlot = (index, field, value) => {
    const newSlots = [...slots];
    newSlots[index][field] = value;
    setSlots(newSlots);
  };

  const removeSlot = (index) => {
    const newSlots = [...slots];
    newSlots.splice(index, 1);
    setSlots(newSlots);
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin w-8 h-8 text-emerald-600" /></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className={`${PAGE_TITLE} flex items-center gap-2`}>
            <Clock className="w-6 h-6 text-emerald-600" />
            Pre-Order Time Slots
          </h1>
          <p className={PAGE_SUB}>Manage delivery time slots for next-day pre-orders</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`${BTN_PRIMARY} flex items-center gap-2`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 flex items-start gap-2">
          <X className="w-5 h-5 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className={`${PANEL} p-6`}>
        <div className="space-y-4">
          {slots.map((slot, i) => (
            <div key={i} className="flex flex-col md:flex-row items-start md:items-center gap-4 p-4 border border-gray-100 rounded-lg hover:border-emerald-500/30 transition-colors bg-gray-50/50">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={slot.startTime}
                    onChange={(e) => updateSlot(i, 'startTime', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={slot.endTime}
                    onChange={(e) => updateSlot(i, 'endTime', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                  <input
                    type="number"
                    min="0"
                    value={slot.capacity}
                    onChange={(e) => updateSlot(i, 'capacity', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    placeholder="Orders limit"
                  />
                </div>
                <div className="flex items-center md:mt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={slot.isActive}
                      onChange={(e) => updateSlot(i, 'isActive', e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                </div>
              </div>
              <button
                onClick={() => removeSlot(i)}
                className="mt-2 md:mt-6 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Remove Slot"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}

          {slots.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No time slots configured. Add your first slot below.
            </div>
          )}
        </div>

        <button
          onClick={addSlot}
          className="mt-6 w-full py-3 border-2 border-dashed border-gray-200 text-gray-600 rounded-xl hover:border-emerald-600 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2 font-medium"
        >
          <Plus className="w-5 h-5" />
          Add Time Slot
        </button>
      </div>
    </div>
  );
}

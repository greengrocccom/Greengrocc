import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Percent,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Store,
  Receipt,
  RefreshCw,
  ShoppingBag,
  Plus,
  FileSpreadsheet,
  X,
  ExternalLink,
} from 'lucide-react';
import adminFinanceApi from '../../api/adminFinanceApi';

const DATE_PRESETS = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'year', label: 'This Year' },
  { id: 'custom', label: 'Custom' },
];

export default function AdminVendorCommissionDetailPage() {
  const { vendorId } = useParams();
  const navigate = useNavigate();

  const [preset, setPreset] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  // Collect Commission (जमा नोंदवा) Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Bank Transfer');
  const [payReference, setPayReference] = useState('');
  const [payNote, setPayNote] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const loadDetail = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit };
      if (preset && preset !== 'custom') {
        params.preset = preset;
      } else if (preset === 'custom') {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }

      const res = await adminFinanceApi.getVendorCommissionDetail(vendorId, params);
      setData(res);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load vendor commission details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [vendorId, preset, startDate, endDate, page]);

  const openPayModal = () => {
    if (!data?.commission) return;
    const pending = data.commission.pendingCommission || 0;
    setPayAmount(pending > 0 ? String(pending) : '');
    setPayMethod('Bank Transfer');
    setPayReference(`COMM-${Date.now().toString().slice(-6)}`);
    setPayNote(`Admin Commission Settlement for ${data.commission.vendor.name}`);
    setPayError('');
    setPaymentModalOpen(true);
  };

  const handleRecordPayment = async (e) => {
    e?.preventDefault();
    const cleanAmount = Number(payAmount);
    if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) {
      setPayError('Please enter a valid payment amount greater than 0');
      return;
    }
    const pending = data?.commission?.pendingCommission || 0;
    if (cleanAmount > pending + 0.5) {
      setPayError(`Payment cannot exceed pending commission balance of ₹${pending}`);
      return;
    }

    setPaySubmitting(true);
    setPayError('');
    try {
      await adminFinanceApi.recordPayment({
        vendorId: data.commission.vendor.id,
        amount: cleanAmount,
        method: payMethod,
        reference: payReference.trim(),
        note: payNote.trim(),
        paidAt: new Date(),
      });

      setPaymentModalOpen(false);
      setToastMessage(`Payment of ₹${cleanAmount.toLocaleString('en-IN')} recorded successfully!`);
      setTimeout(() => setToastMessage(''), 4000);
      loadDetail();
    } catch (err) {
      setPayError(err?.response?.data?.message || err?.message || 'Failed to record payment');
    } finally {
      setPaySubmitting(false);
    }
  };

  const formatInr = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

  const commission = data?.commission || {};
  const vendor = commission.vendor || {};
  const darkStores = commission.darkStores || [];
  const orders = data?.orders || [];
  const payments = commission.payments || [];
  const pagination = data?.pagination || {};

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/finance/commissions')}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs"
            title="Back to Vendor Commissions"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                {vendor.name || 'Vendor Commission Details'}
              </h1>
              <span className="capitalize rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                {vendor.vendorType || 'vendor'}
              </span>
            </div>
            <p className="font-mono text-xs text-slate-400 mt-0.5">
              ID: {vendor.id} {vendor.email ? `• ${vendor.email}` : ''} {vendor.phone ? `• ${vendor.phone}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {commission.pendingCommission > 0 && (
            <button
              type="button"
              onClick={openPayModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition"
            >
              <CreditCard className="h-4 w-4" />
              <span>Record Settlement Payment</span>
            </button>
          )}
          <button
            type="button"
            onClick={loadDetail}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 shadow-xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Date Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-bold text-slate-500 mr-1 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" /> Date Filter:
          </span>
          {DATE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPreset(p.id);
                setPage(1);
              }}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                preset === p.id
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-slate-700"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-slate-700"
            />
          </div>
        )}
      </div>

      {/* Commission Calculation Formula Card (Requirement 5) */}
      <div className="rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-r from-emerald-50/80 via-white to-indigo-50/60 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Transparent Calculation Formula
            </span>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-base sm:text-lg font-black text-slate-900">
              <span className="rounded bg-white px-2 py-0.5 border border-slate-200">
                Eligible Sales ({formatInr(commission.eligibleCommissionSales)})
              </span>
              <span className="text-slate-400">×</span>
              <span className="rounded bg-indigo-50 px-2 py-0.5 border border-indigo-200 text-indigo-800">
                Rate ({commission.commissionRate}%)
              </span>
              <span className="text-slate-400">=</span>
              <span className="rounded bg-emerald-600 px-2.5 py-0.5 text-white">
                Admin Commission ({formatInr(commission.totalAdminCommission)})
              </span>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              Excludes delivery charges, rider fees, cancelled orders, farmer procurement, and vendor expenses.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white border border-slate-200 p-3 text-center min-w-[110px] shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-blue-700 block">Commission Received</span>
              <span className="text-base font-black text-blue-900">{formatInr(commission.commissionPaid)}</span>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-300 p-3 text-center min-w-[120px] shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-amber-800 block">Pending from Vendor</span>
              <span className="text-base font-black text-amber-950">{formatInr(commission.pendingCommission)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Linked Dark Stores Cards */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-emerald-700" />
            <h2 className="text-xs font-bold uppercase text-slate-700">
              Linked Dark Stores ({darkStores.length})
            </h2>
          </div>
          <span className="text-xs text-slate-400">Sales from all linked stores aggregate to this vendor</span>
        </div>

        {darkStores.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No Dark Stores currently mapped to this vendor.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {darkStores.map((s) => (
              <div key={s._id} className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs">
                <div className="font-bold text-slate-800">{s.storeName}</div>
                <div className="text-slate-500 text-[11px] mt-0.5">
                  Manager: {s.name || 'Store Incharge'} {s.area ? `• ${s.area}` : ''} {s.city ? `• ${s.city}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order-wise Commission Breakdown (Requirement 5) */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Order-wise Commission Audit Breakdown</h2>
            <p className="text-xs text-slate-500">
              Transaction-level verification of eligible sales and generated admin commission
            </p>
          </div>
          <span className="text-xs font-bold text-slate-600">
            Total Orders: {pagination.total || orders.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-xs">
            <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5">Order Number</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Dark Store</th>
                <th className="px-3 py-2.5 text-center">Items</th>
                <th className="px-4 py-2.5 text-right">Product Total</th>
                <th className="px-4 py-2.5 text-right">Eligible Sales</th>
                <th className="px-3 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5 text-right font-black text-emerald-800">Admin Commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading order breakdown…
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No orders recorded for this vendor in the selected period.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.orderId} className={`hover:bg-slate-50 transition ${!o.isEligible ? 'bg-rose-50/30' : ''}`}>
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-800">
                      {o.orderNumber}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-[11px]">
                      {new Date(o.createdAt).toLocaleDateString('en-IN')} {new Date(o.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{o.storeName}</td>
                    <td className="px-3 py-2.5 text-center font-semibold text-slate-600" title={o.itemsSummary}>
                      {o.itemsCount}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-700">
                      {formatInr(o.totalProductAmount)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                      {formatInr(o.eligibleSales)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          o.status === 'delivered'
                            ? 'bg-emerald-100 text-emerald-800'
                            : o.status === 'cancelled'
                            ? 'bg-rose-100 text-rose-800 line-through'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-black text-emerald-800 text-sm">
                      {o.isEligible ? formatInr(o.calculatedCommission) : '₹0 (Excluded)'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Orders Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
            <div>
              Page {page} of {pagination.totalPages}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded border border-slate-300 bg-white px-2 py-0.5 font-semibold text-slate-700 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                className="rounded border border-slate-300 bg-white px-2 py-0.5 font-semibold text-slate-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Commission Commission Receipts History (Requirement 6) */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Commission Payment & Settlement History</h2>
            <p className="text-xs text-slate-500">Record of verified commission disbursements to admin</p>
          </div>
          <span className="text-xs font-bold text-blue-700">
            Total Paid: {formatInr(commission.commissionPaid)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5">Date Received</th>
                <th className="px-4 py-2.5">Amount</th>
                <th className="px-4 py-2.5">Method</th>
                <th className="px-4 py-2.5">Transaction Reference</th>
                <th className="px-4 py-2.5">Remarks / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No payment history recorded yet for this vendor.
                  </td>
                </tr>
              ) : (
                payments.map((p, idx) => (
                  <tr key={p._id || idx} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-2.5 text-slate-700">
                      {p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-blue-800 text-sm">
                      {formatInr(p.amount)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                        {p.method || 'Bank Transfer'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-600">
                      {p.reference || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {p.note || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Record Commission Settlement</h3>
                <p className="text-xs text-slate-500">Vendor: {vendor.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="mt-4 space-y-3.5 text-xs">
              {payError && (
                <div className="rounded-lg bg-red-50 p-2.5 text-red-700 font-semibold border border-red-200">
                  {payError}
                </div>
              )}

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-amber-800 font-medium">Pending Commission Balance:</span>
                  <div className="text-base font-black text-amber-950">
                    {formatInr(commission.pendingCommission)}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">Total Commission:</span>
                  <span className="text-xs font-bold text-slate-800">
                    {formatInr(commission.totalAdminCommission)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Amount Received from Vendor (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={commission.pendingCommission + 0.5}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Enter amount to record"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
                >
                  <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                  <option value="Internal Ledger Transfer">Internal Ledger Transfer</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Transaction / Reference ID
                </label>
                <input
                  type="text"
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  placeholder="e.g. UTR / Bank Reference No."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Admin Remarks / Notes</label>
                <textarea
                  rows={2}
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="Optional payment remarks..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paySubmitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-1.5 font-bold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50"
                >
                  {paySubmitting ? 'Recording…' : 'Confirm Collection (जमा नोंदवा)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


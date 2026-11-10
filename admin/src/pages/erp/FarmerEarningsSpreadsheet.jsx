import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Search,
  CheckCircle2,
  Clock,
  Calendar,
  Layers,
  ChevronRight,
  X,
  Printer,
  Package,
  ArrowRight,
  Eye,
  Table,
  Sparkles,
  TrendingUp,
  AlertCircle,
  Copy
} from 'lucide-react';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function shortDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function weekdayName(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return WEEKDAYS[d.getDay()] || '';
}

function formatTime12h(value) {
  if (!value) return '—';
  const raw = String(value).trim();
  if (/am|pm/i.test(raw)) return raw;
  const m = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return raw;
  let hour = Number(m[1]);
  const min = m[2];
  const period = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${min} ${period}`;
}

function isOrderPaid(item) {
  const p = String(item.paymentStatus || item.status || '').toUpperCase().trim();
  return p === 'PAID' || p === 'PAYMENT_COMPLETED' || p === 'COMPLETED' || p === 'PAYMENT RECEIVED' || p === 'SUCCESS';
}

function extractGradeBreakdown(item) {
  const gMap = {
    'Grade A': { qty: 0, rate: 0, amount: 0, rejected: 0 },
    'Grade B': { qty: 0, rate: 0, amount: 0, rejected: 0 },
    'Grade C': { qty: 0, rate: 0, amount: 0, rejected: 0 },
  };

  const gradesList = Array.isArray(item.finalStatement) && item.finalStatement.length > 0
    ? item.finalStatement
    : Array.isArray(item.grades) && item.grades.length > 0
    ? item.grades
    : Array.isArray(item.products) && item.products.length > 0
    ? item.products
    : [];

  let foundGrades = false;
  if (gradesList.length > 0) {
    for (const g of gradesList) {
      const rawName = String(g.grade || g.name || g.label || '').toUpperCase().trim();
      let targetKey = null;
      if (rawName.includes('GRADE A') || rawName === 'A' || rawName.includes('A GRADE')) targetKey = 'Grade A';
      else if (rawName.includes('GRADE B') || rawName === 'B' || rawName.includes('B GRADE')) targetKey = 'Grade B';
      else if (rawName.includes('GRADE C') || rawName === 'C' || rawName.includes('C GRADE')) targetKey = 'Grade C';

      if (targetKey) {
        foundGrades = true;
        const q = Number(g.quantity ?? g.finalQty ?? g.qty ?? g.stock ?? 0);
        const r = Number(g.rate ?? g.price ?? 0);
        const rej = Number(g.rejectedQuantity ?? g.rejectedQty ?? g.rejected ?? 0);
        const amt = Number(g.amount ?? (q * r));
        gMap[targetKey].qty += q;
        if (r > 0) gMap[targetKey].rate = r;
        gMap[targetKey].amount += amt;
        gMap[targetKey].rejected += rej;
      }
    }
  }

  if (item.gradeAQuantity || item.gradeBQuantity || item.gradeCQuantity) {
    foundGrades = true;
    if (item.gradeAQuantity) {
      gMap['Grade A'].qty = Number(item.gradeAQuantity);
      gMap['Grade A'].rate = Number(item.gradeAPrice || item.price || 30);
      gMap['Grade A'].amount = gMap['Grade A'].qty * gMap['Grade A'].rate;
      gMap['Grade A'].rejected = Number(item.gradeARejected || 0);
    }
    if (item.gradeBQuantity) {
      gMap['Grade B'].qty = Number(item.gradeBQuantity);
      gMap['Grade B'].rate = Number(item.gradeBPrice || (item.price ? Math.round(item.price * 0.4) : 12));
      gMap['Grade B'].amount = gMap['Grade B'].qty * gMap['Grade B'].rate;
      gMap['Grade B'].rejected = Number(item.gradeBRejected || 0);
    }
    if (item.gradeCQuantity) {
      gMap['Grade C'].qty = Number(item.gradeCQuantity);
      gMap['Grade C'].rate = Number(item.gradeCPrice || 5);
      gMap['Grade C'].amount = gMap['Grade C'].qty * gMap['Grade C'].rate;
      gMap['Grade C'].rejected = Number(item.gradeCRejected || 0);
    }
  }

  if (!foundGrades) {
    const totalQ = Number(item.totalQuantity ?? item.orderedQuantity ?? item.quantity ?? 0);
    const totalAmt = Number(item.totalAmount ?? item.orderValue ?? item.netEarnings ?? item.grossEarnings ?? item.amount ?? 0);
    const p = Number(item.price ?? item.ratePerKg ?? (totalQ > 0 ? Math.round(totalAmt / totalQ) : 30));
    gMap['Grade A'].qty = totalQ;
    gMap['Grade A'].rate = p;
    gMap['Grade A'].amount = totalAmt || (totalQ * p);
  }

  const rejectedTotal = Math.max(
    Number(item.rejectedQuantity ?? item.rejectionQty ?? item.rejectionQuantity ?? 0),
    gMap['Grade A'].rejected + gMap['Grade B'].rejected + gMap['Grade C'].rejected
  );

  const amount = Number(
    item.totalAmount ?? item.orderValue ?? item.netEarnings ?? item.amount ??
    (gMap['Grade A'].amount + gMap['Grade B'].amount + gMap['Grade C'].amount)
  );

  return { grades: gMap, rejectedTotal, amount };
}

// Full Receipt Modal for individual order
function EarningReceiptModal({ record, onClose, farmer }) {
  if (!record) return null;
  const isPaid = isOrderPaid(record);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl border border-gray-200">
        <div className="flex items-center justify-between border-b border-gray-100 bg-[#217346] px-6 py-4 text-white">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-200">
              GreenGrocc Earning Statement Receipt
            </span>
            <h3 className="text-lg font-bold">Order ID: {record.orderId}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg bg-white/10 p-1.5 text-white hover:bg-white/20 transition"
              title="Print Receipt"
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-white/10 p-1.5 text-white hover:bg-white/20 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 text-xs text-gray-700">
          {/* Progress Timeline */}
          <div className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3 text-center">
              Processing & Settlement Timeline
            </p>
            <div className="flex items-center justify-between">
              {[
                { label: 'Received', done: true },
                { label: 'Quality Check', done: true },
                { label: 'Grading', done: true },
                { label: 'Grade Confirmed', done: true },
                { label: isPaid ? 'Payment Paid' : 'Payment Pending', done: isPaid },
              ].map((step, idx, arr) => (
                <div key={step.label} className="relative flex flex-1 flex-col items-center">
                  {idx < arr.length - 1 && (
                    <div className={`absolute top-2.5 left-1/2 w-full h-0.5 ${step.done && arr[idx + 1].done ? 'bg-[#217346]' : 'bg-gray-200'}`} />
                  )}
                  <div className={`relative z-10 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    step.done ? 'bg-[#217346] text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step.done ? '✓' : idx + 1}
                  </div>
                  <span className={`mt-1.5 text-[10px] font-semibold text-center ${step.done ? 'text-[#217346]' : 'text-gray-400'}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Details Overview */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-gray-50 p-2.5">
              <span className="text-[10px] font-semibold uppercase text-gray-400">Produce Item</span>
              <p className="mt-0.5 font-bold text-gray-900">{record.productName}</p>
              {record.productId && (
                <p className="font-mono text-[10px] text-emerald-700 font-semibold">{record.productId}</p>
              )}
            </div>
            <div className="rounded-lg bg-gray-50 p-2.5">
              <span className="text-[10px] font-semibold uppercase text-gray-400">Order Date</span>
              <p className="mt-0.5 font-bold text-gray-900">{shortDate(record.orderDate)}</p>
              <p className="text-[10px] text-gray-500">{weekdayName(record.orderDate)}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-2.5">
              <span className="text-[10px] font-semibold uppercase text-gray-400">Pickup Date & Time</span>
              <p className="mt-0.5 font-bold text-gray-900">{shortDate(record.pickupDate)}</p>
              <p className="text-[10px] text-gray-500">{formatTime12h(record.pickupTime)}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-2.5">
              <span className="text-[10px] font-semibold uppercase text-gray-400">Payment Status</span>
              <div className="mt-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                  isPaid ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  {record.paymentStatus || 'Pending'}
                </span>
              </div>
            </div>
          </div>

          {/* Grade Breakdown Table */}
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#E8F0EA] text-[#374151] font-bold text-[11px] uppercase border-b border-gray-200">
                <tr>
                  <th className="py-2.5 px-3">Grade Classification</th>
                  <th className="py-2.5 px-3 text-center">Accepted Qty</th>
                  <th className="py-2.5 px-3 text-center">Rate (₹)</th>
                  <th className="py-2.5 px-3 text-center">Rejected Qty</th>
                  <th className="py-2.5 px-3 text-right">Earning Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {['Grade A', 'Grade B', 'Grade C'].map((gKey) => {
                  const g = record.grades[gKey];
                  const tone = gKey === 'Grade A' ? 'bg-emerald-50/50' : gKey === 'Grade B' ? 'bg-sky-50/50' : 'bg-amber-50/50';
                  return (
                    <tr key={gKey} className={tone}>
                      <td className="py-2.5 px-3 font-bold text-gray-900">{gKey}</td>
                      <td className="py-2.5 px-3 text-center font-bold">
                        {g.qty > 0 ? `${Number(g.qty).toLocaleString('en-IN')} ${record.unit}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {g.qty > 0 && g.rate > 0 ? `₹${Number(g.rate).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center text-rose-600 font-semibold">
                        {g.rejected > 0 ? `${Number(g.rejected).toLocaleString('en-IN')} ${record.unit}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                        {g.amount > 0 ? `₹${Number(g.amount).toLocaleString('en-IN')}` : '₹0'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-100 border-t-2 border-gray-200 font-bold">
                <tr>
                  <td className="py-2.5 px-3 text-gray-900">Total Net Settlement</td>
                  <td className="py-2.5 px-3 text-center font-bold text-gray-900">
                    {Number(
                      record.grades['Grade A'].qty + record.grades['Grade B'].qty + record.grades['Grade C'].qty
                    ).toLocaleString('en-IN')} {record.unit}
                  </td>
                  <td className="py-2.5 px-3 text-center text-gray-400">—</td>
                  <td className="py-2.5 px-3 text-center text-rose-600 font-bold">
                    {record.rejectedTotal > 0 ? `${Number(record.rejectedTotal).toLocaleString('en-IN')} ${record.unit}` : '0'}
                  </td>
                  <td className="py-2.5 px-3 text-right text-sm font-extrabold text-[#217346]">
                    ₹{Number(record.amount).toLocaleString('en-IN')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Farmer Bank Details */}
          {farmer?.bank && (
            <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Beneficiary Bank Details
              </span>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                <div>
                  <span className="text-gray-400">Bank Name</span>
                  <p className="font-semibold text-gray-800">{farmer.bank.bankName || '—'}</p>
                </div>
                <div>
                  <span className="text-gray-400">Account No.</span>
                  <p className="font-semibold text-gray-800 font-mono">{farmer.bank.accountNumber || '—'}</p>
                </div>
                <div>
                  <span className="text-gray-400">IFSC Code</span>
                  <p className="font-semibold text-gray-800 font-mono">{farmer.bank.ifsc || '—'}</p>
                </div>
                <div>
                  <span className="text-gray-400">Account Holder</span>
                  <p className="font-semibold text-gray-800">{farmer.bank.accountHolder || farmer.name || '—'}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 bg-gray-50 px-6 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gray-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 transition"
          >
            Close Receipt
          </button>
        </div>
      </div>
    </div>
  );
}

// Product-Wise Card (Identical to Farmer App ProductEarningsCard)
function ProductWiseEarningsCard({ item, onOpenSheet }) {
  const gA = item.gradeTotals['Grade A'];
  const gB = item.gradeTotals['Grade B'];
  const gC = item.gradeTotals['Grade C'];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm hover:border-[#217346] hover:shadow-md transition-all flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-gray-900 text-sm">{item.name}</h4>
              {item.productId && (
                <span className="font-mono text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded">
                  {item.productId}
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Variety: <strong className="text-gray-700">{item.variety || 'Standard'}</strong>
              {item.cropName && <> · Crop: <strong className="text-gray-700">{item.cropName}</strong></>}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200 shrink-0">
            {item.count} Order{item.count === 1 ? '' : 's'}
          </span>
        </div>

        {/* Grade Breakdown Table */}
        <div className="mt-2.5 overflow-hidden rounded-lg border border-[#9CA3AF]">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-[#E8F0EA] text-[#374151] font-bold">
                <th className="border-b border-[#9CA3AF] px-2 py-1 text-left">Grade</th>
                <th className="border-b border-l border-[#9CA3AF] px-2 py-1 text-center">Accepted</th>
                <th className="border-b border-l border-[#9CA3AF] px-2 py-1 text-center">Rate</th>
                <th className="border-b border-l border-[#9CA3AF] px-2 py-1 text-center bg-[#FEE2E2] text-[#991B1B]">
                  Rejected
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Grade A */}
              <tr className="bg-[#ECFDF5]">
                <td className="border-t border-[#9CA3AF] px-2 py-1 font-bold text-[#065F46]">Grade A</td>
                <td className="border-t border-l border-[#9CA3AF] px-2 py-1 text-center font-bold text-gray-900">
                  {gA.qty > 0 ? `${Number(gA.qty).toLocaleString('en-IN')} ${item.unit}` : '—'}
                </td>
                <td className="border-t border-l border-[#9CA3AF] px-2 py-1 text-center font-semibold text-gray-700">
                  {gA.rate > 0 ? `₹${Number(gA.rate).toLocaleString('en-IN')}` : '—'}
                </td>
                <td className="border-t border-l border-[#9CA3AF] px-2 py-1 text-center font-semibold text-rose-600 bg-[#FEF2F2]">
                  {gA.rejected > 0 ? `${Number(gA.rejected).toLocaleString('en-IN')} ${item.unit}` : '0'}
                </td>
              </tr>
              {/* Grade B */}
              <tr className="bg-[#EFF6FF]">
                <td className="border-t border-[#9CA3AF] px-2 py-1 font-bold text-[#1E40AF]">Grade B</td>
                <td className="border-t border-l border-[#9CA3AF] px-2 py-1 text-center font-bold text-gray-900">
                  {gB.qty > 0 ? `${Number(gB.qty).toLocaleString('en-IN')} ${item.unit}` : '—'}
                </td>
                <td className="border-t border-l border-[#9CA3AF] px-2 py-1 text-center font-semibold text-gray-700">
                  {gB.rate > 0 ? `₹${Number(gB.rate).toLocaleString('en-IN')}` : '—'}
                </td>
                <td className="border-t border-l border-[#9CA3AF] px-2 py-1 text-center font-semibold text-rose-600 bg-[#FEF2F2]">
                  {gB.rejected > 0 ? `${Number(gB.rejected).toLocaleString('en-IN')} ${item.unit}` : '0'}
                </td>
              </tr>
              {/* Grade C */}
              <tr className="bg-[#FFFBEB]">
                <td className="border-t border-[#9CA3AF] px-2 py-1 font-bold text-[#92400E]">Grade C</td>
                <td className="border-t border-l border-[#9CA3AF] px-2 py-1 text-center font-bold text-gray-900">
                  {gC.qty > 0 ? `${Number(gC.qty).toLocaleString('en-IN')} ${item.unit}` : '—'}
                </td>
                <td className="border-t border-l border-[#9CA3AF] px-2 py-1 text-center font-semibold text-gray-700">
                  {gC.rate > 0 ? `₹${Number(gC.rate).toLocaleString('en-IN')}` : '—'}
                </td>
                <td className="border-t border-l border-[#9CA3AF] px-2 py-1 text-center font-semibold text-rose-600 bg-[#FEF2F2]">
                  {gC.rejected > 0 ? `${Number(gC.rejected).toLocaleString('en-IN')} ${item.unit}` : '0'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Financial Mini Bar */}
        <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center">
          <div className="rounded-lg bg-[#ECFDF5] border border-emerald-200/60 p-1.5">
            <span className="text-[9px] font-semibold text-gray-500 uppercase">Total Earning</span>
            <p className="font-extrabold text-[#217346] text-xs">₹{Number(item.amount).toLocaleString('en-IN')}</p>
          </div>
          <div className="rounded-lg bg-[#F0FDF4] border border-emerald-200/60 p-1.5">
            <span className="text-[9px] font-semibold text-gray-500 uppercase">Deposited</span>
            <p className="font-extrabold text-[#065F46] text-xs">₹{Number(item.deposited).toLocaleString('en-IN')}</p>
          </div>
          <div className="rounded-lg bg-[#FFFBEB] border border-amber-200/60 p-1.5">
            <span className="text-[9px] font-semibold text-gray-500 uppercase">Pending</span>
            <p className="font-extrabold text-[#B45309] text-xs">₹{Number(item.pending).toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* Button to open sheet for this product */}
      <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between">
        <span className="text-[11px] font-medium text-gray-400">
          Sold: <strong className="text-gray-700">{Number(item.soldQty).toLocaleString('en-IN')} {item.unit}</strong>
        </span>
        <button
          type="button"
          onClick={onOpenSheet}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#217346] hover:bg-[#1B5E39] text-white px-3 py-1 text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <Table className="h-3 w-3" />
          <span>Open Product Sheet</span>
        </button>
      </div>
    </div>
  );
}

export default function FarmerEarningsSpreadsheet({
  orders = [],
  earnings = [],
  products = [],
  farmer = {},
  title = "Farmer Earning Statement",
}) {
  const [activeTab, setActiveTab] = useState('OVERVIEW'); // 'OVERVIEW' or product ID/Name
  const [viewMode, setViewMode] = useState('SHEET'); // 'CARDS' or 'SHEET'
  const [searchQ, setSearchQ] = useState('');
  const [inspectRecord, setInspectRecord] = useState(null);

  // 1. Normalize all orders and earnings into unified statement records
  const allRecords = useMemo(() => {
    const list = [];
    const seenOrderIds = new Set();

    (orders || []).forEach((o) => {
      const oid = String(o.orderId || o.id || o._id || '').trim();
      if (oid) seenOrderIds.add(oid);
      const { grades, rejectedTotal, amount } = extractGradeBreakdown(o);

      list.push({
        id: oid || `ord-${Math.random()}`,
        orderId: oid || 'ORD-GEN',
        productId: o.productId || '',
        productName: o.productName || o.name || o.cropName || 'Farm Produce',
        variety: o.variety || '',
        cropName: o.cropName || '',
        orderDate: o.orderDate || o.createdAt || o.date,
        pickupDate: o.pickupDate || o.pickup?.pickupDate || o.orderDate || o.createdAt,
        pickupTime: o.pickupTime || o.pickup?.pickupTime || '10:00 AM',
        unit: o.unit || 'Kg',
        status: o.status || 'Completed',
        paymentStatus: o.paymentStatus || (isOrderPaid(o) ? 'Paid' : 'Pending'),
        grades,
        rejectedTotal,
        amount,
        raw: o,
      });
    });

    (earnings || []).forEach((e) => {
      const eid = String(e.orderId || e.id || e._id || '').trim();
      if (eid && seenOrderIds.has(eid)) return;
      const { grades, rejectedTotal, amount } = extractGradeBreakdown(e);

      list.push({
        id: eid || `ern-${Math.random()}`,
        orderId: e.orderId || eid || 'ERN-STMT',
        productId: e.productId || '',
        productName: e.cropName || e.productName || 'Farm Produce',
        variety: e.variety || '',
        cropName: e.cropName || '',
        orderDate: e.date || e.createdAt,
        pickupDate: e.pickupDate || e.date || e.createdAt,
        pickupTime: e.pickupTime || '10:00 AM',
        unit: e.unit || 'Kg',
        status: e.status || 'Paid',
        paymentStatus: e.status === 'Paid' ? 'Paid' : (e.paymentStatus || 'Pending'),
        grades,
        rejectedTotal,
        amount: Number(e.netEarnings || amount),
        raw: e,
      });
    });

    return list.sort((a, b) => {
      const ta = new Date(a.orderDate).getTime() || 0;
      const tb = new Date(b.orderDate).getTime() || 0;
      return tb - ta;
    });
  }, [orders, earnings]);

  // 2. Group records product-wise to build distinct Product Summaries
  const productSummaries = useMemo(() => {
    const map = new Map();

    // Seed from catalog products if present
    (products || []).forEach((p) => {
      const pid = String(p.productId || p.id || '').trim();
      const pName = p.productName || p.name || 'Product';
      const key = pid || pName;
      if (!map.has(key)) {
        map.set(key, {
          key,
          productId: pid || 'PRD-GEN',
          name: pName,
          variety: p.variety || '',
          cropName: p.cropName || '',
          unit: p.unit || 'Kg',
          count: 0,
          amount: 0,
          deposited: 0,
          pending: 0,
          soldQty: 0,
          rejected: 0,
          gradeTotals: {
            'Grade A': { qty: 0, rate: 0, rejected: 0 },
            'Grade B': { qty: 0, rate: 0, rejected: 0 },
            'Grade C': { qty: 0, rate: 0, rejected: 0 },
          },
        });
      }
    });

    // Populate from orders/earnings records
    allRecords.forEach((r) => {
      const pid = String(r.productId || '').trim();
      const pName = r.productName || 'Produce';
      const key = pid || pName;

      if (!map.has(key)) {
        map.set(key, {
          key,
          productId: pid || 'PRD-GEN',
          name: pName,
          variety: r.variety || '',
          cropName: r.cropName || '',
          unit: r.unit || 'Kg',
          count: 0,
          amount: 0,
          deposited: 0,
          pending: 0,
          soldQty: 0,
          rejected: 0,
          gradeTotals: {
            'Grade A': { qty: 0, rate: 0, rejected: 0 },
            'Grade B': { qty: 0, rate: 0, rejected: 0 },
            'Grade C': { qty: 0, rate: 0, rejected: 0 },
          },
        });
      }

      const item = map.get(key);
      item.count += 1;
      item.amount += r.amount;
      if (isOrderPaid(r)) {
        item.deposited += r.amount;
      } else {
        item.pending += r.amount;
      }
      item.rejected += r.rejectedTotal;

      ['Grade A', 'Grade B', 'Grade C'].forEach((gKey) => {
        const g = r.grades[gKey];
        item.gradeTotals[gKey].qty += g.qty;
        if (g.rate > 0) item.gradeTotals[gKey].rate = g.rate;
        item.gradeTotals[gKey].rejected += g.rejected;
        item.soldQty += g.qty;
      });
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allRecords, products]);

  // 3. Filter records according to active product tab and search
  const visibleRecords = useMemo(() => {
    return allRecords.filter((r) => {
      if (activeTab !== 'OVERVIEW') {
        const matchKey = r.productId || r.productName;
        if (matchKey !== activeTab && r.productName !== activeTab && r.productId !== activeTab) {
          return false;
        }
      }
      if (searchQ) {
        const q = searchQ.toLowerCase().trim();
        const oid = String(r.orderId || '').toLowerCase();
        const pid = String(r.productId || '').toLowerCase();
        const pName = String(r.productName || '').toLowerCase();
        if (!oid.includes(q) && !pid.includes(q) && !pName.includes(q)) return false;
      }
      return true;
    });
  }, [allRecords, activeTab, searchQ]);

  // 4. Financial Summary
  const summary = useMemo(() => {
    let total = 0;
    let deposited = 0;
    let pending = 0;

    visibleRecords.forEach((r) => {
      total += r.amount;
      if (isOrderPaid(r)) {
        deposited += r.amount;
      } else {
        pending += r.amount;
      }
    });

    return { total, deposited, pending };
  }, [visibleRecords]);

  // 5. Column footer totals
  const tableTotals = useMemo(() => {
    let gradeAQty = 0;
    let gradeBQty = 0;
    let gradeCQty = 0;
    let rejected = 0;
    let totalAmt = 0;

    visibleRecords.forEach((r) => {
      gradeAQty += r.grades['Grade A'].qty;
      gradeBQty += r.grades['Grade B'].qty;
      gradeCQty += r.grades['Grade C'].qty;
      rejected += r.rejectedTotal;
      totalAmt += r.amount;
    });

    return { gradeAQty, gradeBQty, gradeCQty, rejected, totalAmt };
  }, [visibleRecords]);

  // Active product details if a single product tab is selected
  const activeProduct = useMemo(() => {
    if (activeTab === 'OVERVIEW') return null;
    return productSummaries.find((p) => p.key === activeTab || p.productId === activeTab || p.name === activeTab);
  }, [activeTab, productSummaries]);

  // Export CSV
  const handleExportCSV = () => {
    if (!visibleRecords.length) return;
    const headers = [
      '#',
      'Order ID',
      'Product ID',
      'Product Name',
      'Variety',
      'Order Date',
      'Pickup Date',
      'Pickup Time',
      'Grade A Qty (Kg)',
      'Grade A Rate (Rs)',
      'Grade B Qty (Kg)',
      'Grade B Rate (Rs)',
      'Grade C Qty (Kg)',
      'Grade C Rate (Rs)',
      'Rejected Qty (Kg)',
      'Amount (Rs)',
      'Payment Status',
    ];

    const rows = visibleRecords.map((r, idx) => [
      idx + 1,
      r.orderId,
      r.productId || '—',
      r.productName,
      r.variety || '—',
      shortDate(r.orderDate),
      shortDate(r.pickupDate),
      formatTime12h(r.pickupTime),
      r.grades['Grade A'].qty,
      r.grades['Grade A'].rate,
      r.grades['Grade B'].qty,
      r.grades['Grade B'].rate,
      r.grades['Grade C'].qty,
      r.grades['Grade C'].rate,
      r.rejectedTotal,
      r.amount,
      r.paymentStatus,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Farmer_Earning_${activeTab}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 font-sans">
      {/* 1. Header with Title & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h3 className="font-bold text-gray-900 text-sm sm:text-base flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-[#217346]" />
            {title}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Excel-style Quality & Grade settlement statement · Product-wise sheets
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Input */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search Order or Product ID..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#217346] w-48 sm:w-60"
            />
          </div>

          {/* View Mode Toggle when on Overview */}
          {activeTab === 'OVERVIEW' && (
            <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
              <button
                type="button"
                onClick={() => setViewMode('CARDS')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                  viewMode === 'CARDS' ? 'bg-white text-[#217346] shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Product Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode('SHEET')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                  viewMode === 'SHEET' ? 'bg-white text-[#217346] shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All Orders Table
              </button>
            </div>
          )}

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition shadow-xs"
          >
            <Download className="h-3.5 w-3.5 text-[#217346]" />
            Export CSV
          </button>
        </div>
      </div>

      {/* 2. Excel Sheet Tab Bar (Workbook Style Navigation) */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-gray-200 bg-gray-50/80 p-1.5 rounded-xl border scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('OVERVIEW')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'OVERVIEW'
              ? 'bg-[#217346] text-white shadow-sm ring-1 ring-[#217346]'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>All Products Overview ({allRecords.length})</span>
        </button>

        {productSummaries.map((p) => {
          const isSelected = activeTab === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setActiveTab(p.key)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-[#217346] text-white shadow-sm ring-1 ring-[#217346]'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              <span>{p.name}</span>
              {p.productId && p.productId !== 'PRD-GEN' && (
                <span className={`font-mono text-[10px] px-1 py-0.2 rounded font-semibold ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {p.productId}
                </span>
              )}
              <span className={`text-[10px] rounded-full px-1.5 py-0.2 font-semibold ${
                isSelected ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-800'
              }`}>
                {p.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Top Financial Summary Cards */}
      <div className="overflow-hidden border border-[#9CA3AF] bg-white shadow-sm rounded-xl">
        <table className="w-full border-collapse text-xs sm:text-sm">
          <thead>
            <tr>
              <th className="border border-[#9CA3AF] bg-[#E8F0EA] px-3 py-2 text-center font-bold text-[#374151]">
                {activeProduct ? `${activeProduct.name} Total` : 'Total'} <span className="font-semibold text-[#6B7280]">₹</span>
              </th>
              <th className="border border-[#9CA3AF] bg-[#E8F0EA] px-3 py-2 text-center font-bold text-[#374151]">
                Deposited / Paid <span className="font-semibold text-[#6B7280]">₹</span>
              </th>
              <th className="border border-[#9CA3AF] bg-[#E8F0EA] px-3 py-2 text-center font-bold text-[#374151]">
                Pending Balance <span className="font-semibold text-[#6B7280]">₹</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-[#9CA3AF] px-3 py-2.5 text-center font-bold tabular-nums sm:text-base bg-[#ECFDF5] text-[#217346]">
                ₹{Number(summary.total).toLocaleString('en-IN')}
              </td>
              <td className="border border-[#9CA3AF] px-3 py-2.5 text-center font-bold tabular-nums sm:text-base bg-[#F0FDF4] text-[#065F46]">
                ₹{Number(summary.deposited).toLocaleString('en-IN')}
              </td>
              <td className="border border-[#9CA3AF] px-3 py-2.5 text-center font-bold tabular-nums sm:text-base bg-[#FFFBEB] text-[#B45309]">
                ₹{Number(summary.pending).toLocaleString('en-IN')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 4A. If Overview & CARDS mode selected: Show Product-Wise Cards Grid */}
      {activeTab === 'OVERVIEW' && viewMode === 'CARDS' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <Package className="h-4 w-4 text-[#217346]" />
              Product-Wise Earning Breakdown ({productSummaries.length} Products)
            </h4>
            <span className="text-xs text-gray-400">Click &ldquo;Open Product Sheet&rdquo; for itemized orders</span>
          </div>

          {!productSummaries.length ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-400">
              <Package className="mx-auto h-8 w-8 text-gray-300 mb-2" />
              <p>No products registered for this farmer.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
              {productSummaries.map((p) => (
                <ProductWiseEarningsCard
                  key={p.key}
                  item={p}
                  onOpenSheet={() => setActiveTab(p.key)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4B. Spreadsheet View (Single Product Sheet OR All Orders Table) */}
      {(activeTab !== 'OVERVIEW' || viewMode === 'SHEET') && (
        <div className="space-y-2">
          {activeProduct && (
            <div className="flex items-center justify-between bg-emerald-50/60 border border-emerald-200 rounded-xl px-4 py-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 text-sm">{activeProduct.name}</span>
                {activeProduct.productId && (
                  <span className="font-mono text-[11px] font-bold text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-300">
                    ID: {activeProduct.productId}
                  </span>
                )}
                {activeProduct.variety && (
                  <span className="text-gray-600">Variety: <strong>{activeProduct.variety}</strong></span>
                )}
              </div>
              <span className="font-semibold text-emerald-800">
                {visibleRecords.length} Recorded Order{visibleRecords.length === 1 ? '' : 's'}
              </span>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-[#9CA3AF] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-xs">
                <thead className="sticky top-0 z-10">
                  {/* Row 1 Headers */}
                  <tr>
                    <th
                      rowSpan={2}
                      className="border border-[#9CA3AF] bg-[#E8F0EA] px-2 py-1.5 text-center font-bold text-[#374151] w-10"
                    >
                      #
                    </th>

                    {/* Show Product Column when viewing All Products */}
                    {activeTab === 'OVERVIEW' && (
                      <th
                        rowSpan={2}
                        className="border border-[#9CA3AF] bg-[#E8F0EA] px-3 py-1.5 text-left font-bold text-[#374151]"
                      >
                        <span className="block">Product</span>
                        <span className="block text-[10px] text-gray-500">ID & Name</span>
                      </th>
                    )}

                    <th
                      rowSpan={2}
                      className="border border-[#9CA3AF] bg-[#E8F0EA] px-2.5 py-1.5 text-center font-bold text-[#374151]"
                    >
                      <span className="block">Order</span>
                      <span className="block">Date</span>
                    </th>
                    <th
                      rowSpan={2}
                      className="border border-[#9CA3AF] bg-[#E8F0EA] px-2.5 py-1.5 text-center font-bold text-[#374151]"
                    >
                      <span className="block">Pickup</span>
                      <span className="block">Date</span>
                    </th>
                    <th
                      rowSpan={2}
                      className="border border-[#9CA3AF] bg-[#E8F0EA] px-2.5 py-1.5 text-center font-bold text-[#374151]"
                    >
                      <span className="block">Pickup</span>
                      <span className="block">Time</span>
                    </th>
                    <th
                      colSpan={2}
                      className="border border-[#9CA3AF] bg-[#D1FAE5] px-2 py-1.5 text-center font-bold text-[#065F46]"
                    >
                      Grade A
                    </th>
                    <th
                      colSpan={2}
                      className="border border-[#9CA3AF] bg-[#DBEAFE] px-2 py-1.5 text-center font-bold text-[#1E40AF]"
                    >
                      Grade B
                    </th>
                    <th
                      colSpan={2}
                      className="border border-[#9CA3AF] bg-[#FEF3C7] px-2 py-1.5 text-center font-bold text-[#92400E]"
                    >
                      Grade C
                    </th>
                    <th
                      className="border border-[#9CA3AF] bg-[#FEE2E2] px-2 py-1.5 text-center font-bold text-[#991B1B]"
                    >
                      Rejected
                    </th>
                    <th
                      rowSpan={2}
                      className="border border-[#9CA3AF] bg-[#E8F0EA] px-2.5 py-1.5 text-center font-bold text-[#374151]"
                    >
                      <span className="block">Amount</span>
                      <span className="block">₹</span>
                    </th>
                    <th
                      rowSpan={2}
                      className="border border-[#9CA3AF] bg-[#E8F0EA] px-2.5 py-1.5 text-center font-bold text-[#374151]"
                    >
                      <span className="block">Payment</span>
                      <span className="block">Status</span>
                    </th>
                  </tr>
                  {/* Row 2 Sub-Headers */}
                  <tr>
                    <th className="border border-[#9CA3AF] bg-[#D1FAE5] px-2 py-1 text-center text-[10px] font-semibold text-[#065F46]">
                      Qty (Kg)
                    </th>
                    <th className="border border-[#9CA3AF] bg-[#D1FAE5] px-2 py-1 text-center text-[10px] font-semibold text-[#065F46]">
                      Rate (₹)
                    </th>
                    <th className="border border-[#9CA3AF] bg-[#DBEAFE] px-2 py-1 text-center text-[10px] font-semibold text-[#1E40AF]">
                      Qty (Kg)
                    </th>
                    <th className="border border-[#9CA3AF] bg-[#DBEAFE] px-2 py-1 text-center text-[10px] font-semibold text-[#1E40AF]">
                      Rate (₹)
                    </th>
                    <th className="border border-[#9CA3AF] bg-[#FEF3C7] px-2 py-1 text-center text-[10px] font-semibold text-[#92400E]">
                      Qty (Kg)
                    </th>
                    <th className="border border-[#9CA3AF] bg-[#FEF3C7] px-2 py-1 text-center text-[10px] font-semibold text-[#92400E]">
                      Rate (₹)
                    </th>
                    <th className="border border-[#9CA3AF] bg-[#FEE2E2] px-2 py-1 text-center text-[10px] font-semibold text-[#991B1B]">
                      Qty (Kg)
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {!visibleRecords.length ? (
                    <tr>
                      <td colSpan={activeTab === 'OVERVIEW' ? 12 : 11} className="py-12 text-center text-gray-400 border border-[#9CA3AF]">
                        <FileSpreadsheet className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                        <p className="font-medium">No earning statement records found for this product.</p>
                      </td>
                    </tr>
                  ) : (
                    visibleRecords.map((row, idx) => {
                      const isPaid = isOrderPaid(row);
                      const zebra = idx % 2 === 0 ? 'bg-white' : 'bg-[#F9FAFB]';

                      return (
                        <tr
                          key={row.id || idx}
                          onClick={() => setInspectRecord(row)}
                          className={`group cursor-pointer hover:bg-[#ECFDF5] transition-colors ${zebra}`}
                          title="Click to view detailed receipt"
                        >
                          {/* # Index */}
                          <td className="border border-[#9CA3AF] px-2 py-2 text-center font-mono text-[11px] text-gray-400">
                            {idx + 1}
                          </td>

                          {/* Product Info (shown when on All Products view) */}
                          {activeTab === 'OVERVIEW' && (
                            <td className="border border-[#9CA3AF] px-3 py-2 text-left whitespace-nowrap">
                              <p className="font-bold text-gray-900">{row.productName}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {row.productId && (
                                  <span className="font-mono text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                                    {row.productId}
                                  </span>
                                )}
                                {row.variety && (
                                  <span className="text-[10px] text-gray-500">{row.variety}</span>
                                )}
                              </div>
                            </td>
                          )}

                          {/* Order Date with Day */}
                          <td className="border border-[#9CA3AF] px-2 py-2 text-center whitespace-nowrap">
                            <span className="block font-medium text-gray-900">{shortDate(row.orderDate)}</span>
                            {weekdayName(row.orderDate) && (
                              <span className="block text-[10px] text-gray-400 font-medium">
                                {weekdayName(row.orderDate)}
                              </span>
                            )}
                          </td>

                          {/* Pickup Date with Day */}
                          <td className="border border-[#9CA3AF] px-2 py-2 text-center whitespace-nowrap">
                            <span className="block font-medium text-gray-900">{shortDate(row.pickupDate)}</span>
                            {weekdayName(row.pickupDate) && (
                              <span className="block text-[10px] text-gray-400 font-medium">
                                {weekdayName(row.pickupDate)}
                              </span>
                            )}
                          </td>

                          {/* Pickup Time */}
                          <td className="border border-[#9CA3AF] px-2 py-2 text-center whitespace-nowrap text-gray-700 font-mono">
                            {formatTime12h(row.pickupTime)}
                          </td>

                          {/* Grade A Qty & Rate */}
                          <td className="border border-[#9CA3AF] px-2 py-2 text-center font-bold text-gray-900">
                            {row.grades['Grade A'].qty > 0 ? (
                              <span>{Number(row.grades['Grade A'].qty).toLocaleString('en-IN')}</span>
                            ) : (
                              <span className="text-gray-300 font-semibold">×</span>
                            )}
                          </td>
                          <td className="border border-[#9CA3AF] px-2 py-2 text-center text-gray-800">
                            {row.grades['Grade A'].qty > 0 && row.grades['Grade A'].rate > 0 ? (
                              <span>{Number(row.grades['Grade A'].rate).toLocaleString('en-IN')}</span>
                            ) : (
                              <span className="text-gray-300 font-semibold">×</span>
                            )}
                          </td>

                          {/* Grade B Qty & Rate */}
                          <td className="border border-[#9CA3AF] px-2 py-2 text-center font-bold text-gray-900">
                            {row.grades['Grade B'].qty > 0 ? (
                              <span>{Number(row.grades['Grade B'].qty).toLocaleString('en-IN')}</span>
                            ) : (
                              <span className="text-gray-300 font-semibold">×</span>
                            )}
                          </td>
                          <td className="border border-[#9CA3AF] px-2 py-2 text-center text-gray-800">
                            {row.grades['Grade B'].qty > 0 && row.grades['Grade B'].rate > 0 ? (
                              <span>{Number(row.grades['Grade B'].rate).toLocaleString('en-IN')}</span>
                            ) : (
                              <span className="text-gray-300 font-semibold">×</span>
                            )}
                          </td>

                          {/* Grade C Qty & Rate */}
                          <td className="border border-[#9CA3AF] px-2 py-2 text-center font-bold text-gray-900">
                            {row.grades['Grade C'].qty > 0 ? (
                              <span>{Number(row.grades['Grade C'].qty).toLocaleString('en-IN')}</span>
                            ) : (
                              <span className="text-gray-300 font-semibold">×</span>
                            )}
                          </td>
                          <td className="border border-[#9CA3AF] px-2 py-2 text-center text-gray-800">
                            {row.grades['Grade C'].qty > 0 && row.grades['Grade C'].rate > 0 ? (
                              <span>{Number(row.grades['Grade C'].rate).toLocaleString('en-IN')}</span>
                            ) : (
                              <span className="text-gray-300 font-semibold">×</span>
                            )}
                          </td>

                          {/* Rejected Qty */}
                          <td className="border border-[#9CA3AF] px-2 py-2 text-center font-bold">
                            {row.rejectedTotal > 0 ? (
                              <span className="text-rose-600 font-bold">{Number(row.rejectedTotal).toLocaleString('en-IN')}</span>
                            ) : (
                              <span className="text-gray-300 font-semibold">×</span>
                            )}
                          </td>

                          {/* Amount ₹ */}
                          <td className="border border-[#9CA3AF] px-2.5 py-2 text-right whitespace-nowrap font-extrabold text-[#217346]">
                            {row.amount > 0 ? (
                              <span>₹{Number(row.amount).toLocaleString('en-IN')}</span>
                            ) : (
                              <span className="text-gray-300 font-semibold">×</span>
                            )}
                          </td>

                          {/* Payment Status */}
                          <td className="border border-[#9CA3AF] px-2 py-2 text-center whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                              isPaid
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}>
                              {row.paymentStatus || 'Pending'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* Total Footer Row (Farmer App Pinkish / Summary Row) */}
                {visibleRecords.length > 0 && (
                  <tfoot>
                    <tr className="bg-[#FCE7F3] font-bold text-gray-900">
                      <td
                        colSpan={activeTab === 'OVERVIEW' ? 5 : 4}
                        className="border border-[#9CA3AF] px-3 py-2 text-left font-bold text-xs uppercase tracking-wide text-gray-800"
                      >
                        Total
                      </td>
                      {/* Grade A Total Qty & Rate */}
                      <td className="border border-[#9CA3AF] px-2 py-2 text-center font-bold text-emerald-800">
                        {tableTotals.gradeAQty > 0 ? (
                          `${Number(tableTotals.gradeAQty).toLocaleString('en-IN')} Kg`
                        ) : (
                          '×'
                        )}
                      </td>
                      <td className="border border-[#9CA3AF] px-2 py-2 text-center text-gray-400">×</td>

                      {/* Grade B Total Qty & Rate */}
                      <td className="border border-[#9CA3AF] px-2 py-2 text-center font-bold text-sky-800">
                        {tableTotals.gradeBQty > 0 ? (
                          `${Number(tableTotals.gradeBQty).toLocaleString('en-IN')} Kg`
                        ) : (
                          '×'
                        )}
                      </td>
                      <td className="border border-[#9CA3AF] px-2 py-2 text-center text-gray-400">×</td>

                      {/* Grade C Total Qty & Rate */}
                      <td className="border border-[#9CA3AF] px-2 py-2 text-center font-bold text-amber-800">
                        {tableTotals.gradeCQty > 0 ? (
                          `${Number(tableTotals.gradeCQty).toLocaleString('en-IN')} Kg`
                        ) : (
                          '×'
                        )}
                      </td>
                      <td className="border border-[#9CA3AF] px-2 py-2 text-center text-gray-400">×</td>

                      {/* Rejected Total Qty */}
                      <td className="border border-[#9CA3AF] px-2 py-2 text-center font-bold text-rose-700">
                        {tableTotals.rejected > 0 ? (
                          `${Number(tableTotals.rejected).toLocaleString('en-IN')} Kg`
                        ) : (
                          '×'
                        )}
                      </td>

                      {/* Total Amount */}
                      <td className="border border-[#9CA3AF] px-2.5 py-2 text-right font-black text-sm text-[#217346]">
                        ₹{Number(tableTotals.totalAmt).toLocaleString('en-IN')}
                      </td>

                      {/* Payment Status Blank in Total */}
                      <td className="border border-[#9CA3AF] px-2 py-2 text-center text-gray-400">—</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. Detailed Receipt Modal */}
      {inspectRecord && (
        <EarningReceiptModal
          record={inspectRecord}
          onClose={() => setInspectRecord(null)}
          farmer={farmer}
        />
      )}
    </div>
  );
}

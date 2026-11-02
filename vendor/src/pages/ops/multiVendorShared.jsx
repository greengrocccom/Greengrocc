import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Package } from 'lucide-react';
import opsApi from '../../api/opsApi';

export function PendingDarkStoreRequestsBanner() {
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let alive = true;
    opsApi
      .list('dark-store-requests', { status: 'Pending' })
      .then((res) => alive && setPending(res.stats?.pending || 0))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!pending) return null;
  return (
    <Link
      to="/dark-store-requests"
      className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
    >
      <ClipboardList className="h-4 w-4 shrink-0" />
      {pending} dark store request{pending === 1 ? '' : 's'} waiting for approval
      <span className="ml-auto text-xs font-semibold underline">Review</span>
    </Link>
  );
}

export function PendingProductRequestsBanner() {
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let alive = true;
    opsApi
      .list('vendor-product-requests', { status: 'Pending' })
      .then((res) => alive && setPending(res.stats?.pending || 0))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!pending) return null;
  return (
    <Link
      to="/vendor-product-requests"
      className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
    >
      <Package className="h-4 w-4 shrink-0 text-emerald-700" />
      <span>
        <strong>{pending}</strong> collection centre product request{pending === 1 ? '' : 's'} waiting for approval
      </span>
      <span className="ml-auto text-xs font-semibold underline">Review Product Requests</span>
    </Link>
  );
}

export const DOCUMENT_TYPES = [
  { type: 'aadhaar', label: 'Owner Aadhaar Card', short: 'Aadhaar' },
  { type: 'pan', label: 'PAN Card', short: 'PAN' },
  { type: 'gst', label: 'GST Certificate', short: 'GST' },
  { type: 'shop_licence', label: 'Shop / Trade Licence', short: 'Licence' },
  { type: 'bank', label: 'Bank Passbook / Cancelled Cheque', short: 'Bank' },
  { type: 'owner_photo', label: 'Owner Photo', short: 'Photo' },
];
export const DOC_SHORT = Object.fromEntries(DOCUMENT_TYPES.map((d) => [d.type, d.short]));

const STATUS_STYLES = {
  Active: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  Pending: 'bg-amber-50 text-amber-700 ring-amber-100',
  Inactive: 'bg-slate-100 text-slate-600 ring-slate-200',
  Suspended: 'bg-rose-50 text-rose-700 ring-rose-100',
};

export function StatusPill({ status }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
        STATUS_STYLES[status] || STATUS_STYLES.Inactive
      }`}
    >
      {status || '—'}
    </span>
  );
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// The tab must be opened synchronously inside the click handler, otherwise popup blockers stop it.
export async function openVendorDocument(vendorId, doc) {
  const tab = window.open('', '_blank');
  try {
    const res = await opsApi.get(`vendors/${vendorId}/documents/${doc.id}`);
    const blob = await (await fetch(res.data.fileUrl)).blob();
    const url = URL.createObjectURL(blob);
    if (tab) tab.location.href = url;
    else window.location.assign(url);
  } catch (err) {
    tab?.close();
    throw err;
  }
}

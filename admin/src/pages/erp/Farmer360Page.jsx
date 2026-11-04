import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  Edit3,
  FileText,
  Landmark,
  Leaf,
  Loader2,
  MapPin,
  Package,
  Phone,
  ShoppingCart,
  Tractor,
  X,
} from 'lucide-react';
import erpApi from '../../api/erpApi';
import { BTN, PAGE_KICKER, PANEL } from '../../utils/ui';
import FarmerDocumentsPanel from './FarmerDocumentsPanel';
import FarmerEarningsSpreadsheet from './FarmerEarningsSpreadsheet';

const TABS = [
  'Overview',
  'Farm',
  'Crops',
  'Products',
  'Inventory',
  'Orders',
  'Earnings',
  'Documents',
];

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function when(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('en-IN');
}

function statusTone(value) {
  const v = String(value || '').toLowerCase();
  if (['approved', 'verified', 'active', 'completed', 'success', 'paid'].includes(v)) return 'green';
  if (['pending', 'in_progress', 'submitted', 'review', 'scheduled'].includes(v)) return 'amber';
  if (['rejected', 'failed', 'inactive', 'blocked', 'cancelled'].includes(v)) return 'rose';
  return 'slate';
}

function Pill({ children, tone = 'slate' }) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    rose: 'bg-rose-50 text-rose-700 ring-rose-200',
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${tones[tone] || tones.slate}`}
    >
      {children || '—'}
    </span>
  );
}

function pretty(value) {
  return String(value || '—')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function Empty({ label }) {
  return (
    <div className={`${PANEL} px-6 py-12 text-center text-sm text-slate-400`}>{label}</div>
  );
}

function extractGradeInventoryRows(source) {
  if (!Array.isArray(source)) return [];
  const rows = [];
  for (const item of source) {
    if (!item) continue;
    if (Array.isArray(item.grades) && item.grades.length > 0) {
      for (const g of item.grades) {
        const gName = g.grade || g.label || g.name || 'Grade A';
        const gStock = Number(g.stock ?? g.quantity ?? 0);
        rows.push({
          id: g.articleId || `${item.productId || item.id || ''}-${gName}`,
          articleId: g.articleId || item.articleId || '',
          productId: item.productId || item.id || '—',
          productName: item.productName || item.name || 'Product',
          variety: item.variety || 'Standard',
          grade: gName,
          stock: gStock,
          availableQuantity: gStock,
          unit: item.unit || 'Kg',
          status: item.status || 'Active',
        });
      }
    } else {
      rows.push({
        id: item.articleId || item.id || item.productId,
        productId: item.productId || item.id || '—',
        productName: item.productName || item.name || 'Product',
        variety: item.variety || 'Standard',
        grade: item.grade || 'Grade A',
        stock: Number(item.availableQuantity ?? item.stock ?? 0),
        availableQuantity: Number(item.availableQuantity ?? item.stock ?? 0),
        unit: item.unit || 'Kg',
        status: item.status || 'Active',
      });
    }
  }
  return rows;
}

function getGradeStock(product, gradeLetter) {
  if (!product) return 0;
  const target = String(gradeLetter).toUpperCase().trim();
  if (Array.isArray(product.grades) && product.grades.length > 0) {
    const match = product.grades.find((g) => {
      const gStr = String(g.grade || g.label || g.name || '').toUpperCase().trim();
      return (
        gStr === target ||
        gStr === `GRADE ${target}` ||
        gStr.endsWith(` ${target}`) ||
        gStr.includes(target)
      );
    });
    if (match) return Number(match.stock ?? match.quantity ?? 0);
  }
  const pGrade = String(product.grade || '').toUpperCase().trim();
  if (pGrade.includes(target)) {
    return Number(product.availableQuantity ?? product.stock ?? 0);
  }
  return 0;
}

function Table({ columns, rows, rowKey }) {
  if (!rows?.length) return <Empty label="No records" />;
  return (
    <div className={`${PANEL} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/80">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 ${
                    col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={rowKey(row, index)}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-2.5 text-slate-700 ${
                      col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {col.render ? col.render(row) : row[col.key] || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, value, className = '' }) {
  return (
    <div className={`rounded-xl bg-slate-50 px-3 py-2.5 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 break-words text-sm font-medium text-slate-800">{value || '—'}</p>
    </div>
  );
}

function Section({ title, children, action }) {
  return (
    <section className={`${PANEL} p-4`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function Farmer360Page() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Overview');
  const [meetings, setMeetings] = useState([]);
  const [editingBank, setEditingBank] = useState(false);
  const [bankSubmitting, setBankSubmitting] = useState(false);
  const [bankForm, setBankForm] = useState({
    accountHolder: '',
    bankName: '',
    accountNumber: '',
    ifsc: '',
    branch: '',
    accountType: 'Savings',
    upiId: '',
  });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    erpApi
      .farmer(id)
      .then((res) => {
        if (alive) {
          setData(res.data);
        }
      })
      .catch((err) => alive && setError(err.response?.data?.message || 'Farmer not found'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  const reload = () => erpApi.farmer(id).then((res) => setData(res.data));

  const handleDocumentUpdated = (reviewedDoc, shouldReload = false) => {
    if (reviewedDoc && typeof reviewedDoc === 'object') {
      setData((prev) => {
        if (!prev) return prev;
        const nextDocs = (prev.documents || []).map((d) => {
          if (
            (reviewedDoc.id && d.id === reviewedDoc.id) ||
            (reviewedDoc.type && d.type === reviewedDoc.type) ||
            (reviewedDoc._id && d._id === reviewedDoc._id)
          ) {
            return { ...d, ...reviewedDoc };
          }
          return d;
        });
        const bankDoc = nextDocs.find((d) => d.type === 'bank');
        let nextBankStatus = prev.farmer?.bankStatus;
        if (bankDoc?.status === 'Approved') nextBankStatus = 'VERIFIED';
        else if (bankDoc?.status === 'Rejected') nextBankStatus = 'REJECTED';

        const requiredTypes = ['aadhaar', 'pan', 'address_proof', 'bank'];
        const allApproved = requiredTypes.every(
          (t) => nextDocs.find((d) => d.type === t)?.status === 'Approved'
        );
        const anyRejected = requiredTypes.some(
          (t) => nextDocs.find((d) => d.type === t)?.status === 'Rejected'
        );
        let nextKycStatus = prev.farmer?.kycStatus;
        if (allApproved) nextKycStatus = 'APPROVED';
        else if (anyRejected) nextKycStatus = 'REJECTED';

        return {
          ...prev,
          documents: nextDocs,
          farmer: {
            ...prev.farmer,
            bankStatus: nextBankStatus,
            bankVerificationStatus: nextBankStatus,
            kycStatus: nextKycStatus,
          },
        };
      });
    }

    if (shouldReload) {
      reload();
    }
  };

  const farmer = data?.farmer || {};

  const openBankEdit = () => {
    const b = farmer.bank || farmer.bankAccount || {};
    setBankForm({
      accountHolder: b.accountHolder || farmer.name || farmer.fullName || '',
      bankName: b.bankName || '',
      accountNumber: b.accountNumber || '',
      ifsc: b.ifsc || '',
      branch: b.branch || '',
      accountType: b.accountType || 'Savings',
      upiId: b.upiId || '',
    });
    setEditingBank(true);
  };

  const saveBankDetails = async (e) => {
    e.preventDefault();
    setBankSubmitting(true);
    try {
      await erpApi.update('farmers', farmer.farmerId || id, { bank: bankForm });
      await reload();
      setEditingBank(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update bank details');
    } finally {
      setBankSubmitting(false);
    }
  };
  const photos = farmer.farmPhotos || [];
  const videos = farmer.farmVideos || [];
  const documents = useMemo(() => data?.documents || [], [data]);
  const pendingDocs = documents.filter((d) => d.status === 'Pending').length;

  const stats = useMemo(() => {
    if (!data) return [];
    return [
      { label: 'Farms', value: data.farms?.length || 0, icon: Tractor },
      { label: 'Crops', value: data.crops?.length || 0, icon: Leaf },
      { label: 'Products', value: data.products?.length || 0, icon: Package },
      { label: 'Orders', value: data.orders?.length || 0, icon: ShoppingCart },
      { label: 'Documents', value: documents.length, icon: FileText },
      { label: 'Earnings', value: money(data.payments), icon: Banknote },
    ];
  }, [data, documents.length]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading farmer
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/erp/farmers" className={BTN}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to farmers
        </Link>
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      </div>
    );
  }

  const displayName = farmer.fullName || farmer.name || 'Farmer';
  const place = [farmer.village, farmer.taluka, farmer.district].filter(Boolean).join(' · ');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/erp/farmers" className={BTN}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Farmers
        </Link>
        <Link
          to={`/traceability?q=${encodeURIComponent(farmer.farmerId)}`}
          className={`${BTN} text-emerald-700`}
        >
          Full chain →
        </Link>
      </div>

      <div className={`${PANEL} overflow-hidden`}>
        <div className="bg-[var(--admin-secondary)] px-5 py-6 text-slate-900 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
            Farmer 360
          </p>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
            {farmer.profileImage || farmer.profilePhoto ? (
              <img
                src={farmer.profileImage || farmer.profilePhoto}
                alt=""
                className="h-24 w-24 object-cover ring-1 ring-slate-200"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center bg-[var(--admin-primary-soft)] text-3xl font-bold ring-1 ring-slate-200">
                {String(displayName).trim().charAt(0).toUpperCase() || 'F'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs text-slate-600">{farmer.farmerId}</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{displayName}</h1>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                {place ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {place}
                  </span>
                ) : null}
                {farmer.mobile ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    {farmer.mobile}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-white px-5 py-3 sm:px-6">
          <Pill tone={statusTone(farmer.kycStatus)}>KYC {pretty(farmer.kycStatus)}</Pill>
          <Pill tone={statusTone(farmer.bankStatus)}>Bank {pretty(farmer.bankStatus)}</Pill>
          <Pill tone={statusTone(farmer.status)}>{pretty(farmer.status)}</Pill>
          {farmer.managerName ? <Pill tone="slate">Manager · {farmer.managerName}</Pill> : null}
          {farmer.vendorName ? <Pill tone="slate">{farmer.vendorName}</Pill> : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className={`${PANEL} p-3.5`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-slate-500">{item.label}</p>
                <Icon className="h-3.5 w-3.5 text-emerald-600/70" />
              </div>
              <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">{item.value}</p>
            </div>
          );
        })}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-px">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setTab(name)}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-xs font-semibold transition ${
              tab === name
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {name}
            {name === 'Documents' && pendingDocs > 0 ? (
              <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                {pendingDocs}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="grid gap-4 md:grid-cols-2">
          <Section title="Profile">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Name" value={farmer.name} />
              <Field label="Mobile" value={farmer.mobile} />
              <Field label="Email" value={farmer.email} />
              <Field label="Gender" value={farmer.gender} />
              <Field label="Language" value={farmer.preferredLanguage} />
              <Field label="Joined" value={when(farmer.createdAt)} />
            </div>
          </Section>
          <Section title="Address">
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="Registration Address"
                value={
                  farmer.registeredAddress ||
                  [
                    farmer.village || farmer.address?.village,
                    farmer.taluka || farmer.address?.taluka,
                    farmer.district || farmer.address?.district,
                    farmer.state || farmer.address?.state,
                  ].filter(Boolean).join(', ') +
                  ((farmer.pincode || farmer.address?.pincode) ? ` - ${farmer.pincode || farmer.address?.pincode}` : '')
                }
                className="col-span-2"
              />
              <Field label="Village" value={farmer.village || farmer.address?.village} />
              <Field label="Taluka" value={farmer.taluka || farmer.address?.taluka} />
              <Field label="District" value={farmer.district || farmer.address?.district} />
              <Field label="State" value={farmer.state || farmer.address?.state} />
              <Field label="Pincode" value={farmer.pincode || farmer.address?.pincode} />
              <Field
                label="Farm Location"
                value={typeof farmer.farmLocation === 'string' ? farmer.farmLocation : (farmer.farm?.farmLocation || '—')}
              />
              <Field
                label="Farm GPS Address"
                value={farmer.farmAddress || farmer.farmGeo?.farmAddress}
                className="col-span-2"
              />
            </div>
          </Section>
          <Section
            title="Bank"
            action={
              <button
                type="button"
                onClick={openBankEdit}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <Edit3 className="h-3 w-3 text-emerald-600" />
                Edit
              </button>
            }
          >
            <div className="grid grid-cols-2 gap-2">
              <Field label="Holder" value={farmer.bank?.accountHolder || farmer.bankAccount?.accountHolder || farmer.name || farmer.fullName} />
              <Field label="Bank" value={farmer.bank?.bankName || farmer.bankAccount?.bankName} />
              <Field label="Account" value={farmer.bank?.accountNumber || farmer.bankAccount?.accountNumber} />
              <Field label="IFSC" value={farmer.bank?.ifsc || farmer.bankAccount?.ifsc} />
              <Field label="Branch" value={farmer.bank?.branch || farmer.bankAccount?.branch || 'Savner'} />
              <Field label="Account Type" value={farmer.bank?.accountType || farmer.bankAccount?.accountType || 'Savings'} />
              <Field label="Status" value={pretty(farmer.bankVerificationStatus || farmer.bankStatus || 'Pending')} />
              <Field label="UPI ID" value={farmer.bank?.upiId || farmer.bankAccount?.upiId || '—'} />
            </div>
          </Section>
          <Section title="Team">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Manager" value={farmer.managerName || data.manager?.name} />
              <Field label="Manager mobile" value={data.manager?.mobile} />
              <Field label="Vendor" value={farmer.vendorName} />
              <Field label="Vendor ID" value={farmer.vendorId} />
            </div>
          </Section>
        </div>
      )}

      {tab === 'Farm' && (
        <div className="space-y-3">
          {(data.farms || []).map((farm) => (
            <div key={farm.farmId || farm._id} className={`${PANEL} p-4`}>
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                  <Tractor className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-mono text-[11px] text-emerald-700">{farm.farmId}</p>
                  <p className="font-semibold text-slate-900">
                    {farm.farmName || farmer.farmName || 'Farm'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {[
                      farm.area || farmer.farm?.totalFarmArea,
                      farm.areaUnit || farmer.farm?.totalFarmAreaUnit,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    {' · '}
                    {farm.soilType || farmer.farm?.soilType || '—'}
                    {' · '}
                    {farm.irrigationType || farmer.farm?.irrigationType || '—'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {farm.address || farm.farmLocation || farmer.farmLocation || '—'}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {!data.farms?.length && <Empty label="No farm records yet" />}
          {(photos.length > 0 || videos.length > 0) && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {photos.map((url) => (
                <img key={url} src={url} alt="" className="h-28 w-full rounded-xl object-cover" />
              ))}
              {videos.map((url) => (
                <video key={url} src={url} controls className="h-28 w-full rounded-xl object-cover" />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'Crops' && (
        <Table
          rows={data.crops}
          rowKey={(row) => row.id || row.cropId}
          columns={[
            { key: 'cropId', label: 'Crop ID', render: (row) => row.cropId || row.id },
            { key: 'cropName', label: 'Crop' },
            { key: 'variety', label: 'Variety' },
            {
              key: 'area',
              label: 'Area',
              render: (row) => `${row.area || 0} ${row.areaUnit || ''}`.trim(),
            },
            {
              key: 'estimatedQuantity',
              label: 'Est. qty',
              render: (row) =>
                `${row.estimatedQuantity || row.expectedProduction || 0} ${row.unit || ''}`.trim(),
            },
            {
              key: 'status',
              label: 'Status',
              render: (row) => <Pill tone={statusTone(row.status)}>{pretty(row.status)}</Pill>,
            },
            { key: 'sowingDate', label: 'Sowing' },
            { key: 'expectedHarvestDate', label: 'Harvest' },
          ]}
        />
      )}

      {tab === 'Products' && (
        <Table
          rows={data.products}
          rowKey={(row) => row.productId || row.id || row._id}
          columns={[
            {
              key: 'productId',
              label: 'Product ID',
              render: (row) => (
                <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {row.productId || row.id}
                </span>
              ),
            },
            {
              key: 'name',
              label: 'Name',
              render: (row) => (
                <div>
                  <p className="font-semibold text-slate-900">{row.productName || row.name}</p>
                  {row.variety && <p className="text-xs text-slate-500">Variety: {row.variety}</p>}
                </div>
              ),
            },
            { key: 'cropName', label: 'Crop', render: (row) => row.cropName || '—' },
            {
              key: 'status',
              label: 'Status',
              render: (row) => <Pill tone={statusTone(row.status)}>{pretty(row.status)}</Pill>,
            },
          ]}
        />
      )}

      {tab === 'Inventory' && (
        <div className="space-y-6">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Current Stock in Hand</h3>
              <span className="text-xs text-slate-500 font-medium">Live Stock by Grade</span>
            </div>
            <Table
              rows={data.products?.length ? data.products : (data.inventory || [])}
              rowKey={(row) => row.id || row.productId || row._id}
              columns={[
                {
                  key: 'productId',
                  label: 'Product ID',
                  render: (row) => (
                    <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {row.productId || row.id || '—'}
                    </span>
                  ),
                },
                {
                  key: 'productName',
                  label: 'Product Name',
                  render: (row) => <span className="font-bold text-slate-900">{row.productName || row.name}</span>,
                },
                {
                  key: 'variety',
                  label: 'Variety',
                  render: (row) => <span className="text-slate-600">{row.variety || 'Standard'}</span>,
                },
                {
                  key: 'gradeA',
                  label: 'Grade A',
                  align: 'center',
                  render: (row) => {
                    const stock = getGradeStock(row, 'A');
                    return stock > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {Number(stock).toLocaleString('en-IN')} {row.unit || 'Kg'}
                      </span>
                    ) : (
                      <span className="text-gray-300 font-medium">—</span>
                    );
                  },
                },
                {
                  key: 'gradeB',
                  label: 'Grade B',
                  align: 'center',
                  render: (row) => {
                    const stock = getGradeStock(row, 'B');
                    return stock > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                        {Number(stock).toLocaleString('en-IN')} {row.unit || 'Kg'}
                      </span>
                    ) : (
                      <span className="text-gray-300 font-medium">—</span>
                    );
                  },
                },
                {
                  key: 'gradeC',
                  label: 'Grade C',
                  align: 'center',
                  render: (row) => {
                    const stock = getGradeStock(row, 'C');
                    return stock > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {Number(stock).toLocaleString('en-IN')} {row.unit || 'Kg'}
                      </span>
                    ) : (
                      <span className="text-gray-300 font-medium">—</span>
                    );
                  },
                },
                {
                  key: 'totalStock',
                  label: 'Total Stock',
                  align: 'right',
                  render: (row) => {
                    const stockA = getGradeStock(row, 'A');
                    const stockB = getGradeStock(row, 'B');
                    const stockC = getGradeStock(row, 'C');
                    const total = Number(row.stock ?? row.availableQuantity ?? (stockA + stockB + stockC));
                    return (
                      <span className="font-extrabold text-[#217346]">
                        {Number(total).toLocaleString('en-IN')}{' '}
                        <span className="text-xs font-normal text-slate-500">{row.unit || 'Kg'}</span>
                      </span>
                    );
                  },
                },
                {
                  key: 'status',
                  label: 'Status',
                  align: 'right',
                  render: (row) => <Pill tone={statusTone(row.status)}>{pretty(row.status)}</Pill>,
                },
              ]}
            />
          </div>
          <div>
            <h3 className="mb-3 text-base font-semibold text-slate-900">Stock Movements & Log</h3>
            <Table
              rows={data.stockHistory}
              rowKey={(row) => row.id || row._id}
              columns={[
                { key: 'at', label: 'When', render: (row) => when(row.at || row.createdAt) },
                {
                  key: 'productName',
                  label: 'Product',
                  render: (row) => (
                    <div>
                      <span>{row.productName || 'Produce'}</span>
                      {row.productId && <p className="font-mono text-[10px] text-slate-400">{row.productId}</p>}
                    </div>
                  ),
                },
                { key: 'action', label: 'Action' },
                {
                  key: 'changedQuantity',
                  label: 'Change',
                  render: (row) => (
                    <span className={Number(row.changedQuantity) > 0 ? 'text-emerald-700 font-semibold' : ''}>
                      {Number(row.changedQuantity) > 0 ? `+${row.changedQuantity}` : row.changedQuantity}
                    </span>
                  ),
                },
                { key: 'newStock', label: 'New stock' },
                { key: 'reason', label: 'Reason' },
              ]}
            />
          </div>
        </div>
      )}

      {tab === 'Orders' && (
        <Table
          rows={data.orders}
          rowKey={(row) => row.orderId || row.id}
          columns={[
            { key: 'orderId', label: 'Order ID', render: (row) => <span className="font-mono text-xs">{row.orderId || row.id}</span> },
            {
              key: 'productId',
              label: 'Product ID',
              render: (row) =>
                row.productId ? (
                  <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {row.productId}
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                ),
            },
            {
              key: 'productName',
              label: 'Product',
              render: (row) => <span className="font-semibold text-slate-900">{row.productName || row.name || 'Farm Produce'}</span>,
            },
            {
              key: 'totalQuantity',
              label: 'Qty',
              render: (row) => `${Number(row.totalQuantity || row.orderedQuantity || 0).toLocaleString('en-IN')} ${row.unit || 'Kg'}`.trim(),
            },
            {
              key: 'totalAmount',
              label: 'Amount',
              render: (row) => money(row.totalAmount || row.orderValue || row.amount),
            },
            {
              key: 'status',
              label: 'Status',
              render: (row) => <Pill tone={statusTone(row.status)}>{pretty(row.status)}</Pill>,
            },
            { key: 'paymentStatus', label: 'Payment', render: (row) => row.paymentStatus || 'Pending' },
            {
              key: 'createdAt',
              label: 'Date',
              render: (row) => when(row.orderDate || row.createdAt),
            },
          ]}
        />
      )}

      {tab === 'Earnings' && (
        <FarmerEarningsSpreadsheet
          orders={data.orders}
          earnings={data.earnings}
          products={data.products}
          farmer={farmer}
          title="Farmer Earning Statement"
        />
      )}

      {tab === 'Documents' && (
        <FarmerDocumentsPanel farmerId={farmer.farmerId || id} documents={documents} onUpdated={handleDocumentUpdated} />
      )}


      {editingBank && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-800">Edit Bank Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingBank(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={saveBankDetails} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-600">Account Holder</label>
                <input
                  type="text"
                  required
                  value={bankForm.accountHolder}
                  onChange={(e) => setBankForm((f) => ({ ...f, accountHolder: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none"
                  placeholder="e.g. Prajwal Kamdi"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-600">Bank Name</label>
                <input
                  type="text"
                  required
                  value={bankForm.bankName}
                  onChange={(e) => setBankForm((f) => ({ ...f, bankName: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none"
                  placeholder="e.g. State Bank of India"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-600">Account Number</label>
                  <input
                    type="text"
                    required
                    value={bankForm.accountNumber}
                    onChange={(e) => setBankForm((f) => ({ ...f, accountNumber: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none"
                    placeholder="e.g. 39876543210"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-600">IFSC Code</label>
                  <input
                    type="text"
                    required
                    value={bankForm.ifsc}
                    onChange={(e) => setBankForm((f) => ({ ...f, ifsc: e.target.value.toUpperCase() }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 uppercase focus:border-emerald-500 focus:outline-none"
                    placeholder="e.g. SBIN0000478"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-600">Branch</label>
                  <input
                    type="text"
                    value={bankForm.branch}
                    onChange={(e) => setBankForm((f) => ({ ...f, branch: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none"
                    placeholder="e.g. Savner"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-600">Account Type</label>
                  <select
                    value={bankForm.accountType}
                    onChange={(e) => setBankForm((f) => ({ ...f, accountType: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="Savings">Savings</option>
                    <option value="Current">Current</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-600">UPI ID (Optional)</label>
                <input
                  type="text"
                  value={bankForm.upiId}
                  onChange={(e) => setBankForm((f) => ({ ...f, upiId: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none"
                  placeholder="e.g. 9970255658@sbi"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBank(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bankSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  {bankSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Save Bank Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

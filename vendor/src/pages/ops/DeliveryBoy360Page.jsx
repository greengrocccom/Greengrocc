import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, MapPin } from 'lucide-react';
import opsApi from '../../api/opsApi';
import { PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL, TH } from '../../utils/ui';
import RiderSalaryPanel from '../../components/delivery/RiderSalaryPanel';

function when(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('en-IN');
}

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function pretty(value) {
  return String(value || '—').replaceAll('_', ' ');
}

function Badge({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    green: 'bg-emerald-50 text-[#217346]',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    blue: 'bg-sky-50 text-sky-700',
  };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone] || tones.slate}`}>{children}</span>;
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-800">{value || '—'}</p>
    </div>
  );
}

export default function DeliveryBoy360Page() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [meetings, setMeetings] = useState([]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      opsApi.list(`delivery/boys/${id}`),
      opsApi.list('hr/meetings').catch(() => ({ data: [] }))
    ])
      .then(([res, meetingsRes]) => {
        if (alive) {
          setData(res.data);
          const allMeetings = meetingsRes.data || [];
          setMeetings(allMeetings.filter(m => m.roles.includes('all') || m.roles.includes('delivery_boy')));
        }
      })
      .catch((err) => alive && setError(err.response?.data?.message || 'Delivery partner not found'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading rider
      </div>
    );
  }
  if (error) return <p className="text-rose-600">{error}</p>;

  const rider = data.rider || {};
  const manager = data.manager;
  const lat = rider.currentLocation?.lat;
  const lng = rider.currentLocation?.lng;
  const maps = Number.isFinite(lat) && Number.isFinite(lng) ? `https://www.google.com/maps?q=${lat},${lng}` : '';
  const selfie = rider.selfie?.url;
  const liveTone = rider.status === 'online' ? 'green' : rider.status === 'on_delivery' ? 'blue' : 'slate';
  const kycTone = rider.verificationStatus === 'approved' ? 'green' : rider.verificationStatus === 'pending' ? 'amber' : 'rose';
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'documents', label: 'Documents' },
    { id: 'bank', label: 'Bank' },
    { id: 'salary', label: 'Salary & incentives' },
    { id: 'orders', label: `Orders (${data.orders?.length || 0})` },
    { id: 'meetings', label: `Meetings (${meetings.length})` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-xs font-semibold">
        <Link to="/delivery-team?view=riders" className="inline-flex items-center gap-1 text-[#217346] hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Riders
        </Link>
        {manager?.id ? (
          <Link to={`/delivery-team/managers/${manager.id}`} className="text-slate-500 hover:text-[#217346] hover:underline">
            {manager.storeName || manager.name}
          </Link>
        ) : null}
      </div>

      <div className={`${PANEL} flex flex-col gap-4 p-4 sm:flex-row sm:items-center`}>
        {selfie ? (
          <img src={selfie} alt="" className="h-16 w-16 rounded-xl object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-emerald-50 text-xl font-bold text-[#217346]">
            {(rider.name || 'D').charAt(0)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className={PAGE_KICKER}>Delivery rider</p>
          <h1 className={PAGE_TITLE}>{rider.name}</h1>
          <p className={PAGE_SUB}>{rider.phone} · {[rider.area, rider.city].filter(Boolean).join(', ') || 'No area'}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={liveTone}>{pretty(rider.status)}</Badge>
          <Badge tone={kycTone}>KYC {pretty(rider.verificationStatus)}</Badge>
          <Badge tone={rider.onboardingComplete ? 'green' : 'amber'}>
            {rider.onboardingComplete ? 'Onboarded' : pretty(rider.onboardingStep || 'pending')}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Today', rider.todayOrderCount || 0],
          ['Delivered', rider.deliveredCount || 0],
          ['Wallet', money(rider.walletBalance)],
          ['Lifetime', money(rider.totalLifetimeEarnings)],
        ].map(([label, value]) => (
          <div key={label} className={`${PANEL} px-4 py-3`}>
            <p className="text-xs text-[#6B7280]">{label}</p>
            <p className="mt-1 text-lg font-bold text-[#1F2937]">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex rounded-xl border border-slate-200 bg-white p-1 w-fit">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              tab === item.id ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="grid gap-3 md:grid-cols-2">
          <section className={`${PANEL} p-4`}>
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Work</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Vehicle" value={pretty(rider.vehicleType)} />
              <Field label="Rating" value={`${rider.rating || 0} (${rider.totalRatingsCount || 0})`} />
              <Field label="Last seen" value={when(rider.lastSeenAt)} />
              <Field label="Online today" value={`${rider.todayOnlineMinutes || 0} min`} />
              <Field label="Joined" value={when(rider.createdAt)} />
              <Field label="Liveness" value={rider.livenessPassed ? 'Passed' : 'Not passed'} />
            </div>
          </section>
          <section className={`${PANEL} p-4`}>
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Assigned store</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Manager</p>
                {manager?.id ? (
                  <Link to={`/delivery-team/managers/${manager.id}`} className="mt-0.5 block text-sm font-medium text-[#217346] hover:underline">
                    {manager.name}
                  </Link>
                ) : (
                  <p className="mt-0.5 text-sm font-medium">Unassigned</p>
                )}
              </div>
              <Field label="Store" value={manager?.storeName} />
              <Field label="Store phone" value={manager?.phone} />
              <Field label="Store area" value={[manager?.area, manager?.city].filter(Boolean).join(', ')} />
            </div>
            {maps ? (
              <a href={maps} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#217346] hover:underline">
                <MapPin className="h-4 w-4" /> Live location
              </a>
            ) : (
              <p className="mt-4 text-xs text-slate-400">No live location ping</p>
            )}
          </section>
        </div>
      ) : null}

      {tab === 'documents' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(rider.documents || []).map((doc) => (
            <article key={doc.type} className={`${PANEL} p-4`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{pretty(doc.type)}</p>
              <p className="mt-1 text-sm font-semibold capitalize">{pretty(doc.status)}</p>
              {doc.url ? (
                <a href={doc.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-[#217346] hover:underline">Open file</a>
              ) : (
                <p className="mt-2 text-xs text-slate-400">Not uploaded</p>
              )}
            </article>
          ))}
          {!rider.documents?.length ? <p className="text-sm text-slate-400">No documents on file</p> : null}
        </div>
      ) : null}

      {tab === 'bank' ? (
        <section className={`${PANEL} p-4`}>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <Field label="Holder" value={rider.bankDetails?.accountHolderName} />
            <Field label="Bank" value={rider.bankDetails?.bankName} />
            <Field label="Account" value={rider.bankDetails?.accountNumber} />
            <Field label="IFSC" value={rider.bankDetails?.ifscCode} />
            <Field label="UPI" value={rider.bankDetails?.upiId} />
            <Field label="Wallet" value={money(rider.walletBalance)} />
          </div>
        </section>
      ) : null}

      {tab === 'salary' ? <RiderSalaryPanel riderId={id} /> : null}

      {tab === 'orders' ? (
        <div className={PANEL}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#F2F2F2]">
                <tr>
                  {['Order', 'Customer', 'Status', 'Assigned'].map((h) => (
                    <th key={h} className={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.orders || []).map((order) => (
                  <tr key={order.id} className="border-b border-slate-100 last:border-0 hover:bg-[#F9F9F9]">
                    <td className="px-3 py-2.5 font-semibold">{order.orderNumber}</td>
                    <td className="px-3 py-2.5">
                      {order.customerName}
                      <p className="text-xs text-slate-400">{order.customerPhone}</p>
                    </td>
                    <td className="px-3 py-2.5"><Badge>{pretty(order.status)}</Badge></td>
                    <td className="px-3 py-2.5 text-xs tabular-nums text-slate-500">{when(order.assignedAt || order.createdAt)}</td>
                  </tr>
                ))}
                {!data.orders?.length ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-10 text-center text-sm text-slate-400">No assigned orders</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'meetings' ? (
        <div className={PANEL}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#F2F2F2]">
                <tr>
                  {['Link', 'Meeting ID', 'Password', 'Note', 'Date'].map((h) => (
                    <th key={h} className={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {meetings.map((meeting) => (
                  <tr key={meeting._id} className="border-b border-slate-100 last:border-0 hover:bg-[#F9F9F9]">
                    <td className="px-3 py-2.5">
                      {meeting.link ? <a href={meeting.link} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline">{meeting.link}</a> : '—'}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">{meeting.meetingId || '—'}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{meeting.password || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-500">{meeting.note || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{new Date(meeting.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {!meetings.length ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-sm text-slate-400">No meetings scheduled</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

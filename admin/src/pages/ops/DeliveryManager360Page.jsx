import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, MapPin } from 'lucide-react';
import opsApi from '../../api/opsApi';
import { PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL, TH } from '../../utils/ui';
import AdminSlotsPanel from '../../components/delivery/AdminSlotsPanel';

function when(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('en-IN');
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

export default function DeliveryManager360Page() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('store');
  const [meetings, setMeetings] = useState([]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      opsApi.list(`delivery/managers/${id}`),
      opsApi.list('hr/meetings').catch(() => ({ data: [] }))
    ])
      .then(([res, meetingsRes]) => {
        if (alive) {
          setData(res.data);
          const allMeetings = meetingsRes.data || [];
          setMeetings(allMeetings.filter(m => m.roles.includes('all') || m.roles.includes('delivery_manager')));
        }
      })
      .catch((err) => alive && setError(err.response?.data?.message || 'Manager not found'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading store
      </div>
    );
  }
  if (error) return <p className="text-rose-600">{error}</p>;

  const manager = data.manager || {};
  const maps = Number.isFinite(manager.latitude) && Number.isFinite(manager.longitude)
    ? `https://www.google.com/maps?q=${manager.latitude},${manager.longitude}`
    : '';
  const tabs = [
    { id: 'store', label: 'Store' },
    { id: 'riders', label: `Riders (${data.riders?.length || 0})` },
    { id: 'slots', label: 'Slots' },
    { id: 'orders', label: `Orders (${data.orders?.length || 0})` },
    { id: 'meetings', label: `Meetings (${meetings.length})` },
  ];

  return (
    <div className="space-y-4">
      <Link to="/delivery-team" className="inline-flex items-center gap-1 text-xs font-semibold text-[#217346] hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> Delivery team
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={PAGE_KICKER}>Dark store</p>
          <h1 className={PAGE_TITLE}>{manager.storeName || manager.name}</h1>
          <p className={PAGE_SUB}>{manager.name} · {manager.phone || 'No phone'}</p>
        </div>
        <Badge tone={manager.isActive ? 'green' : 'slate'}>{manager.isActive ? 'Active' : 'Inactive'}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Riders', data.riders?.length || 0],
          ['Orders', manager.orderCount || data.orders?.length || 0],
          ['Radius', `${manager.deliveryRadiusKm || 0} km`],
          ['Area', manager.area || manager.city || '—'],
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

      {tab === 'store' ? (
        <div className="grid gap-3 md:grid-cols-2">
          <section className={`${PANEL} p-4`}>
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Manager</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Name" value={manager.name} />
              <Field label="Phone" value={manager.phone} />
              <Field label="Email" value={manager.email} />
              <Field label="Joined" value={when(manager.createdAt)} />
            </div>
          </section>
          <section className={`${PANEL} p-4`}>
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Location</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Address" value={manager.storeAddress} />
              <Field label="Area" value={[manager.area, manager.city, manager.state].filter(Boolean).join(', ')} />
              <Field label="Pincode" value={manager.pincode} />
              <Field label="Geofence" value={manager.geofenceRadius ? `${manager.geofenceRadius} m` : '—'} />
            </div>
            {maps ? (
              <a href={maps} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#217346] hover:underline">
                <MapPin className="h-4 w-4" /> Open map
              </a>
            ) : null}
          </section>
        </div>
      ) : null}

      {tab === 'riders' ? (
        <div className={PANEL}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#F2F2F2]">
                <tr>
                  {['Rider', 'Phone', 'Vehicle', 'Live', 'KYC'].map((h) => (
                    <th key={h} className={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.riders || []).map((rider) => (
                  <tr key={rider.id} className="border-b border-slate-100 last:border-0 hover:bg-[#F9F9F9]">
                    <td className="px-3 py-2.5">
                      <Link to={`/delivery-team/boys/${rider.id}`} className="font-semibold text-[#217346] hover:underline">{rider.name}</Link>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">{rider.phone}</td>
                    <td className="px-3 py-2.5 text-xs capitalize">{pretty(rider.vehicleType)}</td>
                    <td className="px-3 py-2.5"><Badge tone={rider.status === 'online' ? 'green' : rider.status === 'on_delivery' ? 'blue' : 'slate'}>{pretty(rider.status)}</Badge></td>
                    <td className="px-3 py-2.5"><Badge tone={rider.verificationStatus === 'approved' ? 'green' : rider.verificationStatus === 'pending' ? 'amber' : 'slate'}>{pretty(rider.verificationStatus)}</Badge></td>
                  </tr>
                ))}
                {!data.riders?.length ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-sm text-slate-400">No riders on this store</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'slots' ? <AdminSlotsPanel managerId={id} /> : null}

      {tab === 'orders' ? (
        <div className={PANEL}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#F2F2F2]">
                <tr>
                  {['Order', 'Customer', 'Status', 'Placed'].map((h) => (
                    <th key={h} className={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.orders || []).map((order) => (
                  <tr key={order.id} className="border-b border-slate-100 last:border-0 hover:bg-[#F9F9F9]">
                    <td className="px-3 py-2.5 font-semibold">{order.orderNumber}</td>
                    <td className="px-3 py-2.5 text-sm">
                      {order.customerName}
                      <p className="text-xs text-slate-400">{order.customerPhone}</p>
                    </td>
                    <td className="px-3 py-2.5"><Badge>{pretty(order.status)}</Badge></td>
                    <td className="px-3 py-2.5 text-xs tabular-nums text-slate-500">{when(order.createdAt)}</td>
                  </tr>
                ))}
                {!data.orders?.length ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-10 text-center text-sm text-slate-400">No orders yet</td>
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

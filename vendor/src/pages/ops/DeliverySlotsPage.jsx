import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import opsApi from '../../api/opsApi';
import { PAGE_KICKER, PAGE_SUB, PAGE_TITLE } from '../../utils/ui';
import AdminSlotsPanel from '../../components/delivery/AdminSlotsPanel';

export default function DeliverySlotsPage() {
  const [params, setParams] = useSearchParams();
  const [managers, setManagers] = useState([]);
  const [error, setError] = useState('');
  const managerId = params.get('store') || '';

  useEffect(() => {
    let alive = true;
    opsApi
      .list('delivery/team')
      .then((res) => {
        if (!alive) return;
        const list = res.data?.managers || [];
        setManagers(list);
        if (!managerId && list[0]?.id) setParams({ store: list[0].id }, { replace: true });
      })
      .catch((err) => alive && setError(err.response?.data?.message || 'Failed to load dark stores'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={PAGE_KICKER}>Operations</p>
          <h1 className={PAGE_TITLE}>Delivery slots</h1>
          <p className={PAGE_SUB}>
            Create time slots with a KM-wise or hour-wise incentive and assign them to delivery partners of a dark store.
          </p>
        </div>
        <select
          value={managerId}
          onChange={(e) => setParams({ store: e.target.value }, { replace: true })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800"
        >
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.storeName || m.name} {m.area ? `· ${m.area}` : ''}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {managerId ? <AdminSlotsPanel key={managerId} managerId={managerId} /> : null}
    </div>
  );
}

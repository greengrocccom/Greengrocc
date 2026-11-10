import { useEffect, useMemo, useState } from 'react';
import { Camera, Loader2, UserRound, X } from 'lucide-react';
import apiClient from '../../api/client';
import opsApi from '../../api/opsApi';
import { INPUT, PANEL } from '../../utils/ui';

function formatDay(iso) {
  const [year, month, day] = String(iso || '').split('-').map(Number);
  if (!year || !month || !day) return iso || 'Unknown day';
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

function reportTime(report) {
  return report.capturedAt
    ? `Captured ${formatTime(report.capturedAt)} IST`
    : `Submitted ${formatTime(report.createdAt)} IST`;
}

function ReportPhoto({ id, alt, className, onClick }) {
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl = '';
    let cancelled = false;
    setFailed(false);
    setSrc('');
    apiClient
      .get(`/admin-ops/staff-management/cleaning-reports/${id}/photo`, { responseType: 'blob' })
      .then((response) => {
        objectUrl = URL.createObjectURL(response.data);
        if (!cancelled) setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  if (failed) {
    return (
      <div className={`${className} flex items-center justify-center bg-slate-100 text-xs text-slate-500`}>
        Photo unavailable
      </div>
    );
  }
  if (!src) {
    return (
      <div className={`${className} flex items-center justify-center bg-slate-100 text-slate-400`}>
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} onClick={onClick} />;
}

export default function CleaningReportsPanel() {
  const [date, setDate] = useState('');
  const [staffId, setStaffId] = useState('');
  const [view, setView] = useState('day');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cleaners, setCleaners] = useState([]);
  const [reports, setReports] = useState([]);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const params = {};
    if (date) params.date = date;
    if (staffId) params.staffId = staffId;
    opsApi
      .list('staff-management/cleaning-reports', params)
      .then((response) => {
        if (cancelled) return;
        const payload = response.data || {};
        setCleaners(payload.cleaners || []);
        setReports(payload.reports || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'Could not load cleaning photos');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, staffId]);

  const dayGroups = useMemo(() => {
    const byDate = new Map();
    reports.forEach((report) => {
      const key = report.date || 'unknown';
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key).push(report);
    });
    return [...byDate.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, dayReports]) => {
        const byPerson = new Map();
        dayReports.forEach((report) => {
          const id = report.staff?.id || 'unknown';
          if (!byPerson.has(id)) byPerson.set(id, { staff: report.staff, reports: [] });
          byPerson.get(id).reports.push(report);
        });
        if (date) {
          cleaners.forEach((cleaner) => {
            if (staffId && cleaner.id !== staffId) return;
            if (!byPerson.has(cleaner.id)) {
              byPerson.set(cleaner.id, {
                staff: { id: cleaner.id, name: cleaner.name, phone: cleaner.phone },
                reports: [],
              });
            }
          });
        }
        return {
          date: day,
          people: [...byPerson.values()].sort((a, b) =>
            (a.staff?.name || '').localeCompare(b.staff?.name || '')
          ),
        };
      });
  }, [reports, cleaners, date, staffId]);

  const personGroups = useMemo(() => {
    const byPerson = new Map();
    const source = staffId ? cleaners.filter((cleaner) => cleaner.id === staffId) : cleaners;
    source.forEach((cleaner) => {
      byPerson.set(cleaner.id, { staff: cleaner, reports: [] });
    });
    reports.forEach((report) => {
      const id = report.staff?.id || 'unknown';
      if (!byPerson.has(id)) {
        byPerson.set(id, { staff: report.staff, reports: [] });
      }
      byPerson.get(id).reports.push(report);
    });
    return [...byPerson.values()].sort((a, b) => (a.staff?.name || '').localeCompare(b.staff?.name || ''));
  }, [reports, cleaners, staffId]);

  const missingOnSelectedDay = date
    ? cleaners.filter((cleaner) => {
        if (staffId && cleaner.id !== staffId) return false;
        return !reports.some((report) => report.staff?.id === cleaner.id);
      })
    : [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-950">
        Photos taken by cleaning staff with the staff app camera, stamped with the capture date and time. Filter a day or a person, then switch between day-wise and person-wise.
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-slate-600">
          Day
          <input
            type="date"
            className={`${INPUT} mt-1 w-auto`}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Person
          <select
            className={`${INPUT} mt-1 w-auto min-w-[180px]`}
            value={staffId}
            onChange={(event) => setStaffId(event.target.value)}
          >
            <option value="">All cleaners</option>
            {cleaners.map((cleaner) => (
              <option key={cleaner.id} value={cleaner.id}>
                {cleaner.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex rounded-lg border border-slate-200 bg-white p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setView('day')}
            className={`rounded-md px-3 py-1.5 ${view === 'day' ? 'bg-emerald-700 text-white' : 'text-slate-600'}`}
          >
            Day-wise
          </button>
          <button
            type="button"
            onClick={() => setView('person')}
            className={`rounded-md px-3 py-1.5 ${view === 'person' ? 'bg-emerald-700 text-white' : 'text-slate-600'}`}
          >
            Person-wise
          </button>
        </div>
        {(date || staffId) && (
          <button
            type="button"
            className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            onClick={() => {
              setDate('');
              setStaffId('');
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      )}

      {loading ? (
        <div className={`${PANEL} flex items-center justify-center py-16 text-slate-400`}>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading cleaning photos...
        </div>
      ) : view === 'day' ? (
        dayGroups.length === 0 && missingOnSelectedDay.length === 0 ? (
          <EmptyState date={date} />
        ) : (
          dayGroups.map((group) => (
            <section key={group.date} className={PANEL}>
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-bold text-slate-900">{formatDay(group.date)}</h2>
                <p className="text-xs text-slate-500">
                  {group.people.filter((person) => person.reports.length).length} cleaner
                  {group.people.filter((person) => person.reports.length).length === 1 ? '' : 's'} submitted
                </p>
              </div>
              <div className="divide-y divide-slate-100">
                {group.people.map((person) => (
                  <PersonRow
                    key={`${group.date}-${person.staff?.id}`}
                    staff={person.staff}
                    reports={person.reports}
                    onOpen={setPreview}
                  />
                ))}
              </div>
            </section>
          ))
        )
      ) : personGroups.length === 0 ? (
        <EmptyState date={date} />
      ) : (
        personGroups.map((person) => (
          <section key={person.staff?.id} className={PANEL}>
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                <UserRound className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">{person.staff?.name || 'Cleaner'}</h2>
                <p className="text-xs text-slate-500">
                  {person.staff?.phone || 'No phone'} · {person.staff?.roleLabel || 'Cleaning'}
                </p>
              </div>
            </div>
            {person.reports.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">
                {date ? `No photo on ${formatDay(date)}.` : 'No cleaning photos yet.'}
              </p>
            ) : (
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {person.reports.map((report) => (
                  <PhotoCard key={report.id} report={report} showPerson={false} onOpen={setPreview} />
                ))}
              </div>
            )}
          </section>
        ))
      )}

      {view === 'day' && !loading && missingOnSelectedDay.length > 0 && dayGroups.length === 0 && (
        <section className={PANEL}>
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-900">{formatDay(date)}</h2>
          </div>
          {missingOnSelectedDay.map((cleaner) => (
            <PersonRow
              key={cleaner.id}
              staff={cleaner}
              reports={[]}
              onOpen={setPreview}
            />
          ))}
        </section>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" onClick={() => setPreview(null)}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-slate-900">{preview.staff?.name || 'Cleaner'}</p>
                <p className="text-xs text-slate-500">
                  {formatDay(preview.date)} · {reportTime(preview)}
                </p>
              </div>
              <button type="button" onClick={() => setPreview(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ReportPhoto id={preview.id} alt="Cleaning photo" className="max-h-[70vh] w-full object-contain bg-slate-950" />
            <p className="px-4 py-3 text-sm text-slate-700">{preview.note}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ date }) {
  return (
    <div className={`${PANEL} py-16 text-center`}>
      <Camera className="mx-auto h-10 w-10 text-slate-300" />
      <h3 className="mt-3 text-sm font-semibold text-slate-800">No cleaning photos</h3>
      <p className="mt-1 text-xs text-slate-500">
        {date
          ? 'No cleaner has uploaded a photo for this day.'
          : 'Create a cleaning staff login, then the cleaner can upload a daily photo from the staff app.'}
      </p>
    </div>
  );
}

function PersonRow({ staff, reports, onOpen }) {
  return (
    <div className="px-4 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{staff?.name || 'Cleaner'}</p>
          <p className="text-xs text-slate-500">{staff?.phone || 'No phone'}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${reports.length ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {reports.length ? `${reports.length} photo${reports.length === 1 ? '' : 's'}` : 'Not submitted'}
        </span>
      </div>
      {reports.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
            <PhotoCard key={report.id} report={report} showPerson={false} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoCard({ report, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(report)}
      className="overflow-hidden rounded-xl border border-slate-200 text-left hover:border-emerald-300"
    >
      <ReportPhoto id={report.id} alt={`${report.staff?.name || 'Cleaner'} cleaning photo`} className="h-40 w-full object-cover" />
      <div className="px-3 py-2">
        <p className="text-[11px] font-semibold text-slate-500">{formatDay(report.date)} · {reportTime(report)}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-slate-700">{report.note}</p>
      </div>
    </button>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import opsApi from '../../api/opsApi';
import { BTN, BTN_PRIMARY, INPUT, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL } from '../../utils/ui';
import { personKey, Pill, pretty, HrBackButtons } from './hrShared';

const DAY_VIEW_KEY = 'greengrocc_hr_calendar_day_view';

const KIND_META = {
  holiday: {
    label: 'Holiday',
    tone: 'rose',
    bar: 'bg-rose-500',
    soft: 'bg-rose-50 text-rose-700',
    btn: 'border-rose-200 text-rose-700 hover:bg-rose-50',
    accent: 'text-rose-600',
  },
  announcement: {
    label: 'Announcement',
    tone: 'violet',
    bar: 'bg-violet-500',
    soft: 'bg-violet-50 text-violet-700',
    btn: 'border-violet-200 text-violet-700 hover:bg-violet-50',
    accent: 'text-violet-600',
  },
  note: {
    label: 'Note',
    tone: 'orange',
    bar: 'bg-orange-500',
    soft: 'bg-orange-50 text-orange-700',
    btn: 'border-orange-200 text-orange-700 hover:bg-orange-50',
    accent: 'text-orange-600',
  },
  shift: {
    label: 'Shift',
    tone: 'green',
    bar: 'bg-emerald-500',
    soft: 'bg-emerald-50 text-emerald-700',
    btn: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
    accent: 'text-emerald-600',
  },
};

const MESSAGE_KINDS = new Set(['holiday', 'announcement', 'note']);

function monthDays(month) {
  const [year, mo] = month.split('-').map(Number);
  const first = new Date(year, mo - 1, 1);
  const startPad = first.getDay();
  const count = new Date(year, mo, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let d = 1; d <= count; d += 1) cells.push(`${month}-${String(d).padStart(2, '0')}`);
  return cells;
}

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function shiftMonth(month, delta) {
  const [year, mo] = month.split('-').map(Number);
  const next = new Date(year, mo - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthTitle(month) {
  const [year, mo] = month.split('-').map(Number);
  return new Date(year, mo - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function datesOnOrBetween(from, to) {
  const start = String(from || '').slice(0, 10);
  const end = String(to || from || '').slice(0, 10);
  if (!start) return [];
  const out = [];
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime())) return [start];
  while (cursor <= last) {
    out.push(ymd(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function formatDay(date) {
  if (!date) return '';
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatShortDay(date) {
  if (!date) return '';
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

const emptyForm = {
  date: '',
  assignee: '',
  title: '',
  body: '',
  roleKey: 'all',
  status: 'published',
  startTime: '09:00',
  endTime: '18:00',
  shiftName: 'General',
  notes: '',
};

export default function HrCalendarPage() {
  const today = ymd(new Date());
  const [params, setParams] = useSearchParams();
  const roleKey = params.get('role') || '';
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [events, setEvents] = useState([]);
  const [roles, setRoles] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(today);
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [dayViewOpen, setDayViewOpen] = useState(() => {
    try {
      return localStorage.getItem(DAY_VIEW_KEY) !== '0';
    } catch {
      return true;
    }
  });

  const openRole = (value) => setParams(value ? { role: value } : {});

  const toggleDayView = () => {
    setDayViewOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(DAY_VIEW_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const load = async () => {
    setLoading(true);
    try {
      const requests = [opsApi.list('hr/roles'), opsApi.list('hr')];
      if (roleKey) requests.unshift(opsApi.list('hr/calendar', { month, roleKey }));
      const results = await Promise.all(requests);
      let cal = { data: [], roles: [] };
      let roleRows;
      let directory;
      if (roleKey) {
        [cal, roleRows, directory] = results;
      } else {
        [roleRows, directory] = results;
      }
      setEvents(cal.data || []);
      setRoles(roleRows.data?.length ? roleRows.data : cal.roles?.filter((r) => r.value !== 'all') || []);
      setPeople(directory.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load calendar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [month, roleKey]);

  const peopleForRole = useMemo(
    () => (roleKey === 'all' ? people : people.filter((p) => p.roleKey === roleKey)),
    [people, roleKey]
  );

  const byDate = useMemo(() => {
    const map = new Map();
    events.forEach((event) => {
      const days = datesOnOrBetween(event.date, event.toDate || event.date);
      days.forEach((day) => {
        if (!map.has(day)) map.set(day, []);
        map.get(day).push(event);
      });
    });
    return map;
  }, [events]);

  const dayEvents = byDate.get(selectedDate) || [];
  const monthEventCount = events.length;

  const openCreate = (kind, date = selectedDate) => {
    setEditing(null);
    setForm({
      ...emptyForm,
      date,
      roleKey: roleKey === 'all' ? 'all' : roleKey,
      status: 'published',
    });
    setModal(kind);
  };

  const selectDate = (date) => {
    setSelectedDate(date);
  };

  const openEdit = (item) => {
    const meta = item.meta || {};
    setEditing(item);
    setForm({
      ...emptyForm,
      date: item.date || selectedDate,
      assignee: meta.employeeType && meta.employeeId ? `${meta.employeeType}:${meta.employeeId}` : '',
      title: meta.title || item.title || '',
      body: meta.body || item.body || '',
      roleKey: item.roleKey || meta.roleKey || roleKey || 'all',
      status: meta.status === 'scheduled' || item.status === 'scheduled' ? 'scheduled' : 'published',
      startTime: meta.startTime || '09:00',
      endTime: meta.endTime || '18:00',
      shiftName: meta.shiftName || 'General',
      notes: meta.notes || '',
    });
    setModal(item.kind);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const publishMode = form.status === 'scheduled' ? 'scheduled' : 'published';
      if (modal === 'shift') {
        if (editing) {
          await opsApi.update('hr/shifts', editing.id, {
            date: form.date,
            startTime: form.startTime,
            endTime: form.endTime,
            shiftName: form.shiftName,
            notes: form.notes,
            roleKey: form.roleKey,
            status: publishMode,
          });
        } else {
          const [employeeType, ...rest] = form.assignee.split(':');
          const person = people.find((row) => personKey(row) === form.assignee);
          await opsApi.create('hr/shifts', {
            employeeId: rest.join(':'),
            employeeType,
            name: person?.name,
            role: person?.role,
            roleKey: person?.roleKey || form.roleKey,
            date: form.date,
            startTime: form.startTime,
            endTime: form.endTime,
            shiftName: form.shiftName,
            notes: form.notes,
            status: publishMode,
          });
        }
      } else if (MESSAGE_KINDS.has(modal)) {
        const payload = {
          title: form.title,
          body: form.body,
          roleKey: form.roleKey,
          category: modal,
          scheduledAt: form.date,
          status: publishMode,
        };
        if (editing) {
          await opsApi.update('hr/announcements', editing.id, payload);
        } else {
          await opsApi.create('hr/announcements', payload);
        }
      }
      setModal(null);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const removeEvent = async (item) => {
    if (!window.confirm(`Delete this ${KIND_META[item.kind]?.label || item.kind}?`)) return;
    try {
      const path = item.kind === 'shift' ? 'hr/shifts' : 'hr/announcements';
      await opsApi.remove(path, item.id);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not delete');
    }
  };

  const roleLabel = roleKey === 'all' ? 'All roles' : roles.find((r) => r.value === roleKey)?.label || pretty(roleKey);
  const announcementRoles = [{ value: 'all', label: 'All roles' }, ...roles.filter((r) => r.value !== 'all')];
  const metaFor = (kind) => KIND_META[kind] || KIND_META.note;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <HrBackButtons>
            {roleKey ? (
              <button type="button" className={BTN} onClick={() => openRole('')}>
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Roles
              </button>
            ) : null}
          </HrBackButtons>
          <p className={PAGE_KICKER}>HR Management</p>
          <h1 className={PAGE_TITLE}>{roleKey ? `${roleLabel}` : 'Calendar'}</h1>
          <p className={PAGE_SUB}>
            {roleKey
              ? 'Plan holidays, announcements, notes, and shifts for this team.'
              : 'Select a team to manage their calendar.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {roleKey ? (
            <>
              <button
                type="button"
                onClick={toggleDayView}
                className={BTN}
                title={dayViewOpen ? 'Hide day view' : 'Show day view'}
              >
                {dayViewOpen ? <EyeOff className="mr-1.5 h-4 w-4" /> : <Eye className="mr-1.5 h-4 w-4" />}
                {dayViewOpen ? 'Hide day view' : 'Show day view'}
              </button>
              <button type="button" onClick={load} className={BTN}>
                <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div>
      ) : null}

      {!roleKey ? (
        loading ? (
          <div className="flex justify-center py-20 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <button
              type="button"
              onClick={() => openRole('all')}
              className={`${PANEL} group p-5 text-left transition hover:border-emerald-300 hover:shadow-md`}
            >
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                  <CalendarDays className="h-4 w-4" />
                </span>
                <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:text-emerald-600" />
              </div>
              <p className="mt-4 text-sm font-medium text-slate-500">All roles</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{people.length}</p>
              <p className="mt-1 text-xs text-slate-400">people across teams</p>
            </button>
            {roles.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => openRole(item.value)}
                className={`${PANEL} group p-5 text-left transition hover:border-emerald-300 hover:shadow-md`}
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-lg bg-slate-50 p-2 text-slate-600">
                    <CalendarDays className="h-4 w-4" />
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:text-emerald-600" />
                </div>
                <p className="mt-4 text-sm font-medium text-slate-500">{item.label}</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  {item.count ?? people.filter((p) => p.roleKey === item.value).length}
                </p>
                <p className="mt-1 text-xs text-slate-400">team members</p>
              </button>
            ))}
          </div>
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <select
              className={`${INPUT} max-w-[240px]`}
              value={roleKey}
              onChange={(e) => openRole(e.target.value)}
            >
              <option value="all">All roles</option>
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              {Object.entries(KIND_META).map(([key, meta]) => (
                <span key={key} className="inline-flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${meta.bar}`} />
                  {meta.label}
                </span>
              ))}
            </div>
            <p className="ml-auto text-xs tabular-nums text-slate-400">
              {monthEventCount} event{monthEventCount === 1 ? '' : 's'} this month
            </p>
          </div>

          <div
            className={`grid gap-4 ${
              dayViewOpen ? 'xl:grid-cols-[minmax(0,1fr)_340px]' : 'grid-cols-1'
            }`}
          >
            <div className={`${PANEL} overflow-hidden`}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                    onClick={() => setMonth((m) => shiftMonth(m, -1))}
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <h2 className="min-w-[160px] text-center text-base font-semibold text-slate-900">
                    {formatMonthTitle(month)}
                  </h2>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                    onClick={() => setMonth((m) => shiftMonth(m, 1))}
                    aria-label="Next month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`${BTN} h-9 min-h-0 px-3 text-xs`}
                    onClick={() => {
                      setMonth(today.slice(0, 7));
                      setSelectedDate(today);
                    }}
                  >
                    Today
                  </button>
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className={`${INPUT} h-9 max-w-[150px] py-1.5 text-xs`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/70">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div
                    key={d}
                    className="px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {loading ? (
                <div className="flex justify-center py-24 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-7 auto-rows-fr">
                  {monthDays(month).map((date, index) => {
                    const items = date ? byDate.get(date) || [] : [];
                    const isSelected = date === selectedDate;
                    const isToday = date === today;
                    return (
                      <button
                        key={date || `pad-${index}`}
                        type="button"
                        disabled={!date}
                        onClick={() => date && selectDate(date)}
                        className={`relative min-h-[110px] border-b border-r border-slate-100 p-2 text-left transition ${
                          !date
                            ? 'bg-slate-50/40'
                            : isSelected
                              ? 'bg-emerald-50/80'
                              : 'bg-white hover:bg-slate-50/80'
                        }`}
                      >
                        {date ? (
                          <>
                            <div className="mb-1.5 flex items-center justify-between">
                              <span
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                                  isToday
                                    ? 'bg-emerald-700 text-white'
                                    : isSelected
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'text-slate-700'
                                }`}
                              >
                                {Number(date.slice(-2))}
                              </span>
                              {items.length > 0 ? (
                                <span className="text-[10px] font-medium tabular-nums text-slate-400">
                                  {items.length}
                                </span>
                              ) : null}
                            </div>
                            <div className="space-y-1">
                              {items.slice(0, dayViewOpen ? 2 : 3).map((item) => {
                                const meta = metaFor(item.kind);
                                return (
                                  <div
                                    key={`${item.kind}-${item.id}`}
                                    className={`flex items-center gap-1.5 truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium ${meta.soft}`}
                                  >
                                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.bar}`} />
                                    <span className="truncate">{item.title}</span>
                                  </div>
                                );
                              })}
                              {items.length > (dayViewOpen ? 2 : 3) ? (
                                <p className="px-1 text-[10px] text-slate-400">
                                  +{items.length - (dayViewOpen ? 2 : 3)} more
                                </p>
                              ) : null}
                            </div>
                          </>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {dayViewOpen ? (
              <aside className={`${PANEL} flex max-h-[760px] min-h-[480px] flex-col overflow-hidden`}>
                <div className="border-b border-slate-100 px-4 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Day details
                      </p>
                      <h2 className="mt-1 text-lg font-semibold leading-snug text-slate-900">
                        {formatDay(selectedDate)}
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        {dayEvents.length} item{dayEvents.length === 1 ? '' : 's'} · {roleLabel}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      onClick={toggleDayView}
                      title="Hide day view"
                    >
                      <EyeOff className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="border-b border-slate-100 px-3 py-3">
                  <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Add to this day
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(KIND_META).map(([kind, meta]) => (
                      <button
                        key={kind}
                        type="button"
                        className={`inline-flex h-9 items-center justify-center gap-1 rounded-lg border bg-white text-xs font-semibold transition ${meta.btn}`}
                        onClick={() => openCreate(kind)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {meta.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                  {dayEvents.length === 0 ? (
                    <div className="flex h-full min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 text-center">
                      <CalendarDays className="mb-2 h-8 w-8 text-slate-300" />
                      <p className="text-sm font-medium text-slate-500">Nothing scheduled</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Use the buttons above to add a holiday, announcement, note, or shift.
                      </p>
                    </div>
                  ) : (
                    dayEvents.map((item) => {
                      const meta = metaFor(item.kind);
                      return (
                        <article
                          key={`${item.kind}-${item.id}`}
                          className="group rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300"
                        >
                          <div className="flex items-start gap-3">
                            <span className={`mt-1 h-10 w-1 shrink-0 rounded-full ${meta.bar}`} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Pill tone={meta.tone}>{meta.label}</Pill>
                                <span className="text-[11px] capitalize text-slate-400">
                                  {item.status === 'scheduled' ? 'Scheduled' : 'Published'}
                                </span>
                              </div>
                              <p className="mt-1.5 truncate text-sm font-semibold text-slate-900">
                                {item.title}
                              </p>
                              {item.body ? (
                                <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.body}</p>
                              ) : null}
                              {item.roleKey ? (
                                <p className="mt-1 text-[11px] text-slate-400">{pretty(item.roleKey)}</p>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 gap-0.5 opacity-70 transition group-hover:opacity-100">
                              <button
                                type="button"
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-emerald-700"
                                title="Edit"
                                onClick={() => openEdit(item)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                title="Delete"
                                onClick={() => removeEvent(item)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </aside>
            ) : (
              <div className={`${PANEL} flex flex-wrap items-center justify-between gap-3 px-4 py-3 xl:hidden`}>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{formatShortDay(selectedDate)}</p>
                  <p className="text-xs text-slate-500">
                    {dayEvents.length} item{dayEvents.length === 1 ? '' : 's'} selected
                  </p>
                </div>
                <button type="button" className={BTN} onClick={toggleDayView}>
                  <Eye className="mr-1.5 h-4 w-4" />
                  Open day view
                </button>
              </div>
            )}
          </div>

          {!dayViewOpen ? (
            <div className={`hidden ${PANEL} items-center justify-between gap-3 px-4 py-3 xl:flex`}>
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {formatShortDay(selectedDate)}
                </span>
                <p className="text-sm text-slate-500">
                  Day view is hidden · {dayEvents.length} item{dayEvents.length === 1 ? '' : 's'} on this date
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {Object.entries(KIND_META).map(([kind, meta]) => (
                  <button
                    key={kind}
                    type="button"
                    className={`inline-flex h-8 items-center gap-1 rounded-lg border bg-white px-2.5 text-xs font-semibold transition ${meta.btn}`}
                    onClick={() => openCreate(kind)}
                  >
                    <Plus className="h-3 w-3" />
                    {meta.label}
                  </button>
                ))}
                <button type="button" className={BTN} onClick={toggleDayView}>
                  <Eye className="mr-1.5 h-4 w-4" />
                  Show day view
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
          <form onSubmit={submit} className={`w-full max-w-lg ${PANEL} p-6 shadow-xl`}>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wider ${metaFor(modal).accent}`}>
                  {metaFor(modal).label}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">
                  {editing ? 'Edit' : 'Add'} {metaFor(modal).label.toLowerCase()}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModal(null);
                  setEditing(null);
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-semibold text-slate-600">
                Date
                <input
                  type="date"
                  required
                  className={`${INPUT} mt-1.5`}
                  value={form.date}
                  onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                />
              </label>

              <div>
                <p className="mb-2 text-xs font-semibold text-slate-600">Visibility</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, status: 'published' }))}
                    className={`rounded-xl border px-3 py-3 text-left transition ${
                      form.status === 'published'
                        ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">Publish now</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                      Visible instantly in app & panel
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, status: 'scheduled' }))}
                    className={`rounded-xl border px-3 py-3 text-left transition ${
                      form.status === 'scheduled'
                        ? 'border-amber-500 bg-amber-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">Schedule</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                      Goes live on the selected date
                    </p>
                  </button>
                </div>
              </div>

              {MESSAGE_KINDS.has(modal) ? (
                <>
                  <label className="block text-xs font-semibold text-slate-600">
                    Visible to role
                    <select
                      className={`${INPUT} mt-1.5`}
                      value={form.roleKey}
                      onChange={(e) => setForm((p) => ({ ...p, roleKey: e.target.value }))}
                    >
                      {announcementRoles.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    Title
                    <input
                      required
                      className={`${INPUT} mt-1.5`}
                      value={form.title}
                      onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                      placeholder={modal === 'holiday' ? 'e.g. Diwali holiday' : ''}
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    Message
                    <textarea
                      rows={3}
                      className={`${INPUT} mt-1.5`}
                      value={form.body}
                      onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
                    />
                  </label>
                </>
              ) : null}

              {modal === 'shift' ? (
                <>
                  {!editing ? (
                    <label className="block text-xs font-semibold text-slate-600">
                      Employee
                      <select
                        required
                        className={`${INPUT} mt-1.5`}
                        value={form.assignee}
                        onChange={(e) => setForm((p) => ({ ...p, assignee: e.target.value }))}
                      >
                        <option value="">Select</option>
                        {peopleForRole.map((person) => (
                          <option key={personKey(person)} value={personKey(person)}>
                            {person.name} · {person.role}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs font-semibold text-slate-600">
                      Start
                      <input
                        type="time"
                        className={`${INPUT} mt-1.5`}
                        value={form.startTime}
                        onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
                      />
                    </label>
                    <label className="block text-xs font-semibold text-slate-600">
                      End
                      <input
                        type="time"
                        className={`${INPUT} mt-1.5`}
                        value={form.endTime}
                        onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))}
                      />
                    </label>
                  </div>
                  <label className="block text-xs font-semibold text-slate-600">
                    Shift name
                    <input
                      className={`${INPUT} mt-1.5`}
                      value={form.shiftName}
                      onChange={(e) => setForm((p) => ({ ...p, shiftName: e.target.value }))}
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    Notes
                    <input
                      className={`${INPUT} mt-1.5`}
                      value={form.notes}
                      onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    />
                  </label>
                </>
              ) : null}
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                className={BTN}
                onClick={() => {
                  setModal(null);
                  setEditing(null);
                }}
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className={BTN_PRIMARY}>
                {saving ? 'Saving…' : form.status === 'scheduled' ? 'Schedule' : 'Publish now'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

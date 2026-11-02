import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, CalendarDays, Clock3, Loader2, Megaphone, Palmtree, RefreshCw, TrendingUp, UserPlus, UserRound, Users, Wallet } from 'lucide-react';
import opsApi from '../../api/opsApi';
import { BTN, PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL } from '../../utils/ui';
import { inr, HrBackButtons } from '../hr/hrShared';

const MODULES = [
  { to: '/hr-management/b2b-users', label: 'B2B User Management', text: 'Business clients, partners, and company profiles with multiple representatives', icon: Building2 },
  { to: '/hr-management/employees', label: 'Employees', text: 'Role-wise people, logins, and profiles', icon: UserRound },
  { to: '/hr-management/performance', label: 'Career & Appraisals', text: 'Promotions, salary increments, and employee performance logs', icon: TrendingUp },
  { to: '/hr-management/calendar', label: 'Calendar', text: 'Assign leave and schedule announcements', icon: CalendarDays },
  { to: '/hr-management/announcements', label: 'Announcements', text: 'Draft and publish by role', icon: Megaphone },
  { to: '/hr-management/leave', label: 'Leave', text: 'Requests and policies for every role', icon: Palmtree },
  { to: '/hr-management/payroll', label: 'Payroll', text: 'Payruns, payments, and taxes', icon: Wallet },
  { to: '/hr-management/recruitment', label: 'Recruitment', text: 'Vacancies, screening, interviews, CVs', icon: UserPlus },
  { to: '/hr-management/attendance', label: 'Attendance', text: 'Clock logs and role-wise shifts', icon: Clock3 },
];

export default function HrManagement() {
  const [stats, setStats] = useState(null);
  const [payroll, setPayroll] = useState(null);
  const [leaves, setLeaves] = useState(null);
  const [roles, setRoles] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'product_manager',
    password: 'Staff@123',
  });

  const load = async () => {
    setLoading(true);
    try {
      const month = new Date().toISOString().slice(0, 7);
      const [directory, pays, leaveRows, roleRows] = await Promise.all([
        opsApi.list('hr'),
        opsApi.list('hr/payroll', { month }).catch(() => ({ stats: {} })),
        opsApi.list('hr/leaves').catch(() => ({ stats: {} })),
        opsApi.list('hr/roles').catch(() => ({ data: [] })),
      ]);
      setPeople(directory.data || []);
      setStats(directory.stats || null);
      setPayroll(pays.stats || null);
      setLeaves(leaveRows.stats || null);
      const nextRoles = roleRows.data?.length ? roleRows.data : directory.roles || [];
      setRoles(nextRoles);
      if (nextRoles[0]?.value) {
        setForm((prev) => ({ ...prev, role: prev.role || nextRoles[0].value }));
      }
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load HR dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createStaff = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await opsApi.create('hr', form);
      setForm({ name: '', email: '', phone: '', role: form.role, password: 'Staff@123' });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create staff');
    }
  };

  const clock = async (person, action) => {
    try {
      await opsApi.create('hr/attendance', {
        action,
        employeeId: person.id,
        employeeType: person.employeeType,
        name: person.name,
        role: person.role,
      });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Attendance update failed');
    }
  };

  const toggleActive = async (person) => {
    if (person.employeeType !== 'staff') return;
    await opsApi.update('hr', person.id, { isActive: !person.isActive });
    await load();
  };

  const cards = [
    { label: 'People', value: stats?.total ?? 0, to: '/hr-management/employees' },
    { label: 'Clocked in', value: stats?.clockedIn ?? 0, to: '/hr-management/attendance' },
    { label: 'Open work', value: stats?.openWork ?? 0, to: '/hr-management/employees' },
    { label: 'Pending leave', value: leaves?.pending ?? 0, to: '/hr-management/leave' },
    { label: 'Payroll pending', value: inr(payroll?.pendingAmount || 0), to: '/hr-management/payroll' },
    { label: 'Monthly bill', value: inr(stats?.monthlySalaryBill || 0), to: '/hr-management/payroll' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <HrBackButtons fallback="/welcome" />
            <p className={PAGE_KICKER}>HR Management</p>
            <h1 className={PAGE_TITLE}>Dashboard</h1>
            <p className={PAGE_SUB}>People, leave, payroll, recruitment, attendance, and staff logins in one place.</p>
          </div>
        </div>
        <button type="button" onClick={load} className={BTN}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div> : null}

      {loading && !stats ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            {cards.map((card) => (
              <Link key={card.label} to={card.to} className={`${PANEL} px-4 py-3 hover:bg-slate-50`}>
                <p className="text-xs text-[#6B7280]">{card.label}</p>
                <p className="mt-1 text-xl font-bold text-[#1F2937]">{card.value}</p>
              </Link>
            ))}
          </div>

          {stats ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {Object.entries(stats).map(([key, value]) => (
                <div key={key} className={`${PANEL} px-4 py-3`}>
                  <p className="text-[11px] font-semibold uppercase text-slate-400">{key}</p>
                  <p className="text-lg font-bold">{typeof value === 'number' ? value.toLocaleString('en-IN') : String(value)}</p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {MODULES.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.to} to={item.to} className={`${PANEL} p-4 hover:bg-slate-50`}>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-[#217346]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="mt-3 font-semibold text-slate-900">{item.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.text}</p>
                </Link>
              );
            })}
          </div>

          <div className={PANEL}>
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">Employees by role</div>
            <div className="grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-4">
              {roles.map((role) => (
                <Link
                  key={role.value}
                  to={`/hr-management/employees?role=${encodeURIComponent(role.value)}`}
                  className="bg-white px-4 py-3 hover:bg-slate-50"
                >
                  <p className="text-xs text-slate-500">{role.label}</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{role.count ?? people.filter((p) => p.roleKey === role.value).length}</p>
                </Link>
              ))}
            </div>
          </div>

          <form onSubmit={createStaff} className={`grid gap-2 p-4 sm:grid-cols-5 ${PANEL}`}>
            <input required placeholder="Name" className="rounded-xl border px-3 py-2 text-sm" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            <input required type="email" placeholder="Email" className="rounded-xl border px-3 py-2 text-sm" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            <input required placeholder="Phone" className="rounded-xl border px-3 py-2 text-sm" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            <select className="rounded-xl border px-3 py-2 text-sm" value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
              {roles.filter((role) => role.value !== 'all').map((role) => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
            <button type="submit" className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white">Add staff</button>
          </form>

          <div className={`overflow-hidden ${PANEL}`}>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((person) => (
                    <tr key={`${person.employeeType}-${person.id}`} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-semibold">
                        <Link to={person.href || `/hr-management/employees/${person.employeeType}/${person.id}`} className="text-emerald-700 hover:underline">
                          {person.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{person.role}</td>
                      <td className="px-4 py-3">{person.phone || person.email}</td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => toggleActive(person)} className="text-xs font-bold">
                          {person.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3 space-x-2">
                        <button type="button" onClick={() => clock(person, 'in')} className="text-xs font-semibold text-emerald-700">Clock in</button>
                        <button type="button" onClick={() => clock(person, 'out')} className="text-xs font-semibold text-slate-500">Clock out</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

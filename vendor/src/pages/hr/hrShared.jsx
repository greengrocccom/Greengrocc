import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { BTN } from '../../utils/ui';

export const HR_BASE = '/hr-management';

export const HR_LINKS = [
  { to: '/hr-management', label: 'Dashboard' },
  { to: '/hr-management/b2b-users', label: 'B2B Users' },
  { to: '/hr-management/calendar', label: 'Calendar' },
  { to: '/hr-management/announcements', label: 'Announcements' },
  { to: '/hr-management/leave', label: 'Leave' },
  { to: '/hr-management/my-leave', label: 'My Leave' },
  { to: '/hr-management/employees', label: 'Employees' },
  { to: '/hr-management/payroll', label: 'Salary' },
  { to: '/hr-management/performance', label: 'Appraisals & Career' },
  { to: '/hr-management/recruitment', label: 'Recruitment' },
  { to: '/hr-management/attendance', label: 'Attendance' },
  { to: '/hr-management/meetings', label: 'Meetings' },
];

/** Employee types a vendor manages: its farmer managers and pickup drivers. */
export const VENDOR_HR_TYPES = ['farmer_manager', 'pickup_driver'];

export const ROLE_FIELDS = {
  vendor: ['email', 'department'],
  segregation_manager: ['email', 'department'],
  product_manager: ['email', 'department'],
  farmer_manager: ['email', 'address', 'city', 'state', 'pincode', 'location', 'vendorId'],
  farmer: ['email', 'address', 'city', 'state', 'pincode'],
  pickup_driver: ['vehicleNumber', 'vehicleType', 'licenseNumber', 'assignedArea', 'vendorId'],
  delivery_manager: ['email', 'state', 'city', 'area', 'storeName', 'storeAddress', 'pincode'],
  delivery_boy: ['city', 'area', 'managerId', 'vehicleType'],
};

export function inr(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

export function initials(name) {
  return String(name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export function pretty(value) {
  return String(value || '—').replaceAll('_', ' ');
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function personKey(person) {
  return `${person.employeeType}:${person.id}`;
}

export function goToPreviousPage(navigate, fallback = '/hr-management') {
  const idx = window.history.state?.idx;
  if (typeof idx === 'number' && idx > 0) {
    navigate(-1);
    return;
  }
  navigate(fallback);
}

export function HrBackButtons({ children, fallback = '/hr-management' }) {
  const navigate = useNavigate();
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => goToPreviousPage(navigate, fallback)}
        className={`${BTN} inline-flex items-center gap-1.5`}
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      {children}
    </div>
  );
}

export function Pill({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    green: 'bg-emerald-50 text-[#217346]',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    blue: 'bg-sky-50 text-sky-700',
    violet: 'bg-violet-50 text-violet-700',
    orange: 'bg-orange-50 text-orange-700',
  };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone] || tones.slate}`}>{children}</span>;
}

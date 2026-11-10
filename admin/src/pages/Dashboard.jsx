import React from 'react';
import { Leaf, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NAV_GROUPS } from '../config/adminNav';
import { PAGE_KICKER, PAGE_SUB, PAGE_TITLE, PANEL } from '../utils/ui';

const DASHBOARD_LINKS = NAV_GROUPS.flatMap((group) => group.items).filter(
  (item) => item.href !== '/' && item.href !== '/welcome'
);

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-5">
      <div className={`${PANEL} p-6 sm:p-8`}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-green-400 text-white shadow-xl shadow-emerald-500/20">
            <Leaf className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <ShieldCheck className="h-4 w-4" /> Admin Portal
            </div>
            <p className={PAGE_KICKER}>Admin Panel</p>
            <h1 className={PAGE_TITLE}>
              Welcome to <span className="text-emerald-600">GreenGrocc</span> Admin
            </h1>
            <p className={PAGE_SUB}>
              Signed in as <span className="font-semibold text-slate-800">{user?.name || 'Administrator'}</span> ({user?.email || 'admin@greengrocc.com'}). Open a module below.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {DASHBOARD_LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} to={item.href} className={`${PANEL} flex items-start gap-3 px-4 py-4 hover:bg-slate-50`}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{item.name}</p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                  {item.description || 'Open this module from the admin panel.'}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

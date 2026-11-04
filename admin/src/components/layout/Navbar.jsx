import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogOut, Menu, Search, Bell, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { BTN, BTN_PRIMARY, INPUT } from '../../utils/ui';
import apiClient from '../../api/client';
import { useLive } from '../../realtime/useLive';
import { getSoundSettings, playNotificationSound } from '../../utils/notificationSound';

export default function Navbar({ onOpenSidebar, searchValue, onSearchChange }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(() => getSoundSettings().enabled);
  const initial = (user?.name || 'A').charAt(0).toUpperCase();

  const loadUnreadCount = async () => {
    try {
      const res = await apiClient.get('/admin/notifications/system-alerts');
      const count = res.data?.metrics?.unreadCount ?? 0;
      setUnreadCount(count);
    } catch {
      // ignore
    }
  };

  useLive(loadUnreadCount);

  const onSearch = (event) => {
    event.preventDefault();
    const q = String(searchValue || '').trim();
    if (!q) return;
    navigate(`/traceability?q=${encodeURIComponent(q)}`);
  };

  return (
    <header className="z-20 shrink-0 border-b border-slate-200 bg-white">
      <div className="admin-topbar flex min-h-[58px] items-center gap-2 px-3 sm:gap-3 sm:px-5">
        <button type="button" onClick={onOpenSidebar} className={`${BTN} px-2.5 lg:hidden`} aria-label="Open menu">
          <Menu className="h-4 w-4" />
        </button>

        <form onSubmit={onSearch} className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchValue || ''}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Search farmer, batch, QR, or order ID"
            className={`${INPUT} pl-9`}
          />
        </form>

        {/* Notification Bell Button */}
        <Link
          to="/notifications"
          className={`${BTN} relative p-2 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition`}
          title={`Notifications & System Alerts (${unreadCount} unread)`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>

        <div className={`${BTN} hidden items-center gap-2 pr-3 sm:inline-flex`}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
            {initial}
          </span>
          <span className="max-w-[140px] truncate text-sm font-semibold">{user?.name || 'Admin'}</span>
        </div>

        <button type="button" onClick={logout} className={`${BTN_PRIMARY} gap-1.5 px-3`}>
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}

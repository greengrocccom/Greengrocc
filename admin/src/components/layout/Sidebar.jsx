import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';

function withHrRole(href, search) {
  const role = new URLSearchParams(search).get('role');
  if (!role || !href.startsWith('/hr-management') || href === '/hr-management') return href;
  return `${href}?role=${encodeURIComponent(role)}`;
}
import { ChevronDown, ChevronLeft, ChevronRight, LogOut, Settings, X } from 'lucide-react';
import { NAV_GROUPS } from '../../config/adminNav';
import { useAuth } from '../../context/AuthContext';

const SIDEBAR_WIDTH_KEY = 'greengrocc_admin_sidebar_width';
const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 360;
const clampWidth = (width) => Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.round(width)));

function readSidebarWidth() {
  try {
    const width = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    return width > 0 && Number.isFinite(width) ? clampWidth(width) : null;
  } catch {
    return null;
  }
}

function saveSidebarWidth(width) {
  try {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
  } catch {
    // Resizing still works when browser storage is unavailable.
  }
}

function pathMatches(item, pathname) {
  if (item.children?.length) {
    return item.children.some((child) => pathMatches(child, pathname)) || pathname === item.href || pathname.startsWith(`${item.href}/`);
  }
  return item.end ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavItem({ item, compact, onNavigate, nested }) {
  const location = useLocation();
  const Icon = item.icon;
  const isInventoryLink = item.href === '/inventory-tools' || item.href.startsWith('/inventory-tools/');
  const inventoryScope = isInventoryLink
    ? location.pathname.match(/^\/inventory-tools(?:\/[^/]+)?(\/zones\/[^/]+(?:\/stores\/[^/]+)?)\/?$/)?.[1]
    : '';
          return (
            <NavLink
      to={inventoryScope ? `${item.href}${inventoryScope}` : withHrRole(item.href, location.search)}
      end={item.end}
      title={compact ? item.name : undefined}
      onClick={onNavigate}
              className={({ isActive }) =>
        `admin-nav-item group relative mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
          compact ? 'justify-center px-2.5 py-2.5' : nested ? 'py-1.5 pl-9 text-[13px]' : ''
        } ${
                  isActive
            ? 'bg-[var(--admin-active)] text-slate-900'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
          {isActive && !compact ? (
            <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 bg-[var(--admin-accent)]" />
          ) : null}
          {Icon ? (
                  <Icon
              className={`${nested ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]'} shrink-0 ${isActive ? 'text-emerald-700' : 'text-slate-400 group-hover:text-slate-600'}`}
              strokeWidth={isActive ? 2.25 : 1.75}
            />
          ) : null}
          {!compact ? <span className="truncate">{item.name}</span> : null}
                </>
              )}
            </NavLink>
          );
}

function NavBranch({ item, compact, onNavigate }) {
  const location = useLocation();
  const childActive = pathMatches(item, location.pathname);
  const [open, setOpen] = useState(childActive);

  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  if (compact || !item.children?.length) {
    return <NavItem item={item} compact={compact} onNavigate={onNavigate} />;
  }

  const Icon = item.icon;
  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`admin-nav-item group mb-0.5 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
          childActive ? 'bg-[var(--admin-active)] text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        {Icon ? <Icon className={`h-[18px] w-[18px] shrink-0 ${childActive ? 'text-emerald-700' : 'text-slate-400'}`} strokeWidth={childActive ? 2.25 : 1.75} /> : null}
        <span className="min-w-0 flex-1 truncate text-left">{item.name}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open
        ? item.children.map((child) => (
            <NavItem key={child.href} item={child} compact={false} nested onNavigate={onNavigate} />
          ))
        : null}
    </div>
  );
}

function NavGroup({ group, compact, onNavigate }) {
  const location = useLocation();
  const isChildActive = group.items.some((item) => pathMatches(item, location.pathname));
  const [open, setOpen] = useState(true);

  if (compact) {
    return (
      <div className="mx-2 mb-3 space-y-0.5">
        {group.items.map((item) => (
          <NavBranch key={item.href} item={item} compact onNavigate={onNavigate} />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-2 mb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition ${
          isChildActive ? 'text-emerald-700' : 'text-slate-400 hover:text-slate-600'
        }`}
      >
        <span className="flex-1 truncate text-left">{group.label}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="space-y-0.5">
          {group.items.map((item) => (
            <NavBranch key={item.href} item={item} compact={false} onNavigate={onNavigate} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function Sidebar({ isCollapsed, setIsCollapsed, mobileOpen, onCloseMobile }) {
  const { user, logout } = useAuth();
  const [width, setWidth] = useState(readSidebarWidth);
  const drag = useRef(null);
  const compact = isCollapsed && !mobileOpen;
  const initial = (user?.name || 'A').charAt(0).toUpperCase();

  const onNavigate = () => {
    onCloseMobile?.();
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsCollapsed(false);
    }
  };

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] lg:hidden"
          aria-label="Close sidebar"
          onClick={onCloseMobile}
        />
      ) : null}

      <aside
        data-expanded={!compact}
        style={width ? { '--admin-sidebar-width': `${width}px` } : undefined}
        className={`admin-sidebar sticky top-0 z-50 flex h-[100dvh] shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-150 ${
          compact ? 'w-[64px]' : 'w-[248px]'
        } max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:w-[min(248px,86vw)] ${
          mobileOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'
        }`}
      >
        <div className="admin-sidebar-header flex h-[58px] shrink-0 items-center gap-2 border-b border-slate-200 px-3">
          {!compact ? (
            <div className="min-w-0 flex-1 px-1">
              <div className="flex items-center gap-2.5">
                <span className="admin-brand flex h-10 w-10 items-center justify-center bg-emerald-700 text-xs font-bold text-white">
                  GG
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold leading-tight text-slate-900">GreenGrocc</p>
                  <p className="truncate text-[11px] leading-tight text-slate-500">Admin Panel</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <span className="admin-brand flex h-10 w-10 items-center justify-center bg-emerald-700 text-xs font-bold text-white">
                GG
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 lg:inline-flex"
            aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
            title={compact ? 'Expand' : 'Collapse'}
          >
            {compact ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>

          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 lg:hidden"
            onClick={onCloseMobile}
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="admin-scrollbar min-h-0 flex-1 overflow-y-auto py-3">
          {NAV_GROUPS.map((group) => (
            <NavGroup key={group.id} group={group} compact={compact} onNavigate={onNavigate} />
          ))}
        </nav>

        <div className="shrink-0 border-t border-slate-100 p-3">
          <div className={`flex items-center gap-2.5 rounded-xl bg-slate-50 px-2 py-2 ${compact ? 'justify-center' : ''}`}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
              {initial}
            </span>
            {!compact ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-900">{user?.name || 'Admin'}</p>
                <p className="truncate text-[11px] text-slate-500">{user?.email || 'admin@greengrocc.com'}</p>
              </div>
            ) : null}
            <Link
              to="/settings"
              title="Settings (Security & Password)"
              onClick={onNavigate}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-emerald-700"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={logout}
              title="Logout"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-rose-600"
            >
              <LogOut className="h-4 w-4" />
            </button>
        </div>
      </div>
        {!compact && (
          <div
            role="separator"
            aria-label="Resize sidebar"
            aria-orientation="vertical"
            aria-valuemin={MIN_SIDEBAR_WIDTH}
            aria-valuemax={MAX_SIDEBAR_WIDTH}
            aria-valuenow={width ?? (document.documentElement.dataset.adminTheme === 'dark' ? 248 : 188)}
            tabIndex={0}
            className="absolute inset-y-0 -right-1 z-10 hidden w-2 cursor-col-resize touch-none select-none hover:bg-[var(--admin-accent)]/30 focus-visible:bg-[var(--admin-accent)]/30 lg:block"
            onPointerDown={(event) => {
              if (!event.isPrimary || event.button !== 0) return;
              const currentWidth = event.currentTarget.parentElement.getBoundingClientRect().width;
              drag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: currentWidth, width: null };
              event.currentTarget.setPointerCapture(event.pointerId);
              event.preventDefault();
            }}
            onPointerMove={(event) => {
              const resize = drag.current;
              if (!resize || resize.pointerId !== event.pointerId) return;
              resize.width = clampWidth(resize.startWidth + event.clientX - resize.startX);
              setWidth(resize.width);
            }}
            onLostPointerCapture={(event) => {
              const resize = drag.current;
              if (!resize || resize.pointerId !== event.pointerId) return;
              if (resize.width !== null) saveSidebarWidth(resize.width);
              drag.current = null;
            }}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
              event.preventDefault();
              const currentWidth = event.currentTarget.parentElement.getBoundingClientRect().width;
              const nextWidth = clampWidth(currentWidth + (event.key === 'ArrowLeft' ? -12 : 12));
              setWidth(nextWidth);
              saveSidebarWidth(nextWidth);
            }}
          />
        )}
    </aside>
    </>
  );
}

import { useEffect, useState, useMemo } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowUpDown,
  BadgeCheck,
  BadgePercent,
  BarChart3,
  Bell,
  Bike,
  Boxes,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Coins,
  FileSpreadsheet,
  FileText,
  Gift,
  Headset,
  IdCard,
  IndianRupee,
  LayoutDashboard,
  Leaf,
  LogOut,
  MapPinned,
  Megaphone,
  Package,
  PackageOpen,
  Palmtree,
  RotateCcw,
  Route,
  ScrollText,
  ShoppingCart,
  Sprout,
  Star,
  Store,
  Ticket,
  Tractor,
  TrendingUp,
  Truck,
  UserPlus,
  UserRound,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import Header from './Header'
import VendorTopNavbar from './VendorTopNavbar'
import VendorBottomNav from './VendorBottomNav'
import { useVendorAuth } from '../../context/VendorAuthContext'
import { vendorApi } from '../../api/vendorApi'
import { VendorNotificationsProvider } from '../../context/VendorNotificationsContext'

/** Sidebar, grouped by area of work. Every page appears exactly once. */
const navSections = [
  {
    id: 'home',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
      {
        id: 'finance',
        label: 'Vendor Finance',
        icon: IndianRupee,
        children: [
          { to: '/vendor/finance/sales-reports', label: 'Sales Reports' },
          { to: '/vendor/finance/seller-reports', label: 'Vendor Seller Report' },
          { to: '/vendor/finance/farmer-payments', label: 'Farmer Vendor Payments' },
          { to: '/vendor/finance/delivery-manager-reports', label: 'Delivery Manager Reports' },
          { to: '/vendor/finance/expenses', label: 'Expenses' },
        ],
      },
      { to: '/vendor/notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    id: 'orders',
    title: 'Orders',
    items: [
      { to: '/vendor/orders-management', label: 'Orders Management', icon: ShoppingCart },
      {
        id: 'preorders',
        label: 'Pre-orders',
        icon: CalendarClock,
        children: [
          { to: '/vendor/preorders', label: 'Customer Pre-orders', end: true },
          { to: '/vendor/pre-order-slots', label: 'Delivery Slots' },
        ],
      },
      {
        id: 'farmer-orders',
        label: 'Farmer Orders',
        icon: ShoppingCart,
        children: [
          { to: '/vendor/orders/farmer', label: 'All Farmer Orders' },
          { to: '/vendor/orders/products', label: 'Orders by Product' },
          { to: '/vendor/orders/create', label: 'Create Order' },
        ],
      },
      {
        id: 'req-stock',
        label: 'Dark Store Restock',
        icon: PackageOpen,
        children: [{ to: '/vendor/inventory-requests', label: 'All Dark Stores', end: true }],
      },
    ],
  },
  {
    id: 'catalog',
    title: 'Catalog & Products',
    items: [
      {
        id: 'supply-products',
        label: 'Supply Products',
        icon: Package,
        children: [
          { to: '/vendor/products', label: 'Product Requests', end: true },
          { to: '/vendor/my-products', label: 'My Supply Products' },
        ],
      },
      { to: '/vendor/market-prices', label: 'Market Prices', icon: TrendingUp },
      { to: '/vendor/export-import', label: 'Export / Import', icon: ArrowUpDown },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory',
    items: [
      {
        id: 'inventory',
        label: 'Stock',
        icon: ClipboardList,
        children: [
          { to: '/vendor/inventory', label: 'Stock Overview', end: true },
          { to: '/vendor/inventory/farmers', label: 'Farmer Inventory' },
          { to: '/vendor/inventory/history', label: 'Stock History' },
        ],
      },
    ],
  },
  {
    id: 'sourcing',
    title: 'Farmers & Sourcing',
    items: [
      {
        id: 'farmers',
        label: 'Farmers',
        icon: Tractor,
        children: [
          { to: '/vendor/all-farmers', label: 'All Farmers' },
          { to: '/vendor/all-farmers/add', label: 'Add Farmer' },
        ],
      },
      {
        id: 'farmer-managers',
        label: 'Farmer Managers',
        icon: Users,
        children: [
          { to: '/vendor/farmer-managers', label: 'All Managers' },
          { to: '/vendor/farmer-managers/add', label: 'Add Manager' },
        ],
      },
      {
        id: 'crops',
        label: 'Crops',
        icon: Sprout,
        children: [
          { to: '/vendor/crops', label: 'All Crops', end: true },
          { to: '/vendor/my-crops', label: 'My Crops' },
        ],
      },
      {
        id: 'farmer-crops',
        label: 'Farmer Crops',
        icon: Leaf,
        children: [
          { to: '/vendor/farmer-crops', label: 'Farmer Crops', end: true },
          { to: '/vendor/farmer-crop-requests', label: 'Crop Requests' },
        ],
      },
      {
        id: 'farmer-products',
        label: 'Farmer Products',
        icon: Package,
        children: [
          { to: '/vendor/farmer-products', label: 'Farmer Products', end: true },
          { to: '/vendor/farmer-products/add', label: 'Add Product' },
        ],
      },
      {
        id: 'quality',
        label: 'Quality & Grading',
        icon: BadgeCheck,
        children: [
          { to: '/vendor/quality/all', label: 'All Inspections' },
          { to: '/vendor/quality/pending', label: 'Pending' },
          { to: '/vendor/quality/inspection', label: 'Inspect & Grade' },
          { to: '/vendor/quality/completed', label: 'Completed' },
        ],
      },
    ],
  },
  {
    id: 'logistics',
    title: 'Logistics',
    items: [
      {
        id: 'pickups',
        label: 'Farm Pickups',
        icon: Truck,
        children: [
          { to: '/vendor/pickups/ready', label: 'Ready for Pickup' },
          { to: '/vendor/pickups/assigned', label: 'Assigned' },
          { to: '/vendor/pickups/today', label: "Today's Pickups" },
          { to: '/vendor/pickups/incoming', label: 'Incoming' },
          { to: '/vendor/pickups/centre', label: 'At Collection Centre' },
          { to: '/vendor/pickups/all', label: 'All Pickups' },
          { to: '/vendor/drivers/pickup-orders', label: 'Pickup Orders by Driver' },
        ],
      },
      { to: '/vendor/drivers', label: 'Pickup Drivers', icon: IdCard, end: true },
      {
        id: 'dark-stores',
        label: 'Zones & Dark Stores',
        icon: Store,
        children: [
          { to: '/vendor/zones', label: 'My Zones' },
          { to: '/vendor/dark-stores', label: 'My Dark Stores', end: true },
          { to: '/vendor/dark-stores/request', label: 'Request Dark Store' },
          { to: '/vendor/delivery-boys', label: 'Delivery Boys' },
        ],
      },
      { to: '/vendor/shipping-methods', label: 'Shipping Methods', icon: Route },
    ],
  },
  {
    id: 'business',
    title: 'Finance & Store',
    items: [
      {
        id: 'earnings',
        label: 'Earnings',
        icon: Wallet,
        children: [
          { to: '/vendor/earnings', label: 'Statements', end: true },
          { to: '/vendor/earnings/payments', label: 'Payments' },
        ],
      },
      { to: '/vendor/reviews', label: 'Customer Reviews', icon: Star },
      { to: '/vendor/vacation', label: 'Store Vacation', icon: Palmtree },
    ],
  },
  {
    id: 'team',
    title: 'Team & Documents',
    items: [
      {
        id: 'hr-management',
        label: 'HR Management',
        icon: Briefcase,
        children: [
          { to: '/vendor/hr-management', label: 'Overview', end: true },
          { to: '/vendor/hr-management/employees', label: 'Employees' },
          { to: '/vendor/hr-management/attendance', label: 'Attendance & Shifts' },
          { to: '/vendor/hr-management/leave', label: 'Leave Requests' },
          { to: '/vendor/hr-management/my-leave', label: 'My Leave' },
          { to: '/vendor/hr-management/payroll', label: 'Payroll' },
          { to: '/vendor/hr-management/recruitment', label: 'Recruitment' },
          { to: '/vendor/hr-management/meetings', label: 'Meetings' },
          { to: '/vendor/hr-management/calendar', label: 'Calendar' },
          { to: '/vendor/hr-management/announcements', label: 'Announcements' },
        ],
      },
      { to: '/vendor/documents', label: 'Documents', icon: FileText },
    ],
  },
]

const footerItems = [
  { to: '/policies', label: 'Policies', icon: ScrollText },
  { to: '/support', label: 'Support', icon: Headset },
  { to: '/profile', label: 'My Profile', icon: UserRound },
]

const isFarmerOrderPage = (path) => path === '/vendor/orders' || path.startsWith('/vendor/orders/detail/')

/** The child link for the current URL — the longest matching path wins, so nested routes highlight one item. */
function findActiveChild(children = [], path, currentFull) {
  const withQuery = children.find((child) => child.to.includes('?') && currentFull === child.to)
  if (withQuery) return withQuery.to
  let best = null
  for (const child of children) {
    if (child.to.includes('?')) continue
    const childPath = child.to
    const matches =
      path === childPath ||
      (!child.exact && path.startsWith(`${childPath}/`)) ||
      (childPath === '/vendor/orders/farmer' && isFarmerOrderPage(path))
    if (matches && (!best || childPath.length > best.length)) best = childPath
  }
  return best
}

function NavGroup({ item, collapsed, onNavigate }) {
  const location = useLocation()
  const path = location.pathname
  const currentFull = location.pathname + location.search

  const activeChildTo = findActiveChild(item.children, path, currentFull)
  const isChildActive = Boolean(activeChildTo)
  const [open, setOpen] = useState(isChildActive)
  const Icon = item.icon || Package

  useEffect(() => {
    if (isChildActive) setOpen(true)
  }, [location.pathname, location.search, isChildActive])

  if (collapsed) {
    return (
      <NavLink
        to={item.children?.[0]?.to || '#'}
        title={item.label}
        onClick={onNavigate}
        className={() =>
          `group relative mx-1.5 mb-0.5 flex items-center justify-center rounded-lg px-2 py-2 text-xs font-medium transition ${
            isChildActive ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-100'
          }`
        }
      >
        <Icon
          className={`h-4.5 w-4.5 shrink-0 ${isChildActive ? 'text-emerald-700' : 'text-slate-500'}`}
          strokeWidth={isChildActive ? 2.25 : 1.75}
        />
      </NavLink>
    )
  }

  return (
    <div className="mx-1.5 mb-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition ${
          isChildActive ? 'bg-emerald-50 text-emerald-800 font-semibold' : 'text-slate-700 hover:bg-slate-100'
        }`}
      >
        <Icon
          className={`h-4.5 w-4.5 shrink-0 ${isChildActive ? 'text-emerald-700' : 'text-slate-500'}`}
          strokeWidth={isChildActive ? 2.25 : 1.75}
        />
        <span className="flex-1 text-left leading-tight truncate">{item.label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="ml-3.5 mt-0.5 space-y-0.5 border-l border-slate-200 pl-2.5">
          {item.children.map((child) => {
            const isChildItemActive = child.to === activeChildTo

            return (
              <NavLink
                key={child.to}
                to={child.to}
                end={child.end}
                onClick={onNavigate}
                className={() =>
                  `block rounded-md px-2 py-1.5 text-xs transition ${
                    isChildItemActive
                      ? 'bg-white font-semibold text-emerald-700 shadow-xs border border-slate-100'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`
                }
              >
                {child.label}
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}

function NavItem({ item, collapsed, badge, onNavigate }) {
  if (item.children) {
    return <NavGroup item={item} collapsed={collapsed} onNavigate={onNavigate} />
  }

  const Icon = item.icon || Package

  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={collapsed ? item.label : undefined}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group relative mx-1.5 mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition ${
          collapsed ? 'justify-center px-2' : ''
        } ${
          isActive
            ? 'bg-emerald-50 text-emerald-800 font-semibold'
            : 'text-slate-700 hover:bg-slate-100'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-emerald-700' : 'text-slate-500 group-hover:text-slate-700'}`}
            strokeWidth={isActive ? 2.25 : 1.75}
          />
          {!collapsed ? (
            <>
              <span className="flex-1 truncate text-left">{item.label}</span>
              {badge > 0 ? (
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800">
                  {badge}
                </span>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </NavLink>
  )
}

export default function ProductManagerLayout() {
  const vendor = useVendorAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const closeMobile = () => setMobileOpen(false)

  const compact = collapsed && !mobileOpen

  const [vendorDarkStores, setVendorDarkStores] = useState([])
  const [vacationNotice, setVacationNotice] = useState(null)

  useEffect(() => {
    let isMounted = true
    vendorApi
      .getVacation()
      .then((res) => {
        if (!isMounted) return
        if (res?.vacation?.enabled) {
          setVacationNotice(res.vacation)
        } else {
          setVacationNotice(null)
        }
      })
      .catch(() => {})
    return () => {
      isMounted = false
    }
  }, [location.pathname])

  useEffect(() => {
    let isMounted = true
    vendorApi
      .getDarkStoreRequests()
      .then((res) => {
        if (!isMounted) return
        setVendorDarkStores(res.data?.darkStores || [])
      })
      .catch(() => {})
    return () => {
      isMounted = false
    }
  }, [location.pathname])

  const isSeller = vendor?.vendor?.vendorType === 'seller'

  const sectionsToRender = useMemo(() => {
    const storeChildren = (vendorDarkStores || []).map((store) => ({
      to: `/vendor/inventory-requests?storeId=${store.id || store._id}`,
      label: store.storeName || `${store.area} Store`,
    }))
    let list = navSections.map((section) => ({
      ...section,
      items: section.items.map((item) =>
        item.id === 'req-stock' ? { ...item, children: [...item.children, ...storeChildren] } : item,
      ),
    }))

    // If vendor is a Seller Vendor, completely remove all farmer-specific sections and links
    if (isSeller) {
      list = list
        .filter((section) => section.id !== 'sourcing')
        .map((section) => {
          // Hide Farmer Vendor Payments from Vendor Finance for seller vendors
          const cleanFinanceItems = section.items.map((item) => {
            if (item.id === 'finance' && item.children) {
              return {
                ...item,
                children: item.children.filter((c) => c.to !== '/vendor/finance/farmer-payments'),
              }
            }
            return item
          });

          if (section.id === 'orders') {
            return {
              ...section,
              items: cleanFinanceItems.filter((item) => item.id !== 'farmer-orders'),
            }
          }
          if (section.id === 'inventory') {
            return {
              ...section,
              items: cleanFinanceItems.map((item) => {
                if (item.id === 'inventory' && item.children) {
                  return {
                    ...item,
                    children: item.children.filter((c) => c.to !== '/vendor/inventory/farmers'),
                  }
                }
                return item
              }),
            }
          }
          if (section.id === 'logistics') {
            return {
              ...section,
              items: cleanFinanceItems.filter(
                (item) => item.id !== 'pickups' && item.to !== '/vendor/drivers',
              ),
            }
          }
          return {
            ...section,
            items: cleanFinanceItems,
          }
        })
    }

    return list
  }, [vendorDarkStores, isSeller])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const onNavigate = () => {
    closeMobile()
    if (window.innerWidth < 1024) setCollapsed(false)
  }

  return (
    <div className="flex min-h-dvh bg-[#f3f6f4] text-slate-900">
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] lg:hidden print:hidden"
          onClick={closeMobile}
        />
      ) : null}

      {/* Slim Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh shrink-0 flex-col border-r border-slate-200/80 bg-white shadow-xl transition-[width,transform] duration-200 lg:sticky lg:top-0 lg:z-0 lg:shadow-none print:hidden ${
          compact ? 'w-[64px]' : 'w-[218px]'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-100 px-2.5">
          {!compact ? (
            <div className="min-w-0 flex-1 px-1">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700 text-xs font-bold text-white shadow-xs">
                  GG
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold leading-tight text-slate-900">GreenGroo</p>
                  <p className="truncate text-[10px] leading-tight text-slate-400">
                    {isSeller ? 'Seller Panel' : 'Vendor Panel'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700 text-xs font-bold text-white shadow-xs">
                GG
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 lg:inline-flex"
            aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
            title={compact ? 'Expand' : 'Collapse'}
          >
            {compact ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 lg:hidden"
            onClick={closeMobile}
            aria-label="Close sidebar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Scrollable Navigation */}
        <nav className="flex-1 overflow-y-auto py-2">
          {sectionsToRender.map((section, index) => (
            <div key={section.id} className={index ? 'mt-3' : ''}>
              {section.title ? (
                compact ? (
                  <div className="mx-3 mb-2 border-t border-slate-200/80" />
                ) : (
                  <p className="mb-1 px-4 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                    {section.title}
                  </p>
                )
              ) : null}
              {section.items.map((item) => (
                <NavItem key={item.to || item.id} item={item} collapsed={compact} onNavigate={onNavigate} />
              ))}
            </div>
          ))}

          {/* Footer Items */}
          <div className="mt-3 border-t border-slate-200/80 pt-2 pb-5">
            {footerItems.map((item) => {
              const Icon = item.icon || Package
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={compact ? item.label : undefined}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `group relative mx-1.5 mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition ${
                      compact ? 'justify-center px-2' : ''
                    } ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-800 font-semibold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-emerald-700' : 'text-slate-500 group-hover:text-slate-700'}`}
                        strokeWidth={isActive ? 2.25 : 1.75}
                      />
                      {!compact ? <span className="truncate">{item.label}</span> : null}
                    </>
                  )}
                </NavLink>
              )
            })}

            <button
              type="button"
              onClick={() => {
                vendor.logout()
                navigate('/vendor/login', { replace: true })
              }}
              title={compact ? 'Logout' : undefined}
              className={`group relative mx-1.5 mb-0.5 flex w-[calc(100%-0.75rem)] items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition ${
                compact ? 'justify-center px-2' : ''
              }`}
            >
              <LogOut className="h-4.5 w-4.5 shrink-0 text-slate-500 group-hover:text-red-600" strokeWidth={1.75} />
              {!compact ? <span className="truncate">Logout</span> : null}
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <VendorNotificationsProvider>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Top Navbar with Searchbar */}
        <VendorTopNavbar onOpenMobileMenu={() => setMobileOpen(true)} />

        {/* Global Store Vacation Banner Notification */}
        {vacationNotice?.enabled && (
          <div className="flex items-center justify-between gap-3 border-b border-amber-300 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 px-4 py-2 text-xs font-bold text-white shadow-xs print:hidden sm:px-6">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[11px] backdrop-blur-xs">
                🌴
              </span>
              <span>
                Vacation Mode Active: Your store is offline
                {vacationNotice.returnDate ? ` until ${vacationNotice.returnDate}` : ''}.
                {vacationNotice.offlineMode === 'browse_only' ? ' (Catalog browsing active with notice)' : ' (Full catalog hidden)'}
              </span>
            </div>
            <NavLink
              to="/vendor/vacation"
              className="rounded-lg bg-black/20 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-black/30 transition shadow-2xs"
            >
              Manage Vacation →
            </NavLink>
          </div>
        )}

        {/* Page Content — announcements live in the navbar notification bell */}
        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto max-lg:pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
          <Outlet />
        </main>
      </div>
      </VendorNotificationsProvider>

      <div className="print:hidden">
        <VendorBottomNav />
      </div>
    </div>
  )
}

export function PageShell({ title, subtitle, children }) {
  return (
    <>
      {title || subtitle ? <Header title={title} subtitle={subtitle} /> : null}
      <div className="space-y-3 p-3 sm:space-y-4 sm:p-4 lg:p-5">
        {title || subtitle ? (
          <div className="lg:hidden">
            {title ? <h1 className="text-lg font-bold leading-tight text-gray-900">{title}</h1> : null}
            {subtitle ? <p className="mt-0.5 text-xs leading-snug text-gray-500">{subtitle}</p> : null}
          </div>
        ) : null}
        {children}
      </div>
    </>
  )
}

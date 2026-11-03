import React, { useEffect, useRef, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import AdminDataExport from './AdminDataExport';
import { useAuth } from '../../context/AuthContext';
import '../../styles/admin.css';

export default function AdminLayout() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const contentRef = useRef(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="admin-panel flex h-screen h-[100dvh] h-full w-full overflow-hidden bg-[#f3f6f4] text-slate-900">
      <Sidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Navbar
          onOpenSidebar={() => setMobileOpen(true)}
          searchValue={search}
          onSearchChange={setSearch}
        />
        <main
          className={`admin-scrollbar min-h-0 flex-1 overflow-y-auto ${
            location.pathname.startsWith('/billing') ? 'p-3 sm:p-4 lg:p-5 lg:pb-2 pb-2' : 'p-3 sm:p-5 lg:p-6'
          }`}
        >
          <AdminDataExport key={`${location.pathname}${location.search}`} contentRef={contentRef} />
          <div ref={contentRef}><Outlet context={{ search, setSearch }} /></div>
        </main>
      </div>
    </div>
  );
}

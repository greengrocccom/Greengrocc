import LoginAccountsPage from './pages/ops/LoginAccountsPage';
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AdminLayout from './components/layout/AdminLayout';
import ZoneStoreGate from './components/layout/ZoneStoreGate';
import Dashboard from './pages/Dashboard';
import CeoDashboard from './pages/ceo/CeoDashboard';
import TraceabilityPage from './pages/traceability/TraceabilityPage';
import FarmersPage from './pages/erp/FarmersPage';
import Farmer360Page from './pages/erp/Farmer360Page';
import LocationMastersPage from './pages/erp/LocationMastersPage';
import CropsPage from './pages/erp/CropsPage';
import ErpListPage from './pages/erp/ErpListPage';
import Products from './pages/Products';
import BaseProducts from './pages/BaseProducts';
import AllBaseProducts from './pages/AllBaseProducts';
import Banners from './pages/Banners';
import Analytics from './pages/Analytics';
import MarketPricesPage from './pages/ops/MarketPricesPage';
import PreOrderSlots from './pages/PreOrderSlots';
import OrderCharges from './pages/OrderCharges';
import PreOrders from './pages/PreOrders';
import UnroutedOrders from './pages/UnroutedOrders';
import DarkStores from './pages/DarkStores';
import Coupons from './pages/Coupons';
import RewardPoints from './pages/RewardPoints';
import Login from './pages/Login';
import GiftCards from './pages/ops/GiftCards';
import PolicyManagement from './pages/ops/PolicyManagement';
import DynamicPricing from './pages/ops/DynamicPricing';
import BulkImportExport from './pages/ops/BulkImportExport';
import CsvImportExport from './pages/ops/CsvImportExport';
import MultiVendor from './pages/ops/MultiVendor';
import MultiVendorDetailPage from './pages/ops/MultiVendorDetailPage';
import AllVendorsSupportEditor from './pages/ops/AllVendorsSupportEditor';
import ShippingMethodsPage from './pages/ops/ShippingMethodsPage';
import DarkStoreRequestsPage from './pages/ops/DarkStoreRequestsPage';
import ZoneRequestsPage from './pages/ops/ZoneRequestsPage';
import CentreFarmersPage from './pages/ops/CentreFarmersPage';
import AdminCropCatalogPage from './pages/ops/AdminCropCatalogPage';
import AdminAddCropPage from './pages/ops/AdminAddCropPage';
import AdminFarmerCropsPage from './pages/ops/AdminFarmerCropsPage';
import CollectionDashboardPage from './pages/ops/CollectionDashboardPage';
import VendorProductRequestsPage from './pages/ops/VendorProductRequestsPage';
import VendorCatalogRequestsPage from './pages/ops/VendorCatalogRequestsPage';
import VendorCropRequestsPage from './pages/ops/VendorCropRequestsPage';
import CentreFarmerManagersPage from './pages/ops/CentreFarmerManagersPage';
import StaffManagementPage from './pages/ops/StaffManagementPage';
import HrManagement from './pages/ops/HrManagement';
import HrB2bUsersPage from './pages/hr/HrB2bUsersPage';
import HrCalendarPage from './pages/hr/HrCalendarPage';
import HrAnnouncementsPage from './pages/hr/HrAnnouncementsPage';
import HrLeavePage from './pages/hr/HrLeavePage';
import HrMyLeavePage from './pages/hr/HrMyLeavePage';
import HrEmployeesPage from './pages/hr/HrEmployeesPage';
import HrEmployeeProfilePage from './pages/hr/HrEmployeeProfilePage';
import HrPayrollPage from './pages/hr/HrPayrollPage';
import HrRecruitmentPage from './pages/hr/HrRecruitmentPage';
import HrAttendancePage from './pages/hr/HrAttendancePage';
import HrMeetingsPage from './pages/hr/HrMeetingsPage';
import HrPerformancePage from './pages/hr/HrPerformancePage';
import DeliveryManagement from './pages/ops/DeliveryManagement';
import DeliveryTeamPage from './pages/ops/DeliveryTeamPage';
import DeliveryManager360Page from './pages/ops/DeliveryManager360Page';
import DeliveryBoy360Page from './pages/ops/DeliveryBoy360Page';
import DeliverySlotsPage from './pages/ops/DeliverySlotsPage';
import DeliveryTracking from './pages/ops/DeliveryTracking';
import StoreSupport from './pages/ops/StoreSupport';
import FinanceManagement from './pages/ops/FinanceManagement';
import AdminFinanceDashboardPage from './pages/finance/AdminFinanceDashboardPage';
import AdminVendorCommissionPage from './pages/finance/AdminVendorCommissionPage';
import AdminVendorCommissionDetailPage from './pages/finance/AdminVendorCommissionDetailPage';
import AdminCommissionPaymentsPage from './pages/finance/AdminCommissionPaymentsPage';
import AdminFinanceSalesReportsPage from './pages/finance/AdminFinanceSalesReportsPage';
import AdminFinancialReportsPage from './pages/finance/AdminFinancialReportsPage';
import RefundWarranty, {
  RefundWarrantyTypePage,
  RefundWarrantyListPage,
} from './pages/ops/RefundWarranty';
import Reports from './pages/ops/Reports';
import InventoryHubPage from './pages/inventory/InventoryHubPage';
import InventoryDetailPage from './pages/inventory/InventoryDetailPage';
import {
  UserManagementTypePage,
  UserManagementZonesPage,
  UserManagementStoresPage,
  UserManagementUsersPage,
} from './pages/ops/UserManagementPage';
import UserNotificationsPage from './pages/ops/UserNotificationsPage';
import {
  AssetsZonesPage,
  AssetsStoresPage,
  AssetsRolesPage,
  AssetsListPage,
} from './pages/ops/AssetsManagementPage';
import AllGovtSchemesPage from './pages/government/AllGovtSchemesPage';
import CreateGovtSchemePage from './pages/government/CreateGovtSchemePage';
import AllSchemeApplicationsPage from './pages/government/AllSchemeApplicationsPage';
import OmnichannelBillingPage from './pages/billing/OmnichannelBillingPage';
import InventoryToolsPage from './pages/inventory/InventoryToolsPage';
import AdminNotificationsPage from './pages/notifications/AdminNotificationsPage';

function scoped(path, kicker, title, Component, extraProps = {}) {
  const normPath = path.replace(/^\//, '');
  const basePath = `/${normPath}`;
  return [
    <Route
      key={`${normPath}-base`}
      path={normPath}
      element={
        <ZoneStoreGate kicker={kicker} title={title} basePath={basePath} {...extraProps}>
          <Component />
        </ZoneStoreGate>
      }
    />,
    <Route
      key={`${normPath}-zone`}
      path={`${normPath}/zones/:zoneKey`}
      element={
        <ZoneStoreGate kicker={kicker} title={title} basePath={basePath} {...extraProps}>
          <Component />
        </ZoneStoreGate>
      }
    />,
    <Route
      key={`${normPath}-store`}
      path={`${normPath}/zones/:zoneKey/stores/:storeId`}
      element={
        <ZoneStoreGate kicker={kicker} title={title} basePath={basePath} {...extraProps}>
          <Component />
        </ZoneStoreGate>
      }
    />,
  ];
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<AdminLayout />}>
              <Route index element={<CeoDashboard />} />
              <Route path="welcome" element={<Dashboard />} />
              <Route path="notifications" element={<AdminNotificationsPage />} />
              <Route path="billing" element={<OmnichannelBillingPage />} />
              <Route path="billing/:subTab" element={<OmnichannelBillingPage />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="traceability" element={<TraceabilityPage />} />
              <Route path="erp/locations" element={<LocationMastersPage />} />
              <Route path="erp/farmers" element={<FarmersPage />} />
              <Route path="erp/farmers/:id" element={<Farmer360Page />} />
              <Route path="erp/crops" element={<CropsPage />} />
              <Route path="erp/:resource" element={<ErpListPage />} />
              <Route path="products/base-products/add" element={<BaseProducts />} />
              <Route path="products/base-products/:sectionSlug?" element={<AllBaseProducts />} />
              <Route path="products/banners/*" element={<Navigate to="/banners/desktop" replace />} />
              <Route path="banners" element={<Navigate to="/banners/desktop" replace />} />
              <Route path="banners/:device/:sectionSlug?" element={<Banners />} />
              <Route path="products/:catalogView?/:sectionSlug?" element={<Products />} />
              <Route path="market-prices" element={<MarketPricesPage />} />

              {/* Orders with Zone -> Store Scope */}
              {scoped('pre-orders', 'Orders', 'Pre-orders', PreOrders)}
              {scoped('unrouted-orders', 'Orders', 'Unrouted Orders', UnroutedOrders)}
              {scoped('pre-order-slots', 'Orders', 'Pre-Order Slots', PreOrderSlots)}
              {scoped('preorder-slots', 'Orders', 'Pre-Order Slots', PreOrderSlots)}
              {scoped('order-charges', 'Orders', 'Order & Delivery Charges', OrderCharges)}
              {scoped('refund-warranty', 'Orders', 'Return & Warranty', RefundWarrantyListPage)}
              {scoped('refund-warranty/:accountType', 'Orders', 'Return & Warranty', RefundWarrantyListPage)}
              <Route path="refund-warranty/types" element={<RefundWarrantyTypePage />} />

              {/* Inventory with Zone -> Store Scope */}
              {scoped('inventory', 'Inventory', 'Stock Overview', InventoryHubPage)}
              <Route path="inventory/:type/:id" element={<InventoryDetailPage />} />

              {/* Stock Tools with Zone -> Store Scope */}
              {scoped('inventory-tools', 'Inventory', 'Real-Time Stock', InventoryToolsPage)}
              {scoped('inventory-tools/batches', 'Inventory', 'Batch & Expiry', InventoryToolsPage)}
              {scoped('inventory-tools/alerts', 'Inventory', 'Low-Stock Alerts', InventoryToolsPage)}
              {scoped('inventory-tools/grn', 'Inventory', 'Purchase & GRN', InventoryToolsPage)}
              {scoped('inventory-tools/dead-stock', 'Inventory', 'Dead-Stock Reports', InventoryToolsPage)}
              {scoped('inventory-tools/adjustments', 'Inventory', 'Adjustment Logs', InventoryToolsPage)}
              <Route path="inventory-tools/:tab" element={<InventoryToolsPage />} />

              {/* Delivery & Dark Stores with Zone -> Store Scope */}
              {scoped('delivery-management', 'Delivery & Dark Stores', 'Delivery Management', DeliveryManagement)}
              {scoped('delivery-tracking', 'Delivery & Dark Stores', 'Delivery Tracking', DeliveryTracking)}
              {scoped('delivery-slots', 'Delivery & Dark Stores', 'Delivery Slots', DeliverySlotsPage)}
              {scoped('delivery-team', 'Delivery & Dark Stores', 'Delivery Team', DeliveryTeamPage)}
              <Route path="delivery-team/managers/:id" element={<DeliveryManager360Page />} />
              <Route path="delivery-team/boys/:id" element={<DeliveryBoy360Page />} />
              {scoped('dark-stores', 'Delivery & Dark Stores', 'Dark Stores', DarkStores)}

              {/* Assets Management (already has zone -> store structure) */}
              <Route path="assets-management" element={<AssetsZonesPage />} />
              <Route path="assets-management/zones/:zoneKey" element={<AssetsStoresPage />} />
              <Route
                path="assets-management/zones/:zoneKey/stores/:storeId"
                element={<AssetsRolesPage />}
              />
              <Route
                path="assets-management/zones/:zoneKey/stores/:storeId/roles/:role"
                element={<AssetsListPage />}
              />

              {/* Promotions with Zone -> Store Scope */}
              {scoped('coupons', 'Promotions', 'Coupons & Offers', Coupons)}
              {scoped('rewards', 'Promotions', 'Reward Points', RewardPoints)}
              {scoped('gift-cards', 'Promotions', 'Gift Cards', GiftCards)}
              {scoped('dynamic-pricing', 'Promotions', 'Dynamic Pricing', DynamicPricing)}

              <Route path="categories" element={<Navigate to="/products/categories" replace />} />
              <Route path="sections" element={<Navigate to="/products/sections" replace />} />
              <Route path="policy-management" element={<PolicyManagement />} />
              <Route path="policy-management/:roleKey" element={<PolicyManagement />} />
              <Route path="bulk-import-export" element={<BulkImportExport />} />
              <Route path="csv-import-export" element={<CsvImportExport />} />
              <Route path="multi-vendor" element={<MultiVendor />} />
              <Route path="multi-vendor/support" element={<AllVendorsSupportEditor />} />
              <Route path="vendor-support" element={<AllVendorsSupportEditor />} />
              <Route path="multi-vendor/:vendorId" element={<MultiVendorDetailPage />} />
              <Route path="shipping-methods" element={<ShippingMethodsPage />} />
              <Route path="multi-vendor/shipping-methods" element={<ShippingMethodsPage />} />
              <Route path="multi-vendor/products" element={<Products />} />
              <Route path="multi-vendor/market-prices" element={<MarketPricesPage />} />
              <Route path="multi-vendor/pre-order-slots" element={<PreOrderSlots />} />
              <Route path="multi-vendor/pre-orders" element={<PreOrders />} />
              <Route path="multi-vendor/inventory" element={<InventoryHubPage />} />
              <Route path="multi-vendor/bulk-import-export" element={<BulkImportExport />} />
              <Route path="multi-vendor/csv-import-export" element={<CsvImportExport />} />
              <Route path="zone-requests" element={<ZoneRequestsPage />} />
              <Route path="dark-store-requests" element={<DarkStoreRequestsPage />} />
              <Route path="collection-dashboard" element={<CollectionDashboardPage />} />
              <Route path="vendor-product-requests" element={<VendorProductRequestsPage />} />
              <Route path="vendor-catalog-requests" element={<VendorCatalogRequestsPage />} />
              <Route path="vendor-crop-requests" element={<VendorCropRequestsPage />} />
              <Route path="collection-farmers" element={<CentreFarmersPage />} />
              <Route path="collection-crops" element={<AdminCropCatalogPage />} />
              <Route path="collection-crops/add" element={<AdminAddCropPage />} />
              <Route path="collection-farmer-crops" element={<AdminFarmerCropsPage />} />
              <Route path="collection-farmer-managers" element={<CentreFarmerManagersPage />} />

              {/* Team & HR with Zone -> Store Scope */}
              {scoped('staff-management', 'Team & HR', 'Staff Management', StaffManagementPage)}
              <Route path="login-accounts" element={<LoginAccountsPage />} />
              {scoped('hr-management', 'Team & HR', 'HR Dashboard', HrManagement)}
              {scoped('hr-management/employees', 'Team & HR', 'Employees', HrEmployeesPage)}
              <Route path="hr-management/employees/:type/:id" element={<HrEmployeeProfilePage />} />
              {scoped('hr-management/attendance', 'Team & HR', 'Attendance & Shifts', HrAttendancePage)}
              {scoped('hr-management/leave', 'Team & HR', 'Leave Requests', HrLeavePage)}
              {scoped('hr-management/my-leave', 'Team & HR', 'My Leave', HrMyLeavePage)}
              {scoped('hr-management/payroll', 'Team & HR', 'Salary Management', HrPayrollPage)}
              {scoped('hr-management/recruitment', 'Team & HR', 'Recruitment', HrRecruitmentPage)}
              {scoped('hr-management/calendar', 'Team & HR', 'Calendar', HrCalendarPage)}
              {scoped('hr-management/meetings', 'Team & HR', 'Meetings', HrMeetingsPage)}
              {scoped('hr-management/announcements', 'Team & HR', 'Announcements', HrAnnouncementsPage)}
              {scoped('hr-management/b2b-users', 'Team & HR', 'B2B Users', HrB2bUsersPage)}
              {scoped('hr-management/performance', 'Team & HR', 'Career & Appraisals', HrPerformancePage)}

              {/* Customers & Support - User Management */}
              <Route path="user-management" element={<UserManagementTypePage />} />
              <Route path="user-management/zones/:zoneKey" element={<UserManagementStoresPage />} />
              <Route path="user-management/zones/:zoneKey/stores/:storeId" element={<UserManagementUsersPage />} />
              <Route path="user-management/:accountType" element={<UserManagementZonesPage />} />
              <Route path="user-notifications" element={<UserNotificationsPage />} />
              <Route path="user-management/:accountType/notifications" element={<UserNotificationsPage />} />
              <Route path="user-management/:accountType/zones/:zoneKey" element={<UserManagementStoresPage />} />
              <Route
                path="user-management/:accountType/zones/:zoneKey/stores/:storeId"
                element={<UserManagementUsersPage />}
              />

              <Route path="store-support" element={<StoreSupport />} />
              <Route path="store-support/:roleKey" element={<StoreSupport />} />
              {/* Admin Finance & Sales Commission Management */}
              <Route path="finance" element={<AdminFinanceDashboardPage />} />
              <Route path="finance/dashboard" element={<AdminFinanceDashboardPage />} />
              <Route path="finance/commissions" element={<AdminVendorCommissionPage />} />
              <Route path="finance/commissions/:vendorId" element={<AdminVendorCommissionDetailPage />} />
              <Route path="finance/payments" element={<AdminCommissionPaymentsPage />} />
              <Route path="finance/sales-reports" element={<AdminFinanceSalesReportsPage />} />
              <Route path="finance/financial-reports" element={<AdminFinancialReportsPage />} />
              <Route path="finance/erp" element={<FinanceManagement />} />
              <Route path="finance/erp/:section" element={<FinanceManagement />} />
              <Route path="finance/estimations" element={<FinanceManagement />} />
              <Route path="finance/taxes" element={<FinanceManagement />} />
              <Route path="finance/expenses" element={<FinanceManagement />} />
              <Route path="finance/purchases" element={<FinanceManagement />} />
              <Route path="finance/journals" element={<FinanceManagement />} />
              <Route path="finance/contacts" element={<FinanceManagement />} />
              <Route path="finance/accounts" element={<FinanceManagement />} />
              <Route path="finance/transfers" element={<FinanceManagement />} />

              {/* Sales Routes Aliases */}
              <Route path="sales" element={<AdminFinanceDashboardPage />} />
              <Route path="sales/dashboard" element={<AdminFinanceDashboardPage />} />
              <Route path="sales/commissions" element={<AdminVendorCommissionPage />} />
              <Route path="sales/commissions/:vendorId" element={<AdminVendorCommissionDetailPage />} />
              <Route path="sales/payments" element={<AdminCommissionPaymentsPage />} />
              <Route path="sales/sales-reports" element={<AdminFinanceSalesReportsPage />} />
              <Route path="sales/financial-reports" element={<AdminFinancialReportsPage />} />
              <Route path="reports" element={<Reports />} />
              <Route path="government/schemes" element={<AllGovtSchemesPage />} />
              <Route path="government/schemes/create" element={<CreateGovtSchemePage />} />
              <Route path="government/schemes/:id/edit" element={<CreateGovtSchemePage />} />
              <Route path="government/applications" element={<AllSchemeApplicationsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

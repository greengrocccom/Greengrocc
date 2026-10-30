import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AdminLayout from './components/layout/AdminLayout';
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
              <Route path="inventory-tools" element={<InventoryToolsPage />} />
              <Route path="inventory-tools/:tab" element={<InventoryToolsPage />} />
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
              <Route path="pre-order-slots" element={<PreOrderSlots />} />
              <Route path="preorder-slots" element={<PreOrderSlots />} />
              <Route path="order-charges" element={<OrderCharges />} />
              <Route path="pre-orders" element={<PreOrders />} />
              <Route path="unrouted-orders" element={<UnroutedOrders />} />
              <Route path="inventory" element={<InventoryHubPage />} />
              <Route path="inventory/:type/:id" element={<InventoryDetailPage />} />
              <Route path="dark-stores" element={<DarkStores />} />
              <Route path="categories" element={<Navigate to="/products/categories" replace />} />
              <Route path="sections" element={<Navigate to="/products/sections" replace />} />
              <Route path="coupons" element={<Coupons />} />
              <Route path="rewards" element={<RewardPoints />} />
              <Route path="gift-cards" element={<GiftCards />} />
              <Route path="policy-management" element={<PolicyManagement />} />
              <Route path="policy-management/:roleKey" element={<PolicyManagement />} />
              <Route path="dynamic-pricing" element={<DynamicPricing />} />
              <Route path="bulk-import-export" element={<BulkImportExport />} />
              <Route path="csv-import-export" element={<CsvImportExport />} />
              <Route path="multi-vendor" element={<MultiVendor />} />
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
              <Route path="staff-management" element={<StaffManagementPage />} />
              <Route path="hr-management" element={<HrManagement />} />
              <Route path="hr-management/b2b-users" element={<HrB2bUsersPage />} />
              <Route path="hr-management/calendar" element={<HrCalendarPage />} />
              <Route path="hr-management/announcements" element={<HrAnnouncementsPage />} />
              <Route path="hr-management/leave" element={<HrLeavePage />} />
              <Route path="hr-management/my-leave" element={<HrMyLeavePage />} />
              <Route path="hr-management/employees" element={<HrEmployeesPage />} />
              <Route path="hr-management/employees/:type/:id" element={<HrEmployeeProfilePage />} />
              <Route path="hr-management/payroll" element={<HrPayrollPage />} />
              <Route path="hr-management/recruitment" element={<HrRecruitmentPage />} />
              <Route path="hr-management/attendance" element={<HrAttendancePage />} />
              <Route path="hr-management/meetings" element={<HrMeetingsPage />} />
              <Route path="hr-management/performance" element={<HrPerformancePage />} />
              <Route path="delivery-management" element={<DeliveryManagement />} />
              <Route path="delivery-team" element={<DeliveryTeamPage />} />
              <Route path="delivery-team/managers/:id" element={<DeliveryManager360Page />} />
              <Route path="delivery-team/boys/:id" element={<DeliveryBoy360Page />} />
              <Route path="delivery-slots" element={<DeliverySlotsPage />} />
              <Route path="delivery-tracking" element={<DeliveryTracking />} />
              <Route path="user-management" element={<UserManagementTypePage />} />
              <Route path="user-management/:accountType" element={<UserManagementZonesPage />} />
              <Route path="user-management/:accountType/notifications" element={<UserNotificationsPage />} />
              <Route path="user-management/:accountType/zones/:zoneKey" element={<UserManagementStoresPage />} />
              <Route
                path="user-management/:accountType/zones/:zoneKey/stores/:storeId"
                element={<UserManagementUsersPage />}
              />
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
              <Route path="store-support" element={<StoreSupport />} />
              <Route path="store-support/:roleKey" element={<StoreSupport />} />
              <Route path="finance" element={<FinanceManagement />} />
              <Route path="finance/:section" element={<FinanceManagement />} />
              <Route path="refund-warranty" element={<RefundWarrantyTypePage />} />
              <Route path="refund-warranty/:accountType" element={<RefundWarrantyListPage />} />
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

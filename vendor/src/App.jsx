import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { VendorAuthProvider } from './context/VendorAuthContext'
import { DriverAuthProvider } from './context/DriverAuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import DriverProtectedRoute from './components/DriverProtectedRoute'
import ProductManagerLayout from './components/layout/ProductManagerLayout'
import DriverLayout from './components/layout/DriverLayout'
import PlaceholderPage from './components/ui/PlaceholderPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import LoginPage from './pages/auth/LoginPage'
import VendorLoginPage from './pages/vendor-auth/VendorLoginPage'
import FarmerManagersPage from './pages/farmer-managers/FarmerManagersPage'
import AddManagerPage from './pages/farmer-managers/AddManagerPage'
import ManagerDetailPage from './pages/farmer-managers/ManagerDetailPage'
import AllFarmersPage from './pages/vendor-farmers/AllFarmersPage'
import AddFarmerPage from './pages/vendor-farmers/AddFarmerPage'
import FarmerDetailPage from './pages/vendor-farmers/FarmerDetailPage'
import VendorProductsPage from './pages/vendor-farmers/VendorProductsPage'
import VendorProductAddPage from './pages/vendor-farmers/VendorProductAddPage'
import VendorProductFarmersPage from './pages/vendor-farmers/VendorProductFarmersPage'
import VendorCropsPage from './pages/vendor-farmers/VendorCropsPage'
import VendorFarmerCropRequestsPage from './pages/vendor-farmers/VendorFarmerCropRequestsPage'
import FarmerCropViewPage from './pages/vendor-farmers/FarmerCropViewPage'
import FarmerCropFormPage from './pages/vendor-farmers/FarmerCropFormPage'
import DriverFormPage from './pages/drivers/DriverFormPage'
import DriverDetailPage from './pages/drivers/DriverDetailPage'
import DriverPickupOrdersPage from './pages/drivers/DriverPickupOrdersPage'
import ManagerDriversPage from './pages/manager/ManagerDriversPage'
import ManagerPickupsPage from './pages/manager/ManagerPickupsPage'
import ManagerPickupDetailPage from './pages/manager/ManagerPickupDetailPage'
import ManagerReceivePage from './pages/manager/ManagerReceivePage'
import ManagerBatchPage from './pages/manager/ManagerBatchPage'
import ManagerQualityListPage from './pages/manager/ManagerQualityListPage'
import ManagerQualityInspectionPage from './pages/manager/ManagerQualityInspectionPage'
import DriverDashboardPage from './pages/drivers/DriverDashboardPage'
import DriverHomePage from './pages/drivers/DriverHomePage'
import DriverPickupPage from './pages/drivers/DriverPickupPage'
import DriverBatchPage from './pages/drivers/DriverBatchPage'
import InventoryRequestsPage from './pages/inventory-requests/InventoryRequestsPage'
import VendorSearchPage from './pages/search/VendorSearchPage'
import ApplyLeavePage from './pages/leave/ApplyLeavePage'
import DriverLeavePage from './pages/drivers/DriverLeavePage'
import RolePoliciesPage from './pages/policies/PoliciesPage'
import SupportPage from './pages/policies/SupportPage'
import { vendorApi } from './api/vendorApi'
import { driverApi } from './api/driverApi'
import ManagerInventoryPage from './pages/manager/ManagerInventoryPage'
import ManagerInventoryHistoryPage from './pages/manager/ManagerInventoryHistoryPage'
import AllFarmerInventoryPage from './pages/manager/AllFarmerInventoryPage'
import ManagerOrdersPage from './pages/manager/ManagerOrdersPage'
import ManagerCreateOrderPage from './pages/manager/ManagerCreateOrderPage'
import ManagerOrderDetailPage from './pages/manager/ManagerOrderDetailPage'
import OrderProductInventoryPage from './pages/manager/OrderProductInventoryPage'
import ManagerEarningsPage from './pages/manager/ManagerEarningsPage'
import ManagerEarningReportPage from './pages/manager/ManagerEarningReportPage'
import ManagerDocumentsPage from './pages/manager/ManagerDocumentsPage'
import VendorDarkStoresPage from './pages/dark-stores/VendorDarkStoresPage'
import DarkStoreRequestPage from './pages/dark-stores/DarkStoreRequestPage'
import VendorZonesPage from './pages/dark-stores/VendorZonesPage'
import VendorNotificationsPage from './pages/notifications/VendorNotificationsPage'
import VendorDeliveryBoysPage from './pages/dark-stores/VendorDeliveryBoysPage'
import ShippingMethodsPage from './pages/shipping/ShippingMethodsPage'
import VendorPreOrdersPage from './pages/preorders/VendorPreOrdersPage'
import VendorMarketPricesPage from './pages/market/VendorMarketPricesPage'
import VendorPreOrderSlotsPage from './pages/preorders/VendorPreOrderSlotsPage'
import VendorBulkImportExportPage from './pages/catalog/VendorBulkImportExportPage'
import VendorCsvImportExportPage from './pages/catalog/VendorCsvImportExportPage'
import VendorExportImportPage from './pages/catalog/VendorExportImportPage'
import VendorCatalogPage from './pages/catalog/VendorCatalogPage'
import VendorCatalogRequestsPage from './pages/catalog/VendorCatalogRequestsPage'
import VendorMyProductsPage from './pages/products/VendorMyProductsPage'
import VendorProductRequestPage from './pages/products/VendorProductRequestPage'
import VendorAllCropsPage from './pages/crops/VendorAllCropsPage'
import VendorMyCropsPage from './pages/crops/VendorMyCropsPage'
import HrDashboardPage from './pages/hr/HrDashboardPage'
import HrCalendarPage from './pages/hr/HrCalendarPage'
import HrAnnouncementsPage from './pages/hr/HrAnnouncementsPage'
import HrLeavePage from './pages/hr/HrLeavePage'
import HrEmployeesPage from './pages/hr/HrEmployeesPage'
import HrEmployeeProfilePage from './pages/hr/HrEmployeeProfilePage'
import HrPayrollPage from './pages/hr/HrPayrollPage'
import HrRecruitmentPage from './pages/hr/HrRecruitmentPage'
import HrAttendancePage from './pages/hr/HrAttendancePage'
import HrMeetingsPage from './pages/hr/HrMeetingsPage'
import VendorProfilePage from './pages/profile/VendorProfilePage'
import VendorVacationPage from './pages/vacation/VendorVacationPage'
import VendorReviewsPage from './pages/reviews/VendorReviewsPage'
import { VendorSettingsProvider } from './context/VendorSettingsContext'

import Coupons from './pages/Coupons'
import RewardPoints from './pages/RewardPoints'
import GiftCards from './pages/ops/GiftCards'
import DynamicPricing from './pages/ops/DynamicPricing'
import {
  UserManagementTypePage,
  UserManagementZonesPage,
  UserManagementStoresPage,
  UserManagementUsersPage,
} from './pages/ops/UserManagementPage'
import UserNotificationsPage from './pages/ops/UserNotificationsPage'
import DeliveryManagement from './pages/ops/DeliveryManagement'
import DeliveryTracking from './pages/ops/DeliveryTracking'
import DeliverySlotsPage from './pages/ops/DeliverySlotsPage'
import DeliveryTeamPage from './pages/ops/DeliveryTeamPage'
import DeliveryManager360Page from './pages/ops/DeliveryManager360Page'
import DeliveryBoy360Page from './pages/ops/DeliveryBoy360Page'
import DarkStores from './pages/DarkStores'
import {
  AssetsZonesPage,
  AssetsStoresPage,
  AssetsRolesPage,
  AssetsListPage,
} from './pages/ops/AssetsManagementPage'
import InventoryHubPage from './pages/inventory/InventoryHubPage'
import InventoryDetailPage from './pages/inventory/InventoryDetailPage'
import InventoryToolsPage from './pages/inventory/InventoryToolsPage'
import PreOrders from './pages/PreOrders'
import UnroutedOrders from './pages/UnroutedOrders'
import PreOrderSlots from './pages/PreOrderSlots'
import OrderCharges from './pages/OrderCharges'
import RefundWarranty, {
  RefundWarrantyTypePage,
  RefundWarrantyListPage,
} from './pages/ops/RefundWarranty'
import StaffManagementPage from './pages/ops/StaffManagementPage'
import HrManagement from './pages/ops/HrManagement'
import HrB2bUsersPage from './pages/hr/HrB2bUsersPage'
import HrPerformancePage from './pages/hr/HrPerformancePage'
import HrMyLeavePage from './pages/hr/HrMyLeavePage'

function App() {
  return (
    <VendorAuthProvider>
      <VendorSettingsProvider>
        <DriverAuthProvider>
        <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/vendor/login" element={<VendorLoginPage />} />
            <Route path="/driver/login" element={<Navigate to="/vendor/login" replace />} />
            <Route element={<DriverProtectedRoute />}>
              <Route element={<DriverLayout />}>
                <Route path="/driver" element={<DriverHomePage />} />
                <Route path="/driver/assigned" element={<DriverDashboardPage mode="assigned" />} />
                <Route path="/driver/progress" element={<DriverDashboardPage mode="progress" />} />
                <Route path="/driver/completed" element={<DriverDashboardPage mode="completed" />} />
                <Route path="/driver/history" element={<DriverDashboardPage mode="history" />} />
                <Route path="/driver/today" element={<Navigate to="/driver/assigned" replace />} />
                <Route path="/driver/leave" element={<DriverLeavePage />} />
                <Route
                  path="/driver/policies"
                  element={
                    <RolePoliciesPage
                      title="Policies"
                      loadPolicies={() => driverApi.livePolicies()}
                    />
                  }
                />
                <Route path="/driver/batches/:batchId" element={<DriverBatchPage />} />
                <Route path="/driver/pickups/:pickupId" element={<DriverPickupPage />} />
              </Route>
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route element={<ProductManagerLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/vendor/search" element={<VendorSearchPage />} />
                <Route path="/vendor/farmer-managers" element={<FarmerManagersPage />} />
                <Route path="/vendor/farmer-managers/add" element={<AddManagerPage />} />
                <Route path="/vendor/farmer-managers/:managerId" element={<ManagerDetailPage />} />
                <Route path="/vendor/all-farmers" element={<AllFarmersPage />} />
                <Route path="/vendor/crops" element={<VendorAllCropsPage />} />
                <Route path="/vendor/crops/add" element={<Navigate to="/vendor/farmer-crops/add" replace />} />
                <Route path="/vendor/my-crops" element={<VendorMyCropsPage />} />
                <Route path="/vendor/farmer-crops" element={<VendorCropsPage />} />
                <Route path="/vendor/farmer-crop-requests" element={<VendorFarmerCropRequestsPage />} />
                <Route path="/vendor/farmer-crops/add" element={<FarmerCropFormPage />} />
                <Route path="/vendor/products/add" element={<Navigate to="/vendor/products" replace />} />
                <Route path="/vendor/products/:productKey/farmers" element={<VendorProductFarmersPage />} />
                <Route path="/vendor/products" element={<VendorProductRequestPage />} />
                <Route path="/vendor/my-products" element={<VendorMyProductsPage />} />
                <Route path="/vendor/my-products/:editMineProductId/edit" element={<VendorCatalogPage />} />
                <Route path="/vendor/catalog-requests" element={<VendorCatalogRequestsPage />} />
                <Route path="/vendor/catalog/:catalogView?/:sectionSlug?" element={<VendorCatalogPage />} />
                <Route path="/vendor/farmer-products" element={<VendorProductsPage />} />
                <Route path="/vendor/farmer-products/add" element={<VendorProductAddPage />} />
                <Route path="/vendor/all-farmers/add" element={<AddFarmerPage />} />
                <Route path="/vendor/all-farmers/:farmerId/crops/add" element={<FarmerCropFormPage />} />
                <Route path="/vendor/all-farmers/:farmerId/crops/:cropId/edit" element={<FarmerCropFormPage />} />
                <Route path="/vendor/all-farmers/:farmerId/crops/:cropId" element={<FarmerCropViewPage />} />
                <Route path="/vendor/all-farmers/:farmerId/products/add" element={<VendorProductAddPage />} />
                <Route path="/vendor/all-farmers/:farmerId" element={<FarmerDetailPage />} />
                <Route path="/vendor/drivers" element={<ManagerDriversPage />} />
                <Route path="/vendor/drivers/pickup-orders" element={<DriverPickupOrdersPage />} />
                <Route path="/vendor/drivers/pickups" element={<Navigate to="/vendor/drivers/pickup-orders" replace />} />
                <Route path="/vendor/driver-pickups" element={<Navigate to="/vendor/drivers/pickup-orders" replace />} />
                <Route path="/vendor/drivers/add" element={<DriverFormPage />} />
                <Route path="/vendor/drivers/:driverId/edit" element={<DriverFormPage />} />
                <Route path="/vendor/drivers/:driverId" element={<DriverDetailPage />} />
                <Route path="/vendor/zones" element={<VendorZonesPage />} />
                <Route path="/vendor/notifications" element={<VendorNotificationsPage />} />
                <Route path="/vendor/dark-stores" element={<VendorDarkStoresPage />} />
                <Route path="/vendor/dark-stores/request" element={<DarkStoreRequestPage />} />
                <Route path="/vendor/delivery-boys" element={<VendorDeliveryBoysPage />} />
                <Route path="/vendor/dark-stores/delivery-boys" element={<Navigate to="/vendor/delivery-boys" replace />} />
                <Route path="/vendor/shipping-methods" element={<ShippingMethodsPage />} />
                <Route path="/vendor/pickups" element={<Navigate to="/vendor/pickups/ready" replace />} />
                <Route path="/vendor/pickups/requests" element={<Navigate to="/vendor/pickups/ready" replace />} />
                <Route path="/vendor/pickups/ready" element={<ManagerPickupsPage mode="ready" />} />
                <Route path="/vendor/pickups/assigned" element={<ManagerPickupsPage mode="assigned" />} />
                <Route path="/vendor/pickups/assignments" element={<Navigate to="/vendor/pickups/ready" replace />} />
                <Route path="/vendor/pickups/today" element={<ManagerPickupsPage mode="today" />} />
                <Route path="/vendor/pickups/incoming" element={<ManagerPickupsPage mode="incoming" />} />
                <Route path="/vendor/pickups/centre" element={<ManagerPickupsPage mode="centre" />} />
                <Route path="/vendor/pickups/all" element={<ManagerPickupsPage mode="all" />} />
                <Route path="/vendor/pickups/active" element={<Navigate to="/vendor/pickups/all" replace />} />
                <Route path="/vendor/pickups/completed" element={<ManagerPickupsPage mode="history" />} />
                <Route path="/vendor/pickups/history" element={<ManagerPickupsPage mode="history" />} />
                <Route path="/vendor/pickups/batches/:batchId" element={<ManagerBatchPage />} />
                <Route path="/vendor/pickups/:pickupId/receive" element={<ManagerReceivePage />} />
                <Route path="/vendor/pickups/:pickupId" element={<ManagerPickupDetailPage />} />
                <Route path="/vendor/collection-centre" element={<Navigate to="/vendor/pickups/centre" replace />} />
                <Route path="/vendor/collection-centre/:pickupId" element={<ManagerReceivePage />} />
                <Route path="/vendor/batches/:batchId" element={<ManagerBatchPage />} />
                <Route path="/vendor/quality" element={<Navigate to="/vendor/quality/all" replace />} />
                <Route path="/vendor/quality/all" element={<ManagerQualityListPage mode="all" />} />
                <Route path="/vendor/quality/pending" element={<ManagerQualityListPage mode="pending" />} />
                <Route path="/vendor/quality/inspection" element={<ManagerQualityListPage mode="inspection" />} />
                <Route path="/vendor/quality/grading" element={<Navigate to="/vendor/quality/inspection" replace />} />
                <Route path="/vendor/quality/completed" element={<ManagerQualityListPage mode="completed" />} />
                <Route path="/vendor/quality/:orderId" element={<ManagerQualityInspectionPage />} />
                <Route path="/vendor/inventory" element={<ManagerInventoryPage />} />
                <Route path="/vendor/inventory/history" element={<ManagerInventoryHistoryPage />} />
                <Route path="/vendor/inventory/farmers" element={<AllFarmerInventoryPage />} />
                <Route path="/vendor/orders" element={<ManagerOrdersPage mode="farmer" />} />
                <Route path="/vendor/orders/farmer" element={<ManagerOrdersPage mode="farmer" />} />
                <Route path="/vendor/orders/products" element={<ManagerOrdersPage mode="products" />} />
                <Route path="/vendor/orders/by-product" element={<ManagerOrdersPage mode="products" />} />
                <Route path="/vendor/orders/products/:productKey/inventory" element={<OrderProductInventoryPage />} />
                 <Route path="/vendor/preorders" element={<VendorPreOrdersPage />} />
                <Route path="/vendor/pre-orders" element={<VendorPreOrdersPage />} />
                <Route path="/pre-orders" element={<VendorPreOrdersPage />} />
                <Route path="/vendor/pre-order-slots" element={<VendorPreOrderSlotsPage />} />
                <Route path="/pre-order-slots" element={<VendorPreOrderSlotsPage />} />
                <Route path="/vendor/market-prices" element={<VendorMarketPricesPage />} />
                <Route path="/market-prices" element={<VendorMarketPricesPage />} />
                <Route path="/vendor/export-import" element={<VendorExportImportPage />} />
                <Route path="/export-import" element={<VendorExportImportPage />} />
                <Route path="/vendor/bulk-import-export" element={<VendorExportImportPage />} />
                <Route path="/bulk-import-export" element={<VendorExportImportPage />} />
                <Route path="/vendor/csv-import-export" element={<VendorExportImportPage />} />
                <Route path="/csv-import-export" element={<VendorExportImportPage />} />
                <Route path="/products" element={<Navigate to="/vendor/products" replace />} />
                <Route path="/inventory" element={<Navigate to="/vendor/inventory" replace />} />
                <Route path="/vendor/orders/create" element={<ManagerCreateOrderPage />} />
                <Route path="/vendor/orders/detail/:orderId" element={<ManagerOrderDetailPage />} />
                <Route path="/vendor/earnings" element={<ManagerEarningsPage />} />
                <Route path="/vendor/earnings/payments" element={<ManagerEarningsPage defaultTab="payments" />} />
                <Route path="/vendor/earnings/:orderId" element={<ManagerEarningReportPage />} />
                <Route path="/vendor/earnings/farmer/:farmerId" element={<ManagerEarningsPage />} />
                <Route path="/vendor/earnings/farmer/:farmerId/product/:productId" element={<ManagerEarningsPage />} />
                <Route path="/vendor/documents" element={<ManagerDocumentsPage />} />
                <Route path="/vendor/hr-management" element={<HrDashboardPage />} />
                <Route path="/vendor/hr-management/calendar" element={<HrCalendarPage />} />
                <Route path="/vendor/hr-management/announcements" element={<HrAnnouncementsPage />} />
                <Route path="/vendor/hr-management/leave" element={<HrLeavePage />} />
                <Route path="/vendor/hr-management/my-leave" element={<ApplyLeavePage />} />
                <Route path="/vendor/hr-management/employees" element={<HrEmployeesPage />} />
                <Route path="/vendor/hr-management/employees/:type/:id" element={<HrEmployeeProfilePage />} />
                <Route path="/vendor/hr-management/payroll" element={<HrPayrollPage />} />
                <Route path="/vendor/hr-management/recruitment" element={<HrRecruitmentPage />} />
                <Route path="/vendor/hr-management/attendance" element={<HrAttendancePage />} />
                <Route path="/vendor/hr-management/meetings" element={<HrMeetingsPage />} />
                <Route path="/vendor/inventory-requests" element={<InventoryRequestsPage />} />
                <Route path="/vendor/orders/darkstore" element={<Navigate to="/vendor/inventory-requests" replace />} />
                <Route path="/inventory-requests" element={<InventoryRequestsPage />} />
                <Route path="/leave" element={<ApplyLeavePage />} />
                <Route
                  path="/policies"
                  element={
                    <RolePoliciesPage
                      title="Policies"
                      loadPolicies={() => vendorApi.livePolicies()}
                    />
                  }
                />
                <Route path="/support" element={<SupportPage />} />
                <Route path="/settings" element={<Navigate to="/dashboard" replace />} />
                <Route path="/vendor/settings" element={<Navigate to="/dashboard" replace />} />
                <Route path="/vendor/vacation" element={<VendorVacationPage />} />
                <Route path="/vacation" element={<VendorVacationPage />} />
                <Route path="/vendor/reviews" element={<VendorReviewsPage />} />
                <Route path="/reviews" element={<VendorReviewsPage />} />
                <Route path="/profile" element={<VendorProfilePage />} />
                <Route path="/vendor/profile" element={<VendorProfilePage />} />
              </Route>
            </Route>
            <Route path="/" element={<Navigate to="/vendor/login" replace />} />
            <Route path="*" element={<Navigate to="/vendor/login" replace />} />
          </Routes>
        </BrowserRouter>
        </AuthProvider>
        </DriverAuthProvider>
      </VendorSettingsProvider>
    </VendorAuthProvider>
  )
}

export default App

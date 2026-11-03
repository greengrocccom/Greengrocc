import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import ManagerLayout from "./components/layout/ManagerLayout";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import DashboardPage from "./pages/dashboard/DashboardPage";
import RevenuePage from "./pages/revenue/RevenuePage";
import ExpensesPage from "./pages/expenses/ExpensesPage";
import SalesReportsPage from "./pages/sales/SalesReportsPage";
import ProfitLossPage from "./pages/profit-loss/ProfitLossPage";
import SettlementsPage from "./pages/settlements/SettlementsPage";
import StockPage from "./pages/stock/StockPage";
import ProductsPage from "./pages/products/ProductsPage";
import DriversPage from "./pages/drivers/DriversPage";
import DriverDetailPage from "./pages/drivers/DriverDetailPage";
import PendingDriversPage from "./pages/drivers/PendingDriversPage";
import PendingDriverDetailPage from "./pages/drivers/PendingDriverDetailPage";
import OrdersPage from "./pages/orders/OrdersPage";
import OrderDetailPage from "./pages/orders/OrderDetailPage";
import PreOrdersPage from "./pages/preorders/PreOrdersPage";
import ReturnPickupsPage from "./pages/returns/ReturnPickupsPage";
import ShiftManagementPage from "./pages/shifts/ShiftManagementPage";
import CreateShiftPage from "./pages/shifts/CreateShiftPage";
import IncentivesPage from "./pages/incentives/IncentivesPage";
import CreateGigPage from "./pages/incentives/CreateGigPage";
import AlertsPage from "./pages/alerts/AlertsPage";
import ApplyLeavePage from "./pages/leave/ApplyLeavePage";
import PoliciesPage from "./pages/policies/PoliciesPage";
import AnnouncementsPage from "./pages/announcements/AnnouncementsPage";
import SupportPage from "./pages/support/SupportPage";
import MeetingsPage from "./pages/meetings/MeetingsPage";
import FullTimeRulesPage from "./pages/fulltime/FullTimeRulesPage";
import FullTimeShiftManagementPage from "./pages/shifts/FullTimeShiftManagementPage";
import CreateFullTimeShiftPage from "./pages/shifts/CreateFullTimeShiftPage";
import FullTimeAssignOrdersPage from "./pages/fulltime/FullTimeAssignOrdersPage";
import MonthlyPaymentsPage from "./pages/fulltime/MonthlyPaymentsPage";
import RiderDistanceReportPage from "./pages/fulltime/RiderDistanceReportPage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<ManagerLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/revenue" element={<RevenuePage />} />
              <Route path="/sales-reports" element={<SalesReportsPage />} />
              <Route path="/expenses" element={<ExpensesPage />} />
              <Route path="/profit-loss" element={<ProfitLossPage />} />
              <Route path="/settlements" element={<SettlementsPage />} />
              <Route path="/shifts" element={<ShiftManagementPage />} />
              <Route path="/shifts/create" element={<CreateShiftPage />} />
              <Route path="/shifts/fulltime" element={<FullTimeShiftManagementPage />} />
              <Route path="/shifts/fulltime/create" element={<CreateFullTimeShiftPage />} />
              <Route path="/shifts/fulltime/:id/edit" element={<CreateFullTimeShiftPage />} />
              <Route path="/stock" element={<StockPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/drivers" element={<DriversPage />} />
              <Route path="/drivers/fulltime" element={<DriversPage employmentType="FULL_TIME" />} />
              <Route path="/drivers/parttime" element={<DriversPage employmentType="PART_TIME" />} />
              <Route path="/drivers/:driverId" element={<DriverDetailPage />} />
              <Route path="/drivers/pending" element={<PendingDriversPage />} />
              <Route path="/drivers/pending/:id" element={<PendingDriverDetailPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/:orderId" element={<OrderDetailPage />} />
              <Route path="/preorders" element={<PreOrdersPage />} />
              <Route path="/return-pickups" element={<ReturnPickupsPage />} />
              <Route path="/incentives" element={<IncentivesPage />} />
              <Route path="/incentives/create" element={<CreateGigPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/policies" element={<PoliciesPage />} />
              <Route path="/announcements" element={<AnnouncementsPage />} />
              <Route path="/support" element={<SupportPage />} />
              <Route path="/leave" element={<ApplyLeavePage />} />
              <Route path="/meetings" element={<MeetingsPage />} />
              <Route path="/fulltime/salary" element={<Navigate to="/shifts/fulltime" replace />} />
              <Route path="/fulltime/rules" element={<FullTimeRulesPage />} />
              <Route path="/fulltime/attendance" element={<Navigate to="/shifts/fulltime" replace />} />
              <Route path="/fulltime/assign-orders" element={<FullTimeAssignOrdersPage />} />
              <Route path="/payments/monthly" element={<MonthlyPaymentsPage />} />
              <Route path="/payments/distance" element={<RiderDistanceReportPage />} />
            </Route>
          </Route>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth, useCustomerAuth } from "./store/auth";
import AppLayout from "./layouts/AppLayout";
import { Toaster } from "./store/ui";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";

// Internal pages
import DashboardPage from "./pages/DashboardPage";
import QuotesPage from "./pages/QuotesPage";
import QuoteBuilderPage from "./pages/QuoteBuilderPage";
import QuoteDetailPage from "./pages/QuoteDetailPage";
import PipelinePage from "./pages/PipelinePage";
import ApprovalCenterPage from "./pages/ApprovalCenterPage";
import NegotiationCenterPage from "./pages/NegotiationCenterPage";
import DealerComparisonPage from "./pages/DealerComparisonPage";
import WhatIfPage from "./pages/WhatIfPage";
import DealHealthPage from "./pages/DealHealthPage";
import FulfillmentPage from "./pages/FulfillmentPage";
import BillingPage from "./pages/BillingPage";
import ReportsPage from "./pages/ReportsPage";
import DealIntelligencePage from "./pages/DealHealthPage";
import AdminPage from "./pages/AdminPage";

// Customer portal
import PortalLoginPage from "./pages/portal/PortalLoginPage";
import PortalLayout from "./layouts/PortalLayout";
import PortalDashboardPage from "./pages/portal/PortalDashboardPage";
import PortalQuotesPage from "./pages/portal/PortalQuotesPage";
import PortalQuoteDetailPage from "./pages/portal/PortalQuoteDetailPage";

function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireRoles({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function RequireCustomer({ children }) {
  const { customer } = useCustomerAuth();
  if (!customer) return <Navigate to="/portal/login" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Toaster />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/portal/login" element={<PortalLoginPage />} />

        <Route path="/portal" element={<RequireCustomer><PortalLayout /></RequireCustomer>}>
          <Route index element={<PortalDashboardPage />} />
          <Route path="quotes" element={<PortalQuotesPage />} />
          <Route path="quotes/:id" element={<PortalQuoteDetailPage />} />
        </Route>

        <Route path="/" element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<DashboardPage />} />
          <Route path="quotes" element={<QuotesPage />} />
          <Route path="quotes/:id" element={<QuoteDetailPage />} />
          <Route path="builder" element={<QuoteBuilderPage />} />
          <Route path="builder/:id" element={<QuoteBuilderPage />} />
          <Route path="pipeline" element={<PipelinePage />} />
          <Route path="approvals" element={<RequireRoles roles={["SALES_MANAGER", "FINANCE", "ADMIN"]}><ApprovalCenterPage /></RequireRoles>} />
          <Route path="negotiations" element={<NegotiationCenterPage />} />
          <Route path="dealers/comparison" element={<DealerComparisonPage />} />
          <Route path="whatif" element={<WhatIfPage />} />
          <Route path="deal-health" element={<DealHealthPage />} />
          <Route path="fulfillment" element={<FulfillmentPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="intelligence" element={<DealIntelligencePage />} />

          <Route path="admin/products" element={<RequireRoles roles={["ADMIN", "SALES_MANAGER"]}><AdminPage tab="products" /></RequireRoles>} />
          <Route path="admin/customers" element={<RequireRoles roles={["ADMIN", "SALES_MANAGER"]}><AdminPage tab="customers" /></RequireRoles>} />
          <Route path="admin/dealers" element={<RequireRoles roles={["ADMIN", "SALES_MANAGER"]}><AdminPage tab="dealers" /></RequireRoles>} />
          <Route path="admin/offers" element={<RequireRoles roles={["ADMIN", "SALES_MANAGER"]}><AdminPage tab="offers" /></RequireRoles>} />
          <Route path="admin/warehouses" element={<RequireRoles roles={["ADMIN", "SALES_MANAGER"]}><AdminPage tab="warehouses" /></RequireRoles>} />
          <Route path="admin/settings" element={<RequireRoles roles={["ADMIN", "SALES_MANAGER", "FINANCE"]}><AdminPage tab="settings" /></RequireRoles>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
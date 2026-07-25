import { Navigate, Route, Routes } from 'react-router'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { AuditDetailPage } from '@/features/audit/AuditDetailPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { CustomerDetailPage } from '@/features/customers/CustomerDetailPage'
import { CustomersPage } from '@/features/customers/CustomersPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { NewOrderPage } from '@/features/orders/NewOrderPage'
import { OrderDetailPage } from '@/features/orders/OrderDetailPage'
import { OrderLabelPrintPage } from '@/features/orders/OrderLabelPrintPage'
import { OrdersPage } from '@/features/orders/OrdersPage'
import { PickupDetailPage } from '@/features/orders/PickupDetailPage'
import { PaymentsPage } from '@/features/payments/PaymentsPage'
import { PaymentDetailPage } from '@/features/payments/PaymentDetailPage'
import { ReportDetailPage } from '@/features/reports/ReportDetailPage'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { ScanPage } from '@/features/scan/ScanPage'
import { ServiceDetailPage } from '@/features/settings/ServiceDetailPage'
import { ServiceSettingsPage } from '@/features/settings/ServiceSettingsPage'
import { UserDetailPage } from '@/features/settings/UserDetailPage'
import { UserSettingsPage } from '@/features/settings/UserSettingsPage'

export function AppShell() {
  return (
    <Routes>
      <Route element={<LoginPage />} path="/login" />
      <Route
        element={
          <RequireAuth>
            <OrderLabelPrintPage />
          </RequireAuth>
        }
        path="/print/orders/:orderCode/label"
      />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <AdminLayout>
              <Routes>
                <Route element={<DashboardPage />} index />
                <Route element={<OrdersPage />} path="orders" />
                <Route element={<NewOrderPage />} path="orders/new" />
                <Route element={<OrderDetailPage />} path="orders/:orderCode" />
                <Route element={<PickupDetailPage />} path="orders/:orderCode/pickup" />
                <Route element={<ScanPage />} path="scan" />
                <Route element={<CustomersPage />} path="customers" />
                <Route element={<CustomerDetailPage />} path="customers/:customerId" />
                <Route element={<PaymentsPage />} path="payments" />
                <Route element={<PaymentDetailPage />} path="payments/:paymentCode" />
                <Route element={<ReportsPage />} path="reports" />
                <Route element={<ReportDetailPage />} path="reports/:reportType" />
                <Route element={<Navigate replace to="/settings/services" />} path="settings" />
                <Route element={<ServiceSettingsPage />} path="settings/services" />
                <Route element={<ServiceDetailPage />} path="settings/services/:serviceCode" />
                <Route element={<UserSettingsPage />} path="settings/users" />
                <Route element={<UserDetailPage />} path="settings/users/:username" />
                <Route element={<AuditDetailPage />} path="audit/:auditId" />
                <Route element={<Navigate replace to="/" />} path="*" />
              </Routes>
            </AdminLayout>
          </RequireAuth>
        }
      />
    </Routes>
  )
}

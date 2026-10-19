import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import EmployeesPage from './pages/EmployeesPage';
import HolidaysPage from './pages/HolidaysPage';
import AssignmentsPage from './pages/AssignmentsPage';
import SchedulesPage from './pages/SchedulesPage';
import TimesheetEntriesPage from './pages/TimesheetEntriesPage';
import TimesheetsPage from './pages/TimesheetsPage';
import ReportsPage from './pages/ReportsPage';
import PayRunsPage from './pages/PayRunsPage';
import PayRunDetailPage from './pages/PayRunDetailPage';
import PayRunPayslipPage from './pages/PayRunPayslipPage';
import SettingsPage from './pages/SettingsPage';
import EmployeePortalPage from './pages/EmployeePortalPage';
import EmployeePayslipViewPage from './pages/EmployeePayslipViewPage';
import EmployeeTimesheetPage from './pages/EmployeeTimesheetPage';
import EmployeeSchedulePage from './pages/EmployeeSchedulePage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import PayrollPage from './pages/PayrollPage';
import ThirteenthMonthRunsPage from './pages/ThirteenthMonthRunsPage';
import ThirteenthMonthDetailPage from './pages/ThirteenthMonthDetailPage';
import ThirteenthMonthPayslipPage from './pages/ThirteenthMonthPayslipPage';
import ApprovalsPage from './pages/ApprovalsPage';
import { useAuth } from './context/AuthContext';

const HomeRedirect = () => {
  const { user } = useAuth();
  return <Navigate to={user?.role === 'manager' ? '/schedules' : '/dashboard'} replace />;
};

const PayRunLegacyRedirect = () => {
  const { payRunId } = useParams();
  return <Navigate to={`/payroll/pay-runs/${payRunId}`} replace />;
};

const PayRunPayslipLegacyRedirect = () => {
  const { payRunId, entryId } = useParams();
  return <Navigate to={`/payroll/pay-runs/${payRunId}/payslips/${entryId}`} replace />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Employee Portal Routes (Standalone Header Layout) */}
          <Route
            path="/employee/schedules"
            element={
              <ProtectedRoute allowedRoles={['employee']}>
                <EmployeeSchedulePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/payslips"
            element={
              <ProtectedRoute allowedRoles={['employee']}>
                <EmployeePortalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/payslips/:payRunId"
            element={
              <ProtectedRoute allowedRoles={['employee']}>
                <EmployeePayslipViewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/timesheet"
            element={
              <ProtectedRoute allowedRoles={['employee']}>
                <EmployeeTimesheetPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/approvals"
            element={
              <ProtectedRoute allowedRoles={['employee']}>
                <Navigate to="/employee/timesheet?tab=approvals" replace />
              </ProtectedRoute>
            }
          />
          
          <Route path="/" element={<ProtectedRoute allowedRoles={['admin']}><Layout /></ProtectedRoute>}>
            <Route index element={<HomeRedirect />} />
            <Route path="dashboard" element={<ProtectedRoute allowedRoles={['admin']}><Dashboard /></ProtectedRoute>} />
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="holidays" element={<HolidaysPage />} />
            <Route path="assignments" element={<ProtectedRoute allowedRoles={['admin']}><AssignmentsPage /></ProtectedRoute>} />
            <Route path="schedules" element={<SchedulesPage />} />
            <Route path="timesheet-entries" element={<ProtectedRoute allowedRoles={['admin']}><TimesheetEntriesPage /></ProtectedRoute>} />
            <Route path="approvals" element={<ProtectedRoute allowedRoles={['admin']}><ApprovalsPage /></ProtectedRoute>} />
            <Route path="timesheets/:timesheetId" element={<ProtectedRoute allowedRoles={['admin']}><TimesheetsPage /></ProtectedRoute>} />
            <Route path="reports" element={<ProtectedRoute allowedRoles={['admin']}><ReportsPage /></ProtectedRoute>} />
            <Route path="payroll" element={<ProtectedRoute allowedRoles={['admin']}><PayrollPage /></ProtectedRoute>}>
              <Route index element={<Navigate to="pay-runs" replace />} />
              <Route path="pay-runs" element={<PayRunsPage />} />
              <Route path="pay-runs/:payRunId" element={<PayRunDetailPage />} />
              <Route path="pay-runs/:payRunId/payslips/:entryId" element={<PayRunPayslipPage />} />
              <Route path="13th-month" element={<ThirteenthMonthRunsPage />} />
              <Route path="13th-month/:runId" element={<ThirteenthMonthDetailPage />} />
              <Route path="13th-month/:runId/payslips/:entryId" element={<ThirteenthMonthPayslipPage />} />
            </Route>
            <Route path="timesheet-report" element={<ProtectedRoute allowedRoles={['admin']}><ReportsPage /></ProtectedRoute>} />
            <Route path="pay-runs" element={<Navigate to="/payroll/pay-runs" replace />} />
            <Route path="pay-runs/:payRunId" element={<PayRunLegacyRedirect />} />
            <Route path="pay-runs/:payRunId/payslips/:entryId" element={<PayRunPayslipLegacyRedirect />} />
            <Route path="settings" element={<ProtectedRoute allowedRoles={['admin']}><SettingsPage /></ProtectedRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

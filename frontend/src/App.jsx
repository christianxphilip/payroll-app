import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Employee Portal Routes (Standalone Header Layout) */}
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
          
          <Route path="/" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="holidays" element={<HolidaysPage />} />
            <Route path="assignments" element={<AssignmentsPage />} />
            <Route path="schedules" element={<SchedulesPage />} />
            <Route path="timesheet-entries" element={<TimesheetEntriesPage />} />
            <Route path="timesheets/:timesheetId" element={<TimesheetsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="payroll" element={<ReportsPage />} />
            <Route path="timesheet-report" element={<ReportsPage />} />
            <Route path="pay-runs" element={<ProtectedRoute allowedRoles={['admin']}><PayRunsPage /></ProtectedRoute>} />
            <Route path="pay-runs/:payRunId" element={<ProtectedRoute allowedRoles={['admin']}><PayRunDetailPage /></ProtectedRoute>} />
            <Route
              path="pay-runs/:payRunId/payslips/:entryId"
              element={<ProtectedRoute allowedRoles={['admin']}><PayRunPayslipPage /></ProtectedRoute>}
            />
            <Route path="settings" element={<ProtectedRoute allowedRoles={['admin']}><SettingsPage /></ProtectedRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;


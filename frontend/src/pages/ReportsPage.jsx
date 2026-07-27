import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { payRunAPI, timesheetAPI, employeeAPI, timesheetEntryAPI } from '../services/api';
import { formatMoney, formatHours, downloadCSV } from '../utils/formatters';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import Tooltip from '../components/Tooltip';
import ResponsiveTableWrapper from '../components/ResponsiveTableWrapper';

const ReportsPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const timesheetIdParam = searchParams.get('timesheetId');
  const [activeTab, setActiveTab] = useState('timesheet'); // 'timesheet' or 'payroll'
  
  const [employees, setEmployees] = useState([]);
  const [timesheetReport, setTimesheetReport] = useState(null);
  const [payrollReport, setPayrollReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    employeeName: '',
    includeSubmittedOnly: false,
  });
  // Payroll report period selection
  const [payrollPeriod, setPayrollPeriod] = useState({
    type: 'yearly', // 'yearly', 'monthly', 'semi-monthly'
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1, // 1-12
    period: 'first', // 'first' or 'second' for semi-monthly
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (user?.role === 'manager' && activeTab === 'payroll') {
      setActiveTab('timesheet');
    }
  }, [user, activeTab]);

  useEffect(() => {
    fetchEmployees();
    
    // If timesheetId is provided in URL, auto-generate timesheet report
    if (timesheetIdParam) {
      loadAndGenerateTimesheetReport(timesheetIdParam);
    }
  }, [timesheetIdParam]);

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll();
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Failed to fetch employees');
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const loadAndGenerateTimesheetReport = async (timesheetId) => {
    setLoading(true);
    try {
      const entryResponse = await timesheetEntryAPI.getById(timesheetId);
      const entry = entryResponse.data || entryResponse;
      
      if (!entry) {
        throw new Error('Timesheet entry not found');
      }
      
      const startDate = entry.startDate ? entry.startDate.split('T')[0] : '';
      const endDate = entry.endDate ? entry.endDate.split('T')[0] : '';
      
      const newFilters = {
        startDate,
        endDate,
        employeeName: '',
        includeSubmittedOnly: true,
      };
      setFilters(newFilters);
      
      const reportParams = {
        startDate,
        endDate,
        employeeName: '',
        includeSubmittedOnly: true,
        timesheetId: timesheetId
      };
      
      const response = await timesheetAPI.getReport(reportParams);
      const reportData = response.data || response;
      
      if (!reportData || !reportData.report) {
        throw new Error('Invalid report data structure');
      }
      
      if (reportData.report.length === 0) {
        showMessage('error', 'No data found for this timesheet. Please ensure timelogs are properly submitted.');
        setTimesheetReport(reportData);
      } else {
        setTimesheetReport(reportData);
        showMessage('success', `Timesheet report generated for "${entry.name}" - ${reportData.totalEmployees} employees, ${reportData.totalRecords} records`);
      }
    } catch (error) {
      console.error('[TimesheetReport] Error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to generate report';
      showMessage('error', `Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
  };

  const handleGenerateTimesheetReport = async () => {
    if (!filters.startDate || !filters.endDate) {
      showMessage('error', 'Please select start and end dates');
      return;
    }

    setLoading(true);
    try {
      const response = await timesheetAPI.getReport(filters);
      const reportData = response.data || response;
      setTimesheetReport(reportData);
      showMessage('success', 'Timesheet report generated successfully');
    } catch (error) {
      showMessage('error', 'Failed to generate timesheet report');
    } finally {
      setLoading(false);
    }
  };

  // Convert period selection to startDate and endDate
  const getDateRangeFromPeriod = (period) => {
    let startDate, endDate;
    
    if (period.type === 'yearly') {
      // Yearly: January 1 to December 31
      startDate = `${period.year}-01-01`;
      endDate = `${period.year}-12-31`;
    } else if (period.type === 'monthly') {
      // Monthly: First day to last day of the month
      const month = String(period.month).padStart(2, '0');
      const lastDay = new Date(period.year, period.month, 0).getDate();
      startDate = `${period.year}-${month}-01`;
      endDate = `${period.year}-${month}-${String(lastDay).padStart(2, '0')}`;
    } else if (period.type === 'semi-monthly') {
      // Semi-monthly: First half (1-15) or Second half (16-end of month)
      const month = String(period.month).padStart(2, '0');
      if (period.period === 'first') {
        startDate = `${period.year}-${month}-01`;
        endDate = `${period.year}-${month}-15`;
      } else {
        const lastDay = new Date(period.year, period.month, 0).getDate();
        startDate = `${period.year}-${month}-16`;
        endDate = `${period.year}-${month}-${String(lastDay).padStart(2, '0')}`;
      }
    }
    
    return { startDate, endDate };
  };

  const handleGeneratePayrollReport = async () => {
    // Convert period to date range
    const { startDate, endDate } = getDateRangeFromPeriod(payrollPeriod);
    
    const reportFilters = {
      startDate,
      endDate,
      employeeName: filters.employeeName,
      includeSubmittedOnly: filters.includeSubmittedOnly,
    };

    setLoading(true);
    try {
      const response = await payRunAPI.getFinancialReport(reportFilters);
      const reportData = response.data || response;
      setPayrollReport(reportData);
      showMessage('success', `Payroll report generated - Total Net Pay: ₱${formatMoney(reportData.summary.totalNetPay)}`);
    } catch (error) {
      showMessage('error', 'Failed to generate payroll report');
    } finally {
      setLoading(false);
    }
  };

  const handleExportTimesheetCSV = async () => {
    if (!timesheetReport) {
      showMessage('error', 'Please generate a timesheet report first');
      return;
    }

    setExporting(true);
    try {
      const csvFilters = {
        ...filters,
        format: 'csv',
      };

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:9001/api'}/timesheets/report?${new URLSearchParams(csvFilters)}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      const csvContent = await response.text();
      downloadCSV(csvContent, `timesheet-report-${new Date().toISOString().split('T')[0]}.csv`);
      showMessage('success', 'CSV exported successfully');
    } catch (error) {
      showMessage('error', 'Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPayrollCSV = async () => {
    if (!payrollReport) {
      showMessage('error', 'Please generate a payroll report first');
      return;
    }

    setExporting(true);
    try {
      // Convert period to date range for CSV export
      const { startDate, endDate } = getDateRangeFromPeriod(payrollPeriod);
      const csvFilters = {
        startDate,
        endDate,
        employeeName: filters.employeeName,
        includeSubmittedOnly: filters.includeSubmittedOnly,
        format: 'csv',
      };

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:9001/api'}/pay-runs/financial-report?${new URLSearchParams(csvFilters)}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      const csvContent = await response.text();
      downloadCSV(csvContent, `payroll-financial-report-${new Date().toISOString().split('T')[0]}.csv`);
      showMessage('success', 'CSV exported successfully');
    } catch (error) {
      showMessage('error', 'Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const handleSubmitTimesheets = async () => {
    if (!timesheetReport) {
      showMessage('error', 'Please generate a timesheet report first');
      return;
    }

    if (!confirm('Are you sure you want to submit and archive these timesheets? This action will lock them.')) {
      return;
    }

    try {
      const timesheetsResponse = await timesheetAPI.getAll(filters);
      const timesheetIds = timesheetsResponse.data.map((t) => t._id);

      if (timesheetIds.length === 0) {
        showMessage('error', 'No timesheets found to submit');
        return;
      }

      const response = await timesheetAPI.submit(timesheetIds);
      showMessage('success', response.message || 'Timesheets submitted successfully');
      
      handleGenerateTimesheetReport();
    } catch (error) {
      showMessage('error', 'Failed to submit timesheets');
    }
  };

  return (
    <div className="px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('timesheet')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'timesheet'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Timesheet Report
            </button>
            {user?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('payroll')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'payroll'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Payroll Report
              </button>
            )}
          </nav>
        </div>
      </div>

      {loading && (
        <div className="mb-6">
          <LoadingSkeleton type="card" />
        </div>
      )}

      {message.text && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Report Parameters</h2>
        
        {activeTab === 'timesheet' ? (
          // Timesheet Report: Date Range
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Employee (Optional)
              </label>
              <select
                value={filters.employeeName}
                onChange={(e) => handleFilterChange('employeeName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">All Employees</option>
                {employees.map((emp) => (
                  <option key={emp._id} value={emp.employeeName}>
                    {emp.employeeName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.includeSubmittedOnly}
                  onChange={(e) => handleFilterChange('includeSubmittedOnly', e.target.checked)}
                  className="mr-2 rounded"
                />
                <span className="text-sm">Submitted only</span>
              </label>
            </div>
          </div>
        ) : (
          // Payroll Report: Period Selection
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Period Type <span className="text-red-500">*</span>
              </label>
              <select
                value={payrollPeriod.type}
                onChange={(e) => setPayrollPeriod({ ...payrollPeriod, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="yearly">Yearly</option>
                <option value="monthly">Monthly</option>
                <option value="semi-monthly">Semi-Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Year <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={payrollPeriod.year}
                onChange={(e) => setPayrollPeriod({ ...payrollPeriod, year: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                min="2000"
                max="2100"
                required
              />
            </div>
            {(payrollPeriod.type === 'monthly' || payrollPeriod.type === 'semi-monthly') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Month <span className="text-red-500">*</span>
                </label>
                <select
                  value={payrollPeriod.month}
                  onChange={(e) => setPayrollPeriod({ ...payrollPeriod, month: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="1">January</option>
                  <option value="2">February</option>
                  <option value="3">March</option>
                  <option value="4">April</option>
                  <option value="5">May</option>
                  <option value="6">June</option>
                  <option value="7">July</option>
                  <option value="8">August</option>
                  <option value="9">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>
              </div>
            )}
            {payrollPeriod.type === 'semi-monthly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Period <span className="text-red-500">*</span>
                </label>
                <select
                  value={payrollPeriod.period}
                  onChange={(e) => setPayrollPeriod({ ...payrollPeriod, period: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="first">First Half (1-15)</option>
                  <option value="second">Second Half (16-End)</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Employee (Optional)
              </label>
              <select
                value={filters.employeeName}
                onChange={(e) => handleFilterChange('employeeName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">All Employees</option>
                {employees.map((emp) => (
                  <option key={emp._id} value={emp.employeeName}>
                    {emp.employeeName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.includeSubmittedOnly}
                  onChange={(e) => handleFilterChange('includeSubmittedOnly', e.target.checked)}
                  className="mr-2 rounded"
                />
                <span className="text-sm">Submitted only</span>
              </label>
            </div>
          </div>
        )}
        
        <div className="mt-4">
          {activeTab === 'timesheet' ? (
            <button
              onClick={handleGenerateTimesheetReport}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Generating...' : 'Generate Timesheet Report'}
            </button>
          ) : (
            <button
              onClick={handleGeneratePayrollReport}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Generating...' : 'Generate Payroll Report'}
            </button>
          )}
        </div>
      </div>

      {/* Timesheet Report Tab */}
      {activeTab === 'timesheet' && timesheetReport && (
        <>
          {/* Report Summary */}
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Timesheet Report Summary</h2>
              <div className="flex gap-2">
                <button
                  onClick={handleExportTimesheetCSV}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  Export to CSV
                </button>
                {!filters.includeSubmittedOnly && (
                  <button
                    onClick={handleSubmitTimesheets}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                  >
                    Submit Timesheets
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Employees</p>
                <p className="text-2xl font-bold text-blue-900">{timesheetReport.totalEmployees}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Records</p>
                <p className="text-2xl font-bold text-green-900">{timesheetReport.totalRecords}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Generated At</p>
                <p className="text-sm font-bold text-purple-900">
                  {new Date(timesheetReport.generatedAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Consolidated Report Table */}
          <ResponsiveTableWrapper stickyFirstColumn={true}>
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Employee Name
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Total Hours
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      ND Hours
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Regular Holiday Hours
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Special Holiday Hours
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Overtime Hours
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      OT Regular Holiday
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      OT Special Holiday
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Records
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {timesheetReport.report.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="px-6 py-4 text-center text-gray-500">
                        No data found for selected criteria
                      </td>
                    </tr>
                  ) : (
                    timesheetReport.report.map((employee, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap font-medium">
                          {employee.employeeName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {formatHours(employee.totalConsolidatedHours)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {formatHours(employee.totalNDHours)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            {formatHours(employee.regularHolidayHours)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {formatHours(employee.specialHolidayHours)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-orange-600">
                          {formatHours(employee.totalOvertimeHours)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-purple-600">
                          {formatHours(employee.overtimeRegularHolidayHours || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-pink-600">
                          {formatHours(employee.overtimeSpecialHolidayHours || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-gray-500">
                          {employee.recordCount}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ResponsiveTableWrapper>
        </>
      )}

      {/* Payroll Report Tab */}
      {activeTab === 'payroll' && payrollReport && (
        <>
          {/* Financial Summary */}
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Payroll Financial Summary</h2>
              <button
                onClick={handleExportPayrollCSV}
                disabled={exporting}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {exporting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Exporting...
                  </>
                ) : (
                  'Export to CSV'
                )}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Basic Salary</p>
                <p className="text-2xl font-bold text-blue-900">₱ {formatMoney(payrollReport.summary.totalBasicSalary)}</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Overtime Pay</p>
                <p className="text-2xl font-bold text-orange-900">₱ {formatMoney(payrollReport.summary.totalOvertimePay + payrollReport.summary.totalOvertimeRegularHolidayPay + payrollReport.summary.totalOvertimeSpecialHolidayPay)}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Allowances</p>
                <p className="text-2xl font-bold text-purple-900">₱ {formatMoney(payrollReport.summary.totalAllowances)}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Deductions</p>
                <p className="text-2xl font-bold text-red-900">₱ {formatMoney(payrollReport.summary.totalDeductions)}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg col-span-full">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-600">Total Net Pay</p>
                    <p className="text-3xl font-bold text-green-900">₱ {formatMoney(payrollReport.summary.totalNetPay)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Average per Employee</p>
                    <p className="text-xl font-bold text-green-800">₱ {formatMoney(payrollReport.summary.averagePayPerEmployee)}</p>
                    <p className="text-xs text-gray-500 mt-1">{payrollReport.summary.totalEmployees} employees</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Detailed Breakdown */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Cost Breakdown</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Regular OT Pay</p>
                  <p className="font-semibold">₱ {formatMoney(payrollReport.summary.totalOvertimePay)}</p>
                </div>
                <div>
                  <p className="text-gray-600">OT Regular Holiday</p>
                  <p className="font-semibold text-purple-600">₱ {formatMoney(payrollReport.summary.totalOvertimeRegularHolidayPay)}</p>
                </div>
                <div>
                  <p className="text-gray-600">OT Special Holiday</p>
                  <p className="font-semibold text-pink-600">₱ {formatMoney(payrollReport.summary.totalOvertimeSpecialHolidayPay)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Night Differential</p>
                  <p className="font-semibold">₱ {formatMoney(payrollReport.summary.totalNightDiffPay)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Regular Holiday Pay</p>
                  <p className="font-semibold">₱ {formatMoney(payrollReport.summary.totalRegularHolidayPay)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Special Holiday Pay</p>
                  <p className="font-semibold">₱ {formatMoney(payrollReport.summary.totalSpecialHolidayPay)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Total Records</p>
                  <p className="font-semibold">{payrollReport.summary.totalRecords}</p>
                </div>
                <div>
                  <p className="text-gray-600">Generated At</p>
                  <p className="font-semibold text-xs">{new Date(payrollReport.generatedAt).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Employee Payroll Breakdown Table */}
          <ResponsiveTableWrapper stickyFirstColumn={true}>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Hours</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Basic Salary</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">OT Pay</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">OT RH Pay</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">OT SH Pay</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ND Pay</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Holiday Pay</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Allowances</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deductions</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net Pay</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payrollReport.report.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="px-6 py-4 text-center text-gray-500">
                      No data found for selected criteria
                    </td>
                  </tr>
                ) : (
                  payrollReport.report.map((employee, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap font-medium">
                        {employee.employeeName}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {employee.position || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                        {formatHours(employee.totalHoursWorked)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-medium">
                        ₱ {formatMoney(employee.basicSalary)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-orange-600">
                        ₱ {formatMoney(employee.overtimePay)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium text-purple-600">
                        ₱ {formatMoney(employee.overtimeRegularHolidayPay)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium text-pink-600">
                        ₱ {formatMoney(employee.overtimeSpecialHolidayPay)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                        ₱ {formatMoney(employee.nightDiffPay)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                        ₱ {formatMoney(employee.regularHolidayPay + employee.specialHolidayPay)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-green-600">
                        ₱ {formatMoney(employee.allowancesTotal)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-red-600">
                        ₱ {formatMoney(employee.deductionsTotal)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-lg text-green-700">
                        ₱ {formatMoney(employee.netSalary)}
                      </td>
                    </tr>
                  ))
                )}
                {payrollReport.report.length > 0 && (
                  <tr className="bg-gray-100 font-bold">
                    <td colSpan="3" className="px-4 py-3 text-right">TOTAL</td>
                    <td className="px-4 py-3 text-right">₱ {formatMoney(payrollReport.summary.totalBasicSalary)}</td>
                    <td className="px-4 py-3 text-right">₱ {formatMoney(payrollReport.summary.totalOvertimePay)}</td>
                    <td className="px-4 py-3 text-right">₱ {formatMoney(payrollReport.summary.totalOvertimeRegularHolidayPay)}</td>
                    <td className="px-4 py-3 text-right">₱ {formatMoney(payrollReport.summary.totalOvertimeSpecialHolidayPay)}</td>
                    <td className="px-4 py-3 text-right">₱ {formatMoney(payrollReport.summary.totalNightDiffPay)}</td>
                    <td className="px-4 py-3 text-right">₱ {formatMoney(payrollReport.summary.totalRegularHolidayPay + payrollReport.summary.totalSpecialHolidayPay)}</td>
                    <td className="px-4 py-3 text-right">₱ {formatMoney(payrollReport.summary.totalAllowances)}</td>
                    <td className="px-4 py-3 text-right">₱ {formatMoney(payrollReport.summary.totalDeductions)}</td>
                    <td className="px-4 py-3 text-right text-lg">₱ {formatMoney(payrollReport.summary.totalNetPay)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </ResponsiveTableWrapper>
        </>
      )}

      {!timesheetReport && !payrollReport && !loading && (
        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <p className="text-gray-500 text-lg">
            Select date range and click "Generate {activeTab === 'timesheet' ? 'Timesheet' : 'Payroll'} Report" to view {activeTab === 'timesheet' ? 'timesheet hours' : 'payroll financial'} summary
          </p>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;


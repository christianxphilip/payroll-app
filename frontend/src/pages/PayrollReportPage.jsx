import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { payRunAPI, employeeAPI, timesheetEntryAPI } from '../services/api';
import { formatMoney, formatHours, downloadCSV } from '../utils/formatters';

const PayrollReportPage = () => {
  const [searchParams] = useSearchParams();
  const timesheetIdParam = searchParams.get('timesheetId');
  
  const [employees, setEmployees] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    employeeName: '',
    includeSubmittedOnly: false,
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchEmployees();
    
    // If timesheetId is provided in URL, auto-generate report
    if (timesheetIdParam) {
      loadAndGenerateReport(timesheetIdParam);
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

  const loadAndGenerateReport = async (timesheetId) => {
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
      
      const response = await payRunAPI.getFinancialReport(reportParams);
      const reportData = response.data || response;
      
      if (!reportData || !reportData.report) {
        throw new Error('Invalid report data structure');
      }
      
      if (reportData.report.length === 0) {
        showMessage('error', 'No data found for this timesheet. Please ensure timelogs are properly submitted.');
        setReport(reportData);
      } else {
        setReport(reportData);
        showMessage('success', `Payroll report generated for "${entry.name}" - ${reportData.summary.totalEmployees} employees, Total Net Pay: ₱${formatMoney(reportData.summary.totalNetPay)}`);
      }
    } catch (error) {
      console.error('[PayrollReport] Error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to generate report';
      showMessage('error', `Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
  };

  const handleGenerateReport = async () => {
    if (!filters.startDate || !filters.endDate) {
      showMessage('error', 'Please select start and end dates');
      return;
    }

    setLoading(true);
    try {
      const response = await payRunAPI.getFinancialReport(filters);
      const reportData = response.data || response;
      setReport(reportData);
      showMessage('success', `Payroll report generated - Total Net Pay: ₱${formatMoney(reportData.summary.totalNetPay)}`);
    } catch (error) {
      showMessage('error', 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    if (!report) {
      showMessage('error', 'Please generate a report first');
      return;
    }

    try {
      const csvFilters = {
        ...filters,
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
    }
  };

  return (
    <div className="px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Payroll Financial Report</h1>
      </div>

      {loading && (
        <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg mb-6">
          <div className="flex items-center justify-center gap-3">
            <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-lg font-medium text-blue-900">Generating report, please wait...</span>
          </div>
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
        <div className="mt-4">
          <button
            onClick={handleGenerateReport}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* Report Display */}
      {report && (
        <>
          {/* Financial Summary */}
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Financial Summary</h2>
              <button
                onClick={handleExportCSV}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                Export to CSV
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Basic Salary</p>
                <p className="text-2xl font-bold text-blue-900">₱ {formatMoney(report.summary.totalBasicSalary)}</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Overtime Pay</p>
                <p className="text-2xl font-bold text-orange-900">₱ {formatMoney(report.summary.totalOvertimePay + report.summary.totalOvertimeRegularHolidayPay + report.summary.totalOvertimeSpecialHolidayPay)}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Allowances</p>
                <p className="text-2xl font-bold text-purple-900">₱ {formatMoney(report.summary.totalAllowances)}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Deductions</p>
                <p className="text-2xl font-bold text-red-900">₱ {formatMoney(report.summary.totalDeductions)}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg col-span-full">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-600">Total Net Pay</p>
                    <p className="text-3xl font-bold text-green-900">₱ {formatMoney(report.summary.totalNetPay)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Average per Employee</p>
                    <p className="text-xl font-bold text-green-800">₱ {formatMoney(report.summary.averagePayPerEmployee)}</p>
                    <p className="text-xs text-gray-500 mt-1">{report.summary.totalEmployees} employees</p>
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
                  <p className="font-semibold">₱ {formatMoney(report.summary.totalOvertimePay)}</p>
                </div>
                <div>
                  <p className="text-gray-600">OT Regular Holiday</p>
                  <p className="font-semibold text-purple-600">₱ {formatMoney(report.summary.totalOvertimeRegularHolidayPay)}</p>
                </div>
                <div>
                  <p className="text-gray-600">OT Special Holiday</p>
                  <p className="font-semibold text-pink-600">₱ {formatMoney(report.summary.totalOvertimeSpecialHolidayPay)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Night Differential</p>
                  <p className="font-semibold">₱ {formatMoney(report.summary.totalNightDiffPay)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Regular Holiday Pay</p>
                  <p className="font-semibold">₱ {formatMoney(report.summary.totalRegularHolidayPay)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Special Holiday Pay</p>
                  <p className="font-semibold">₱ {formatMoney(report.summary.totalSpecialHolidayPay)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Total Records</p>
                  <p className="font-semibold">{report.summary.totalRecords}</p>
                </div>
                <div>
                  <p className="text-gray-600">Generated At</p>
                  <p className="font-semibold text-xs">{new Date(report.generatedAt).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Employee Payroll Breakdown Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
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
                  {report.report.length === 0 ? (
                    <tr>
                      <td colSpan="12" className="px-6 py-4 text-center text-gray-500">
                        No data found for selected criteria
                      </td>
                    </tr>
                  ) : (
                    report.report.map((employee, index) => (
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
                  {report.report.length > 0 && (
                    <tr className="bg-gray-100 font-bold">
                      <td colSpan="3" className="px-4 py-3 text-right">TOTAL</td>
                      <td className="px-4 py-3 text-right">₱ {formatMoney(report.summary.totalBasicSalary)}</td>
                      <td className="px-4 py-3 text-right">₱ {formatMoney(report.summary.totalOvertimePay)}</td>
                      <td className="px-4 py-3 text-right">₱ {formatMoney(report.summary.totalOvertimeRegularHolidayPay)}</td>
                      <td className="px-4 py-3 text-right">₱ {formatMoney(report.summary.totalOvertimeSpecialHolidayPay)}</td>
                      <td className="px-4 py-3 text-right">₱ {formatMoney(report.summary.totalNightDiffPay)}</td>
                      <td className="px-4 py-3 text-right">₱ {formatMoney(report.summary.totalRegularHolidayPay + report.summary.totalSpecialHolidayPay)}</td>
                      <td className="px-4 py-3 text-right">₱ {formatMoney(report.summary.totalAllowances)}</td>
                      <td className="px-4 py-3 text-right">₱ {formatMoney(report.summary.totalDeductions)}</td>
                      <td className="px-4 py-3 text-right text-lg">₱ {formatMoney(report.summary.totalNetPay)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!report && !loading && (
        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <p className="text-gray-500 text-lg">
            Select date range and click "Generate Report" to view payroll financial summary
          </p>
          <p className="text-gray-400 text-sm mt-2">
            This report shows compensation breakdown including salaries, overtime, allowances, and deductions
          </p>
        </div>
      )}
    </div>
  );
};

export default PayrollReportPage;


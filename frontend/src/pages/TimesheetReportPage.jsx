import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { timesheetAPI, employeeAPI, timesheetEntryAPI } from '../services/api';
import { formatHours, downloadCSV } from '../utils/formatters';

const TimesheetReportPage = () => {
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
  const [selectedTimesheetIds, setSelectedTimesheetIds] = useState([]);
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
      console.log('[PayrollReport] Loading report for timesheetId:', timesheetId);
      
      // Fetch timesheet entry details
      const entryResponse = await timesheetEntryAPI.getById(timesheetId);
      console.log('[PayrollReport] Entry response:', entryResponse);
      const entry = entryResponse.data || entryResponse;
      
      if (!entry) {
        throw new Error('Timesheet entry not found');
      }
      
      console.log('[PayrollReport] Entry:', entry);
      
      // Set filters based on entry - extract just the date part if it's an ISO string
      const startDate = entry.startDate ? entry.startDate.split('T')[0] : '';
      const endDate = entry.endDate ? entry.endDate.split('T')[0] : '';
      
      const newFilters = {
        startDate,
        endDate,
        employeeName: '',
        includeSubmittedOnly: true,
      };
      setFilters(newFilters);
      console.log('[PayrollReport] Filters set:', newFilters);
      
      // Generate report with timesheetId filter - IMPORTANT: pass timesheetId!
      const reportParams = {
        startDate,
        endDate,
        employeeName: '',
        includeSubmittedOnly: true,
        timesheetId: timesheetId  // Explicitly pass the timesheetId
      };
      
      console.log('[PayrollReport] Calling getReport with params:', reportParams);
      
      const response = await timesheetAPI.getReport(reportParams);
      console.log('[PayrollReport] Report response:', response);
      console.log('[PayrollReport] Response type:', typeof response);
      console.log('[PayrollReport] Response keys:', Object.keys(response || {}));
      
      // The axios interceptor already unwraps response.data, so response IS the data
      const reportData = response;
      console.log('[PayrollReport] Report data:', reportData);
      console.log('[PayrollReport] Report data keys:', Object.keys(reportData || {}));
      console.log('[PayrollReport] Report array:', reportData?.report);
      console.log('[PayrollReport] Report array length:', reportData?.report?.length);
      console.log('[PayrollReport] Total employees:', reportData?.totalEmployees);
      console.log('[PayrollReport] Total records:', reportData?.totalRecords);
      
      if (!reportData) {
        throw new Error('No report data received from server');
      }
      
      if (!reportData.report) {
        console.error('[PayrollReport] Invalid report structure. Full response:', reportData);
        throw new Error(`Invalid report data structure. Keys received: ${Object.keys(reportData).join(', ')}`);
      }
      
      if (reportData.report.length === 0) {
        showMessage('error', 'No data found for this timesheet. Please ensure timelogs are properly submitted.');
        setReport(reportData); // Still set it so filters show
      } else {
        setReport(reportData);
        showMessage('success', `Report generated for "${entry.name}" - ${reportData.totalEmployees} employees, ${reportData.totalRecords} records`);
      }
    } catch (error) {
      console.error('[PayrollReport] Error:', error);
      console.error('[PayrollReport] Error stack:', error.stack);
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
      const response = await timesheetAPI.getReport(filters);
      // Extract report data from response
      const reportData = response.data || response;
      setReport(reportData);
      showMessage('success', 'Report generated successfully');
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

      // Make direct API call to get CSV
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:9001/api'}/timesheets/report?${new URLSearchParams(csvFilters)}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      const csvContent = await response.text();
      downloadCSV(csvContent, `payroll-report-${new Date().toISOString().split('T')[0]}.csv`);
      showMessage('success', 'CSV exported successfully');
    } catch (error) {
      showMessage('error', 'Failed to export CSV');
    }
  };

  const handleSubmitTimesheets = async () => {
    if (!report) {
      showMessage('error', 'Please generate a report first');
      return;
    }

    if (!confirm('Are you sure you want to submit and archive these timesheets? This action will lock them.')) {
      return;
    }

    try {
      // Get all timesheet IDs from the current filters
      const timesheetsResponse = await timesheetAPI.getAll(filters);
      const timesheetIds = timesheetsResponse.data.map((t) => t._id);

      if (timesheetIds.length === 0) {
        showMessage('error', 'No timesheets found to submit');
        return;
      }

      const response = await timesheetAPI.submit(timesheetIds);
      showMessage('success', response.message || 'Timesheets submitted successfully');
      
      // Refresh report
      handleGenerateReport();
    } catch (error) {
      showMessage('error', 'Failed to submit timesheets');
    }
  };

  return (
    <div className="px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Timesheet Report</h1>
      </div>

      {/* Debug info */}
      {!loading && !report && !message.text && timesheetIdParam && (
        <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg mb-6">
          <h3 className="text-lg font-semibold text-yellow-900 mb-2">Loading Report...</h3>
          <p className="text-sm text-yellow-800">Timesheet ID: {timesheetIdParam}</p>
          <p className="text-sm text-yellow-800 mt-2">Check browser console (F12) for detailed logs.</p>
        </div>
      )}

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
          {/* Report Summary */}
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Report Summary</h2>
              <div className="flex gap-2">
                <button
                  onClick={handleExportCSV}
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
                <p className="text-2xl font-bold text-blue-900">{report.totalEmployees}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Records</p>
                <p className="text-2xl font-bold text-green-900">{report.totalRecords}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Generated At</p>
                <p className="text-sm font-bold text-purple-900">
                  {new Date(report.generatedAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Consolidated Report Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
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
                  {report.report.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="px-6 py-4 text-center text-gray-500">
                        No data found for selected criteria
                      </td>
                    </tr>
                  ) : (
                    report.report.map((employee, index) => (
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
            </div>
          </div>

          {/* Calculation Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
            <h3 className="font-bold text-blue-900 mb-2">Calculation Notes:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
              <li>Total Hours: Sum of all adjusted hours worked</li>
              <li>ND Hours: Night Differential hours (10:00 PM - 6:00 AM)</li>
              <li>Overtime: Hours exceeding scheduled hours (when scheduled hours &gt; 0)</li>
              <li>Holidays: Total payable hours worked on Regular or Special holiday dates</li>
            </ul>
          </div>
        </>
      )}

      {!report && !loading && (
        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <p className="text-gray-500 text-lg">
            Select date range and click "Generate Report" to view payroll summary
          </p>
        </div>
      )}
    </div>
  );
};

export default TimesheetReportPage;


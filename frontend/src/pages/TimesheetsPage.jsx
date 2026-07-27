import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { timesheetAPI, timesheetEntryAPI, employeeAPI, scheduleAPI } from '../services/api';
import Modal from '../components/Modal';
import { formatDate, formatTime, formatHours } from '../utils/formatters';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';

const TimesheetsPage = () => {
  const { timesheetId } = useParams();
  const navigate = useNavigate();
  const [timesheetEntry, setTimesheetEntry] = useState(null);
  const [timesheets, setTimesheets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });
  const [sort, setSort] = useState({
    sortBy: 'date',
    sortOrder: 'desc'
  });
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    employeeName: '',
    reviewFlag: '',
    isSubmitted: '',
  });
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmData, setConfirmData] = useState({ missingLogs: [], totalLogs: 0 });
  const [uploadFile, setUploadFile] = useState(null);
  const [formData, setFormData] = useState({
    employeeName: '',
    date: '',
    timeIn: '',
    timeOut: '',
    selectedScheduleId: '', // For multiple schedules
  });
  const [availableSchedules, setAvailableSchedules] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [batchLoading, setBatchLoading] = useState(false);

  useEffect(() => {
    if (!timesheetId) {
      navigate('/timesheet-entries');
      return;
    }
    fetchTimesheetEntry();
    fetchEmployees();
    fetchTimesheets();
  }, [timesheetId]);

  // Fetch schedules when employee and date are selected in manual entry modal
  useEffect(() => {
    const fetchSchedulesForDate = async () => {
      if (formData.employeeName && formData.date && isManualModalOpen) {
        try {
          const response = await scheduleAPI.getAll({
            employeeName: formData.employeeName,
            startDate: formData.date,
            endDate: formData.date,
            limit: 100
          });
          const schedules = (response.data || []).filter(s => !s.isOff);
          setAvailableSchedules(schedules);
          
          // If only one schedule, auto-select it
          if (schedules.length === 1) {
            setFormData(prev => ({ ...prev, selectedScheduleId: schedules[0]._id }));
          } else if (schedules.length > 1) {
            // Reset selection if multiple schedules
            setFormData(prev => ({ ...prev, selectedScheduleId: '' }));
          } else {
            setFormData(prev => ({ ...prev, selectedScheduleId: '' }));
          }
        } catch (error) {
          console.error('Failed to fetch schedules:', error);
          setAvailableSchedules([]);
        }
      } else if (!formData.employeeName || !formData.date) {
        setAvailableSchedules([]);
        setFormData(prev => ({ ...prev, selectedScheduleId: '' }));
      }
    };

    fetchSchedulesForDate();
  }, [formData.employeeName, formData.date, isManualModalOpen]);

  const fetchTimesheetEntry = async () => {
    try {
      const response = await timesheetEntryAPI.getById(timesheetId);
      setTimesheetEntry(response.data);
    } catch (error) {
      showMessage('error', 'Failed to fetch timesheet entry');
      navigate('/timesheet-entries');
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll();
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Failed to fetch employees');
    }
  };

  const fetchTimesheets = async (page = pagination.page) => {
    try {
      const params = {
        timesheetId, // Filter by parent timesheet entry
        ...filters,
        ...sort,
        page,
        limit: pagination.limit
      };
      const response = await timesheetAPI.getAll(params);
      setTimesheets(response.data || []);
      if (response.pagination) {
        setPagination(response.pagination);
      }
    } catch (error) {
      showMessage('error', 'Failed to fetch timesheets');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (column) => {
    const newSortOrder = sort.sortBy === column && sort.sortOrder === 'asc' ? 'desc' : 'asc';
    setSort({ sortBy: column, sortOrder: newSortOrder });
    setPagination({ ...pagination, page: 1 });
    setTimeout(() => fetchTimesheets(1), 0);
  };

  const getSortIcon = (column) => {
    if (sort.sortBy !== column) return ' ⇅';
    return sort.sortOrder === 'asc' ? ' ↑' : ' ↓';
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const handleFilterChange = (field, value) => {
    const newFilters = { ...filters, [field]: value };
    setFilters(newFilters);
    // Auto-apply filters - fetch with new filters from page 1
    setPagination({ ...pagination, page: 1 });
    
    // Use setTimeout to batch the state updates
    setTimeout(async () => {
      try {
        const params = {
          timesheetId,
          ...newFilters,
          ...sort,
          page: 1,
          limit: pagination.limit
        };
        const response = await timesheetAPI.getAll(params);
        setTimesheets(response.data || []);
        if (response.pagination) {
          setPagination(response.pagination);
        }
      } catch (error) {
        showMessage('error', 'Failed to fetch timesheets');
      }
    }, 0);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(timesheets.map((t) => t._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const openAddModal = () => {
    setFormData({
      employeeName: '',
      date: '',
      timeIn: '',
      timeOut: '',
      selectedScheduleId: '',
    });
    setAvailableSchedules([]);
    setIsManualModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // If multiple schedules exist, require selection
      if (availableSchedules.length > 1 && !formData.selectedScheduleId) {
        showMessage('error', 'Please select a schedule');
        return;
      }

      // Combine date and time into full timestamps
      const timeInDate = new Date(`${formData.date}T${formData.timeIn}`);
      let timeOutDate = new Date(`${formData.date}T${formData.timeOut}`);

      // If timeOut is before timeIn, assume it's the next day (overnight shift)
      if (timeOutDate <= timeInDate) {
        const nextDay = new Date(timeOutDate);
        nextDay.setDate(nextDay.getDate() + 1);
        timeOutDate = nextDay;
      }

      const submitData = {
        timesheetId, // Associate with parent timesheet entry
        employeeName: formData.employeeName,
        date: formData.date,
        timeIn: timeInDate.toISOString(),
        timeOut: timeOutDate.toISOString(),
      };

      // If a schedule was selected, use its data for calculation
      if (formData.selectedScheduleId) {
        const selectedSchedule = availableSchedules.find(s => s._id === formData.selectedScheduleId);
        if (selectedSchedule) {
          // Pass schedule info to backend for proper matching
          submitData.scheduleId = selectedSchedule._id;
        }
      }

      await timesheetAPI.create(submitData);
      showMessage('success', 'Time log created successfully');
      setIsManualModalOpen(false);
      fetchTimesheets();
      fetchTimesheetEntry(); // Refresh count
    } catch (error) {
      showMessage('error', error.response?.data?.error || 'Operation failed');
    }
  };

  const handleInlineEdit = async (id, field, value) => {
    try {
      const updateData = { [field]: value };
      const response = await timesheetAPI.update(id, updateData);
      
      // Update the timesheet in state immediately with the response data
      if (response.data) {
        setTimesheets(prevTimesheets => {
          const updated = prevTimesheets.map(t => 
            t._id === id ? { ...t, ...response.data } : t
          );
          // Return a new array reference to ensure React re-renders
          return [...updated];
        });
      } else {
        // Fallback: refetch if response doesn't have data
        fetchTimesheets();
      }
    } catch (error) {
      showMessage('error', 'Failed to update timesheet');
    }
  };

  const handleTimeEdit = async (timesheet, field, newTimeValue) => {
    try {
      // newTimeValue is in format "HH:MM" from time input
      if (!newTimeValue) return;
      
      console.log('[TimeEdit] Editing', field, 'to', newTimeValue);
      console.log('[TimeEdit] Original timesheet:', timesheet);
      
      // Get the date in YYYY-MM-DD format
      const date = new Date(timesheet.date);
      const dateStr = date.toISOString().split('T')[0]; // Get YYYY-MM-DD
      
      // Parse the time
      const [hours, minutes] = newTimeValue.split(':');
      
      // Construct ISO string with Philippines timezone offset (+08:00)
      let isoString = `${dateStr}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00+08:00`;
      let newDateTime = new Date(isoString);
      
      // If editing timeOut and it would be before timeIn, assume it's next day
      if (field === 'timeOut' && timesheet.timeIn) {
        const timeInDate = new Date(timesheet.timeIn);
        console.log('[TimeEdit] Comparing timeOut:', newDateTime, 'with timeIn:', timeInDate);
        
        if (newDateTime <= timeInDate) {
          console.log('[TimeEdit] TimeOut is before or equal to TimeIn, adding 1 day');
          // Add 1 day to timeOut
          const nextDayDate = new Date(date);
          nextDayDate.setDate(nextDayDate.getDate() + 1);
          const nextDayStr = nextDayDate.toISOString().split('T')[0];
          isoString = `${nextDayStr}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00+08:00`;
          newDateTime = new Date(isoString);
          console.log('[TimeEdit] Adjusted to next day:', newDateTime);
        }
      }
      
      console.log('[TimeEdit] Final ISO string:', isoString);
      console.log('[TimeEdit] Final datetime:', newDateTime);
      
      // Send the full datetime to backend
      const updateData = { [field]: newDateTime.toISOString() };
      console.log('[TimeEdit] Sending update:', updateData);
      
      showMessage('success', 'Recalculating...');
      const response = await timesheetAPI.update(timesheet._id, updateData);
      
      console.log('[TimeEdit] API Response:', response);
      console.log('[TimeEdit] Response data:', response.data);
      console.log('[TimeEdit] OvertimeHours in response:', response.data?.overtimeHours);
      
      // Update the timesheet in state immediately with the response data
      if (response.data) {
        setTimesheets(prevTimesheets => {
          const updated = prevTimesheets.map(t => {
            if (t._id === timesheet._id) {
              // Create a new object to ensure React detects the change
              const merged = { ...t, ...response.data };
              console.log('[TimeEdit] Updated timesheet in state:', merged);
              console.log('[TimeEdit] OvertimeHours after merge:', merged.overtimeHours);
              return merged;
            }
            return t;
          });
          console.log('[TimeEdit] All timesheets after update:', updated);
          // Return a new array reference to ensure React re-renders
          return [...updated];
        });
      } else {
        // Fallback: refetch if response doesn't have data
        console.log('[TimeEdit] No response.data, refetching...');
        await fetchTimesheets();
      }
      
      // Refresh to get any other recalculated values and update log count
      await fetchTimesheetEntry(); // Update log count
      showMessage('success', 'Time updated and recalculated');
    } catch (error) {
      console.error('[TimeEdit] Error:', error);
      showMessage('error', error.response?.data?.error || 'Failed to update time');
    }
  };

  const handleBatchAdjust = async (action) => {
    if (selectedIds.length === 0) {
      showMessage('error', 'Please select timesheets first');
      return;
    }

    if (batchLoading) {
      showMessage('error', 'Please wait, processing previous action...');
      return;
    }

    try {
      setBatchLoading(true);
      console.log('[Batch Adjust] Starting action:', action, 'for', selectedIds.length, 'records');
      
      const response = await timesheetAPI.batchAdjust(selectedIds, action);
      console.log('[Batch Adjust] Response:', response);
      
      showMessage('success', response.message || 'Batch adjustment completed');
      setSelectedIds([]);
      
      // Force refresh the table
      console.log('[Batch Adjust] Refreshing table...');
      setLoading(true);
      await fetchTimesheets(pagination.page);
      await fetchTimesheetEntry(); // Update log count
      console.log('[Batch Adjust] Table refreshed');
    } catch (error) {
      console.error('[Batch Adjust] Error:', error);
      showMessage('error', error.response?.data?.error || 'Batch adjustment failed');
    } finally {
      setBatchLoading(false);
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this timesheet?')) return;

    try {
      await timesheetAPI.delete(id);
      showMessage('success', 'Timesheet deleted successfully');
      fetchTimesheets();
    } catch (error) {
      showMessage('error', 'Failed to delete timesheet');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      showMessage('error', 'Please select timesheets to delete');
      return;
    }

    if (batchLoading) {
      showMessage('error', 'Please wait, processing previous action...');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedIds.length} timesheet(s)?`)) {
      return;
    }

    try {
      setBatchLoading(true);
      let successCount = 0;
      for (const id of selectedIds) {
        await timesheetAPI.delete(id);
        successCount++;
      }
      showMessage('success', `${successCount} timesheets deleted successfully`);
      setSelectedIds([]);
      await fetchTimesheets();
      await fetchTimesheetEntry(); // Update log count
    } catch (error) {
      showMessage('error', 'Failed to delete some timesheets');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    
    if (!uploadFile) {
      showMessage('error', 'Please select a file');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('timesheetId', timesheetId); // Associate with parent entry

      const response = await timesheetAPI.uploadCSV(formData);
      const message = response.message || 'CSV uploaded successfully';
      
      // Show notification if there are skipped entries
      if (response.skippedEntries && response.skippedEntries.length > 0) {
        const skippedList = response.skippedEntries.map(e => `${e.employeeName} (${e.date})`).join(', ');
        showMessage('warning', `${message}. ${response.skippedEntries.length} entry(ies) skipped due to multiple schedules: ${skippedList}. Please add these manually.`);
      } else {
        showMessage('success', message);
      }
      
      setIsUploadModalOpen(false);
      setUploadFile(null);
      fetchTimesheets();
      fetchTimesheetEntry(); // Refresh count
    } catch (error) {
      showMessage('error', error.response?.data?.error || 'Upload failed');
    }
  };

  const handleSubmitTimesheet = async () => {
    try {
      // Get timesheet entry details for date range
      if (!timesheetEntry) {
        showMessage('error', 'Timesheet entry not found');
        return;
      }

      // Get all schedules for the date range
      const scheduleResponse = await scheduleAPI.getAll({
        startDate: timesheetEntry.startDate,
        endDate: timesheetEntry.endDate,
        page: 1,
        limit: 1000 // Get all schedules
      });

      const schedules = scheduleResponse.data || [];

      // Get all timelogs for this timesheet
      const timelogResponse = await timesheetAPI.getAll({
        timesheetId,
        page: 1,
        limit: 1000 // Get all logs
      });

      const timelogs = timelogResponse.data || [];

      // Create a map of employee+date to timelog
      const timelogMap = new Map();
      timelogs.forEach(log => {
        const key = `${log.employeeName}_${new Date(log.date).toDateString()}`;
        timelogMap.set(key, log);
      });

      // Find employees with schedules but no logs
      const missingLogs = [];
      schedules.forEach(schedule => {
        const key = `${schedule.employeeName}_${new Date(schedule.date).toDateString()}`;
        if (!timelogMap.has(key)) {
          missingLogs.push({
            employee: schedule.employeeName,
            date: new Date(schedule.date).toLocaleDateString(),
            shift: `${schedule.scheduledStartTime} - ${schedule.scheduledEndTime}`
          });
        }
      });

      // Show confirmation modal
      setConfirmData({ missingLogs, totalLogs: timelogs.length });
      setIsConfirmModalOpen(true);
    } catch (error) {
      showMessage('error', error.response?.data?.error || 'Failed to load validation data');
    }
  };

  const confirmSubmit = async () => {
    try {
      setIsConfirmModalOpen(false);
      
      // Submit the timesheet entry first
      await timesheetEntryAPI.submit(timesheetId);
      fetchTimesheetEntry(); // Refresh status
      
      // Navigate to payroll report page to show the consolidated report
      navigate(`/reports?timesheetId=${timesheetId}&startDate=${timesheetEntry.startDate}&endDate=${timesheetEntry.endDate}`);
    } catch (error) {
      showMessage('error', error.response?.data?.error || 'Failed to submit timesheet');
      setIsConfirmModalOpen(false);
    }
  };

  const handleDeleteTimesheetEntry = async () => {
    if (!confirm('Are you sure you want to delete this entire timesheet entry? All time logs will be permanently deleted.')) {
      return;
    }

    try {
      await timesheetEntryAPI.delete(timesheetId);
      showMessage('success', 'Timesheet entry deleted successfully');
      navigate('/timesheet-entries');
    } catch (error) {
      showMessage('error', error.response?.data?.error || 'Failed to delete timesheet entry');
    }
  };

  if (loading) {
    return <div className="p-6">Loading timesheets...</div>;
  }

  return (
    <div className="px-4 py-6">
      {/* Breadcrumb / Back Button */}
      <div className="mb-4">
        <button
          onClick={() => navigate('/timesheet-entries')}
          className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
        >
          ← Back to Timesheet Entries
        </button>
      </div>

      {/* Timesheet Entry Header */}
      {timesheetEntry && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{timesheetEntry.name}</h1>
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Date Range:</span>{' '}
                  {new Date(timesheetEntry.startDate).toLocaleDateString()} -{' '}
                  {new Date(timesheetEntry.endDate).toLocaleDateString()}
                </div>
                <div>
                  <span className="font-medium">Total Logs:</span> {timesheetEntry.logCount || 0}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 relative disabled:bg-gray-400 disabled:cursor-not-allowed"
                disabled={timesheetEntry?.status === 'submitted'}
              >
                Add Time Log
                <span className="text-xs">{isAddMenuOpen ? '▲' : '▼'}</span>
                {isAddMenuOpen && (
                  <div className="absolute right-0 top-12 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsUploadModalOpen(true);
                        setIsAddMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 rounded-t-lg text-gray-700"
                    >
                      <div className="font-medium">Upload CSV</div>
                      <div className="text-xs text-gray-500">Bulk import attendance data</div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openAddModal();
                        setIsAddMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded-b-lg text-gray-700"
                    >
                      <div className="font-medium">Manual Entry</div>
                      <div className="text-xs text-gray-500">Add individual time log</div>
                    </button>
                  </div>
                )}
              </button>
              <button
                onClick={handleSubmitTimesheet}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:bg-gray-400"
                disabled={timesheetEntry?.status === 'submitted'}
              >
                Submit Timesheet
              </button>
              <button
                onClick={handleDeleteTimesheetEntry}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2"
                title="Delete Timesheet Entry"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Delete Entry
              </button>
            </div>
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

      {/* Filters and Sort */}
      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort</label>
            <select
              value={`${sort.sortBy}-${sort.sortOrder}`}
              onChange={async (e) => {
                const [sortBy, sortOrder] = e.target.value.split('-');
                setSort({ sortBy, sortOrder });
                // Fetch with new sort parameters
                try {
                  const params = {
                    timesheetId,
                    ...filters,
                    sortBy,
                    sortOrder,
                    page: 1,
                    limit: pagination.limit
                  };
                  const response = await timesheetAPI.getAll(params);
                  setTimesheets(response.data || []);
                  if (response.pagination) {
                    setPagination(response.pagination);
                  }
                } catch (error) {
                  showMessage('error', error.response?.data?.error || 'Failed to sort timesheets');
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="employeeName-asc">Name + Earliest Date</option>
              <option value="date-asc">Earliest Date</option>
              <option value="date-desc">Latest Date</option>
              <option value="timeIn-asc">Earliest Time In</option>
              <option value="reviewFlag-desc">Flagged First</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Review Flag</label>
            <select
              value={filters.reviewFlag}
              onChange={(e) => handleFilterChange('reviewFlag', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">All</option>
              <option value="true">Flagged</option>
              <option value="false">Not Flagged</option>
            </select>
          </div>
        </div>
      </div>

      {/* Batch Operations */}
      {selectedIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-blue-900 font-medium">{selectedIds.length} selected</span>
            {batchLoading && (
              <div className="flex items-center gap-2 text-blue-700">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm font-medium">Processing...</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleBatchAdjust('applyScheduled')}
              disabled={batchLoading || timesheetEntry?.status === 'submitted'}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              title="Set Adjusted Hours to Scheduled Hours"
            >
              Apply Scheduled Hours
            </button>
            <button
              onClick={() => handleBatchAdjust('cap8')}
              disabled={batchLoading || timesheetEntry?.status === 'submitted'}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Apply 8-Hour Cap
            </button>
            <button
              onClick={() => handleBatchAdjust('approve')}
              disabled={batchLoading || timesheetEntry?.status === 'submitted'}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Approve Extended Hours
            </button>
            <button
              onClick={() => handleBatchAdjust('clearFlag')}
              disabled={batchLoading || timesheetEntry?.status === 'submitted'}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Clear Review Flag
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={batchLoading || timesheetEntry?.status === 'submitted'}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Timesheets Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-center w-12">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === timesheets.length && timesheets.length > 0}
                    onChange={handleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">
                  <button onClick={() => handleSort('employeeName')} className="hover:text-gray-700">
                    Employee{getSortIcon('employeeName')}
                  </button>
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-28">
                  <button onClick={() => handleSort('date')} className="hover:text-gray-700">
                    Date{getSortIcon('date')}
                  </button>
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase w-36">
                  <button onClick={() => handleSort('timeIn')} className="hover:text-gray-700">
                    Time In{getSortIcon('timeIn')}
                  </button>
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase w-36">
                  <button onClick={() => handleSort('timeOut')} className="hover:text-gray-700">
                    Time Out{getSortIcon('timeOut')}
                  </button>
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase w-20">
                  <button onClick={() => handleSort('hoursWorked')} className="hover:text-gray-700" title="Actual hours (less break if >= 7.5 hrs)">
                    Hours<br/><span className="text-[10px] font-normal normal-case">(less break)</span>{getSortIcon('hoursWorked')}
                  </button>
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase w-16">
                  <button onClick={() => handleSort('ndHours')} className="hover:text-gray-700">
                    ND{getSortIcon('ndHours')}
                  </button>
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase w-16">
                  <button onClick={() => handleSort('overtimeHours')} className="hover:text-gray-700">
                    OT{getSortIcon('overtimeHours')}
                  </button>
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase w-16">
                  Holiday
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase w-20">
                  <button onClick={() => handleSort('scheduledHours')} className="hover:text-gray-700" title="Scheduled hours (less break if >= 7.5 hrs)">
                    Sched<br/><span className="text-[10px] font-normal normal-case">(less break)</span>{getSortIcon('scheduledHours')}
                  </button>
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase w-20">
                  <button onClick={() => handleSort('adjustedHoursWorked')} className="hover:text-gray-700" title="Final payable hours (editable)">
                    Adjusted<br/><span className="text-[10px] font-normal normal-case">(payable)</span>{getSortIcon('adjustedHoursWorked')}
                  </button>
                </th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase w-16">
                  <button onClick={() => handleSort('reviewFlag')} className="hover:text-gray-700">
                    Review{getSortIcon('reviewFlag')}
                  </button>
                </th>
                <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase w-20">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {timesheets.length === 0 ? (
                <tr>
                  <td colSpan="13" className="px-6 py-4 text-center text-gray-500">
                    No timesheets found
                  </td>
                </tr>
              ) : (
                timesheets.map((timesheet) => (
                  <tr
                    key={timesheet._id}
                    className={`hover:bg-gray-50 ${
                      timesheet.reviewFlag ? 'bg-yellow-50' : ''
                    }`}
                  >
                    <td className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(timesheet._id)}
                        onChange={() => handleSelectOne(timesheet._id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <div className="truncate max-w-[130px]" title={timesheet.employeeName}>
                        {timesheet.employeeName}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm">
                      {new Date(timesheet.date).toLocaleDateString()}
                    </td>
                    <td className="px-2 py-2 text-sm">
                      <div className="flex flex-col gap-0.5">
                        {timesheet.timeIn ? (
                          <input
                            type="time"
                            defaultValue={new Date(timesheet.timeIn).toTimeString().slice(0, 5)}
                            onBlur={(e) => handleTimeEdit(timesheet, 'timeIn', e.target.value)}
                            disabled={timesheetEntry?.status === 'submitted'}
                            className="w-full px-1.5 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                          />
                        ) : '-'}
                        {timesheet.scheduledStartTime && (
                          <span className="text-[10px] text-gray-500 italic whitespace-nowrap">
                            Sched: {timesheet.scheduledStartTime}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-sm">
                      <div className="flex flex-col gap-0.5">
                        {timesheet.timeOut ? (
                          <input
                            type="time"
                            defaultValue={new Date(timesheet.timeOut).toTimeString().slice(0, 5)}
                            onBlur={(e) => handleTimeEdit(timesheet, 'timeOut', e.target.value)}
                            disabled={timesheetEntry?.status === 'submitted'}
                            className="w-full px-1.5 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                          />
                        ) : '-'}
                        {timesheet.scheduledEndTime && (
                          <span className="text-[10px] text-gray-500 italic whitespace-nowrap">
                            Sched: {timesheet.scheduledEndTime}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-sm text-right">
                      {formatHours(timesheet.hoursWorked)}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-sm text-right">
                      {formatHours(timesheet.ndHours)}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-sm text-right" key={`ot-${timesheet._id}-${timesheet.overtimeHours}`}>
                      {formatHours(timesheet.overtimeHours || 0)}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-sm text-center">
                      {timesheet.isHoliday ? (
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                            timesheet.holidayType === 'Regular'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                          title={timesheet.holidayType}
                        >
                          {timesheet.holidayType === 'Regular' ? 'RH' : 'SH'}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-sm text-right">
                      {formatHours(timesheet.scheduledHours)}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-sm">
                      <input
                        type="number"
                        step="0.01"
                        value={(timesheet.adjustedHoursWorked || 0).toFixed(2)}
                        onChange={(e) =>
                          handleInlineEdit(
                            timesheet._id,
                            'adjustedHoursWorked',
                            parseFloat(e.target.value)
                          )
                        }
                        disabled={timesheetEntry?.status === 'submitted'}
                        className="w-full px-1.5 py-1 border border-gray-300 rounded text-sm text-right disabled:bg-gray-100 disabled:cursor-not-allowed"
                        title="Payable hours (2 decimal places)"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-center">
                      {timesheet.reviewFlag && (
                        <span className="text-yellow-600 font-bold text-lg">⚠</span>
                      )}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-center text-sm font-medium">
                      <button
                        onClick={() => handleDelete(timesheet._id)}
                        disabled={timesheetEntry?.status === 'submitted'}
                        className="text-red-600 hover:text-red-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                        title="Delete"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-4 py-3 sm:px-6 mt-4 rounded-lg shadow">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => fetchTimesheets(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => fetchTimesheets(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing page <span className="font-medium">{pagination.page}</span> of{' '}
                <span className="font-medium">{pagination.totalPages}</span> ({pagination.total} total records)
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  onClick={() => fetchTimesheets(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {[...Array(Math.min(5, pagination.totalPages))].map((_, idx) => {
                  const pageNum = idx + 1;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => fetchTimesheets(pageNum)}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                        pagination.page === pageNum
                          ? 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                          : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => fetchTimesheets(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      <Modal isOpen={isManualModalOpen} onClose={() => setIsManualModalOpen(false)} title="Manual Entry - Add Time Log">
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Employee</label>
            <select
              value={formData.employeeName}
              onChange={(e) => setFormData({ ...formData, employeeName: e.target.value, selectedScheduleId: '' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            >
              <option value="">Select Employee</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp.employeeName}>
                  {emp.employeeName}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value, selectedScheduleId: '' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          {availableSchedules.length > 1 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Schedule <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.selectedScheduleId}
                onChange={(e) => setFormData({ ...formData, selectedScheduleId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              >
                <option value="">Select a schedule</option>
                {availableSchedules.map((schedule) => (
                  <option key={schedule._id} value={schedule._id}>
                    {schedule.scheduledStartTime} - {schedule.scheduledEndTime} ({schedule.scheduledDuration} hrs)
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                This employee has multiple schedules on this date. Please select which schedule this entry is for.
              </p>
            </div>
          )}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Time In</label>
            <input
              type="time"
              value={formData.timeIn}
              onChange={(e) => setFormData({ ...formData, timeIn: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Time Out</label>
            <input
              type="time"
              value={formData.timeOut}
              onChange={(e) => setFormData({ ...formData, timeOut: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsManualModalOpen(false);
                setFormData({
                  employeeName: '',
                  date: '',
                  timeIn: '',
                  timeOut: '',
                  selectedScheduleId: '',
                });
                setAvailableSchedules([]);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add
            </button>
          </div>
        </form>
      </Modal>

      {/* CSV Upload Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload Attendance CSV"
      >
        <form onSubmit={handleFileUpload}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">CSV File</label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setUploadFile(e.target.files[0])}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              Upload a CSV file with columns: Employee, Check In, Check Out
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Format: "Employee Name","2025-10-01 15:59:34","2025-10-02 00:31:10"
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Upload
            </button>
          </div>
        </form>
      </Modal>

      {/* Submit Confirmation Modal */}
      <Modal 
        isOpen={isConfirmModalOpen} 
        onClose={() => setIsConfirmModalOpen(false)} 
        title="Confirm Timesheet Submission"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to submit <strong>"{timesheetEntry?.name}"</strong>?
          </p>
          
          {confirmData.missingLogs.length > 0 ? (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Warning: {confirmData.missingLogs.length} scheduled shift(s) with no time logs
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <div className="max-h-48 overflow-y-auto">
                      <ul className="list-disc list-inside space-y-1">
                        {confirmData.missingLogs.slice(0, 10).map((log, index) => (
                          <li key={index}>
                            <strong>{log.employee}</strong> - {log.date} ({log.shift})
                          </li>
                        ))}
                        {confirmData.missingLogs.length > 10 && (
                          <li className="text-yellow-600 font-semibold">
                            ... and {confirmData.missingLogs.length - 10} more
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-yellow-800">
                    Do you still want to submit?
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-green-50 border-l-4 border-green-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700">
                    All scheduled shifts have corresponding time logs.
                  </p>
                  <p className="text-sm text-green-700 mt-1">
                    <strong>Total logs:</strong> {confirmData.totalLogs}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => setIsConfirmModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmSubmit}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Confirm & Submit
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TimesheetsPage;


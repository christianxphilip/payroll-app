import { useState, useEffect } from 'react';
import { scheduleAPI, employeeAPI } from '../services/api';
import Modal from '../components/Modal';
import { formatDate } from '../utils/formatters';
import SchedulesCalendarPage from './SchedulesCalendarPage';
import ShiftsView from './ShiftsView';
import AvailabilityView from './AvailabilityView';
import ResponsiveTableWrapper from '../components/ResponsiveTableWrapper';
import CalendarFeedModal from '../components/CalendarFeedModal';

const SchedulesPage = () => {
  const [schedules, setSchedules] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isFeedModalOpen, setIsFeedModalOpen] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });
  const [sort, setSort] = useState({
    sortBy: 'date',
    sortOrder: 'asc'
  });
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    employeeName: '',
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [viewMode, setViewMode] = useState('calendar'); // 'list', 'calendar', 'availability', or 'shifts'
  const [formData, setFormData] = useState({
    employeeName: '',
    date: '',
    scheduledStartTime: '',
    scheduledEndTime: '',
    scheduledDuration: '',
    isOff: false,
    notes: '',
    assignmentType: 'GENERAL'
  });

  const assignmentTypes = [
    { value: 'GENERAL', label: 'General', color: '#3b82f6' },
    { value: 'BAR', label: 'Bar', color: '#8b5cf6' },
    { value: 'KITCHEN', label: 'Kitchen', color: '#ef4444' },
    { value: 'FLEX', label: 'Flex', color: '#10b981' },
    { value: 'TRAINING', label: 'Training', color: '#f59e0b' }
  ];
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchEmployees();
    fetchSchedules();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll();
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Failed to fetch employees');
    }
  };

  const fetchSchedules = async (page = pagination.page) => {
    try {
      const params = {
        ...filters,
        ...sort,
        page,
        limit: pagination.limit
      };
      const response = await scheduleAPI.getAll(params);
      setSchedules(response.data || []);
      if (response.pagination) {
        setPagination(response.pagination);
      }
    } catch (error) {
      showMessage('error', 'Failed to fetch schedules');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (column) => {
    const newSortOrder = sort.sortBy === column && sort.sortOrder === 'asc' ? 'desc' : 'asc';
    setSort({ sortBy: column, sortOrder: newSortOrder });
    setPagination({ ...pagination, page: 1 });
    setTimeout(() => fetchSchedules(1), 0);
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
    setFilters({ ...filters, [field]: value });
  };

  const handleApplyFilters = () => {
    setLoading(true);
    setPagination({ ...pagination, page: 1 });
    fetchSchedules(1);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(schedules.map((s) => s._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      showMessage('error', 'Please select schedules to delete');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedIds.length} schedule(s)?`)) {
      return;
    }

    try {
      let successCount = 0;
      for (const id of selectedIds) {
        await scheduleAPI.delete(id);
        successCount++;
      }
      showMessage('success', `${successCount} schedules deleted successfully`);
      setSelectedIds([]);
      fetchSchedules();
    } catch (error) {
      showMessage('error', 'Failed to delete some schedules');
    }
  };

  const openAddModal = () => {
    setEditingSchedule(null);
    setFormData({
      employeeName: '',
      date: '',
      scheduledStartTime: '',
      scheduledEndTime: '',
      scheduledDuration: '',
      isOff: false,
      notes: '',
      assignmentType: 'GENERAL'
    });
    setIsModalOpen(true);
  };

  const openEditModal = (schedule) => {
    setEditingSchedule(schedule);
    setFormData({
      employeeName: schedule.employeeName,
      date: formatDate(schedule.date),
      scheduledStartTime: schedule.scheduledStartTime || '',
      scheduledEndTime: schedule.scheduledEndTime || '',
      scheduledDuration: schedule.scheduledDuration || '',
      isOff: schedule.isOff || false,
      notes: schedule.notes || '',
      assignmentType: schedule.assignmentType || 'GENERAL'
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        scheduledDuration: parseFloat(formData.scheduledDuration) || 0,
      };

      if (editingSchedule) {
        await scheduleAPI.update(editingSchedule._id, submitData);
        showMessage('success', 'Schedule updated successfully');
      } else {
        await scheduleAPI.create(submitData);
        showMessage('success', 'Schedule created successfully');
      }

      setIsModalOpen(false);
      fetchSchedules();
    } catch (error) {
      showMessage('error', error.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;

    try {
      await scheduleAPI.delete(id);
      showMessage('success', 'Schedule deleted successfully');
      fetchSchedules();
    } catch (error) {
      showMessage('error', 'Failed to delete schedule');
    }
  };

  if (loading) {
    return <div className="p-6">Loading schedules...</div>;
  }

  return (
    <div className="px-4 py-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Schedules</h1>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={() => setIsFeedModalOpen(true)}
            className="flex-1 sm:flex-none bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 font-medium min-h-[44px] flex items-center justify-center gap-2"
          >
            <span>📅 Sync to Google Calendar</span>
          </button>
          {viewMode === 'list' && (
            <button
              onClick={openAddModal}
              className="flex-1 sm:flex-none bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 font-medium min-h-[44px]"
            >
              Add Schedule
            </button>
          )}
        </div>
      </div>

      {message.text && (
        <div
          className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
        >
          {message.text}
        </div>
      )}

      {/* View Toggle */}
      <div className="flex justify-center mb-6 overflow-x-auto pb-1">
        <div className="bg-gray-100 p-1 rounded-lg inline-flex max-w-full">
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${viewMode === 'calendar'
              ? 'bg-white text-gray-900 shadow'
              : 'text-gray-500 hover:text-gray-900'
              }`}
          >
            Calendar
          </button>
          <button
            onClick={() => setViewMode('availability')}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${viewMode === 'availability'
              ? 'bg-white text-gray-900 shadow'
              : 'text-gray-500 hover:text-gray-900'
              }`}
          >
            Availability
          </button>
          <button
            onClick={() => setViewMode('shifts')}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${viewMode === 'shifts'
              ? 'bg-white text-gray-900 shadow'
              : 'text-gray-500 hover:text-gray-900'
              }`}
          >
            Shifts
          </button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <SchedulesCalendarPage />
      ) : viewMode === 'availability' ? (
        <AvailabilityView />
      ) : viewMode === 'shifts' ? (
        <ShiftsView />
      ) : (
        <>
          {/* Filters */}
          <div className="bg-white p-4 rounded-lg shadow mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <div className="flex items-end">
                <button
                  onClick={handleApplyFilters}
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>

          {/* Bulk Delete Bar */}
          {selectedIds.length > 0 && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg mb-4 flex items-center justify-between">
              <span className="text-red-900 font-medium">{selectedIds.length} schedule(s) selected</span>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete Selected
              </button>
            </div>
          )}

          {/* Schedules Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === schedules.length && schedules.length > 0}
                        onChange={handleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <button onClick={() => handleSort('employeeName')} className="hover:text-gray-700">
                        Employee{getSortIcon('employeeName')}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <button onClick={() => handleSort('date')} className="hover:text-gray-700">
                        Date{getSortIcon('date')}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <button onClick={() => handleSort('scheduledStartTime')} className="hover:text-gray-700">
                        Start Time{getSortIcon('scheduledStartTime')}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <button onClick={() => handleSort('scheduledEndTime')} className="hover:text-gray-700">
                        End Time{getSortIcon('scheduledEndTime')}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <button onClick={() => handleSort('scheduledDuration')} className="hover:text-gray-700" title="Payable hours after break deduction (if >= 7.5 hrs)">
                        Duration (hrs)<br /><span className="text-[10px] font-normal normal-case">(less break)</span>{getSortIcon('scheduledDuration')}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <button onClick={() => handleSort('isOff')} className="hover:text-gray-700">
                        Status{getSortIcon('isOff')}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Notes
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {schedules.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="px-6 py-4 text-center text-gray-500">
                        No schedules found
                      </td>
                    </tr>
                  ) : (
                    schedules.map((schedule) => (
                      <tr key={schedule._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(schedule._id)}
                            onChange={() => handleSelectOne(schedule._id)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">{schedule.employeeName}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {new Date(schedule.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {schedule.scheduledStartTime || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {schedule.scheduledEndTime || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {schedule.scheduledDuration.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${schedule.isOff
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-green-100 text-green-800'
                              }`}
                          >
                            {schedule.isOff ? 'OFF' : 'Scheduled'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {schedule.notes || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => openEditModal(schedule)}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(schedule._id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
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
                  onClick={() => fetchSchedules(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => fetchSchedules(pagination.page + 1)}
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
                      onClick={() => fetchSchedules(pagination.page - 1)}
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
                          onClick={() => fetchSchedules(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${pagination.page === pageNum
                            ? 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                            : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
                            }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => fetchSchedules(pagination.page + 1)}
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

          {/* Add/Edit Schedule Modal */}
          <Modal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title={editingSchedule ? 'Edit Schedule' : 'Add Schedule'}
          >
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Employee</label>
                <select
                  value={formData.employeeName}
                  onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isOff}
                    onChange={(e) => setFormData({ ...formData, isOff: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">OFF Day</span>
                </label>
              </div>
              {!formData.isOff && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Time (e.g., 3PM)
                    </label>
                    <input
                      type="text"
                      value={formData.scheduledStartTime}
                      onChange={(e) =>
                        setFormData({ ...formData, scheduledStartTime: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="3PM"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Time (e.g., 12AM)
                    </label>
                    <input
                      type="text"
                      value={formData.scheduledEndTime}
                      onChange={(e) => setFormData({ ...formData, scheduledEndTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="12AM"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Duration (hours)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={formData.scheduledDuration}
                      onChange={(e) =>
                        setFormData({ ...formData, scheduledDuration: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="8"
                    />
                  </div>
                </>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Optional notes"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingSchedule ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </Modal>

        </>
      )}

      {/* Calendar Feed Modal */}
      <CalendarFeedModal
        isOpen={isFeedModalOpen}
        onClose={() => setIsFeedModalOpen(false)}
      />
    </div>
  );
};

export default SchedulesPage;

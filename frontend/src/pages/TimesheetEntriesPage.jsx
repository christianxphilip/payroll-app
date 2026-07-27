import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { timesheetEntryAPI, payRunAPI } from '../services/api';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';

const TimesheetEntriesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [payRuns, setPayRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    notes: '',
    generateFromSchedules: false
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchEntries();
    if (user?.role === 'admin') {
      fetchPayRuns();
    }
  }, [user]);

  const fetchEntries = async (page = pagination.page) => {
    try {
      const params = {
        page,
        limit: pagination.limit
      };
      const response = await timesheetEntryAPI.getAll(params);
      setEntries(response.data || []);
      if (response.pagination) {
        setPagination(response.pagination);
      }
    } catch (error) {
      showMessage('error', 'Failed to fetch timesheet entries');
    } finally {
      setLoading(false);
    }
  };

  const fetchPayRuns = async () => {
    try {
      const response = await payRunAPI.getAll();
      setPayRuns(response.data || []);
    } catch (error) {
      // Silently fail - not critical for display
      console.error('Failed to fetch pay runs:', error);
    }
  };

  const isTimesheetInPayRun = (timesheetId) => {
    return payRuns.some(payRun => 
      payRun.timesheetIds && payRun.timesheetIds.some(id => 
        (typeof id === 'string' ? id : id._id || id.toString()) === timesheetId
      )
    );
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const openAddModal = () => {
    setFormData({
      name: '',
      startDate: '',
      endDate: '',
      notes: '',
      generateFromSchedules: false
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await timesheetEntryAPI.create(formData);
      showMessage('success', 'Timesheet entry created successfully');
      setIsModalOpen(false);
      fetchEntries();
    } catch (error) {
      showMessage('error', error.response?.data?.error || 'Failed to create timesheet entry');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this timesheet entry? All associated time logs will also be deleted.')) return;

    try {
      await timesheetEntryAPI.delete(id);
      showMessage('success', 'Timesheet entry deleted successfully');
      fetchEntries();
    } catch (error) {
      showMessage('error', error.response?.data?.error || 'Failed to delete timesheet entry');
    }
  };

  const handleSubmitForApproval = async (id) => {
    if (!confirm('Submit this timesheet for approval? This will lock it from further editing.')) return;

    try {
      await timesheetEntryAPI.submit(id);
      showMessage('success', 'Timesheet submitted successfully');
      fetchEntries();
    } catch (error) {
      showMessage('error', error.response?.data?.error || 'Failed to submit timesheet');
    }
  };

  const handleRevertToDraft = async (id) => {
    if (!confirm('Revert this timesheet back to draft? This will unlock it for editing.')) return;

    try {
      await timesheetEntryAPI.revert(id);
      showMessage('success', 'Timesheet reverted to draft successfully');
      fetchEntries();
    } catch (error) {
      showMessage('error', error.response?.data?.error || 'Failed to revert timesheet');
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      submitted: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
    };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colors[status] || colors.draft}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const handleCreatePayRun = (entry) => {
    const params = new URLSearchParams({
      timesheetIds: entry._id,
      startDate: entry.startDate.split('T')[0],
      endDate: entry.endDate.split('T')[0]
    });
    navigate(`/pay-runs?${params.toString()}`);
  };

  if (loading) {
    return <div className="p-6">Loading timesheet entries...</div>;
  }

  return (
    <div className="px-4 py-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Timesheet Entries</h1>
        <button
          onClick={openAddModal}
          className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 font-medium min-h-[44px]"
        >
          Add Timesheet Entry
        </button>
      </div>

      {message.text && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Entries List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {entries.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500">No timesheet entries found. Create one to get started.</p>
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry._id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/timesheets/${entry._id}`)}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">{entry.name}</h3>
                  {getStatusBadge(entry.status)}
                </div>
                
                <div className="space-y-2 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Date Range:</span>{' '}
                    {new Date(entry.startDate).toLocaleDateString()} - {new Date(entry.endDate).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium">Time Logs:</span> {entry.logCount || 0}
                  </div>
                </div>

                {entry.notes && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-500">{entry.notes}</p>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                  {entry.status === 'draft' && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSubmitForApproval(entry._id);
                        }}
                        className="flex-1 text-sm bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700"
                      >
                        Submit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(entry._id);
                        }}
                        className="text-sm text-red-600 hover:text-red-900 px-3 py-2"
                      >
                        Delete
                      </button>
                    </>
                  )}
                  {entry.status !== 'draft' && (
                    <div className="flex flex-col gap-2 w-full">
                      <div className="text-sm text-gray-500 italic">
                        Submitted on {new Date(entry.submittedAt).toLocaleDateString()}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/reports?timesheetId=${entry._id}&startDate=${entry.startDate}&endDate=${entry.endDate}`);
                          }}
                          className="text-sm bg-blue-600 text-white px-3 py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                          </svg>
                          View Report
                        </button>
                        {user?.role === 'admin' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCreatePayRun(entry);
                            }}
                            className="text-sm bg-orange-600 text-white px-3 py-3 rounded-lg hover:bg-orange-700 flex items-center justify-center gap-1"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M4 4a2 2 0 012-2h8a2 2 0 012 2v1H4V4z" />
                              <path fillRule="evenodd" d="M3 8a2 2 0 012-2h10a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm6 1a1 1 0 000 2h1.586l-.293.293a1 1 0 101.414 1.414L13.414 11l-1.707-1.707a1 1 0 10-1.414 1.414L11.586 11H9a1 1 0 01-1-1z" clipRule="evenodd" />
                            </svg>
                            <span>Pay Run</span>
                          </button>
                        )}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await timesheetEntryAPI.exportLogs(entry._id);
                              showMessage('success', 'Timelogs exported successfully');
                            } catch (error) {
                              showMessage('error', 'Failed to export timelogs');
                            }
                          }}
                          className="text-sm bg-green-600 text-white px-3 py-3 rounded-lg hover:bg-green-700 flex items-center justify-center gap-1"
                          title="Export time logs as CSV"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          Export Logs
                        </button>
                        {!isTimesheetInPayRun(entry._id) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRevertToDraft(entry._id);
                            }}
                            className="text-sm bg-yellow-600 text-white px-3 py-3 rounded-lg hover:bg-yellow-700 flex items-center justify-center gap-1"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
                            </svg>
                            Revert
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => fetchEntries(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-700">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => fetchEntries(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {/* Add Entry Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Timesheet Entry">
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="e.g., October 2025 Payroll"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows="3"
              placeholder="Additional notes..."
            />
          </div>
          <div className="mb-4 flex items-start">
            <div className="flex items-center h-5">
              <input
                id="generateFromSchedules"
                type="checkbox"
                checked={formData.generateFromSchedules}
                onChange={(e) => setFormData({ ...formData, generateFromSchedules: e.target.checked })}
                className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded cursor-pointer"
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="generateFromSchedules" className="font-medium text-gray-700 cursor-pointer">
                Populate timesheet logs from schedules
              </label>
              <p className="text-gray-500 text-xs">
                Automatically create daily time logs for employees based on active schedule shifts within this date range.
              </p>
            </div>
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
              Create
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TimesheetEntriesPage;

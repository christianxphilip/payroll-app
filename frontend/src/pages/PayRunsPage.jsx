import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { payRunAPI, timesheetEntryAPI } from '../services/api';
import Modal from '../components/Modal';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import { useUndo } from '../hooks/useUndo';
import UndoToast from '../components/UndoToast';

const PayRunsPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialTimesheetIds = searchParams.get('timesheetIds');
  const initialStart = searchParams.get('startDate');
  const initialEnd = searchParams.get('endDate');

  const [payRuns, setPayRuns] = useState([]);
  const [timesheetEntries, setTimesheetEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [form, setForm] = useState({
    timesheetIds: initialTimesheetIds ? initialTimesheetIds.split(',') : [],
    payrollPeriodStart: initialStart || '',
    payrollPeriodEnd: initialEnd || '',
    payoutDate: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, payRunId: null, status: null });
  const { addAction, undo, canUndo, lastAction, clearHistory } = useUndo();
  const [undoToastVisible, setUndoToastVisible] = useState(false);

  useEffect(() => {
    fetchPayRuns();
    fetchTimesheetEntries();
  }, []);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const fetchPayRuns = async () => {
    try {
      const res = await payRunAPI.getAll();
      setPayRuns(res.data || res);
    } catch {
      showMessage('error', 'Failed to load pay runs');
    } finally {
      setLoading(false);
    }
  };

  const fetchTimesheetEntries = async () => {
    try {
      const res = await timesheetEntryAPI.getAll({ limit: 100 });
      setTimesheetEntries(res.data || res);
    } catch (error) {
      showMessage('error', 'Failed to load timesheet entries');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.timesheetIds.length) {
      showMessage('error', 'At least one submitted timesheet is required');
      return;
    }
    if (!form.payoutDate) {
      showMessage('error', 'Payout date is required');
      return;
    }
    try {
      const payload = {
        timesheetIds: form.timesheetIds,
        payrollPeriodStart: form.payrollPeriodStart || undefined,
        payrollPeriodEnd: form.payrollPeriodEnd || undefined,
        payoutDate: form.payoutDate
      };
      const res = await payRunAPI.create(payload);
      showMessage('success', 'Pay run created');
      setForm({ ...form, payoutDate: '' });
      setIsCreateModalOpen(false);
      // Prepend new pay run
      setPayRuns((prev) => [res.data || res, ...prev]);
    } catch (error) {
      const msg = error.response?.data?.error || 'Failed to create pay run';
      showMessage('error', msg);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      const res = await payRunAPI.updateStatus(id, status);
      setPayRuns((prev) => prev.map((pr) => (pr._id === id ? (res.data || res) : pr)));
    } catch (error) {
      const msg = error.response?.data?.error || 'Failed to update status';
      showMessage('error', msg);
    }
  };

  const handleDelete = async (id, status) => {
    if (status !== 'DRAFT') {
      showMessage('error', 'Only DRAFT pay runs can be deleted');
      return;
    }
    setDeleteConfirm({ isOpen: true, payRunId: id, status });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.payRunId) return;
    
    // Find the pay run to save for undo
    const payRunToDelete = payRuns.find(pr => pr._id === deleteConfirm.payRunId);
    
    try {
      await payRunAPI.delete(deleteConfirm.payRunId);
      
      // Add undo action
      if (payRunToDelete) {
        addAction({
          message: `Pay run deleted`,
          undo: async () => {
            try {
              // Recreate the pay run (this would need a create endpoint that accepts full pay run data)
              // For now, we'll just show a message that it can't be fully restored
              showMessage('info', 'Pay run deletion cannot be automatically undone. Please recreate manually.');
              fetchPayRuns();
            } catch (error) {
              showMessage('error', 'Failed to restore pay run');
            }
          }
        });
        setUndoToastVisible(true);
      }
      
      setPayRuns((prev) => prev.filter((pr) => pr._id !== deleteConfirm.payRunId));
      showMessage('success', 'Pay run deleted successfully');
      setDeleteConfirm({ isOpen: false, payRunId: null, status: null });
    } catch (error) {
      const msg = error.response?.data?.error || 'Failed to delete pay run';
      showMessage('error', msg);
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-6">
        <LoadingSkeleton type="table" rows={5} cols={5} />
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Pay Runs</h1>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
        >
          Create Pay Run
        </button>
      </div>

      {message.text && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 
            message.type === 'info' ? 'bg-blue-100 text-blue-800' :
            'bg-red-100 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Undo Toast */}
      {undoToastVisible && lastAction && (
        <div className="fixed top-4 right-4 z-50">
          <UndoToast
            action={lastAction}
            onUndo={async () => {
              const success = await undo();
              if (success) {
                showMessage('success', 'Action undone');
              } else {
                showMessage('error', 'Failed to undo action');
              }
            }}
            onDismiss={() => {
              setUndoToastVisible(false);
              clearHistory();
            }}
          />
        </div>
      )}

      {/* Pay Runs List */}
      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payout Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timesheets</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payRuns.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-4">
                    <EmptyState
                      title="No Pay Runs Yet"
                      message="Create your first pay run to get started. Pay runs help you manage payroll for specific time periods."
                      actionLabel="Create Pay Run"
                      onAction={() => setIsCreateModalOpen(true)}
                    />
                  </td>
                </tr>
              ) : (
                payRuns.map((pr) => (
                  <tr key={pr._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      {pr.payrollPeriodStart &&
                        new Date(pr.payrollPeriodStart).toLocaleDateString()}{' '}
                      -{' '}
                      {pr.payrollPeriodEnd &&
                        new Date(pr.payrollPeriodEnd).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {pr.payoutDate && new Date(pr.payoutDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {pr.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {pr.timesheetIds && pr.timesheetIds.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {pr.timesheetIds.map((timesheetItem, index) => {
                            // Handle both populated objects and IDs
                            let timesheetName;
                            let key;
                            
                            if (typeof timesheetItem === 'object' && timesheetItem !== null) {
                              // Already populated from backend
                              timesheetName = timesheetItem.name || `Timesheet ${timesheetItem._id || index}`;
                              key = timesheetItem._id || index;
                            } else {
                              // Just an ID, need to find in timesheetEntries
                              const timesheet = timesheetEntries.find((te) => te._id === timesheetItem);
                              timesheetName = timesheet ? timesheet.name : `Timesheet ${timesheetItem}`;
                              key = timesheetItem;
                            }
                            
                            return (
                              <span key={key} className="text-xs">
                                {timesheetName}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right space-x-2">
                      <button
                        onClick={() => navigate(`/pay-runs/${pr._id}`)}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        View
                      </button>
                      {pr.status === 'DRAFT' && (
                        <button
                          onClick={() => handleStatusChange(pr._id, 'APPROVED')}
                          className="px-3 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          Approve
                        </button>
                      )}
                      {pr.status === 'APPROVED' && (
                        <button
                          onClick={() => handleStatusChange(pr._id, 'PAID')}
                          className="px-3 py-1 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                        >
                          Mark Paid
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(pr._id, pr.status)}
                        className="px-3 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700"
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

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, payRunId: null, status: null })}
        onConfirm={confirmDelete}
        title="Delete Pay Run"
        message="Are you sure you want to delete this pay run and all related employee breakdowns? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        type="danger"
      />

      {/* Create Pay Run Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Pay Run"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Timesheet to include
            </label>
            <select
              value={form.timesheetIds[0] || ''}
              onChange={(e) => {
                const value = e.target.value;
                setForm({
                  ...form,
                  timesheetIds: value ? [value] : []
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            >
              <option value="">Select timesheet...</option>
              {timesheetEntries.map((entry) => (
                <option key={entry._id} value={entry._id}>
                  {entry.name} (
                  {entry.startDate &&
                    new Date(entry.startDate).toLocaleDateString()}{' '}
                  -{' '}
                  {entry.endDate &&
                    new Date(entry.endDate).toLocaleDateString()}
                  )
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Select a submitted timesheet to include in this pay run.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payout Date
            </label>
            <input
              type="date"
              value={form.payoutDate}
              onChange={(e) =>
                setForm({ ...form, payoutDate: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Create Pay Run
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PayRunsPage;



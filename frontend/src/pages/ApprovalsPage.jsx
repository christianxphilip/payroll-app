import { useState, useEffect } from 'react';
import { employeePortalAPI } from '../services/api';
import Modal from '../components/Modal';

const odooDate = (value) => (value ? new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`) : null);

const formatDateTime = (value) => {
  const date = odooDate(value);
  return date
    ? date.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';
};

const ApprovalsPage = () => {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'For L1 Approval' | 'For L2 Approval' | 'Valid' | 'Invalid'
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  // Standard Decision Modal
  const [decisionModal, setDecisionModal] = useState({
    isOpen: false,
    approval: null,
    action: 'APPROVE', // 'APPROVE' | 'REJECT'
    notes: '',
    submitting: false
  });

  // Admin Override Modal
  const [overrideModal, setOverrideModal] = useState({
    isOpen: false,
    approval: null,
    action: 'FORCE_APPROVE', // 'FORCE_APPROVE' | 'FORCE_REJECT'
    notes: '',
    submitting: false
  });

  // History Details Modal
  const [historyModal, setHistoryModal] = useState({
    isOpen: false,
    approval: null
  });

  const showToast = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await employeePortalAPI.getAllApprovals(params);
      setApprovals(res.data || []);
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to fetch approvals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchApprovals();
  };

  // Standard Approve/Reject
  const handleDecisionSubmit = async () => {
    if (!decisionModal.approval) return;
    try {
      setDecisionModal(prev => ({ ...prev, submitting: true }));
      await employeePortalAPI.takeApprovalAction({
        approvalId: decisionModal.approval._id,
        action: decisionModal.action,
        notes: decisionModal.notes
      });

      showToast('success', `Attendance request ${decisionModal.action === 'APPROVE' ? 'approved' : 'rejected'} successfully`);
      setDecisionModal(prev => ({ ...prev, isOpen: false }));
      fetchApprovals();
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Decision failed');
      setDecisionModal(prev => ({ ...prev, submitting: false }));
    }
  };

  // Admin Override
  const handleOverrideSubmit = async () => {
    if (!overrideModal.approval) return;
    try {
      setOverrideModal(prev => ({ ...prev, submitting: true }));
      await employeePortalAPI.overrideApproval({
        approvalId: overrideModal.approval._id,
        action: overrideModal.action,
        notes: overrideModal.notes
      });

      showToast('success', `Admin override applied: Record is now ${overrideModal.action === 'FORCE_APPROVE' ? 'Valid' : 'Invalid'}`);
      setOverrideModal(prev => ({ ...prev, isOpen: false }));
      fetchApprovals();
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Override failed');
      setOverrideModal(prev => ({ ...prev, submitting: false }));
    }
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Valid':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Valid
          </span>
        );
      case 'Invalid':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 border border-red-200">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            Invalid
          </span>
        );
      case 'For L1 Approval':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            For L1 Approval
          </span>
        );
      case 'For L2 Approval':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            For L2 Approval
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
            {status}
          </span>
        );
    }
  };

  // Metrics
  const l1Count = approvals.filter(a => a.status === 'For L1 Approval').length;
  const l2Count = approvals.filter(a => a.status === 'For L2 Approval').length;
  const validCount = approvals.filter(a => a.status === 'Valid').length;
  const invalidCount = approvals.filter(a => a.status === 'Invalid').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Toast */}
      {message.text && (
        <div className={`mb-6 p-4 rounded-xl border text-sm flex items-center justify-between ${
          message.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="font-bold ml-2">✕</button>
        </div>
      )}

      {/* Page Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Attendance Approvals</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review, approve, reject, or administrative override for timesheet correction requests across all employees.
          </p>
        </div>
        <button
          onClick={fetchApprovals}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 self-start md:self-auto"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div
          onClick={() => setStatusFilter('ALL')}
          className={`cursor-pointer rounded-xl border p-4 transition-all ${
            statusFilter === 'ALL' ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20' : 'bg-white hover:bg-gray-50'
          }`}
        >
          <div className="text-xs font-semibold uppercase text-gray-500">All Requests</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{approvals.length}</div>
        </div>
        <div
          onClick={() => setStatusFilter('For L1 Approval')}
          className={`cursor-pointer rounded-xl border p-4 transition-all ${
            statusFilter === 'For L1 Approval' ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20' : 'bg-white hover:bg-gray-50'
          }`}
        >
          <div className="text-xs font-semibold uppercase text-amber-700">For L1 Approval</div>
          <div className="mt-1 text-2xl font-bold text-amber-800">{l1Count}</div>
        </div>
        <div
          onClick={() => setStatusFilter('For L2 Approval')}
          className={`cursor-pointer rounded-xl border p-4 transition-all ${
            statusFilter === 'For L2 Approval' ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500/20' : 'bg-white hover:bg-gray-50'
          }`}
        >
          <div className="text-xs font-semibold uppercase text-blue-700">For L2 Approval</div>
          <div className="mt-1 text-2xl font-bold text-blue-800">{l2Count}</div>
        </div>
        <div
          onClick={() => setStatusFilter('Valid')}
          className={`cursor-pointer rounded-xl border p-4 transition-all ${
            statusFilter === 'Valid' ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20' : 'bg-white hover:bg-gray-50'
          }`}
        >
          <div className="text-xs font-semibold uppercase text-emerald-700">Valid / Approved</div>
          <div className="mt-1 text-2xl font-bold text-emerald-800">{validCount}</div>
        </div>
        <div
          onClick={() => setStatusFilter('Invalid')}
          className={`cursor-pointer rounded-xl border p-4 transition-all col-span-2 sm:col-span-1 ${
            statusFilter === 'Invalid' ? 'bg-red-50 border-red-300 ring-2 ring-red-500/20' : 'bg-white hover:bg-gray-50'
          }`}
        >
          <div className="text-xs font-semibold uppercase text-red-700">Invalid / Rejected</div>
          <div className="mt-1 text-2xl font-bold text-red-800">{invalidCount}</div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="mb-6 rounded-xl border bg-white p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'For L1 Approval', label: 'For L1' },
            { id: 'For L2 Approval', label: 'For L2' },
            { id: 'Valid', label: 'Valid' },
            { id: 'Invalid', label: 'Invalid' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-72">
          <input
            type="text"
            placeholder="Search employee or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700"
          >
            Search
          </button>
        </form>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="flex justify-center py-20 bg-white rounded-xl border">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        </div>
      ) : approvals.length === 0 ? (
        <div className="rounded-2xl border bg-white p-12 text-center text-sm text-gray-500">
          No attendance approval requests found for this filter.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
            <thead className="bg-gray-50 uppercase font-bold text-gray-500">
              <tr>
                <th className="px-5 py-3.5">Employee</th>
                <th className="px-4 py-3.5">Original Punch</th>
                <th className="px-4 py-3.5">Requested Correction &amp; Reason</th>
                <th className="px-4 py-3.5">Approver Assigned</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {approvals.map((app) => {
                const isPending = app.status === 'For L1 Approval' || app.status === 'For L2 Approval';

                return (
                  <tr key={app._id} className="hover:bg-gray-50/80 transition-colors">
                    {/* Employee */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="font-bold text-gray-900 text-sm">{app.employeeName}</div>
                      <div className="text-gray-500">{app.employeeId?.position || 'Employee'}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">Date: {app.date || '—'}</div>
                    </td>

                    {/* Original Punch */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div><span className="text-gray-400">In:</span> <span className="font-medium">{formatDateTime(app.checkIn)}</span></div>
                      <div className={app.checkOut ? '' : 'text-red-600 font-semibold'}>
                        <span className="text-gray-400">Out:</span> {formatDateTime(app.checkOut)}
                      </div>
                    </td>

                    {/* Corrected & Reason */}
                    <td className="px-4 py-4">
                      {(app.correctedCheckIn || app.correctedCheckOut) ? (
                        <div className="font-medium text-indigo-700">
                          {app.correctedCheckIn && <div>In: {formatDateTime(app.correctedCheckIn)}</div>}
                          {app.correctedCheckOut && <div>Out: {formatDateTime(app.correctedCheckOut)}</div>}
                        </div>
                      ) : (
                        <div className="text-gray-400 italic">No time change specified</div>
                      )}
                      <div className="text-gray-600 italic mt-1 max-w-xs truncate" title={app.reason}>
                        "{app.reason || 'Correction requested'}"
                      </div>
                      {app.rejectionReason && (
                        <div className="text-red-600 font-medium text-[11px] mt-0.5">
                          {app.rejectionReason}
                        </div>
                      )}
                    </td>

                    {/* Approvers info */}
                    <td className="px-4 py-4 whitespace-nowrap text-gray-600">
                      <div>
                        <span className="font-semibold text-gray-700">L1:</span> {app.employeeId?.l1ApproverName || 'None'}
                        {app.l1ApprovedBy && <span className="text-emerald-600 text-[11px] ml-1">(Approved by {app.l1ApprovedBy})</span>}
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">L2:</span> {app.employeeId?.l2ApproverName || 'None'}
                        {app.l2ApprovedBy && <span className="text-emerald-600 text-[11px] ml-1">(Approved by {app.l2ApprovedBy})</span>}
                      </div>
                    </td>

                    {/* Status badge */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {renderStatusBadge(app.status)}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 whitespace-nowrap text-right space-x-1.5">
                      {/* Standard approval actions for pending */}
                      {isPending && (
                        <>
                          <button
                            type="button"
                            onClick={() => setDecisionModal({ isOpen: true, approval: app, action: 'APPROVE', notes: '', submitting: false })}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => setDecisionModal({ isOpen: true, approval: app, action: 'REJECT', notes: '', submitting: false })}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-md bg-red-600 text-white hover:bg-red-700 shadow-sm"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {/* Admin Override Dropdown / Buttons */}
                      <button
                        type="button"
                        onClick={() => setOverrideModal({ isOpen: true, approval: app, action: app.status === 'Valid' ? 'FORCE_REJECT' : 'FORCE_APPROVE', notes: '', submitting: false })}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
                        title="Administrator Override allows forcing Valid or Invalid regardless of current stage"
                      >
                        <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Admin Override
                      </button>

                      {/* History Log */}
                      <button
                        type="button"
                        onClick={() => setHistoryModal({ isOpen: true, approval: app })}
                        className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                        title="View history audit trail"
                      >
                        History
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL 1: Standard Decision (Approve / Reject) */}
      <Modal
        isOpen={decisionModal.isOpen}
        onClose={() => setDecisionModal(prev => ({ ...prev, isOpen: false }))}
        title={`${decisionModal.action === 'APPROVE' ? 'Approve' : 'Reject'} Attendance Request`}
      >
        {decisionModal.approval && (
          <div className="space-y-4 text-sm">
            <p className="text-gray-700">
              Confirm decision for <strong className="text-gray-900">{decisionModal.approval.employeeName}</strong>:
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                {decisionModal.action === 'APPROVE' ? 'Remarks (Optional)' : 'Reason for Rejection *'}
              </label>
              <textarea
                rows={3}
                required={decisionModal.action === 'REJECT'}
                placeholder={decisionModal.action === 'APPROVE' ? 'Add any remarks...' : 'Explain why this was rejected'}
                value={decisionModal.notes}
                onChange={e => setDecisionModal({ ...decisionModal, notes: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setDecisionModal(prev => ({ ...prev, isOpen: false }))}
                className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={decisionModal.submitting || (decisionModal.action === 'REJECT' && !decisionModal.notes.trim())}
                onClick={handleDecisionSubmit}
                className={`rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-50 ${
                  decisionModal.action === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {decisionModal.submitting ? 'Processing…' : (decisionModal.action === 'APPROVE' ? 'Confirm Approval' : 'Confirm Rejection')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 2: Administrator Override Modal */}
      <Modal
        isOpen={overrideModal.isOpen}
        onClose={() => setOverrideModal(prev => ({ ...prev, isOpen: false }))}
        title="Administrator Override"
      >
        {overrideModal.approval && (
          <div className="space-y-4 text-sm">
            <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 text-xs text-purple-900">
              <strong>Admin Authority Notice:</strong> Overriding bypasses normal L1 and L2 approval rules and immediately marks the punch status as either <strong>Valid</strong> or <strong>Invalid</strong>.
            </div>

            <p className="text-gray-700">
              Target Employee: <strong>{overrideModal.approval.employeeName}</strong> (Current Status: <span className="font-semibold">{overrideModal.approval.status}</span>)
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Select Override Action
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setOverrideModal({ ...overrideModal, action: 'FORCE_APPROVE' })}
                  className={`p-3 rounded-xl border text-left font-semibold text-xs transition-all ${
                    overrideModal.action === 'FORCE_APPROVE'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-400/20'
                      : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="text-emerald-700">Force Approve (Valid)</div>
                  <div className="text-[11px] font-normal text-gray-500 mt-0.5">Directly approves &amp; marks punch valid</div>
                </button>
                <button
                  type="button"
                  onClick={() => setOverrideModal({ ...overrideModal, action: 'FORCE_REJECT' })}
                  className={`p-3 rounded-xl border text-left font-semibold text-xs transition-all ${
                    overrideModal.action === 'FORCE_REJECT'
                      ? 'border-red-500 bg-red-50 text-red-800 ring-2 ring-red-400/20'
                      : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="text-red-700">Force Reject (Invalid)</div>
                  <div className="text-[11px] font-normal text-gray-500 mt-0.5">Directly rejects &amp; marks punch invalid</div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Override Reason / Admin Notes <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                placeholder="State the reason for this administrative override..."
                value={overrideModal.notes}
                onChange={e => setOverrideModal({ ...overrideModal, notes: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setOverrideModal(prev => ({ ...prev, isOpen: false }))}
                className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={overrideModal.submitting || !overrideModal.notes.trim()}
                onClick={handleOverrideSubmit}
                className={`rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-50 ${
                  overrideModal.action === 'FORCE_APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {overrideModal.submitting ? 'Overriding…' : `Confirm Override (${overrideModal.action === 'FORCE_APPROVE' ? 'Valid' : 'Invalid'})`}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 3: Audit Trail History Modal */}
      <Modal
        isOpen={historyModal.isOpen}
        onClose={() => setHistoryModal({ isOpen: false, approval: null })}
        title="Approval Audit History"
      >
        {historyModal.approval && (
          <div className="space-y-4 text-sm">
            <div className="border-b pb-3">
              <div className="font-bold text-gray-900 text-base">{historyModal.approval.employeeName}</div>
              <div className="text-xs text-gray-500">Date: {historyModal.approval.date} • Current Status: {historyModal.approval.status}</div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-bold uppercase text-gray-500 tracking-wider">Timeline</div>
              {(!historyModal.approval.history || historyModal.approval.history.length === 0) ? (
                <div className="text-xs text-gray-500 italic">No timeline entries recorded yet.</div>
              ) : (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                  {historyModal.approval.history.map((item, idx) => (
                    <div key={idx} className="relative">
                      <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-indigo-600 ring-4 ring-white" />
                      <div className="text-xs font-semibold text-gray-900">
                        {item.action} — <span className="text-indigo-600">{item.byName || item.byRole || 'User'}</span>
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {new Date(item.date).toLocaleString()}
                      </div>
                      {item.notes && (
                        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded mt-1 border">
                          {item.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                type="button"
                onClick={() => setHistoryModal({ isOpen: false, approval: null })}
                className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ApprovalsPage;

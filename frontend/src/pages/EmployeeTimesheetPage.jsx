import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { employeePortalAPI } from '../services/api';
import Modal from '../components/Modal';

const localDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const odooDate = (value) => value ? new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`) : null;

const toDateTimeLocalValue = (dateObj) => {
  if (!dateObj) return '';
  const d = new Date(dateObj);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const EmployeeTimesheetPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'approvals' ? 'approvals' : 'timesheet');
  const [page, setPage] = useState(0);
  const [range, setRange] = useState({ startDate: '', endDate: '' });
  const [records, setRecords] = useState([]);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  // Approvals state
  const [isApprover, setIsApprover] = useState(false);
  const [pendingReviewsCount, setPendingReviewsCount] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loadingApprovals, setLoadingApprovals] = useState(false);

  // Correction request modal
  const [requestModal, setRequestModal] = useState({
    isOpen: false,
    record: null,
    correctedCheckIn: '',
    correctedCheckOut: '',
    reason: '',
    submitting: false
  });

  // Action / Reject modal
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    approval: null,
    action: 'APPROVE', // 'APPROVE' | 'REJECT'
    notes: '',
    submitting: false
  });

  const showToast = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  const cutoffFor = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return date.getDate() <= 15
      ? { startDate: localDate(new Date(year, month, 1)), endDate: localDate(new Date(year, month, 15)) }
      : { startDate: localDate(new Date(year, month, 16)), endDate: localDate(new Date(year, month + 1, 0)) };
  };

  const getPageRange = (pageNumber) => {
    let cutoff = cutoffFor(new Date());
    for (let index = 0; index < pageNumber; index += 1) {
      const previousDay = new Date(`${cutoff.startDate}T00:00:00`);
      previousDay.setDate(previousDay.getDate() - 1);
      cutoff = cutoffFor(previousDay);
    }
    return cutoff;
  };

  const loadAttendance = async (requestedRange) => {
    try {
      setLoading(true);
      setError('');
      const response = await employeePortalAPI.getAttendance(requestedRange.startDate, requestedRange.endDate);
      setRecords(response.data || []);
      setEmployee(response.employee || null);
      setIsApprover(Boolean(response.isApprover || response.employee?.isApprover));
      setPendingReviewsCount(response.pendingReviewsCount || 0);
    } catch (err) {
      setRecords([]);
      setError(err.response?.data?.error || 'Failed to load attendance.');
    } finally {
      setLoading(false);
    }
  };

  const loadPendingApprovals = async () => {
    try {
      setLoadingApprovals(true);
      const res = await employeePortalAPI.getPendingApprovals();
      setPendingApprovals(res.data || []);
      setPendingReviewsCount((res.data || []).length);
    } catch (err) {
      console.error('Failed to load pending approvals:', err);
    } finally {
      setLoadingApprovals(false);
    }
  };

  useEffect(() => {
    const requestedRange = getPageRange(page);
    setRange(requestedRange);
    loadAttendance(requestedRange);
  }, [page]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'approvals' && activeTab !== 'approvals') {
      setActiveTab('approvals');
    } else if (!tabParam && activeTab === 'approvals') {
      setActiveTab('timesheet');
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeTab === 'approvals') {
      loadPendingApprovals();
    }
  }, [activeTab]);

  const formatDateTime = (value) => {
    const date = odooDate(value);
    return date
      ? date.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
      : 'Missing';
  };

  const openRequestModal = (record) => {
    const inDate = odooDate(record.checkIn);
    const outDate = odooDate(record.checkOut);
    setRequestModal({
      isOpen: true,
      record,
      correctedCheckIn: inDate ? toDateTimeLocalValue(inDate) : '',
      correctedCheckOut: outDate ? toDateTimeLocalValue(outDate) : '',
      reason: '',
      submitting: false
    });
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    if (!requestModal.record) return;

    try {
      setRequestModal(prev => ({ ...prev, submitting: true }));
      await employeePortalAPI.requestApproval({
        odooAttendanceId: requestModal.record.id,
        date: requestModal.record.checkIn ? String(requestModal.record.checkIn).slice(0, 10) : range.startDate,
        checkIn: requestModal.record.checkIn,
        checkOut: requestModal.record.checkOut,
        correctedCheckIn: requestModal.correctedCheckIn ? new Date(requestModal.correctedCheckIn).toISOString() : undefined,
        correctedCheckOut: requestModal.correctedCheckOut ? new Date(requestModal.correctedCheckOut).toISOString() : undefined,
        reason: requestModal.reason
      });

      showToast('success', 'Submitted for L1 Approval successfully');
      setRequestModal(prev => ({ ...prev, isOpen: false }));
      loadAttendance(range);
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to submit approval request');
      setRequestModal(prev => ({ ...prev, submitting: false }));
    }
  };

  const handleAction = async () => {
    if (!actionModal.approval) return;
    try {
      setActionModal(prev => ({ ...prev, submitting: true }));
      await employeePortalAPI.takeApprovalAction({
        approvalId: actionModal.approval._id,
        action: actionModal.action,
        notes: actionModal.notes
      });

      showToast('success', `Attendance ${actionModal.action === 'APPROVE' ? 'approved' : 'rejected'} successfully`);
      setActionModal(prev => ({ ...prev, isOpen: false }));
      if (activeTab === 'approvals') {
        loadPendingApprovals();
      }
      loadAttendance(range);
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Action failed');
      setActionModal(prev => ({ ...prev, submitting: false }));
    }
  };

  // Status badge helper
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
            {status || 'Unknown'}
          </span>
        );
    }
  };

  // Summary counts
  const validCount = records.filter(r => r.status === 'Valid').length;
  const invalidCount = records.filter(r => r.status === 'Invalid').length;
  const pendingCount = records.filter(r => r.status === 'For L1 Approval' || r.status === 'For L2 Approval').length;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Employee Top Navbar */}
      <header className="bg-slate-900 text-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white shadow-sm">
              {(employee?.name || user?.employeeName || user?.username || 'E').charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">ESPRO Employee Portal</h1>
              <p className="text-xs text-slate-300">
                Logged in as <span className="font-semibold text-white">{employee?.name || user?.employeeName || user?.username}</span>
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors"
          >
            Sign Out
          </button>
        </div>
        <div className="max-w-6xl mx-auto px-4 pb-3 flex gap-2 text-sm">
          <button
            onClick={() => navigate('/employee/payslips')}
            className="rounded-lg px-3 py-2 font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
          >
            Payslips
          </button>
          <button
            onClick={() => {
              setActiveTab('timesheet');
              setSearchParams({});
            }}
            className={`rounded-lg px-3 py-2 font-semibold transition-colors ${
              activeTab === 'timesheet'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-200 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Timesheet
          </button>
          {(isApprover || user?.role === 'admin' || pendingReviewsCount > 0) && (
            <button
              onClick={() => {
                setActiveTab('approvals');
                setSearchParams({ tab: 'approvals' });
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 font-semibold transition-colors ${
                activeTab === 'approvals'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-200 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span>Approvals</span>
              {pendingReviewsCount > 0 && (
                <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {pendingReviewsCount}
                </span>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-6xl px-4 pt-8">
        {/* Flash Message */}
        {message.text && (
          <div className={`mb-5 p-3 rounded-xl border text-sm flex items-center justify-between ${
            message.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}>
            <span>{message.text}</span>
            <button onClick={() => setMessage({ type: '', text: '' })} className="font-bold ml-2">✕</button>
          </div>
        )}

        {/* Page title – adapts to active tab */}
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            {activeTab === 'timesheet' ? 'My Timesheet' : 'Attendance Approvals'}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {activeTab === 'timesheet'
              ? 'Attendance logs synchronized from Odoo and approval workflow.'
              : 'Review and approve timesheet corrections requested by employees.'}
          </p>
        </div>

        {/* TAB 1: MY TIMESHEET */}
        {activeTab === 'timesheet' && (
          <>
            {/* Approvers Info Strip */}
            {employee && (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-2.5 text-xs text-indigo-900">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-indigo-800">Assigned Approvers:</span>
                  <span>
                    L1: <strong className="text-indigo-950">{employee.l1ApproverName || 'None assigned'}</strong>
                  </span>
                  <span className="text-indigo-300">•</span>
                  <span>
                    L2: <strong className="text-indigo-950">{employee.l2ApproverType === 'NONE' || !employee.l2ApproverName ? 'None' : employee.l2ApproverName}</strong>
                  </span>
                </div>
                <span className="text-[11px] text-indigo-600">
                  Invalid attendance triggers L1 approval{employee.l2ApproverType !== 'NONE' && employee.l2ApproverName ? ' then L2 approval' : ''}.
                </span>
              </div>
            )}

            {/* Attendance Window Controls */}
            <div className="mb-5 flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between shadow-sm">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Payroll cutoff
                </div>
                <div className="mt-1 text-sm font-bold text-gray-900">
                  {range.startDate} – {range.endDate}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Showing the current or either of the two previous payroll cutoffs.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={loading || page >= 2}
                  onClick={() => setPage(current => Math.min(2, current + 1))}
                  className="h-10 rounded-lg border border-gray-300 px-4 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  ← Previous Cutoff
                </button>
                <button
                  type="button"
                  disabled={loading || page === 0}
                  onClick={() => setPage(current => Math.max(0, current - 1))}
                  className="h-10 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                  Current Cutoff →
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Summary Cards - Strictly NO Hours */}
            {!error && !loading && (
              <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase text-gray-500">Total Records</div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">{records.length}</div>
                </div>
                <div className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase text-emerald-600">Valid</div>
                  <div className="mt-1 text-2xl font-bold text-emerald-700">{validCount}</div>
                </div>
                <div className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase text-red-600">Invalid</div>
                  <div className="mt-1 text-2xl font-bold text-red-700">{invalidCount}</div>
                </div>
                <div className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase text-amber-600">In Approval</div>
                  <div className="mt-1 text-2xl font-bold text-amber-700">{pendingCount}</div>
                </div>
              </div>
            )}

            {/* Attendance Table - Strictly NO Hours */}
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              </div>
            ) : !error && records.length === 0 ? (
              <div className="rounded-2xl border bg-white p-12 text-center text-sm text-gray-500">
                No attendance records found for this date range.
              </div>
            ) : !error && (
              <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
                <div className="hidden grid-cols-[minmax(190px,1fr)_minmax(190px,1fr)_150px_180px] gap-5 border-b bg-gray-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-gray-500 lg:grid">
                  <span>Time In</span>
                  <span>Time Out</span>
                  <span>Status</span>
                  <span>Action</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {records.map((record) => {
                    const isInvalid = record.status === 'Invalid';
                    const isPending = record.status === 'For L1 Approval' || record.status === 'For L2 Approval';

                    return (
                      <div
                        key={record.id}
                        className={`grid gap-3 px-4 py-4 text-sm transition-colors sm:px-5 lg:grid-cols-[minmax(190px,1fr)_minmax(190px,1fr)_150px_180px] lg:items-center lg:gap-5 ${
                          isInvalid ? 'border-l-4 border-red-500 bg-red-50/40' : ''
                        } ${isPending ? 'border-l-4 border-amber-400 bg-amber-50/30' : 'hover:bg-gray-50/60'}`}
                      >
                        {/* Time In */}
                        <div>
                          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-gray-400 lg:hidden">Time In</span>
                          <span className="font-medium text-gray-900">{formatDateTime(record.checkIn)}</span>
                          {record.approvalDetails?.correctedCheckIn && (
                            <div className="text-[11px] text-indigo-600">
                              Corrected: {formatDateTime(record.approvalDetails.correctedCheckIn)}
                            </div>
                          )}
                        </div>

                        {/* Time Out */}
                        <div>
                          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-gray-400 lg:hidden">Time Out</span>
                          <span className={record.checkOut ? 'font-medium text-gray-900' : 'font-semibold text-red-600'}>
                            {formatDateTime(record.checkOut)}
                          </span>
                          {record.approvalDetails?.correctedCheckOut && (
                            <div className="text-[11px] text-indigo-600">
                              Corrected: {formatDateTime(record.approvalDetails.correctedCheckOut)}
                            </div>
                          )}
                        </div>

                        {/* Status */}
                        <div>
                          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-gray-400 lg:hidden">Status</span>
                          {renderStatusBadge(record.status)}
                          {record.approvalDetails?.rejectionReason && (
                            <div className="mt-1 text-[11px] text-red-600">
                              Reason: {record.approvalDetails.rejectionReason}
                            </div>
                          )}
                        </div>

                        {/* Action */}
                        <div>
                          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-gray-400 lg:hidden">Action</span>
                          {isInvalid && (
                            <button
                              type="button"
                              onClick={() => openRequestModal(record)}
                              className="min-h-9 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
                            >
                              Request Approval
                            </button>
                          )}
                          {isPending && (
                            <span className="text-xs italic text-gray-500">
                              Awaiting {record.status === 'For L1 Approval' ? (employee?.l1ApproverName || 'L1') : (employee?.l2ApproverName || 'L2')}
                            </span>
                          )}
                          {!isInvalid && !isPending && <span className="text-gray-300">—</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB 2: PENDING APPROVALS FOR REVIEWERS */}
        {activeTab === 'approvals' && (
          <div className="space-y-4">
            {loadingApprovals ? (
              <div className="flex justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              </div>
            ) : pendingApprovals.length === 0 ? (
              <div className="rounded-2xl border bg-white p-12 text-center text-sm text-gray-500">
                No pending timesheet approvals requiring your action.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
                <div className="hidden grid-cols-[1.5fr_1.5fr_1.5fr_1fr_auto] gap-4 border-b bg-gray-50 px-5 py-3 text-xs font-bold uppercase text-gray-500 sm:grid">
                  <span>Employee</span>
                  <span>Original Punch</span>
                  <span>Corrected Punch &amp; Reason</span>
                  <span>Stage</span>
                  <span className="text-right">Decision</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {pendingApprovals.map((app) => (
                    <div
                      key={app._id}
                      className="grid gap-3 px-5 py-4 text-sm sm:grid-cols-[1.5fr_1.5fr_1.5fr_1fr_auto] sm:items-center"
                    >
                      {/* Employee info */}
                      <div>
                        <div className="font-semibold text-gray-900">{app.employeeName}</div>
                        <div className="text-xs text-gray-500">{app.employeeId?.position || 'Employee'}</div>
                      </div>

                      {/* Original Punch */}
                      <div className="text-xs space-y-1">
                        <div><span className="text-gray-400">In:</span> {formatDateTime(app.checkIn)}</div>
                        <div className={app.checkOut ? '' : 'text-red-600 font-semibold'}><span className="text-gray-400">Out:</span> {formatDateTime(app.checkOut)}</div>
                      </div>

                      {/* Corrected & Reason */}
                      <div className="text-xs space-y-1">
                        {(app.correctedCheckIn || app.correctedCheckOut) && (
                          <div className="font-medium text-indigo-700">
                            {app.correctedCheckIn && <span>In: {formatDateTime(app.correctedCheckIn)} </span>}
                            {app.correctedCheckOut && <span>Out: {formatDateTime(app.correctedCheckOut)}</span>}
                          </div>
                        )}
                        <div className="text-gray-600 italic">"{app.reason || 'No explanation provided'}"</div>
                      </div>

                      {/* Stage badge */}
                      <div>
                        {renderStatusBadge(app.status)}
                      </div>

                      {/* Actions: Approve / Reject */}
                      <div className="flex sm:justify-end items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActionModal({ isOpen: true, approval: app, action: 'APPROVE', notes: '', submitting: false })}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => setActionModal({ isOpen: true, approval: app, action: 'REJECT', notes: '', submitting: false })}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 shadow-sm transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL 1: Request Approval for Invalid Attendance */}
      <Modal
        isOpen={requestModal.isOpen}
        onClose={() => setRequestModal(prev => ({ ...prev, isOpen: false }))}
        title="Request Attendance Approval"
      >
        {requestModal.record && (
          <form onSubmit={handleRequestSubmit} className="space-y-4 text-sm">
            <div className="rounded-lg bg-gray-50 p-3 border text-xs text-gray-600 space-y-1">
              <div><span className="font-semibold text-gray-700">Original Time In:</span> {formatDateTime(requestModal.record.checkIn)}</div>
              <div><span className="font-semibold text-gray-700">Original Time Out:</span> {formatDateTime(requestModal.record.checkOut)}</div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Corrected Check In <span className="text-gray-400 font-normal">(Leave as is if unchanged)</span>
              </label>
              <input
                type="datetime-local"
                value={requestModal.correctedCheckIn}
                onChange={e => setRequestModal({ ...requestModal, correctedCheckIn: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Corrected Check Out <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={requestModal.correctedCheckOut}
                onChange={e => setRequestModal({ ...requestModal, correctedCheckOut: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Reason for Correction <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Forgot to clock out before leaving, device offline, etc."
                value={requestModal.reason}
                onChange={e => setRequestModal({ ...requestModal, reason: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setRequestModal(prev => ({ ...prev, isOpen: false }))}
                className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={requestModal.submitting}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {requestModal.submitting ? 'Submitting…' : 'Submit for L1 Approval'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL 2: Approver Decision Modal */}
      <Modal
        isOpen={actionModal.isOpen}
        onClose={() => setActionModal(prev => ({ ...prev, isOpen: false }))}
        title={`${actionModal.action === 'APPROVE' ? 'Approve' : 'Reject'} Timesheet Correction`}
      >
        {actionModal.approval && (
          <div className="space-y-4 text-sm">
            <p className="text-gray-700">
              Are you sure you want to <strong className={actionModal.action === 'APPROVE' ? 'text-emerald-700' : 'text-red-700'}>
                {actionModal.action === 'APPROVE' ? 'approve' : 'reject'}
              </strong> the timesheet request for <span className="font-semibold">{actionModal.approval.employeeName}</span>?
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                {actionModal.action === 'APPROVE' ? 'Optional Notes' : 'Rejection Reason *'}
              </label>
              <textarea
                rows={3}
                required={actionModal.action === 'REJECT'}
                placeholder={actionModal.action === 'APPROVE' ? 'Add any remarks (optional)' : 'Provide reason for rejection'}
                value={actionModal.notes}
                onChange={e => setActionModal({ ...actionModal, notes: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setActionModal(prev => ({ ...prev, isOpen: false }))}
                className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionModal.submitting || (actionModal.action === 'REJECT' && !actionModal.notes.trim())}
                onClick={handleAction}
                className={`rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-50 ${
                  actionModal.action === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {actionModal.submitting ? 'Processing…' : (actionModal.action === 'APPROVE' ? 'Confirm Approval' : 'Confirm Rejection')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default EmployeeTimesheetPage;

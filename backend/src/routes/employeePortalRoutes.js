import express from 'express';
import PayRun from '../models/PayRun.js';
import PayRunEmployee from '../models/PayRunEmployee.js';
import Employee from '../models/Employee.js';
import AllowanceDeduction from '../models/AllowanceDeduction.js';
import PayrollAdjustment from '../models/PayrollAdjustment.js';
import AttendanceApproval from '../models/AttendanceApproval.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';
import { getPayRunTimesheetLogs } from '../services/payslipTimesheetService.js';
import { findOdooEmployeeByName, getEmployeeAttendance, updateOdooAttendance } from '../services/odooAttendanceService.js';

const router = express.Router();

// All employee portal routes require authentication
router.use(authenticate);

const escapeRegex = (s) => (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Helper to resolve current logged-in employee name/id
async function resolveEmployee(req) {
  let employee = null;

  if (req.user.employeeId) {
    employee = await Employee.findById(req.user.employeeId);
  }

  if (!employee && req.user.username) {
    const cleanUsername = req.user.username.trim().toLowerCase();
    employee = await Employee.findOne({
      $or: [
        { username: cleanUsername },
        { username: { $regex: '^' + escapeRegex(cleanUsername) + '$', $options: 'i' } }
      ]
    });
  }

  if (!employee && req.user.employeeName) {
    employee = await Employee.findOne({
      employeeName: { $regex: '^' + escapeRegex(req.user.employeeName) + '$', $options: 'i' }
    });
  }

  if (!employee) {
    throw new AppError(`Employee profile not found for account "${req.user.username || 'unknown'}".`, 404);
  }

  return { employeeId: employee._id, employeeName: employee.employeeName, employee };
}

// GET /api/employee-portal/attendance - Read the logged-in employee's Odoo attendance
router.get('/attendance', async (req, res, next) => {
  try {
    let employee = null;
    if (req.user.role === 'employee') {
      const resolved = await resolveEmployee(req);
      employee = resolved.employee;
    } else if (req.user.role === 'admin') {
      if (req.query.employeeId) {
        employee = await Employee.findById(req.query.employeeId);
      } else {
        try {
          const resolved = await resolveEmployee(req);
          employee = resolved.employee;
        } catch {
          // If admin has no employee profile, pick first active employee with odooEmployeeId or any
          employee = await Employee.findOne({ status: { $ne: 'RESIGNED' } }).sort({ employeeName: 1 });
        }
      }
      if (!employee) throw new AppError('No employee profile found', 404);
    } else {
      throw new AppError('Unauthorized access', 403);
    }

    const startDate = String(req.query.startDate || '');
    const endDate = String(req.query.endDate || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) {
      throw new AppError('A valid start and end date are required', 400);
    }
    const manilaToday = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    const today = new Date(`${manilaToday}T00:00:00Z`);
    const formatDate = date => date.toISOString().slice(0, 10);
    const cutoffFor = date => {
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      const day = date.getUTCDate();
      return day <= 15
        ? { startDate: formatDate(new Date(Date.UTC(year, month, 1))), endDate: formatDate(new Date(Date.UTC(year, month, 15))) }
        : { startDate: formatDate(new Date(Date.UTC(year, month, 16))), endDate: formatDate(new Date(Date.UTC(year, month + 1, 0))) };
    };
    const currentCutoff = cutoffFor(today);
    const allowedCutoffs = [currentCutoff];
    for (let index = 0; index < 2; index += 1) {
      const priorReference = new Date(`${allowedCutoffs[allowedCutoffs.length - 1].startDate}T00:00:00Z`);
      priorReference.setUTCDate(priorReference.getUTCDate() - 1);
      allowedCutoffs.push(cutoffFor(priorReference));
    }
    const isAllowedCutoff = allowedCutoffs.some(cutoff =>
      cutoff.startDate === startDate && cutoff.endDate === endDate
    );
    if (!isAllowedCutoff) {
      throw new AppError('Attendance is limited to the current and two previous payroll cutoffs', 400);
    }

    let odooEmployeeId = employee.odooEmployeeId;
    let linkedByName = false;
    if (!odooEmployeeId) {
      const odooEmployee = await findOdooEmployeeByName(employee.employeeName);
      if (!odooEmployee) throw new AppError(`No Odoo employee matched "${employee.employeeName}".`, 404);
      odooEmployeeId = odooEmployee.id;
      employee.odooEmployeeId = odooEmployeeId;
      await employee.save();
      linkedByName = true;
    }

    const attendance = await getEmployeeAttendance({ odooEmployeeId, startDate, endDate });

    // Fetch approval records for these attendance logs
    const odooIds = attendance.map(a => a.id);
    const approvals = await AttendanceApproval.find({
      employeeId: employee._id,
      odooAttendanceId: { $in: odooIds }
    });
    const approvalMap = new Map();
    approvals.forEach(app => {
      approvalMap.set(app.odooAttendanceId, app);
    });

    // Check count of pending approvals the logged-in user can review
    let pendingReviewsCount = 0;
    if (req.user.role === 'admin') {
      pendingReviewsCount = await AttendanceApproval.countDocuments({
        status: { $in: ['For L1 Approval', 'For L2 Approval'] }
      });
    } else if (req.user.employeeId) {
      const l1Emps = await Employee.find({ l1ApproverId: req.user.employeeId }).select('_id');
      const l2Emps = await Employee.find({ l2ApproverId: req.user.employeeId }).select('_id');
      const l1Ids = l1Emps.map(e => e._id);
      const l2Ids = l2Emps.map(e => e._id);
      pendingReviewsCount = await AttendanceApproval.countDocuments({
        $or: [
          { employeeId: { $in: l1Ids }, status: 'For L1 Approval' },
          { employeeId: { $in: l2Ids }, status: 'For L2 Approval' }
        ]
      });
    }

    // Map each attendance record to guaranteed status: 'Valid' | 'Invalid' | 'For L1 Approval' | 'For L2 Approval'
    const enrichedAttendance = attendance.map(record => {
      const approval = approvalMap.get(record.id);
      let status = 'Valid';
      if (approval) {
        status = approval.status;
      } else if (record.isInvalid || !record.checkOut) {
        status = 'Invalid';
      }

      return {
        ...record,
        status,
        approvalDetails: approval || null
      };
    });

    let isApprover = false;
    if (req.user.role === 'admin') {
      isApprover = true;
    } else if (employee) {
      isApprover = Boolean(await Employee.exists({
        $or: [{ l1ApproverId: employee._id }, { l2ApproverId: employee._id }]
      }));
    }

    res.json({
      success: true,
      data: enrichedAttendance,
      employee: {
        id: employee._id,
        name: employee.employeeName,
        odooEmployeeId,
        isApprover,
        l1ApproverType: employee.l1ApproverType,
        l1ApproverId: employee.l1ApproverId,
        l1ApproverName: employee.l1ApproverName,
        l2ApproverType: employee.l2ApproverType,
        l2ApproverId: employee.l2ApproverId,
        l2ApproverName: employee.l2ApproverName
      },
      isApprover,
      pendingReviewsCount,
      linkedByName,
      limits: {
        allowedCutoffs
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/employee-portal/approver-status - Quick check if user is an approver and has pending items
router.get('/approver-status', async (req, res, next) => {
  try {
    let isApprover = false;
    let pendingCount = 0;

    if (req.user.role === 'admin') {
      isApprover = true;
      pendingCount = await AttendanceApproval.countDocuments({
        status: { $in: ['For L1 Approval', 'For L2 Approval'] }
      });
    } else {
      let currentEmp = null;
      try {
        const resolved = await resolveEmployee(req);
        currentEmp = resolved.employee;
      } catch {
        return res.json({ success: true, isApprover: false, pendingCount: 0 });
      }

      const l1Emps = await Employee.find({ l1ApproverId: currentEmp._id }).select('_id');
      const l2Emps = await Employee.find({ l2ApproverId: currentEmp._id }).select('_id');
      const l1Ids = l1Emps.map(e => e._id);
      const l2Ids = l2Emps.map(e => e._id);

      isApprover = l1Ids.length > 0 || l2Ids.length > 0;

      if (isApprover) {
        pendingCount = await AttendanceApproval.countDocuments({
          $or: [
            { employeeId: { $in: l1Ids }, status: 'For L1 Approval' },
            { employeeId: { $in: l2Ids }, status: 'For L2 Approval' }
          ]
        });
      }
    }

    res.json({
      success: true,
      isApprover,
      pendingCount
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/employee-portal/attendance/request-approval - Submit invalid punch for approval
router.post('/attendance/request-approval', async (req, res, next) => {
  try {
    const { employee } = await resolveEmployee(req);
    const { odooAttendanceId, date, checkIn, checkOut, correctedCheckIn, correctedCheckOut, reason } = req.body;

    if (!odooAttendanceId) {
      throw new AppError('Odoo attendance ID is required', 400);
    }

    let approval = await AttendanceApproval.findOne({
      employeeId: employee._id,
      odooAttendanceId: Number(odooAttendanceId)
    });

    if (!approval) {
      approval = new AttendanceApproval({
        odooAttendanceId: Number(odooAttendanceId),
        employeeId: employee._id,
        employeeName: employee.employeeName
      });
    }

    approval.date = date || (checkIn ? new Date(checkIn).toISOString().slice(0, 10) : '');
    approval.checkIn = checkIn ? new Date(checkIn) : approval.checkIn;
    approval.checkOut = checkOut ? new Date(checkOut) : approval.checkOut;
    if (correctedCheckIn) approval.correctedCheckIn = new Date(correctedCheckIn);
    if (correctedCheckOut) approval.correctedCheckOut = new Date(correctedCheckOut);
    approval.reason = reason || 'Attendance correction requested';
    approval.status = 'For L1 Approval';
    approval.rejectionReason = '';

    approval.history.push({
      action: 'SUBMITTED',
      byRole: req.user.role || 'employee',
      byId: employee._id,
      byName: employee.employeeName,
      date: new Date(),
      notes: reason || 'Submitted for L1 Approval'
    });

    await approval.save();

    res.json({
      success: true,
      data: approval,
      message: 'Attendance submitted for L1 approval'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/employee-portal/attendance/pending-approvals - Approver lists items needing review
router.get('/attendance/pending-approvals', async (req, res, next) => {
  try {
    let query = {};
    if (req.user.role === 'admin') {
      query = { status: { $in: ['For L1 Approval', 'For L2 Approval'] } };
    } else {
      let currentEmp = null;
      try {
        const resolved = await resolveEmployee(req);
        currentEmp = resolved.employee;
      } catch {
        return res.json({ success: true, data: [] });
      }

      const l1Emps = await Employee.find({ l1ApproverId: currentEmp._id }).select('_id');
      const l2Emps = await Employee.find({ l2ApproverId: currentEmp._id }).select('_id');
      const l1Ids = l1Emps.map(e => e._id);
      const l2Ids = l2Emps.map(e => e._id);

      query = {
        $or: [
          { employeeId: { $in: l1Ids }, status: 'For L1 Approval' },
          { employeeId: { $in: l2Ids }, status: 'For L2 Approval' }
        ]
      };
    }

    const pending = await AttendanceApproval.find(query)
      .populate('employeeId', 'employeeName position l1ApproverName l2ApproverName l2ApproverType')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: pending
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/employee-portal/attendance/action - Approve or Reject an attendance request
router.post('/attendance/action', async (req, res, next) => {
  try {
    const { approvalId, action, notes } = req.body;
    if (!['APPROVE', 'REJECT'].includes(action)) {
      throw new AppError('Action must be APPROVE or REJECT', 400);
    }

    const approval = await AttendanceApproval.findById(approvalId);
    if (!approval) throw new AppError('Approval record not found', 404);

    const targetEmployee = await Employee.findById(approval.employeeId);
    if (!targetEmployee) throw new AppError('Target employee not found', 404);

    const isAdmin = req.user.role === 'admin';
    const currentEmpId = req.user.employeeId ? String(req.user.employeeId) : null;
    const isL1 = (currentEmpId && targetEmployee.l1ApproverId && String(targetEmployee.l1ApproverId) === currentEmpId) ||
                 (targetEmployee.l1ApproverType === 'ADMIN' && isAdmin);
    const isL2 = (currentEmpId && targetEmployee.l2ApproverId && String(targetEmployee.l2ApproverId) === currentEmpId) ||
                 (targetEmployee.l2ApproverType === 'ADMIN' && isAdmin);

    if (approval.status === 'For L1 Approval' && !isL1 && !isAdmin) {
      throw new AppError('You are not authorized to perform L1 approval for this employee', 403);
    }
    if (approval.status === 'For L2 Approval' && !isL2 && !isAdmin) {
      throw new AppError('You are not authorized to perform L2 approval for this employee', 403);
    }

    const actorName = req.user.employeeName || req.user.username || (isAdmin ? 'Admin' : 'Approver');

    if (action === 'APPROVE') {
      if (approval.status === 'For L1 Approval') {
        const hasL2 = targetEmployee.l2ApproverType === 'ADMIN' ||
                      (targetEmployee.l2ApproverType === 'EMPLOYEE' && targetEmployee.l2ApproverId);
        if (hasL2) {
          approval.status = 'For L2 Approval';
          approval.l1ApprovedAt = new Date();
          approval.l1ApprovedBy = actorName;
          approval.history.push({
            action: 'L1_APPROVED',
            byRole: req.user.role,
            byId: req.user.employeeId || null,
            byName: actorName,
            date: new Date(),
            notes: notes || 'Approved by L1 Approver'
          });
        } else {
          approval.status = 'Valid';
          approval.l1ApprovedAt = new Date();
          approval.l1ApprovedBy = actorName;
          approval.history.push({
            action: 'L1_APPROVED',
            byRole: req.user.role,
            byId: req.user.employeeId || null,
            byName: actorName,
            date: new Date(),
            notes: notes || 'Final approval (No L2 required)'
          });
        }
      } else if (approval.status === 'For L2 Approval') {
        approval.status = 'Valid';
        approval.l2ApprovedAt = new Date();
        approval.l2ApprovedBy = actorName;
        approval.history.push({
          action: 'L2_APPROVED',
          byRole: req.user.role,
          byId: req.user.employeeId || null,
          byName: actorName,
          date: new Date(),
          notes: notes || 'Final approval by L2 Approver'
        });
      }
    } else if (action === 'REJECT') {
      approval.status = 'Invalid';
      approval.rejectedAt = new Date();
      approval.rejectedBy = actorName;
      approval.rejectionReason = notes || 'Rejected by approver';
      approval.history.push({
        action: 'REJECTED',
        byRole: req.user.role,
        byId: req.user.employeeId || null,
        byName: actorName,
        date: new Date(),
        notes: notes || 'Rejected'
      });
    }

    await approval.save();

    // --- Sync corrected times back to Odoo when the record is finally approved ---
    if (approval.status === 'Valid' && approval.odooAttendanceId) {
      const hasCorrectedIn  = approval.correctedCheckIn  && approval.correctedCheckIn  !== approval.checkIn;
      const hasCorrectedOut = approval.correctedCheckOut && approval.correctedCheckOut !== approval.checkOut;
      if (hasCorrectedIn || hasCorrectedOut) {
        try {
          await updateOdooAttendance(approval.odooAttendanceId, {
            checkIn:  hasCorrectedIn  ? approval.correctedCheckIn  : undefined,
            checkOut: hasCorrectedOut ? approval.correctedCheckOut : undefined,
            odooEmployeeId: targetEmployee.odooEmployeeId
          });
        } catch (odooErr) {
          // Log but don't fail – the approval is already saved in our DB
          console.error('[Odoo sync] Failed to write corrected attendance:', odooErr.message);
        }
      }
    }

    res.json({
      success: true,
      data: approval,
      message: `Attendance ${action === 'APPROVE' ? 'approved' : 'rejected'} successfully`
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/employee-portal/attendance/all-approvals - List approvals with filters
router.get('/attendance/all-approvals', async (req, res, next) => {
  try {
    const { status, search, employeeId } = req.query;
    let query = {};

    if (req.user.role === 'admin') {
      if (status && status !== 'ALL') {
        query.status = status;
      }
      if (employeeId) {
        query.employeeId = employeeId;
      }
      if (search) {
        query.employeeName = { $regex: search, $options: 'i' };
      }
    } else {
      let currentEmp = null;
      try {
        const resolved = await resolveEmployee(req);
        currentEmp = resolved.employee;
      } catch {
        return res.json({ success: true, data: [] });
      }

      const l1Emps = await Employee.find({ l1ApproverId: currentEmp._id }).select('_id');
      const l2Emps = await Employee.find({ l2ApproverId: currentEmp._id }).select('_id');
      const l1Ids = l1Emps.map(e => e._id);
      const l2Ids = l2Emps.map(e => e._id);

      const assignedEmpIds = [...new Set([...l1Ids.map(String), ...l2Ids.map(String)])];

      query = {
        employeeId: { $in: assignedEmpIds }
      };

      if (status && status !== 'ALL') {
        query.status = status;
      }
      if (search) {
        query.employeeName = { $regex: search, $options: 'i' };
      }
    }

    const approvals = await AttendanceApproval.find(query)
      .populate('employeeId', 'employeeName position l1ApproverName l2ApproverName l2ApproverType')
      .sort({ updatedAt: -1, createdAt: -1 });

    res.json({
      success: true,
      data: approvals
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/employee-portal/attendance/override - Admin overrides any approval directly
router.post('/attendance/override', async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      throw new AppError('Only administrators can override attendance approvals', 403);
    }

    const { approvalId, action, notes } = req.body;
    if (!['FORCE_APPROVE', 'FORCE_REJECT'].includes(action)) {
      throw new AppError('Action must be FORCE_APPROVE or FORCE_REJECT', 400);
    }

    const approval = await AttendanceApproval.findById(approvalId);
    if (!approval) throw new AppError('Approval record not found', 404);
    const targetEmployee = await Employee.findById(approval.employeeId);
    if (!targetEmployee) throw new AppError('Target employee not found', 404);

    const adminName = req.user.username || 'Admin';

    if (action === 'FORCE_APPROVE') {
      approval.status = 'Valid';
      approval.l1ApprovedAt = approval.l1ApprovedAt || new Date();
      approval.l1ApprovedBy = approval.l1ApprovedBy || adminName;
      approval.l2ApprovedAt = new Date();
      approval.l2ApprovedBy = `${adminName} (Admin Override)`;
      approval.rejectionReason = '';

      approval.history.push({
        action: 'L2_APPROVED',
        byRole: 'admin',
        byId: req.user.employeeId || null,
        byName: `${adminName} (Admin Override)`,
        date: new Date(),
        notes: `[ADMIN OVERRIDE - FORCE APPROVE] ${notes || 'Manually approved by Administrator'}`
      });
    } else if (action === 'FORCE_REJECT') {
      approval.status = 'Invalid';
      approval.rejectedAt = new Date();
      approval.rejectedBy = `${adminName} (Admin Override)`;
      approval.rejectionReason = `[ADMIN OVERRIDE] ${notes || 'Rejected by Administrator'}`;

      approval.history.push({
        action: 'REJECTED',
        byRole: 'admin',
        byId: req.user.employeeId || null,
        byName: `${adminName} (Admin Override)`,
        date: new Date(),
        notes: `[ADMIN OVERRIDE - FORCE REJECT] ${notes || 'Manually rejected by Administrator'}`
      });
    }

    await approval.save();

    // --- Sync corrected times back to Odoo when admin force-approves ---
    if (approval.status === 'Valid' && approval.odooAttendanceId) {
      const hasCorrectedIn  = approval.correctedCheckIn  && approval.correctedCheckIn  !== approval.checkIn;
      const hasCorrectedOut = approval.correctedCheckOut && approval.correctedCheckOut !== approval.checkOut;
      if (hasCorrectedIn || hasCorrectedOut) {
        try {
          await updateOdooAttendance(approval.odooAttendanceId, {
            checkIn:  hasCorrectedIn  ? approval.correctedCheckIn  : undefined,
            checkOut: hasCorrectedOut ? approval.correctedCheckOut : undefined,
            odooEmployeeId: targetEmployee.odooEmployeeId
          });
        } catch (odooErr) {
          console.error('[Odoo sync] Failed to write corrected attendance (override):', odooErr.message);
        }
      }
    }

    res.json({
      success: true,
      data: approval,
      message: `Approval overridden to ${approval.status} by administrator`
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/employee-portal/payslips - List all PAID pay runs for current employee
router.get('/payslips', async (req, res, next) => {
  try {
    const { employeeId, employeeName } = await resolveEmployee(req);

    // Find all paid pay runs
    const paidPayRuns = await PayRun.find({ status: 'PAID' }).sort({ payrollPeriodEnd: -1, createdAt: -1 });
    const payRunIds = paidPayRuns.map(pr => pr._id);

    const nameRegex = new RegExp('^' + escapeRegex(employeeName) + '$', 'i');
    const searchConditions = [{ employeeName: nameRegex }];
    if (employeeId) {
      searchConditions.push({ employeeId: employeeId });
    }

    // Find PayRunEmployee entries for this employee in paid pay runs
    const entries = await PayRunEmployee.find({
      payRunId: { $in: payRunIds },
      $or: searchConditions
    });

    const entryMap = new Map();
    entries.forEach(entry => {
      entryMap.set(entry.payRunId.toString(), entry);
    });

    const result = paidPayRuns
      .filter(pr => entryMap.has(pr._id.toString()))
      .map(pr => {
        const entry = entryMap.get(pr._id.toString());
        const start = pr.payrollPeriodStart || pr.payPeriodStart;
        const end = pr.payrollPeriodEnd || pr.payPeriodEnd;
        const payout = pr.payoutDate || pr.paymentDate;

        const basicSalary = entry.basicSalary !== undefined ? entry.basicSalary : (entry.basicPay || 0);
        const overtimePay = entry.overtimePay || 0;
        const nightDiffPay = entry.nightDiffPay !== undefined ? entry.nightDiffPay : (entry.ndPay || 0);
        const regularHolidayPay = entry.regularHolidayPay || 0;
        const specialHolidayPay = entry.specialHolidayPay || 0;
        const overtimeRegularHolidayPay = entry.overtimeRegularHolidayPay || 0;
        const overtimeSpecialHolidayPay = entry.overtimeSpecialHolidayPay || 0;
        const allowancesTotal = entry.allowancesTotal !== undefined ? entry.allowancesTotal : (entry.allowances || 0);
        const deductionsTotal = entry.deductionsTotal !== undefined ? entry.deductionsTotal : (entry.totalDeductions || 0);

        const priorPeriodAdjustmentTotal = entry.priorPeriodAdjustmentTotal || 0;
        const calculatedGross = basicSalary + overtimePay + nightDiffPay + regularHolidayPay + specialHolidayPay + overtimeRegularHolidayPay + overtimeSpecialHolidayPay + allowancesTotal + priorPeriodAdjustmentTotal;
        const grossSalary = (entry.grossSalary && entry.grossSalary > 0) ? entry.grossSalary : calculatedGross;
        const netSalary = entry.netSalary || (grossSalary - deductionsTotal);

        return {
          payRunId: pr._id,
          payPeriodStart: start,
          payPeriodEnd: end,
          payrollPeriodStart: start,
          payrollPeriodEnd: end,
          paymentDate: payout,
          payoutDate: payout,
          payrollType: pr.payrollType,
          status: pr.status,
          entryId: entry._id,
          employeeName: entry.employeeName,
          basicPay: basicSalary,
          overtimePay,
          ndPay: nightDiffPay,
          regularHolidayHours: entry.regularHolidayHours || 0,
          regularHolidayPay,
          specialHolidayHours: entry.specialHolidayHours || 0,
          specialHolidayPay,
          overtimeRegularHolidayHours: entry.overtimeRegularHolidayHours || 0,
          overtimeRegularHolidayPay,
          overtimeSpecialHolidayHours: entry.overtimeSpecialHolidayHours || 0,
          overtimeSpecialHolidayPay,
          allowancesTotal,
          priorPeriodAdjustmentTotal,
          grossSalary,
          totalDeductions: deductionsTotal,
          netSalary
        };
      });

    res.json({
      success: true,
      data: result,
      employeeName
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/employee-portal/payslips/:payRunId - Detailed payslip view for employee
router.get('/payslips/:payRunId', async (req, res, next) => {
  try {
    const { payRunId } = req.params;
    const { employeeId, employeeName } = await resolveEmployee(req);

    // Verify pay run exists and is PAID
    const payRun = await PayRun.findById(payRunId);
    if (!payRun) {
      throw new AppError('Pay run not found', 404);
    }
    if (payRun.status !== 'PAID') {
      throw new AppError('Access denied: Only paid payslips can be viewed', 403);
    }

    const nameRegex = new RegExp('^' + escapeRegex(employeeName) + '$', 'i');
    const searchConditions = [{ employeeName: nameRegex }];
    if (employeeId) {
      searchConditions.push({ employeeId: employeeId });
    }

    // Find employee's entry
    const entry = await PayRunEmployee.findOne({
      payRunId: payRun._id,
      $or: searchConditions
    });

    if (!entry) {
      throw new AppError('Payslip entry not found for this pay period', 404);
    }

    // Fetch Employee profile to populate wageRate, wageType, position, employmentType
    const empDoc = (entry.employeeId ? await Employee.findById(entry.employeeId) : null) || await Employee.findOne({
      employeeName: { $regex: '^' + escapeRegex(entry.employeeName) + '$', $options: 'i' }
    });

    const start = payRun.payrollPeriodStart || payRun.payPeriodStart;
    const end = payRun.payrollPeriodEnd || payRun.payPeriodEnd;
    const payout = payRun.payoutDate || payRun.paymentDate;

    const timesheetLogs = await getPayRunTimesheetLogs(payRun, entry.employeeName);

    let adjustments = [];
    if (empDoc?._id || entry.employeeId) {
      const targetEmpId = empDoc?._id || entry.employeeId;
      adjustments = await AllowanceDeduction.find({
        employeeId: targetEmpId,
        $or: [
          {
            appliesFrom: { $lte: new Date(end) },
            appliesTo: { $gte: new Date(start) }
          },
          {
            appliesFrom: { $lte: new Date(end) },
            appliesTo: null
          }
        ]
      }).sort({ appliesFrom: 1 });
    }

    const basicSalary = entry.basicSalary !== undefined ? entry.basicSalary : (entry.basicPay || 0);
    const overtimeHours = entry.overtimeHours || entry.regularOvertimeHours || 0;
    const overtimePay = entry.overtimePay || 0;
    const nightDiffHours = entry.nightDiffHours || entry.ndHours || 0;
    const nightDiffPay = entry.nightDiffPay !== undefined ? entry.nightDiffPay : (entry.ndPay || 0);
    const regularHolidayPay = entry.regularHolidayPay || 0;
    const specialHolidayPay = entry.specialHolidayPay || 0;
    const overtimeRegularHolidayPay = entry.overtimeRegularHolidayPay || 0;
    const overtimeSpecialHolidayPay = entry.overtimeSpecialHolidayPay || 0;
    const allowancesTotal = entry.allowancesTotal !== undefined ? entry.allowancesTotal : (entry.allowances || 0);
    const deductionsTotal = entry.deductionsTotal !== undefined ? entry.deductionsTotal : (entry.totalDeductions || 0);

    const priorPeriodAdjustmentTotal = entry.priorPeriodAdjustmentTotal || 0;
    const calculatedGross = basicSalary + overtimePay + nightDiffPay + regularHolidayPay + specialHolidayPay + overtimeRegularHolidayPay + overtimeSpecialHolidayPay + allowancesTotal + priorPeriodAdjustmentTotal;
    const grossSalary = (entry.grossSalary && entry.grossSalary > 0) ? entry.grossSalary : calculatedGross;
    const netSalary = entry.netSalary || (grossSalary - deductionsTotal);

    // Dynamic SSS, PhilHealth, Pag-IBIG deduction breakdown if present in breakdown object
    const sssContribution = entry.breakdown?.sssDeduction || entry.sssContribution || 0;
    const philhealthContribution = entry.breakdown?.philhealthDeduction || entry.philhealthContribution || 0;
    const pagibigContribution = entry.breakdown?.pagibigDeduction || entry.pagibigContribution || 0;
    const withholdingTax = entry.breakdown?.withholdingTax || entry.withholdingTax || 0;

    const mergedEntry = {
      ...entry.toObject(),
      wageRate: empDoc?.wageRate || entry.wageRate || 0,
      wageType: empDoc?.wageType || entry.wageType || 'HOURLY',
      position: empDoc?.position || entry.position || 'Staff',
      employmentType: empDoc?.employmentType || entry.employmentType || 'FULL_TIME',
      basicSalary,
      basicPay: basicSalary,
      overtimeHours,
      regularOvertimeHours: overtimeHours,
      overtimePay,
      nightDiffHours,
      ndHours: nightDiffHours,
      nightDiffPay,
      ndPay: nightDiffPay,
      regularHolidayPay,
      specialHolidayPay,
      overtimeRegularHolidayPay,
      overtimeSpecialHolidayPay,
      priorPeriodAdjustmentTotal,
      allowancesTotal,
      allowances: allowancesTotal,
      deductionsTotal,
      totalDeductions: deductionsTotal,
      grossSalary,
      netSalary,
      sssContribution,
      philhealthContribution,
      pagibigContribution,
      withholdingTax
    };

    const payrollAdjustments = await PayrollAdjustment.find({
      includedPayRunId: payRun._id,
      employeeId: entry.employeeId,
      status: 'PAID'
    }).sort({ originalWorkDate: 1, createdAt: 1 }).lean();

    res.json({
      success: true,
      data: {
        payRun: {
          _id: payRun._id,
          payPeriodStart: start,
          payPeriodEnd: end,
          payrollPeriodStart: start,
          payrollPeriodEnd: end,
          paymentDate: payout,
          payoutDate: payout,
          payrollType: payRun.payrollType,
          status: payRun.status
        },
        entry: mergedEntry,
        timesheetLogs,
        adjustments,
        payrollAdjustments
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;

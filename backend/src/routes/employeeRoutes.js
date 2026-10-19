import express from 'express';
import Employee from '../models/Employee.js';
import TimesheetLog from '../models/TimesheetLog.js';
import PayRunEmployee from '../models/PayRunEmployee.js';
import Schedule from '../models/Schedule.js';
import Availability from '../models/Availability.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';
import { assertManagerCanManageEmployee, isEmployeeInManagerScope, managerEmployeeQuery } from '../utils/managerScope.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// POST /api/employees/:id/password-reset-link - Generate a one-time reset link
router.post('/:id/password-reset-link', authorize(['admin']), async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      throw new AppError('Employee not found', 404);
    }
    if (!employee.username) {
      throw new AppError('Set a portal username for this employee first', 400);
    }

    const token = crypto.randomBytes(32).toString('hex');
    employee.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
    employee.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await employee.save({ validateBeforeSave: false });

    const frontendUrl = (process.env.FRONTEND_URL || req.get('origin') || 'http://localhost:5173').replace(/\/$/, '');
    const resetLink = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

    res.json({
      success: true,
      data: {
        resetLink,
        expiresAt: employee.passwordResetExpires,
        employeeName: employee.employeeName
      },
      message: 'Password reset link generated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/employees - List all employees
router.get('/', async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && !req.user.managerScope) {
      throw new AppError('Employee directory access is limited to administrators and Scheduling Leads', 403);
    }
    const { search, excludeResigned } = req.query;
    
    let query = {};
    if (search) {
      query.employeeName = { $regex: search, $options: 'i' };
    }
    if (excludeResigned === 'true') {
      query.status = { $ne: 'RESIGNED' };
    }
    if (req.user.managerScope) {
      query = { $and: [query, managerEmployeeQuery(req.user.managerScope)] };
    }
    
    let projection = {};
    if (req.user.managerScope) {
      projection = { wageType: 0, wageRate: 0 };
    }
    const employees = await Employee.find(query, projection).sort({ employeeName: 1 });
    
    res.json({
      success: true,
      data: employees,
      count: employees.length
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/employees - Add new employee
router.post('/', async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      throw new AppError('Only administrators can create employees', 403);
    }
    if (req.user.role === 'manager') {
      delete req.body.wageType;
      delete req.body.wageRate;
      delete req.body.eligibleForThirteenthMonth;
    }
    const {
      employeeName,
      position,
      email,
      birthday,
      address,
      hiredDate,
      resignedDate,
      lastWorkingDate,
      status,
      employmentType,
      scheduleLeadRole,
      wageType,
      wageRate,
      eligibleForThirteenthMonth,
      username,
      password,
      l1ApproverType,
      l1ApproverId,
      l1ApproverName,
      l2ApproverType,
      l2ApproverId,
      l2ApproverName,
      odooEmployeeId
    } = req.body;

    if (req.user.role === 'manager' && !isEmployeeInManagerScope(position, req.user.managerScope)) {
      throw new AppError('Managers can only create employees in their department', 403);
    }
    
    if (!employeeName || !employeeName.trim()) {
      throw new AppError('Employee name is required', 400);
    }

    let hashedPassword = undefined;
    let portalPassword = undefined;
    if (password && password.trim()) {
      const raw = password.trim();
      hashedPassword = await bcrypt.hash(raw, 10);
      portalPassword = raw;
    }

    const parsedOdooId = (odooEmployeeId !== undefined && odooEmployeeId !== '' && odooEmployeeId !== null)
      ? Number(odooEmployeeId)
      : undefined;
    if (parsedOdooId !== undefined && (isNaN(parsedOdooId) || parsedOdooId < 1)) {
      throw new AppError('Odoo Employee ID must be a positive number', 400);
    }
    
    const employeePayload = {
      employeeName: employeeName.trim(),
      position,
      email,
      birthday,
      address,
      hiredDate,
      resignedDate,
      lastWorkingDate,
      status,
      employmentType,
      scheduleLeadRole: req.user.role === 'admin' ? (scheduleLeadRole || 'NONE') : 'NONE',
      wageType,
      wageRate,
      eligibleForThirteenthMonth,
      username: username ? username.trim().toLowerCase() : undefined,
      password: hashedPassword,
      portalPassword,
      odooEmployeeId: parsedOdooId,
      l1ApproverType: l1ApproverType || null,
      l1ApproverId: l1ApproverId || null,
      l1ApproverName: l1ApproverName || '',
      l2ApproverType: l2ApproverType || 'NONE',
      l2ApproverId: l2ApproverId || null,
      l2ApproverName: l2ApproverName || ''
    };
    
    const employee = await Employee.create(employeePayload);
    
    res.status(201).json({
      success: true,
      data: employee,
      message: 'Employee created successfully'
    });
  } catch (error) {
    if (error.code === 11000) {
      if (error.keyPattern?.username) {
        next(new AppError('Username is already taken', 400));
      } else if (error.keyPattern?.odooEmployeeId) {
        next(new AppError('Odoo Employee ID is already linked to another employee', 400));
      } else {
        next(new AppError('Employee name already exists', 400));
      }
    } else {
      next(error);
    }
  }
});

// PUT /api/employees/:name - Update employee
router.put('/:name', async (req, res, next) => {
  try {
    if (req.user.role === 'employee') {
      throw new AppError('Only administrators can update employees', 403);
    }
    const { name } = req.params;
    const updateData = { ...req.body };
    const currentEmployee = await Employee.findOne({ employeeName: name.trim() });
    if (!currentEmployee) throw new AppError('Employee not found', 404);
    assertManagerCanManageEmployee(currentEmployee, req.user);
    if (req.user.role === 'manager' && updateData.position !== undefined && !isEmployeeInManagerScope(updateData.position, req.user.managerScope)) {
      throw new AppError('Managers cannot move employees outside their department', 403);
    }
    
    if (req.user.role === 'manager') {
      delete updateData.wageType;
      delete updateData.wageRate;
      delete updateData.eligibleForThirteenthMonth;
      delete updateData.scheduleLeadRole;
    }
    
    if (updateData.l1ApproverId === '') updateData.l1ApproverId = null;
    if (updateData.l2ApproverId === '') updateData.l2ApproverId = null;
    if (updateData.odooEmployeeId === '' || updateData.odooEmployeeId === null) {
      updateData.odooEmployeeId = null;
    } else if (updateData.odooEmployeeId !== undefined) {
      const parsed = Number(updateData.odooEmployeeId);
      if (isNaN(parsed) || parsed < 1) {
        throw new AppError('Odoo Employee ID must be a positive number', 400);
      }
      updateData.odooEmployeeId = parsed;
    }

    if (updateData.employeeName && !updateData.employeeName.trim()) {
      throw new AppError('Employee name is required', 400);
    }

    if (updateData.employeeName) {
      updateData.employeeName = updateData.employeeName.trim();
    }

    if (updateData.username !== undefined) {
      updateData.username = updateData.username ? updateData.username.trim().toLowerCase() : null;
    }

    if (updateData.password && updateData.password.trim()) {
      const raw = updateData.password.trim();
      updateData.password = await bcrypt.hash(raw, 10);
      updateData.portalPassword = raw;
      updateData.passwordResetToken = null;
      updateData.passwordResetExpires = null;
    } else {
      delete updateData.password;
    }
    
    const oldName = name.trim();
    const newName = updateData.employeeName ? updateData.employeeName.trim() : null;

    const employee = await Employee.findOneAndUpdate(
      { employeeName: oldName },
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!employee) {
      throw new AppError('Employee not found', 404);
    }
    
    // Cascade name update to related collections if employeeName changed
    if (newName && newName !== oldName) {
      await Promise.all([
        TimesheetLog.updateMany({ employeeName: oldName }, { $set: { employeeName: newName } }),
        PayRunEmployee.updateMany({ employeeName: oldName }, { $set: { employeeName: newName } }),
        Schedule.updateMany({ employeeName: oldName }, { $set: { employeeName: newName } }),
        Availability.updateMany({ employeeName: oldName }, { $set: { employeeName: newName } })
      ]);
    }

    res.json({
      success: true,
      data: employee,
      message: 'Employee updated successfully'
    });
  } catch (error) {
    if (error.code === 11000) {
      // Handle unique index conflicts (name, email, or odooEmployeeId)
      if (error.keyPattern?.employeeName) {
        next(new AppError('Employee name already exists', 400));
      } else if (error.keyPattern?.email) {
        next(new AppError('Email already exists', 400));
      } else if (error.keyPattern?.odooEmployeeId) {
        next(new AppError('Odoo Employee ID is already linked to another employee', 400));
      } else {
        next(error);
      }
    } else {
      next(error);
    }
  }
});

// DELETE /api/employees/:name - Delete employee
router.delete('/:name', authorize(['admin']), async (req, res, next) => {
  try {
    const { name } = req.params;
    const employeeName = name.trim();

    const employee = await Employee.findOneAndDelete({ employeeName });
    if (!employee) {
      throw new AppError('Employee not found', 404);
    }

    // Cascade delete related records
    await Promise.all([
      TimesheetLog.deleteMany({ employeeName }),
      PayRunEmployee.deleteMany({ employeeName }),
      Schedule.deleteMany({ employeeName }),
      Availability.deleteMany({ employeeName })
    ]);

    res.json({
      success: true,
      message: 'Employee and all associated records deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;

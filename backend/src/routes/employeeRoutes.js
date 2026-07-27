import express from 'express';
import Employee from '../models/Employee.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/employees - List all employees
router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query;
    
    let query = {};
    if (search) {
      query.employeeName = { $regex: search, $options: 'i' };
    }
    
    let projection = {};
    if (req.user.role === 'manager') {
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
    if (req.user.role === 'manager') {
      delete req.body.wageType;
      delete req.body.wageRate;
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
      wageType,
      wageRate
    } = req.body;
    
    if (!employeeName || !employeeName.trim()) {
      throw new AppError('Employee name is required', 400);
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
      wageType,
      wageRate
    };
    
    const employee = await Employee.create(employeePayload);
    
    res.status(201).json({
      success: true,
      data: employee,
      message: 'Employee created successfully'
    });
  } catch (error) {
    if (error.code === 11000) {
      next(new AppError('Employee name already exists', 400));
    } else {
      next(error);
    }
  }
});

// PUT /api/employees/:name - Update employee
router.put('/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    const updateData = req.body;
    
    if (req.user.role === 'manager') {
      delete updateData.wageType;
      delete updateData.wageRate;
    }
    
    if (updateData.employeeName && !updateData.employeeName.trim()) {
      throw new AppError('Employee name is required', 400);
    }

    if (updateData.employeeName) {
      updateData.employeeName = updateData.employeeName.trim();
    }
    
    const employee = await Employee.findOneAndUpdate(
      { employeeName: name },
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!employee) {
      throw new AppError('Employee not found', 404);
    }
    
    res.json({
      success: true,
      data: employee,
      message: 'Employee updated successfully'
    });
  } catch (error) {
    if (error.code === 11000) {
      // Handle unique index conflicts (name or email)
      if (error.keyPattern?.employeeName) {
      next(new AppError('Employee name already exists', 400));
      } else if (error.keyPattern?.email) {
        next(new AppError('Email already exists', 400));
      } else {
        next(error);
      }
    } else {
      next(error);
    }
  }
});

// DELETE /api/employees/:name - Delete employee
router.delete('/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    
    const employee = await Employee.findOneAndDelete({ employeeName: name });
    
    if (!employee) {
      throw new AppError('Employee not found', 404);
    }
    
    res.json({
      success: true,
      message: 'Employee deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;


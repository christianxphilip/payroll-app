import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Employee from '../models/Employee.js';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// POST /api/auth/login - Login with username/password or password only
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    if (!password) {
      throw new AppError('Password is required', 400);
    }
    
    const adminPassword = process.env.ADMIN_PASSWORD || process.env.AUTH_PASSWORD || 'admin123';
    const managerPassword = process.env.MANAGER_PASSWORD || 'manager123';
    
    let resolvedRole = null;
    let resolvedUsername = null;
    let employeeId = null;
    let employeeName = null;
    
    const cleanUsername = username ? username.trim().toLowerCase() : '';

    if (cleanUsername === 'admin' && password === adminPassword) {
      resolvedRole = 'admin';
      resolvedUsername = 'admin';
    } else if (cleanUsername === 'manager' && password === managerPassword) {
      resolvedRole = 'manager';
      resolvedUsername = 'manager';
    } else if (!cleanUsername && password === adminPassword) {
      resolvedRole = 'admin';
      resolvedUsername = 'admin';
    } else if (!cleanUsername && password === managerPassword) {
      resolvedRole = 'manager';
      resolvedUsername = 'manager';
    } else if (cleanUsername) {
      // Check Employee collection for matching username
      const emp = await Employee.findOne({ username: cleanUsername }).select('+password');
      if (emp && emp.password) {
        const isMatch = await bcrypt.compare(password, emp.password);
        if (isMatch) {
          resolvedRole = 'employee';
          resolvedUsername = emp.username;
          employeeId = emp._id;
          employeeName = emp.employeeName;
        }
      }
    }
    
    if (!resolvedRole) {
      throw new AppError('Invalid username or password', 401);
    }
    
    // Generate JWT token containing the username, role, and employee info
    const token = jwt.sign(
      { 
        authenticated: true,
        username: resolvedUsername,
        role: resolvedRole,
        employeeId,
        employeeName
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      token,
      user: {
        username: resolvedUsername,
        role: resolvedRole,
        employeeId,
        employeeName
      },
      message: 'Login successful'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/verify - Verify token validity
router.post('/verify', authenticate, (req, res) => {
  res.json({
    success: true,
    user: req.user,
    message: 'Token is valid'
  });
});


export default router;


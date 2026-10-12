import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
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
    const kitchenManagerPassword = process.env.KITCHEN_MANAGER_PASSWORD || managerPassword;
    const barManagerPassword = process.env.BAR_MANAGER_PASSWORD || managerPassword;
    
    let resolvedRole = null;
    let resolvedUsername = null;
    let employeeId = null;
    let employeeName = null;
    let managerScope = null;
    
    const cleanUsername = username ? username.trim().toLowerCase() : '';

    if (cleanUsername === 'admin' && password === adminPassword) {
      resolvedRole = 'admin';
      resolvedUsername = 'admin';
    } else if (['kitchen manager', 'kitchen-manager', 'kitchen_manager', 'kitchenmanager'].includes(cleanUsername) && password === kitchenManagerPassword) {
      resolvedRole = 'manager';
      resolvedUsername = 'kitchen-manager';
      managerScope = 'kitchen';
    } else if (['bar manager', 'bar-manager', 'bar_manager', 'barmanager'].includes(cleanUsername) && password === barManagerPassword) {
      resolvedRole = 'manager';
      resolvedUsername = 'bar-manager';
      managerScope = 'bar';
    } else if (cleanUsername === 'manager' && password === managerPassword) {
      throw new AppError('Use the kitchen manager or bar manager username', 401);
    } else if (!cleanUsername && password === adminPassword) {
      resolvedRole = 'admin';
      resolvedUsername = 'admin';
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
        employeeName,
        managerScope
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
        employeeName,
        managerScope
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

const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// GET /api/auth/reset-password/:token - Check whether a reset link is still usable
router.get('/reset-password/:token', async (req, res, next) => {
  try {
    const employee = await Employee.findOne({
      passwordResetToken: hashResetToken(req.params.token),
      passwordResetExpires: { $gt: new Date() }
    }).select('employeeName username');

    if (!employee) {
      throw new AppError('This password reset link is invalid or has expired', 400);
    }

    res.json({
      success: true,
      data: { employeeName: employee.employeeName, username: employee.username }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/reset-password/:token - Set a new password and consume the link
router.post('/reset-password/:token', async (req, res, next) => {
  try {
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (password.length < 8) {
      throw new AppError('Password must be at least 8 characters long', 400);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const employee = await Employee.findOneAndUpdate({
      passwordResetToken: hashResetToken(req.params.token),
      passwordResetExpires: { $gt: new Date() }
    }, {
      $set: { password: hashedPassword },
      $unset: { portalPassword: 1, passwordResetToken: 1, passwordResetExpires: 1 }
    }, { new: true });

    if (!employee) {
      throw new AppError('This password reset link is invalid or has expired', 400);
    }

    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    next(error);
  }
});


export default router;

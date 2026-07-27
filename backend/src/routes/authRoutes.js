import express from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// POST /api/auth/login - Login with username/password or just password
router.post('/login', (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    if (!password) {
      throw new AppError('Password is required', 400);
    }
    
    const adminPassword = process.env.ADMIN_PASSWORD || process.env.AUTH_PASSWORD || 'admin123';
    const managerPassword = process.env.MANAGER_PASSWORD || 'manager123';
    
    let resolvedRole = null;
    let resolvedUsername = null;
    
    if (username) {
      if (username === 'admin' && password === adminPassword) {
        resolvedRole = 'admin';
        resolvedUsername = 'admin';
      } else if (username === 'manager' && password === managerPassword) {
        resolvedRole = 'manager';
        resolvedUsername = 'manager';
      } else {
        throw new AppError('Invalid username or password', 401);
      }
    } else {
      // Backward compatible password-only login
      if (password === adminPassword) {
        resolvedRole = 'admin';
        resolvedUsername = 'admin';
      } else if (password === managerPassword) {
        resolvedRole = 'manager';
        resolvedUsername = 'manager';
      } else {
        throw new AppError('Invalid password', 401);
      }
    }
    
    // Generate JWT token containing the username and role
    const token = jwt.sign(
      { 
        authenticated: true,
        username: resolvedUsername,
        role: resolvedRole
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      token,
      user: {
        username: resolvedUsername,
        role: resolvedRole
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


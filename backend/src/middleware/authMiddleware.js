import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler.js';

export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }

    const token = authHeader.split(' ')[1];
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role === 'manager') {
      throw new AppError('Manager accounts have been replaced by employee Scheduling Lead accounts. Please sign in again.', 401);
    }
    if (decoded.managerScope && !['kitchen', 'bar'].includes(decoded.managerScope)) {
      throw new AppError('Scheduling Lead session must be renewed', 401);
    }
    req.user = {
      role: decoded.role || 'admin',
      username: decoded.username || 'admin',
      ...decoded
    };
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(new AppError('Invalid token', 401));
    } else if (error.name === 'TokenExpiredError') {
      next(new AppError('Token expired', 401));
    } else {
      next(error);
    }
  }
};

export const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Unauthorized', 401));
    }
    if (roles.length && !roles.includes(req.user.role)) {
      return next(new AppError('Forbidden: Access denied', 403));
    }
    next();
  };
};

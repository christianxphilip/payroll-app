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



import { AppError } from '../middleware/errorHandler.js';

export const normalizePosition = (position = '') => String(position).trim().toLowerCase();

export const getPositionDepartments = (position) => {
  const value = normalizePosition(position);
  return {
    kitchen: value.includes('kitchen'),
    bar: value.includes('barista') || /(^|\W)bar($|\W)/.test(value)
  };
};

export const isDualPosition = (position) => {
  const departments = getPositionDepartments(position);
  return departments.kitchen && departments.bar;
};

export const isEmployeeInManagerScope = (position, managerScope) => {
  if (!managerScope) return true;
  return Boolean(getPositionDepartments(position)[managerScope]);
};

export const managerEmployeeQuery = (managerScope) => {
  if (managerScope === 'kitchen') return { position: { $regex: 'kitchen', $options: 'i' } };
  if (managerScope === 'bar') return { position: { $regex: 'barista|(^|[^a-z])bar([^a-z]|$)', $options: 'i' } };
  return {};
};

export const managerAssignmentType = (managerScope) => managerScope === 'kitchen' ? 'KITCHEN' : 'BAR';

export const assertManagerCanManageEmployee = (employee, reqUser) => {
  if (reqUser.role === 'manager' && !isEmployeeInManagerScope(employee?.position, reqUser.managerScope)) {
    throw new AppError('This employee is outside your department', 403);
  }
};

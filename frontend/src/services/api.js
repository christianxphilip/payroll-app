import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:9001/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', typeof credentials === 'string' ? { password: credentials } : credentials),
  verify: () => api.post('/auth/verify'),
};

// Employee API
export const employeeAPI = {
  getAll: (search = '') => api.get('/employees', { params: { search } }),
  create: (data) => api.post('/employees', data),
  update: (name, data) => api.put(`/employees/${encodeURIComponent(name)}`, data),
  delete: (name) => api.delete(`/employees/${encodeURIComponent(name)}`),
  getAdjustments: (employeeId) =>
    api.get(`/employees/${employeeId}/adjustments`),
  createAdjustment: (employeeId, data) =>
    api.post(`/employees/${employeeId}/adjustments`, data),
  updateAdjustment: (id, data) =>
    api.put(`/adjustments/${id}`, data),
  deleteAdjustment: (id) =>
    api.delete(`/adjustments/${id}`)
};

// Holiday API
export const holidayAPI = {
  getAll: (filters = {}) => api.get('/holidays', { params: filters }),
  create: (data) => api.post('/holidays', data),
  bulkCreate: (holidays) => api.post('/holidays/bulk', { holidays }),
  bulkCreateFromExternal: (year) => api.post('/holidays/fetch-external', { year }),
  update: (id, data) => api.put(`/holidays/${id}`, data),
  delete: (id) => api.delete(`/holidays/${id}`),
};

// Schedule API
export const scheduleAPI = {
  getAll: (filters = {}) => api.get('/schedules', { params: filters }),
  create: (data) => api.post('/schedules', data),
  bulkCreate: (schedules) => api.post('/schedules/bulk', { schedules }),
  uploadCSV: (formData) => api.post('/schedules/upload-csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, data) => api.put(`/schedules/${id}`, data),
  delete: (id) => api.delete(`/schedules/${id}`),
  deleteRange: (data) => api.delete('/schedules/range/delete', { data }),
  getEstimatedSalary: (startDate, endDate) => api.get('/schedules/estimated-salary', { params: { startDate, endDate } }),
  exportICal: async (startDate, endDate, employeeName = '') => {
    const params = { startDate, endDate };
    if (employeeName) params.employeeName = employeeName;

    const response = await api.get('/schedules/export-ical', {
      params,
      responseType: 'blob'
    });

    const blob = new Blob([response], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `espro-schedules-${startDate}-to-${endDate}.ics`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
};

// Assignment API
export const assignmentAPI = {
  getAll: (filters = {}) => api.get('/assignments', { params: filters }),
  getById: (id) => api.get(`/assignments/${id}`),
  create: (data) => api.post('/assignments', data),
  update: (id, data) => api.put(`/assignments/${id}`, data),
  delete: (id) => api.delete(`/assignments/${id}`),
};

// Operating Hours API
export const operatingHoursAPI = {
  getAll: (filters = {}) => api.get('/operating-hours', { params: filters }),
  create: (data) => api.post('/operating-hours', data),
  delete: (date) => api.delete(`/operating-hours/${date}`),
  bulkCreate: (hours) => api.post('/operating-hours/bulk', { hours }),
};

// Timesheet Entry API (parent level)
export const timesheetEntryAPI = {
  getAll: (filters = {}) => api.get('/timesheet-entries', { params: filters }),
  getById: (id) => api.get(`/timesheet-entries/${id}`),
  create: (data) => api.post('/timesheet-entries', data),
  update: (id, data) => api.put(`/timesheet-entries/${id}`, data),
  delete: (id, force = false) => api.delete(`/timesheet-entries/${id}`, { params: { force } }),
  submit: (id) => api.post(`/timesheet-entries/${id}/submit`),
  revert: (id) => api.post(`/timesheet-entries/${id}/revert`),
  exportLogs: async (id) => {
    // Special handling for file download with proper authentication
    const token = localStorage.getItem('token');
    const response = await fetch(`${api.defaults.baseURL}/timesheet-entries/${id}/export`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to export logs');
    }

    // Get filename from Content-Disposition header or use default
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'timelogs.csv';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?(.+)"?/);
      if (match) filename = match[1];
    }

    // Download the file
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};

export const payRunAPI = {
  create: (data) => api.post('/pay-runs', data),
  getAll: (params) => api.get('/pay-runs', { params }),
  getById: (id) => api.get(`/pay-runs/${id}`),
  getPayslip: (payRunId, entryId) =>
    api.get(`/pay-runs/${payRunId}/payslips/${entryId}`),
  updateStatus: (id, status) => api.patch(`/pay-runs/${id}/status`, { status }),
  emailAllPayslips: (id) => api.post(`/pay-runs/${id}/email-payslips`),
  emailPayslipForEmployee: (id, entryId) =>
    api.post(`/pay-runs/${id}/email-payslips/${entryId}`),
  delete: (id) => api.delete(`/pay-runs/${id}`),
  recalculate: (id) => api.post(`/pay-runs/${id}/recalculate`),
  updateEmployee: (employeeEntryId, data) =>
    api.patch(`/pay-runs/employees/${employeeEntryId}`, data),
  getFinancialReport: (filters) => api.get('/pay-runs/financial-report', { params: filters }),
};

// Timesheet API (time logs - child level)
export const timesheetAPI = {
  getAll: (filters = {}) => api.get('/timesheets', { params: filters }),
  create: (data) => api.post('/timesheets', data),
  uploadCSV: (formData) => api.post('/timesheets/upload-csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, data) => api.put(`/timesheets/${id}`, data),
  delete: (id) => api.delete(`/timesheets/${id}`),
  batchAdjust: (timesheetIds, action) => api.post('/timesheets/batch-adjust', { timesheetIds, action }),
  submit: (timesheetIds) => api.post('/timesheets/submit', { timesheetIds }),
  getReport: (filters = {}) => api.get('/timesheets/report', { params: filters }),
};

// Settings API
export const settingsAPI = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
};

// Shift API
export const shiftAPI = {
  getAll: () => api.get('/shifts'),
  create: (data) => api.post('/shifts', data),
  update: (id, data) => api.put(`/shifts/${id}`, data),
  delete: (id) => api.delete(`/shifts/${id}`),
};

// Availability API
export const availabilityAPI = {
  getAll: (filters = {}) => api.get('/availability', { params: filters }),
  create: (data) => api.post('/availability', data),
  update: (id, data) => api.put(`/availability/${id}`, data),
  delete: (id) => api.delete(`/availability/${id}`),
};

// Shift Allocation API
export const shiftAllocationAPI = {
  getAll: () => api.get('/shift-allocations'),
  upsert: (allocations) => api.post('/shift-allocations', { allocations }),
};

export default api;


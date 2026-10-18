import {
  cacheAttendance,
  getCachedAttendance,
  invalidateEmployeeAttendanceCache
} from './attendanceCacheService.js';

const baseUrl = () => (process.env.ODOO_BASE_URL || 'https://espressionist-attendance.odoo.com').replace(/\/$/, '');

const configuredMode = () => process.env.ODOO_API_MODE
  || (process.env.ODOO_API_KEY && !process.env.ODOO_USERNAME ? 'json2' : 'legacy');

const legacyPassword = () => process.env.ODOO_PASSWORD || process.env.ODOO_API_KEY;

const assertConfigured = () => {
  if (configuredMode() === 'json2' && process.env.ODOO_API_KEY) return;
  if (process.env.ODOO_DATABASE && process.env.ODOO_USERNAME && legacyPassword()) return;
  const error = new Error('Odoo attendance is not configured. Add ODOO_API_KEY, or the legacy ODOO_DATABASE/ODOO_USERNAME/ODOO_PASSWORD settings.');
  error.statusCode = 503;
  throw error;
};

const json2Call = async (model, method, payload) => {
  const headers = {
    Authorization: `bearer ${process.env.ODOO_API_KEY}`,
    'Content-Type': 'application/json'
  };
  if (process.env.ODOO_DATABASE) headers['X-Odoo-Database'] = process.env.ODOO_DATABASE;
  const response = await fetch(`${baseUrl()}/json/2/${model}/${method}`, {
    method: 'POST', headers, body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || result.error || `Odoo request failed (${response.status})`);
  return result;
};

let legacyUid = null;
const legacyRpc = async (service, method, args) => {
  const response = await fetch(`${baseUrl()}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { service, method, args }, id: Date.now() })
  });
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(body.error?.data?.message || body.error?.message || `Odoo request failed (${response.status})`);
  return body.result;
};

const legacyCall = async (model, method, args = [], kwargs = {}) => {
  if (!legacyUid) {
    legacyUid = await legacyRpc('common', 'authenticate', [
      process.env.ODOO_DATABASE, process.env.ODOO_USERNAME, legacyPassword(), {}
    ]);
    if (!legacyUid) throw new Error('Odoo authentication failed');
  }
  return legacyRpc('object', 'execute_kw', [
    process.env.ODOO_DATABASE, legacyUid, legacyPassword(), model, method, args, kwargs
  ]);
};

const searchRead = async (model, domain, fields, options = {}) => {
  assertConfigured();
  if (configuredMode() === 'json2') {
    return json2Call(model, 'search_read', { domain, fields, ...options });
  }
  return legacyCall(model, 'search_read', [domain], { fields, ...options });
};

const getFields = async (model) => {
  assertConfigured();
  if (configuredMode() === 'json2') return json2Call(model, 'fields_get', { attributes: ['type', 'string'] });
  return legacyCall(model, 'fields_get', [], { attributes: ['type', 'string'] });
};

export const findOdooEmployeeByName = async (employeeName) => {
  const matches = await searchRead('hr.employee', [['name', '=ilike', employeeName]], ['id', 'name'], { limit: 2 });
  if (matches.length === 0) return null;
  if (matches.length > 1) throw new Error(`Multiple Odoo employees match "${employeeName}". Link the Odoo employee ID manually.`);
  return matches[0];
};

const odooDateTime = (date, endOfRange = false) => {
  // Odoo stores naive UTC datetimes; attendance days are interpreted in Manila time.
  const value = new Date(`${date}T00:00:00+08:00`);
  if (endOfRange) value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 19).replace('T', ' ');
};

export const getEmployeeAttendance = async ({ odooEmployeeId, startDate, endDate }) => {
  const cacheParams = { odooEmployeeId, startDate, endDate };
  const cached = await getCachedAttendance(cacheParams);
  if (cached) return cached;

  const fieldMap = await getFields('hr.attendance');
  const fields = ['id', 'employee_id', 'check_in', 'check_out', 'worked_hours'];
  if (fieldMap.color) fields.push('color');
  const records = await searchRead('hr.attendance', [
    ['employee_id', '=', Number(odooEmployeeId)],
    ['check_in', '>=', odooDateTime(startDate)],
    ['check_in', '<', odooDateTime(endDate, true)]
  ], fields, { order: 'check_in desc', limit: 500 });

  const attendance = records.map(record => ({
    id: record.id,
    employeeId: Array.isArray(record.employee_id) ? record.employee_id[0] : record.employee_id,
    employeeName: Array.isArray(record.employee_id) ? record.employee_id[1] : '',
    checkIn: record.check_in || null,
    checkOut: record.check_out || null,
    workedHours: Number(record.worked_hours || 0),
    color: Number(record.color || 0),
    isInvalid: Number(record.color || 0) === 1
  }));

  await cacheAttendance(cacheParams, attendance);
  return attendance;
};

/**
 * Update an hr.attendance record in Odoo with corrected check_in / check_out values.
 * Called when an approval request reaches "Valid" status.
 *
 * @param {number} odooAttendanceId - The hr.attendance record ID in Odoo
 * @param {object} fields            - { checkIn?: ISOString, checkOut?: ISOString }
 */
export const updateOdooAttendance = async (odooAttendanceId, { checkIn, checkOut, odooEmployeeId }) => {
  assertConfigured();
  const vals = {};
  // Odoo stores datetime as naive UTC strings: "YYYY-MM-DD HH:MM:SS"
  if (checkIn)  vals.check_in  = new Date(checkIn).toISOString().slice(0, 19).replace('T', ' ');
  if (checkOut) vals.check_out = new Date(checkOut).toISOString().slice(0, 19).replace('T', ' ');
  if (Object.keys(vals).length === 0) return; // nothing to update

  if (configuredMode() === 'json2') {
    await json2Call('hr.attendance', 'write', { ids: [Number(odooAttendanceId)], vals });
  } else {
    await legacyCall('hr.attendance', 'write', [[Number(odooAttendanceId)], vals]);
  }

  await invalidateEmployeeAttendanceCache(odooEmployeeId);
};

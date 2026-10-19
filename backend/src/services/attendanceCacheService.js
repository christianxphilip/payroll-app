import { createClient } from 'redis';

// v2 uses the operational attendance-day window (10:00 AM to 5:00 AM
// the following day) instead of calendar-midnight boundaries.
const CACHE_NAMESPACE = 'odoo-attendance:v2';
const DEFAULT_TTL_SECONDS = 60 * 60;

let clientPromise = null;
let missingConfigLogged = false;

const ttlSeconds = () => {
  const configured = Number(process.env.ATTENDANCE_CACHE_TTL_SECONDS);
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : DEFAULT_TTL_SECONDS;
};

const redisUrl = () => {
  const configured = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;
  if (!configured) return null;

  // Upstash's public Redis endpoint requires TLS. Accept a redis:// value from
  // configuration and safely upgrade it without putting credentials in code.
  if (configured.startsWith('redis://') && configured.includes('.upstash.io')) {
    return configured.replace(/^redis:\/\//, 'rediss://');
  }
  return configured;
};

const getClient = async () => {
  const url = redisUrl();
  if (!url) {
    if (!missingConfigLogged) {
      console.warn('[Attendance cache] REDIS_URL is not configured; using Odoo directly.');
      missingConfigLogged = true;
    }
    return null;
  }

  if (!clientPromise) {
    const client = createClient({ url });
    client.on('error', error => {
      console.error('[Attendance cache] Redis error:', error.message);
    });
    clientPromise = client.connect()
      .then(() => client)
      .catch(error => {
        clientPromise = null;
        console.error('[Attendance cache] Connection failed; using Odoo directly:', error.message);
        return null;
      });
  }

  return clientPromise;
};

const rangeKey = ({ odooEmployeeId, startDate, endDate }) =>
  `${CACHE_NAMESPACE}:employee:${Number(odooEmployeeId)}:${startDate}:${endDate}`;

const indexKey = odooEmployeeId =>
  `${CACHE_NAMESPACE}:index:${Number(odooEmployeeId)}`;

export const getCachedAttendance = async params => {
  try {
    const client = await getClient();
    if (!client) return null;
    const value = await client.get(rangeKey(params));
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error('[Attendance cache] Read failed; using Odoo directly:', error.message);
    return null;
  }
};

export const cacheAttendance = async (params, attendance) => {
  try {
    const client = await getClient();
    if (!client) return;

    const key = rangeKey(params);
    const employeeIndexKey = indexKey(params.odooEmployeeId);
    const ttl = ttlSeconds();
    await client.multi()
      .set(key, JSON.stringify(attendance), { EX: ttl })
      .sAdd(employeeIndexKey, key)
      .expire(employeeIndexKey, ttl + 300)
      .exec();
  } catch (error) {
    console.error('[Attendance cache] Write failed; continuing without cache:', error.message);
  }
};

export const invalidateEmployeeAttendanceCache = async odooEmployeeId => {
  if (!odooEmployeeId) return;

  try {
    const client = await getClient();
    if (!client) return;

    const employeeIndexKey = indexKey(odooEmployeeId);
    const keys = await client.sMembers(employeeIndexKey);
    await client.del([...keys, employeeIndexKey]);
  } catch (error) {
    // The Odoo update has already succeeded. Cache invalidation must never turn
    // that successful update into an API failure; the one-hour TTL is the fallback.
    console.error('[Attendance cache] Invalidation failed:', error.message);
  }
};

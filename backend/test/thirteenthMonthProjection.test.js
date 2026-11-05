import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateProjectedWork } from '../src/services/thirteenthMonthService.js';

const week = {
  projectionStart: new Date('2026-11-02T00:00:00.000Z'),
  projectionEnd: new Date('2026-11-08T23:59:59.999Z'),
  employeeStart: new Date('2020-01-01T00:00:00.000Z'),
  employeeEnd: new Date('2099-12-31T23:59:59.999Z')
};

test('weekly off-days fill unscheduled future dates', () => {
  assert.deepEqual(calculateProjectedWork({
    ...week,
    schedulesByDay: new Map(),
    useWeeklyOffDays: true,
    weeklyOffDays: ['Sunday']
  }), {
    projectedHours: 48,
    projectedDays: 6,
    fallbackDays: 6
  });
});

test('published work and off schedules override the weekly fallback', () => {
  const schedulesByDay = new Map([
    ['2026-11-04', { hours: 0 }],
    ['2026-11-08', { hours: 4 }]
  ]);

  assert.deepEqual(calculateProjectedWork({
    ...week,
    schedulesByDay,
    useWeeklyOffDays: true,
    weeklyOffDays: ['Sunday']
  }), {
    projectedHours: 44,
    projectedDays: 6,
    fallbackDays: 5
  });
});

test('schedule-only mode does not invent workdays', () => {
  assert.deepEqual(calculateProjectedWork({
    ...week,
    schedulesByDay: new Map([['2026-11-03', { hours: 7.5 }]]),
    useWeeklyOffDays: false,
    weeklyOffDays: ['Sunday']
  }), {
    projectedHours: 7.5,
    projectedDays: 1,
    fallbackDays: 0
  });
});

import React, { useEffect, useState } from 'react';

const GoogleCalendarScheduleView = ({
  dateRangeDates,
  schedules,
  employees,
  assignmentTypes,
  operatingHours,
  holidays,
  getAssignmentColor,
  getScheduleVisual,
  canEditSchedule,
  onEditSchedule,
  onAddSchedule,
  onNavigatePrev,
  onNavigateNext,
  onNavigateToday,
  getWeekLabel,
  dateRange,
  onDateRangeChange,
  user,
  onOpenExportICal,
  onOpenShiftTargets,
  onComputeSalary,
  loadingEstimatedSalary,
  viewMode,
  onToggleViewMode,
  onExportImage,
  onOpenTutorial,
  teamFilter,
  onTeamFilterChange
}) => {
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState('');
  const [selectedAssignmentFilter, setSelectedAssignmentFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (selectedEmployeeFilter && !employees.some((employee) => employee.employeeName === selectedEmployeeFilter)) {
      setSelectedEmployeeFilter('');
    }
  }, [employees, selectedEmployeeFilter]);

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Helper to format time like "5pm – 2am", "2 – 11pm"
  const formatTime = (t) => {
    if (!t) return '';
    let s = t.trim().toLowerCase();
    s = s.replace(/\s+/g, '');
    s = s.replace(':00', '');
    return s;
  };

  const formatTimeRange = (startTime, endTime) => {
    if (!startTime && !endTime) return '';
    if (!endTime) return formatTime(startTime);
    if (!startTime) return formatTime(endTime);

    let start = formatTime(startTime);
    let end = formatTime(endTime);

    if (start.endsWith('pm') && end.endsWith('pm')) {
      const startNum = start.replace('pm', '');
      return `${startNum} – ${end}`;
    }
    if (start.endsWith('am') && end.endsWith('am')) {
      const startNum = start.replace('am', '');
      return `${startNum} – ${end}`;
    }
    return `${start} – ${end}`;
  };

  // Filter schedules based on employee, assignment, and search term
  const filterSchedulesForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];

    return schedules.filter((schedule) => {
      // Date match
      const scheduleDateStr = new Date(schedule.date).toISOString().split('T')[0];
      if (scheduleDateStr !== dateStr) return false;

      // Employee filter
      if (selectedEmployeeFilter && schedule.employeeName !== selectedEmployeeFilter) {
        return false;
      }

      // Assignment filter
      if (selectedAssignmentFilter && schedule.assignmentType !== selectedAssignmentFilter) {
        return false;
      }

      // Search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const empNameMatch = schedule.employeeName?.toLowerCase().includes(term);
        const notesMatch = schedule.notes?.toLowerCase().includes(term);
        const assignmentMatch = schedule.assignmentType?.toLowerCase().includes(term);
        if (!empNameMatch && !notesMatch && !assignmentMatch) return false;
      }

      return true;
    });
  };

  // Helper to get assignment type badge label
  const getAssignmentLabel = (typeCode) => {
    const found = assignmentTypes.find((a) => a.value === typeCode);
    return found ? found.label.toUpperCase() : (typeCode || 'GENERAL').toUpperCase();
  };

  return (
    <div className="bg-white min-h-[600px] flex flex-col font-sans">
      {/* Top Header & Navigation Bar */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* Week Label & Navigation */}
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h2 className="text-base sm:text-lg font-bold text-gray-900">{getWeekLabel()}</h2>
            <div className="inline-flex rounded-lg border border-gray-300 bg-white shadow-xs">
              <button
                onClick={onNavigatePrev}
                className="px-2.5 py-1 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 border-r border-gray-300"
                title="Previous Week"
              >
                ‹ Prev
              </button>
              <button
                onClick={onNavigateToday}
                className="px-3 py-1 text-xs sm:text-sm font-medium text-blue-600 hover:bg-blue-50 border-r border-gray-300"
              >
                Today
              </button>
              <button
                onClick={onNavigateNext}
                className="px-2.5 py-1 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50"
                title="Next Week"
              >
                Next ›
              </button>
            </div>
          </div>

          {/* View Toggle & Add Button */}
          <div className="flex items-center gap-2">
            {onToggleViewMode && (
              <div className="bg-gray-200 p-0.5 rounded-lg inline-flex text-xs">
                <button
                  onClick={() => onToggleViewMode('agenda')}
                  className={`px-3 py-1.5 font-medium rounded-md transition-all ${
                    viewMode === 'agenda'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📱 Schedule
                </button>
                <button
                  onClick={() => onToggleViewMode('grid')}
                  className={`px-3 py-1.5 font-medium rounded-md transition-all ${
                    viewMode === 'grid'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📊 Grid
                </button>
              </div>
            )}

            <button
              onClick={() => onAddSchedule(new Date())}
              className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium hover:bg-blue-700 transition-colors shadow-xs flex items-center gap-1 min-h-[36px]"
            >
              <span>+ Add Shift</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-white border border-gray-200 p-2 min-w-0">
          <label className="text-[11px] font-semibold text-gray-600">
            Start Date
            <input type="date" value={dateRange?.startDate || ''} onChange={(event) => onDateRangeChange?.('startDate', event.target.value)} className="mt-1 block w-full min-w-0 h-10 px-2 py-1 text-xs sm:text-sm border border-gray-300 rounded-lg bg-white appearance-none" />
          </label>
          <label className="text-[11px] font-semibold text-gray-600">
            End Date
            <input type="date" value={dateRange?.endDate || ''} onChange={(event) => onDateRangeChange?.('endDate', event.target.value)} className="mt-1 block w-full min-w-0 h-10 px-2 py-1 text-xs sm:text-sm border border-gray-300 rounded-lg bg-white appearance-none" />
          </label>
        </div>

        <div className={`grid grid-cols-1 gap-2 ${user?.role === 'admin' ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
          {/* Employee Filter */}
          <div>
            <select
              value={selectedEmployeeFilter}
              onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Employees ({employees.length})</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp.employeeName}>
                  {emp.employeeName}
                </option>
              ))}
            </select>
          </div>

          {user?.role === 'admin' && (
            <div>
              <select
                value={teamFilter || ''}
                onChange={(event) => onTeamFilterChange?.(event.target.value)}
                className="w-full px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-label="Filter schedule by team"
              >
                <option value="">All Teams</option>
                <option value="kitchen">Kitchen</option>
                <option value="bar">Bar</option>
              </select>
            </div>
          )}

          {/* Assignment Role Filter */}
          <div>
            <select
              value={selectedAssignmentFilter}
              onChange={(e) => setSelectedAssignmentFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Roles</option>
              {assignmentTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Search */}
          <div>
            <input
              type="text"
              placeholder="Search schedule..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Admin / Additional Action Bar */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 pb-0.5 text-xs">
          {onOpenTutorial && (
            <button onClick={onOpenTutorial} className="w-full px-2.5 py-2 bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 rounded-md font-medium whitespace-nowrap">
              ❓ Tutorial
            </button>
          )}
          {onOpenExportICal && (
            <button
              onClick={onOpenExportICal}
              className="w-full px-2.5 py-2 bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 rounded-md font-medium whitespace-nowrap"
            >
              📅 Export .ics
            </button>
          )}
          {onExportImage && (
            <button onClick={onExportImage} className="w-full px-2.5 py-2 bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 rounded-md font-medium whitespace-nowrap">
              🖼 Export Image
            </button>
          )}
          {onOpenShiftTargets && (
            <button
              onClick={onOpenShiftTargets}
              className="w-full px-2.5 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md font-medium whitespace-nowrap"
            >
              🎯 Targets
            </button>
          )}
          {user?.role === 'admin' && onComputeSalary && (
            <button
              onClick={onComputeSalary}
              disabled={loadingEstimatedSalary}
              className="px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 rounded-md font-medium whitespace-nowrap disabled:opacity-50"
            >
              {loadingEstimatedSalary ? 'Computing...' : '💵 Est. Salary'}
            </button>
          )}
        </div>
      </div>

      {/* Agenda Schedule Feed (Google Calendar Style) */}
      <div className="flex-1 divide-y divide-gray-100 overflow-y-auto">
        {dateRangeDates.map((date, dateIdx) => {
          const dateStr = date.toISOString().split('T')[0];
          const isToday = dateStr === todayStr;

          const dayNum = date.getDate();
          const monthStr = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
          const weekdayStr = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

          const daySchedules = filterSchedulesForDate(date);
          const holiday = holidays[dateStr];
          const operatingHourStr = operatingHours[dateStr];

          return (
            <div
              key={dateStr}
              className={`p-3 sm:p-4 transition-colors ${
                isToday ? 'bg-blue-50/30' : 'hover:bg-gray-50/50'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start gap-3">
                {/* Left Date Column */}
                <div className="flex items-center sm:items-start gap-2.5 w-full sm:w-36 shrink-0 border-b sm:border-b-0 pb-2 sm:pb-0 border-gray-100">
                  {/* Day Circle Badge */}
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-transform ${
                      isToday
                        ? 'bg-blue-600 text-white shadow-md ring-4 ring-blue-100'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {dayNum}
                  </div>

                  {/* Month & Weekday Label */}
                  <div className="flex flex-col">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider ${
                        isToday ? 'text-blue-600' : 'text-gray-600'
                      }`}
                    >
                      {monthStr}, {weekdayStr}
                    </span>

                    {/* Operating hours note if set */}
                    {operatingHourStr && (
                      <span className="text-[11px] font-normal text-gray-500">
                        {operatingHourStr}
                      </span>
                    )}

                    {/* Holiday indicator */}
                    {holiday && (
                      <span className="text-[10px] font-semibold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                        {holiday.name || holiday.description}
                      </span>
                    )}
                  </div>

                  {/* Mobile Quick Add (+) Button */}
                  <button
                    onClick={() => onAddSchedule(date)}
                    className="ml-auto sm:hidden p-1 text-gray-400 hover:text-blue-600 text-xs rounded hover:bg-gray-100"
                    title="Add shift on this day"
                  >
                    + Add
                  </button>
                </div>

                {/* Right Timeline & Shifts Area */}
                <div className="flex-1 w-full space-y-1">
                  {daySchedules.length === 0 ? (
                    <div className="py-2 text-xs sm:text-sm text-gray-400 italic flex items-center justify-between">
                      <span>No shifts scheduled</span>
                      <button
                        onClick={() => onAddSchedule(date)}
                        className="hidden sm:inline-block text-blue-600 hover:underline text-xs font-medium"
                      >
                        + Add Schedule
                      </button>
                    </div>
                  ) : (
                    daySchedules.map((schedule, schedIdx) => {
                      const color = getAssignmentColor(schedule.assignmentType);
                      const visual = getScheduleVisual ? getScheduleVisual(schedule) : { backgroundColor: '#ffffff', textColor: '#111827', assignmentColor: color, shiftName: '' };
                      const editable = canEditSchedule ? canEditSchedule(schedule) : true;

                      return (
                        <React.Fragment key={schedule._id || schedIdx}>
                          {/* Event Card / Timeline Item */}
                          <div
                            onClick={() => editable && onEditSchedule(schedule)}
                            className={`group flex items-start sm:items-center gap-3 p-2.5 rounded-lg border transition-all ${editable ? 'hover:shadow-sm cursor-pointer' : 'cursor-not-allowed opacity-75'}`}
                            style={{ backgroundColor: editable ? visual.backgroundColor : '#e5e7eb', borderColor: visual.assignmentColor, borderLeftWidth: '5px', color: visual.textColor }}
                          >
                            {/* Dot Indicator */}
                            <div className="mt-1 sm:mt-0 w-4 flex items-center justify-center shrink-0">
                              {schedule.isOff ? (
                                <div className="w-3 h-3 rounded-full border-2 border-gray-400 bg-white" />
                              ) : (
                                <div
                                  className="w-3 h-3 rounded-full shadow-xs shrink-0"
                                  style={{ backgroundColor: color }}
                                />
                              )}
                            </div>

                            {/* Time String (e.g. 5pm – 2am) */}
                            <div className="w-24 sm:w-28 text-xs sm:text-sm font-semibold text-gray-700 shrink-0">
                              {schedule.isOff
                                ? 'OFF'
                                : formatTimeRange(
                                    schedule.scheduledStartTime,
                                    schedule.scheduledEndTime
                                  )}
                            </div>

                            {/* Shift Title & Subtitle */}
                            <div className="flex-1 min-w-0">
                              <div className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                                Shift:{' '}
                                <span className="font-semibold">{schedule.employeeName}</span>{' '}
                                <span className="text-xs font-normal text-gray-600">
                                  ({getAssignmentLabel(schedule.assignmentType)})
                                </span>
                                {schedule.notes && (
                                  <span className="text-xs font-normal text-gray-500 italic ml-1.5">
                                    ({schedule.notes})
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-gray-400 font-medium tracking-wide">
                                {[visual.shiftName, 'ESPRO Coffee'].filter(Boolean).join(' • ')}
                              </div>
                            </div>

                            {/* Edit Pencil Icon */}
                            <div className="text-gray-500 text-xs shrink-0">
                              {editable ? '✏️ Edit' : `🔒 ${schedule.assignmentType}`}
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })
                  )}

                  {/* Red Current Time Line Indicator for Today */}
                  {isToday && (
                    <div className="relative my-2 py-1 flex items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-600 z-10 shadow-xs -ml-1" />
                      <div className="flex-1 h-[2px] bg-red-600" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GoogleCalendarScheduleView;

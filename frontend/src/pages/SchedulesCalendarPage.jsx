import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { scheduleAPI, employeeAPI, assignmentAPI, operatingHoursAPI, holidayAPI, shiftAPI, availabilityAPI, shiftAllocationAPI } from '../services/api';
import Modal from '../components/Modal';
import ExportICalModal from '../components/ExportICalModal';
import { useUndo } from '../hooks/useUndo';
import UndoToast from '../components/UndoToast';
import GoogleCalendarScheduleView from '../components/GoogleCalendarScheduleView';

const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2
    }).format(amount);
};

// Get Monday of the week for a given date
function getMonday(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0); // Reset time to avoid timezone issues
    const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    // Calculate days to subtract to get to Monday
    // If Sunday (0), subtract 6 days. Otherwise subtract (day - 1) days
    const diff = day === 0 ? -6 : -(day - 1);
    d.setDate(d.getDate() + diff);
    return d;
}

const SchedulesCalendarPage = () => {
    const { user } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [assignmentTypes, setAssignmentTypes] = useState([]);
    const [loading, setLoading] = useState(true);

    // Format date as YYYY-MM-DD in local timezone (not UTC)
    const formatDateLocal = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Initialize date range with current week
    const getInitialDateRange = () => {
        const today = new Date();
        const monday = getMonday(today);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return {
            startDate: formatDateLocal(monday),
            endDate: formatDateLocal(sunday)
        };
    };

    const [dateRange, setDateRange] = useState(getInitialDateRange());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isExportICalModalOpen, setIsExportICalModalOpen] = useState(false);
    const [selectedCell, setSelectedCell] = useState(null);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [copiedSchedule, setCopiedSchedule] = useState(null);
    const [operatingHours, setOperatingHours] = useState({});
    const [editingHours, setEditingHours] = useState(null);
    const [holidays, setHolidays] = useState({});
    const [draggedSchedule, setDraggedSchedule] = useState(null);
    const [dragOverCell, setDragOverCell] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const [simplifyView, setSimplifyView] = useState(false);
    const [isEstimatedSalaryModalOpen, setIsEstimatedSalaryModalOpen] = useState(false);
    const [estimatedSalaryData, setEstimatedSalaryData] = useState(null);
    const [loadingEstimatedSalary, setLoadingEstimatedSalary] = useState(false);
    const { addAction, undo, canUndo, lastAction, clearHistory } = useUndo();
    const [undoToastVisible, setUndoToastVisible] = useState(false);
    const [shifts, setShifts] = useState([]);
    const [availability, setAvailability] = useState([]);
    const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false);
    const [selectedAvailabilityDate, setSelectedAvailabilityDate] = useState(null);
    const [shiftAllocations, setShiftAllocations] = useState([]);
    const [isShiftTargetsModalOpen, setIsShiftTargetsModalOpen] = useState(false);
    const [showAvailability, setShowAvailability] = useState(false);
    const [editingAllocations, setEditingAllocations] = useState({}); // { "Monday_shiftId": count }
    const [calendarViewMode, setCalendarViewMode] = useState(() => {
        return typeof window !== 'undefined' && window.innerWidth < 768 ? 'agenda' : 'grid';
    });

    const handleEditScheduleFromAgenda = (schedule) => {
        const employee = employees.find(e => e.employeeName === schedule.employeeName) || { employeeName: schedule.employeeName };
        const date = new Date(schedule.date);
        setSelectedCell({ employee, date, existing: schedule, allSchedules: [schedule] });

        const validAssignmentType = assignmentTypes.find(a => a.value === schedule.assignmentType)
            ? schedule.assignmentType
            : (assignmentTypes.length > 0 ? assignmentTypes[0].value : '');

        setFormData({
            employeeName: schedule.employeeName || '',
            scheduledStartTime: schedule.scheduledStartTime || '',
            scheduledEndTime: schedule.scheduledEndTime || '',
            scheduledDuration: schedule.scheduledDuration || '',
            assignmentType: validAssignmentType,
            notes: schedule.notes || ''
        });
        setIsModalOpen(true);
    };

    const handleAddScheduleFromAgenda = (date, defaultEmployeeName = '') => {
        const employee = defaultEmployeeName
            ? (employees.find(e => e.employeeName === defaultEmployeeName) || employees[0] || { employeeName: defaultEmployeeName })
            : (employees[0] || { employeeName: '' });
        setSelectedCell({ employee, date, existing: null, allSchedules: [] });
        setFormData({
            employeeName: employee.employeeName || '',
            scheduledStartTime: '',
            scheduledEndTime: '',
            scheduledDuration: '',
            assignmentType: assignmentTypes.length > 0 ? assignmentTypes[0].value : '',
            notes: ''
        });
        setIsModalOpen(true);
    };
    
    // Helper to determine if a date is a weekend (Fri-Sun) or weekday (Mon-Thu)
    const isWeekendDay = (date) => {
        const day = date.getDay();
        return day === 0 || day === 5 || day === 6; // Friday, Saturday, Sunday
    };

    // Calculate shift coverage statistics for a date based on ShiftAllocation targets
    const getShiftCoverageStats = (date) => {
        const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
        const dateStr = date.toISOString().split('T')[0];

        // Find all allocations for this day of week that require at least 1 person
        const dayAllocations = shiftAllocations.filter(
            a => a.dayOfWeek === dayOfWeek && a.requiredCount > 0
        );

        if (dayAllocations.length === 0) {
            return { hasTargets: false, isMet: true, understaffedShifts: [] };
        }

        const understaffedShifts = [];
        let isMet = true;

        dayAllocations.forEach(alloc => {
            const shift = alloc.shiftId;
            if (!shift) return;

            const required = alloc.requiredCount;

            // Count scheduled employees for this shift on this date
            const scheduledCount = schedules.filter(s => {
                if (s.date.split('T')[0] !== dateStr || s.isOff) return false;

                // Match by shift time similarity
                const sStart = s.scheduledStartTime?.replace(/\s+/g, '').toUpperCase();
                const sEnd = s.scheduledEndTime?.replace(/\s+/g, '').toUpperCase();
                const shiftStart = shift.startTime?.replace(/\s+/g, '').toUpperCase();
                const shiftEnd = shift.endTime?.replace(/\s+/g, '').toUpperCase();

                return sStart === shiftStart && sEnd === shiftEnd;
            }).length;

            if (scheduledCount < required) {
                isMet = false;
                understaffedShifts.push({
                    name: shift.name,
                    scheduled: scheduledCount,
                    required: required
                });
            }
        });

        return {
            hasTargets: true,
            isMet,
            understaffedShifts
        };
    };


    // Form state
    const [formData, setFormData] = useState({
        employeeName: '',
        scheduledStartTime: '',
        scheduledEndTime: '',
        scheduledDuration: '',
        assignmentType: '',
        notes: ''
    });

    // Generate dates based on date range
    const getDateRangeDates = () => {
        try {
            if (!dateRange || !dateRange.startDate || !dateRange.endDate) {
                // Fallback to current week if dateRange is invalid
                const monday = getMonday(new Date());
                const sunday = new Date(monday);
                sunday.setDate(monday.getDate() + 6);
                const dates = [];
                const current = new Date(monday);
                while (current <= sunday) {
                    dates.push(new Date(current));
                    current.setDate(current.getDate() + 1);
                }
                return dates;
            }

            const dates = [];
            const start = new Date(dateRange.startDate);
            const end = new Date(dateRange.endDate);

            // Ensure end date is after start date
            if (end < start || isNaN(start.getTime()) || isNaN(end.getTime())) {
                // Fallback to current week
                const monday = getMonday(new Date());
                const sunday = new Date(monday);
                sunday.setDate(monday.getDate() + 6);
                const current = new Date(monday);
                while (current <= sunday) {
                    dates.push(new Date(current));
                    current.setDate(current.getDate() + 1);
                }
                return dates;
            }

            const current = new Date(start);
            while (current <= end) {
                dates.push(new Date(current));
                current.setDate(current.getDate() + 1);
            }
            return dates;
        } catch (error) {
            console.error('Error generating date range:', error);
            // Fallback to current week
            const monday = getMonday(new Date());
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            const dates = [];
            const current = new Date(monday);
            while (current <= sunday) {
                dates.push(new Date(current));
                current.setDate(current.getDate() + 1);
            }
            return dates;
        }
    };

    // Get default operating hours based on day of week
    const getDefaultOperatingHours = (date) => {
        const dateStr = date.toISOString().split('T')[0];

        // Check if custom hours are set for this date
        if (operatingHours[dateStr]) {
            return operatingHours[dateStr];
        }

        const day = date.getDay();
        // Weekdays (Mon-Thu): 4PM-12AM, Weekends (Fri-Sun): 4PM-2AM
        if (day >= 1 && day <= 4) {
            return '4PM – 12AM';
        } else {
            return '4PM – 2AM';
        }
    };

    // Check if hours value is a default value
    const isDefaultHours = (date, hours) => {
        const day = date.getDay();
        const defaultHours = (day >= 1 && day <= 4) ? '4PM – 12AM' : '4PM – 2AM';
        // Normalize comparison - remove extra spaces and compare case-insensitively
        const normalizedInput = hours.trim().replace(/\s+/g, ' ').toUpperCase();
        const normalizedDefault = defaultHours.replace(/\s+/g, ' ').toUpperCase();
        return normalizedInput === normalizedDefault;
    };

    // Parse time string (e.g., "3PM", "12AM") to hour (0-23)
    const parseTimeString = (timeStr) => {
        if (!timeStr) return null;
        const trimmed = timeStr.trim().toUpperCase();
        const match = trimmed.match(/(\d+)(AM|PM)/);
        if (!match) return null;

        let hour = parseInt(match[1], 10);
        const period = match[2];

        if (period === 'AM') {
            if (hour === 12) hour = 0;
        } else { // PM
            if (hour !== 12) hour += 12;
        }

        return hour;
    };

    // Calculate duration from start and end times
    const calculateDuration = (startTime, endTime) => {
        if (!startTime || !endTime) return 0;

        const startHour = parseTimeString(startTime);
        const endHour = parseTimeString(endTime);

        if (startHour === null || endHour === null) return 0;

        let rawDuration = 0;
        if (endHour >= startHour) {
            rawDuration = endHour - startHour;
        } else {
            // Overnight shift (e.g., 6PM - 3AM = 9 hours)
            rawDuration = (24 - startHour) + endHour;
        }

        // If duration is more than 7 hours, subtract 1 hour for break
        if (rawDuration > 7) {
            return rawDuration - 1;
        }

        return rawDuration;
    };

    // Check if operating hours contain "closed" (case-insensitive)
    const isClosed = (date) => {
        const hours = getDefaultOperatingHours(date);
        return hours && hours.toLowerCase().includes('closed');
    };

    // Format week label (e.g., "Week of December 1")
    const getWeekLabel = () => {
        const startDate = new Date(dateRange.startDate);
        const monthName = startDate.toLocaleDateString('en-US', { month: 'long' });
        const day = startDate.getDate();
        return `Week of ${monthName} ${day}`;
    };

    useEffect(() => {
        fetchAssignments();
        fetchEmployees();
        fetchHolidays();
        fetchShifts();
    }, []);

    useEffect(() => {
        fetchSchedules();
        fetchOperatingHours();
        fetchHolidays();
        fetchHolidays();
        fetchAvailability();
        fetchShiftAllocations();
    }, [dateRange]);

    // Show undo toast when lastAction changes
    useEffect(() => {
        if (lastAction) {
            setUndoToastVisible(true);
        }
    }, [lastAction]);

    // Preserve scroll position when simplify view or date range changes
    useEffect(() => {
        const scrollPosition = sessionStorage.getItem('scheduleScrollPosition');
        if (scrollPosition) {
            // Use requestAnimationFrame for smoother scroll restoration
            requestAnimationFrame(() => {
                window.scrollTo({
                    top: parseInt(scrollPosition, 10),
                    behavior: 'instant'
                });
                sessionStorage.removeItem('scheduleScrollPosition');
            });
        }
    }, [simplifyView, dateRange]);

    const fetchAssignments = async () => {
        try {
            const response = await assignmentAPI.getAll({ isActive: 'true' });
            const assignments = (response.data || []).map(a => ({
                value: a.code,
                label: a.label,
                color: a.color
            }));
            setAssignmentTypes(assignments);

            // Set default assignment type if available and current selection doesn't exist
            if (assignments.length > 0) {
                if (!assignments.find(a => a.value === formData.assignmentType)) {
                    setFormData(prev => ({ ...prev, assignmentType: assignments[0].value }));
                }
            } else {
                // No assignments available - set to empty string
                setFormData(prev => ({ ...prev, assignmentType: '' }));
            }
        } catch (error) {
            console.error('Failed to fetch assignments');
            // Don't use fallback - only show assignments from database
            setAssignmentTypes([]);
        }
    };

    const fetchEmployees = async () => {
        try {
            const response = await employeeAPI.getAll();
            // Filter to show only active employees (not resigned or with lastWorkingDate before the date range)
            const rangeStart = new Date(dateRange.startDate);

            const activeEmployees = (response.data || []).filter(emp => {
                // If no status field, assume active
                if (!emp.status) return true;

                // If status is ACTIVE, include
                if (emp.status === 'ACTIVE') return true;

                // If RENDERING, check if lastWorkingDate is after the range start
                if (emp.status === 'RENDERING' && emp.lastWorkingDate) {
                    const lastWorkingDate = new Date(emp.lastWorkingDate);
                    return lastWorkingDate >= rangeStart;
                }

                // Exclude RESIGNED employees
                return false;
            });

            // Sort employees: FULL_TIME first, then PART_TIME, then ON_CALL, then by name
            const sortedEmployees = activeEmployees.sort((a, b) => {
                // Define order priority for employment types
                const typeOrder = { 'FULL_TIME': 1, 'PART_TIME': 2, 'ON_CALL': 3 };
                const aOrder = typeOrder[a.employmentType] || 99;
                const bOrder = typeOrder[b.employmentType] || 99;

                // First sort by employment type
                if (aOrder !== bOrder) {
                    return aOrder - bOrder;
                }

                // If same type, sort by name
                return (a.employeeName || '').localeCompare(b.employeeName || '');
            });

            setEmployees(sortedEmployees);
        } catch (error) {
            console.error('Failed to fetch employees');
        }
    };

    const fetchSchedules = async () => {
        try {
            const response = await scheduleAPI.getAll({
                startDate: dateRange.startDate,
                endDate: dateRange.endDate,
                limit: 1000
            });
            setSchedules(response.data || []);
        } catch (error) {
            showMessage('error', 'Failed to fetch schedules');
        } finally {
            setLoading(false);
        }
    };

    const fetchHolidays = async () => {
        try {
            const response = await holidayAPI.getAll({
                startDate: dateRange.startDate,
                endDate: dateRange.endDate
            });
            const holidaysMap = {};
            (response.data || []).forEach(holiday => {
                const dateStr = new Date(holiday.date).toISOString().split('T')[0];
                holidaysMap[dateStr] = holiday;
            });
            setHolidays(holidaysMap);
        } catch (error) {
            console.error('Failed to fetch holidays:', error);
        }
    };

    const fetchShifts = async () => {
        try {
            const response = await shiftAPI.getAll();
            setShifts(response.data || []);
        } catch (error) {
            console.error('Failed to fetch shifts');
        }
    };

    const fetchAvailability = async () => {
        try {
            const response = await availabilityAPI.getAll();
            setAvailability(response.data || []);
        } catch (error) {
            console.error('Failed to fetch availability');
        }
    };

    const fetchShiftAllocations = async () => {
        try {
            const response = await shiftAllocationAPI.getAll();
            setShiftAllocations(response.data || []);

            // Initialize editing state
            const initialEditingState = {};
            (response.data || []).forEach(alloc => {
                if (alloc.shiftId) {
                    const key = `${alloc.dayOfWeek}_${alloc.shiftId._id || alloc.shiftId}`;
                    initialEditingState[key] = alloc.requiredCount;
                }
            });
            setEditingAllocations(initialEditingState);
        } catch (error) {
            console.error('Failed to fetch shift allocations');
        }
    };

    const handleSaveShiftAllocations = async () => {
        try {
            const allocationsToSave = [];

            // Iterate through all shifts and days
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

            shifts.forEach(shift => {
                days.forEach(day => {
                    const key = `${day}_${shift._id}`;
                    if (editingAllocations[key] !== undefined) {
                        allocationsToSave.push({
                            dayOfWeek: day,
                            shiftId: shift._id,
                            requiredCount: parseInt(editingAllocations[key]) || 0
                        });
                    }
                });
            });

            await shiftAllocationAPI.upsert(allocationsToSave);
            showMessage('success', 'Shift targets updated successfully');
            setIsShiftTargetsModalOpen(false);
            fetchShiftAllocations();
        } catch (error) {
            showMessage('error', 'Failed to save shift targets');
        }
    };

    const getAvailableSlots = (date, shift) => {
        const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
        const allocation = shiftAllocations.find(
            a => a.dayOfWeek === dayOfWeek && (a.shiftId._id === shift._id || a.shiftId === shift._id)
        );

        if (!allocation || !allocation.requiredCount) return null;

        const required = allocation.requiredCount;

        // Count scheduled employees for this shift on this date
        // We match based on shift name or time range approximation
        // Since schedules don't explicitly link to Shift IDs, we match by time
        // Or we can rely on the user to select the correct times.
        // Ideally, schedules should link to shifts, but for now we'll match by time overlap/equality

        const dateStr = date.toISOString().split('T')[0];
        const scheduledCount = schedules.filter(s => {
            if (s.date.split('T')[0] !== dateStr || s.isOff) return false;

            // Simple check: if schedule start/end matches shift start/end
            // Normalize times for comparison
            const sStart = s.scheduledStartTime?.replace(/\s+/g, '').toUpperCase();
            const sEnd = s.scheduledEndTime?.replace(/\s+/g, '').toUpperCase();
            const shiftStart = shift.startTime?.replace(/\s+/g, '').toUpperCase();
            const shiftEnd = shift.endTime?.replace(/\s+/g, '').toUpperCase();

            return sStart === shiftStart && sEnd === shiftEnd;
        }).length;

        const available = required - scheduledCount;

        // Return null if fully staffed or overstaffed (available <= 0)
        if (available <= 0) return null;

        return { required, scheduled: scheduledCount, available };
    };



    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    };

    const handleCellClick = (employee, date, event) => {
        // Ctrl+Click to copy
        if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            const dateStr = date.toISOString().split('T')[0];
            const existingSchedules = schedules.filter(
                s => s.employeeName === employee.employeeName &&
                    s.date.split('T')[0] === dateStr && !s.isOff
            );
            if (existingSchedules.length > 0) {
                handleCopySchedule(existingSchedules[0]); // Copy first schedule
            }
            return;
        }

        // If schedule is copied and normal click, paste it
        if (copiedSchedule) {
            handlePasteSchedule(employee, date);
            return;
        }

        // Normal click - open modal
        const dateStr = date.toISOString().split('T')[0];
        const existingSchedules = schedules.filter(
            s => s.employeeName === employee.employeeName &&
                s.date.split('T')[0] === dateStr
        );

        // If multiple schedules, use the first one (or allow selection later)
        const existing = existingSchedules.length > 0 ? existingSchedules[0] : null;

        setSelectedCell({ employee, date, existing, allSchedules: existingSchedules });

        if (existing) {
            // Use existing assignment type if it exists in available assignments, otherwise use first available or empty
            const validAssignmentType = assignmentTypes.find(a => a.value === existing.assignmentType)
                ? existing.assignmentType
                : (assignmentTypes.length > 0 ? assignmentTypes[0].value : '');

            setFormData({
                employeeName: existing.employeeName || employee.employeeName || '',
                scheduledStartTime: existing.scheduledStartTime || '',
                scheduledEndTime: existing.scheduledEndTime || '',
                scheduledDuration: existing.scheduledDuration || '',
                assignmentType: validAssignmentType,
                notes: existing.notes || ''
            });
        } else {
            setFormData({
                employeeName: employee.employeeName || '',
                scheduledStartTime: '',
                scheduledEndTime: '',
                scheduledDuration: '',
                assignmentType: assignmentTypes.length > 0 ? assignmentTypes[0].value : '',
                notes: ''
            });
        }

        setIsModalOpen(true);
    };

    const handleCellRightClick = (employee, date, event) => {
        event.preventDefault();
        const dateStr = date.toISOString().split('T')[0];
        const existingSchedules = schedules.filter(
            s => s.employeeName === employee.employeeName &&
                s.date.split('T')[0] === dateStr && !s.isOff
        );

        setContextMenu({
            x: event.clientX,
            y: event.clientY,
            employee,
            date,
            hasSchedule: existingSchedules.length > 0,
            firstSchedule: existingSchedules.length > 0 ? existingSchedules[0] : null
        });
    };

    const handleContextMenuCopy = () => {
        if (contextMenu?.firstSchedule) {
            handleCopySchedule(contextMenu.firstSchedule);
        }
        setContextMenu(null);
    };

    const handleContextMenuAddSchedule = () => {
        if (contextMenu) {
            const { employee, date } = contextMenu;
            const dateStr = date.toISOString().split('T')[0];
            const existingSchedules = schedules.filter(
                s => s.employeeName === employee.employeeName &&
                    s.date.split('T')[0] === dateStr
            );

            setSelectedCell({ employee, date, existing: null, allSchedules: existingSchedules });
            setFormData({
                employeeName: employee.employeeName || '',
                scheduledStartTime: '',
                scheduledEndTime: '',
                scheduledDuration: '',
                assignmentType: assignmentTypes.length > 0 ? assignmentTypes[0].value : '',
                notes: ''
            });
            setIsModalOpen(true);
        }
        setContextMenu(null);
    };

    const handleContextMenuDelete = async () => {
        if (!contextMenu) return;

        const { employee, date } = contextMenu;
        const dateStr = date.toISOString().split('T')[0];
        const existingSchedules = schedules.filter(
            s => s.employeeName === employee.employeeName &&
                s.date.split('T')[0] === dateStr
        );

        if (existingSchedules.length === 0) {
            setContextMenu(null);
            return;
        }

        // If multiple schedules, ask which one to delete or delete all
        if (existingSchedules.length > 1) {
            if (!confirm(`Delete all ${existingSchedules.length} schedules for this date?`)) {
                setContextMenu(null);
                return;
            }
        } else {
            if (!confirm('Delete this schedule?')) {
                setContextMenu(null);
                return;
            }
        }

        try {
            // Delete all schedules for this employee/date
            for (const schedule of existingSchedules) {
                await scheduleAPI.delete(schedule._id);
            }
            showMessage('success', `Deleted ${existingSchedules.length} schedule(s)`);
            fetchSchedules();
        } catch (error) {
            showMessage('error', 'Failed to delete schedule(s)');
        }

        setContextMenu(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedCell) return;

        try {
            // Auto-calculate duration if start and end times are provided
            let duration = formData.scheduledDuration ? parseFloat(formData.scheduledDuration) : 0;
            if (formData.scheduledStartTime && formData.scheduledEndTime) {
                const calculatedDuration = calculateDuration(formData.scheduledStartTime, formData.scheduledEndTime);
                if (calculatedDuration > 0) {
                    duration = calculatedDuration;
                }
            }

            const submitData = {
                employeeName: formData.employeeName || selectedCell.employee.employeeName,
                date: selectedCell.date.toISOString().split('T')[0],
                scheduledStartTime: formData.scheduledStartTime,
                scheduledEndTime: formData.scheduledEndTime,
                scheduledDuration: duration,
                isOff: !formData.scheduledStartTime, // OFF if no time
                notes: formData.notes,
                assignmentType: formData.assignmentType
            };

            // Save old schedule data for undo if updating
            const oldSchedule = selectedCell.existing ? JSON.parse(JSON.stringify(selectedCell.existing)) : null;

            if (selectedCell.existing) {
                await scheduleAPI.update(selectedCell.existing._id, submitData);

                // Add undo action
                if (oldSchedule) {
                    addAction({
                        message: 'Schedule updated',
                        undo: async () => {
                            try {
                                await scheduleAPI.update(selectedCell.existing._id, oldSchedule);
                                showMessage('success', 'Schedule update undone');
                                fetchSchedules();
                            } catch (error) {
                                showMessage('error', 'Failed to undo schedule update');
                            }
                        }
                    });
                }

                showMessage('success', 'Schedule updated successfully');
            } else {
                const response = await scheduleAPI.create(submitData);
                const newScheduleId = response.data?._id || response._id;

                // Add undo action
                if (newScheduleId) {
                    addAction({
                        message: 'Schedule created',
                        undo: async () => {
                            try {
                                await scheduleAPI.delete(newScheduleId);
                                showMessage('success', 'Schedule creation undone');
                                fetchSchedules();
                            } catch (error) {
                                showMessage('error', 'Failed to undo schedule creation');
                            }
                        }
                    });
                }

                showMessage('success', 'Schedule created successfully');
            }

            setIsModalOpen(false);
            fetchSchedules();
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Operation failed');
        }
    };

    const handleDelete = async () => {
        if (!selectedCell?.existing) return;
        if (!confirm('Are you sure you want to delete this schedule?')) return;

        // Save schedule data for undo
        const scheduleToDelete = JSON.parse(JSON.stringify(selectedCell.existing));

        try {
            await scheduleAPI.delete(selectedCell.existing._id);

            // Add undo action
            addAction({
                message: 'Schedule deleted',
                undo: async () => {
                    try {
                        const { _id, __v, ...restoredData } = scheduleToDelete;
                        await scheduleAPI.create(restoredData);
                        showMessage('success', 'Schedule deletion undone');
                        fetchSchedules();
                    } catch (error) {
                        showMessage('error', 'Failed to undo schedule deletion');
                    }
                }
            });

            showMessage('success', 'Schedule deleted successfully');
            setIsModalOpen(false);
            fetchSchedules();
        } catch (error) {
            showMessage('error', 'Failed to delete schedule');
        }
    };


    const getScheduleForCell = (employeeName, date) => {
        const dateStr = date.toISOString().split('T')[0];
        return schedules.filter(
            s => s.employeeName === employeeName && s.date.split('T')[0] === dateStr
        );
    };

    const getAssignmentColor = (assignmentType) => {
        const type = assignmentTypes.find(t => t.value === assignmentType);
        return type ? type.color : '#6b7280';
    };

    const handleOperatingHoursClick = (date) => {
        const dateStr = date.toISOString().split('T')[0];
        setEditingHours({
            date: dateStr,
            value: operatingHours[dateStr] || getDefaultOperatingHours(date)
        });
    };

    const fetchOperatingHours = async () => {
        try {
            // Check cache first
            const cacheKey = `operating_hours_${dateRange.startDate}_${dateRange.endDate}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const cachedData = JSON.parse(cached);
                // Check if cache is recent (less than 5 minutes old)
                if (cachedData.timestamp && Date.now() - cachedData.timestamp < 5 * 60 * 1000) {
                    setOperatingHours(cachedData.data);
                    return;
                }
            }

            // Fetch from API
            const response = await operatingHoursAPI.getAll({
                startDate: dateRange.startDate,
                endDate: dateRange.endDate
            });

            const hoursData = response.data || {};
            setOperatingHours(hoursData);

            // Cache the result
            localStorage.setItem(cacheKey, JSON.stringify({
                data: hoursData,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.error('Failed to fetch operating hours:', error);
            // Fallback to localStorage cache if available
            const cacheKey = `operating_hours_${dateRange.startDate}_${dateRange.endDate}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const cachedData = JSON.parse(cached);
                setOperatingHours(cachedData.data || {});
            }
        }
    };

    const handleOperatingHoursSave = async () => {
        if (editingHours) {
            try {
                const date = new Date(editingHours.date);
                const hoursValue = editingHours.value.trim();

                // Check if the value is a default - if so, delete from database
                if (isDefaultHours(date, hoursValue)) {
                    // Delete from MongoDB if it exists
                    try {
                        await operatingHoursAPI.delete(editingHours.date);
                    } catch (deleteError) {
                        // Ignore if not found - that's fine
                        if (deleteError.response?.status !== 404) {
                            console.error('Failed to delete operating hours:', deleteError);
                        }
                    }

                    // Remove from local state
                    const updated = { ...operatingHours };
                    delete updated[editingHours.date];
                    setOperatingHours(updated);

                    // Update cache
                    const cacheKey = `operating_hours_${dateRange.startDate}_${dateRange.endDate}`;
                    const cached = localStorage.getItem(cacheKey);
                    if (cached) {
                        const cachedData = JSON.parse(cached);
                        delete cachedData.data[editingHours.date];
                        cachedData.timestamp = Date.now();
                        localStorage.setItem(cacheKey, JSON.stringify(cachedData));
                    }
                } else {
                    // Save to MongoDB
                    await operatingHoursAPI.create({
                        date: editingHours.date,
                        hours: hoursValue
                    });

                    // Update local state
                    const updated = {
                        ...operatingHours,
                        [editingHours.date]: hoursValue
                    };
                    setOperatingHours(updated);

                    // Update cache
                    const cacheKey = `operating_hours_${dateRange.startDate}_${dateRange.endDate}`;
                    const cached = localStorage.getItem(cacheKey);
                    if (cached) {
                        const cachedData = JSON.parse(cached);
                        cachedData.data = updated;
                        cachedData.timestamp = Date.now();
                        localStorage.setItem(cacheKey, JSON.stringify(cachedData));
                    }
                }

                setEditingHours(null);
            } catch (error) {
                console.error('Failed to save operating hours:', error);
                showMessage('error', 'Failed to save operating hours');
            }
        }
    };

    const handleOperatingHoursCancel = () => {
        setEditingHours(null);
    };

    const handleComputeEstimatedSalary = async () => {
        setLoadingEstimatedSalary(true);
        try {
            const response = await scheduleAPI.getEstimatedSalary(dateRange.startDate, dateRange.endDate);
            setEstimatedSalaryData(response.data);
            setIsEstimatedSalaryModalOpen(true);
        } catch (error) {
            console.error('Failed to compute estimated salary:', error);
            showMessage('error', 'Failed to compute estimated salary');
        } finally {
            setLoadingEstimatedSalary(false);
        }
    };

    const getHolidayColor = (date) => {
        const dateStr = date.toISOString().split('T')[0];
        const holiday = holidays[dateStr];
        if (!holiday) return null;

        if (holiday.type === 'REGULAR' || holiday.type === 'Regular') {
            return 'rgba(233, 213, 255, 0.51)'; // Light purple with 51% opacity
        } else if (holiday.type === 'SPECIAL' || holiday.type === 'Special') {
            return '#fce7f3'; // Light pink
        }
        return null;
    };

    const getHolidayInfo = (date) => {
        const dateStr = date.toISOString().split('T')[0];
        const holiday = holidays[dateStr];
        if (!holiday) return null;
        return {
            name: holiday.name || holiday.description || 'Holiday',
            type: holiday.type
        };
    };

    const getShiftColor = (shiftName) => {
        const name = shiftName.toLowerCase();
        if (name.includes('opening')) return 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200';
        if (name.includes('mid')) return 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200';
        if (name.includes('closing')) return 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200';
        if (name.includes('any')) return 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200';
        return 'bg-white text-gray-900 border-gray-100 hover:border-blue-300 hover:bg-blue-50';
    };

    const getAvailabilityForDate = (date) => {
        const dateStr = date.toISOString().split('T')[0];
        const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });

        return availability.filter(item => {
            // Check if date is within range for WEEKLY, MONTHLY, INDEFINITE
            const startDate = item.startDate ? new Date(item.startDate) : null;
            const endDate = item.endDate ? new Date(item.endDate) : null;

            if (startDate && date < startDate) return false;
            if (endDate && date > endDate) return false;

            if (item.type === 'WEEKLY') {
                return item.daysOfWeek.includes(dayOfWeek);
            }
            if (item.type === 'SPECIFIC_DATES') {
                return item.specificDates.some(d => new Date(d).toISOString().split('T')[0] === dateStr);
            }
            return true; // INDEFINITE or MONTHLY (within range)
        });
    };

    const handleAvailabilityIconClick = (date) => {
        setSelectedAvailabilityDate(date);
        setIsAvailabilityModalOpen(true);
    };

    const handleCopySchedule = (schedule) => {
        if (schedule && !schedule.isOff) {
            setCopiedSchedule({
                scheduledStartTime: schedule.scheduledStartTime,
                scheduledEndTime: schedule.scheduledEndTime,
                scheduledDuration: schedule.scheduledDuration || 0,
                assignmentType: schedule.assignmentType,
                notes: schedule.notes
            });
            showMessage('success', 'Schedule copied! Click on another cell to paste.');
        }
    };

    const handlePasteSchedule = async (employee, date) => {
        if (!copiedSchedule) {
            showMessage('error', 'No schedule copied. Right-click a schedule cell to copy.');
            return;
        }

        try {
            const dateStr = date.toISOString().split('T')[0];
            const submitData = {
                employeeName: employee.employeeName,
                date: dateStr,
                scheduledStartTime: copiedSchedule.scheduledStartTime,
                scheduledEndTime: copiedSchedule.scheduledEndTime,
                scheduledDuration: copiedSchedule.scheduledDuration || 0,
                isOff: false,
                notes: copiedSchedule.notes,
                assignmentType: copiedSchedule.assignmentType
            };

            // Create new schedule (allow multiple schedules per date)
            await scheduleAPI.create(submitData);
            showMessage('success', 'Schedule pasted successfully');

            fetchSchedules();
        } catch (error) {
            showMessage('error', 'Failed to paste schedule');
        }
    };

    const handleDragStart = (e, schedule, employee, date) => {
        if (schedule && !schedule.isOff) {
            setDraggedSchedule({ schedule, employee, date });
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', ''); // Required for Firefox
            e.currentTarget.style.opacity = '0.5';
        }
    };

    const handleDragEnd = (e) => {
        e.currentTarget.style.opacity = '1';
        setDraggedSchedule(null);
        setDragOverCell(null);
    };

    const handleDragOver = (e, employee, date) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverCell({ employee, date });
    };

    const handleDragLeave = () => {
        setDragOverCell(null);
    };

    const handleDrop = async (e, targetEmployee, targetDate) => {
        e.preventDefault();
        setDragOverCell(null);

        if (!draggedSchedule) return;

        const { schedule, employee: sourceEmployee, date: sourceDate } = draggedSchedule;

        // Don't do anything if dropped on the same cell
        if (sourceEmployee.employeeName === targetEmployee.employeeName &&
            sourceDate.toISOString().split('T')[0] === targetDate.toISOString().split('T')[0]) {
            setDraggedSchedule(null);
            return;
        }

        try {
            const targetDateStr = targetDate.toISOString().split('T')[0];

            // Create new schedule at target location (allow multiple schedules)
            const submitData = {
                employeeName: targetEmployee.employeeName,
                date: targetDateStr,
                scheduledStartTime: schedule.scheduledStartTime,
                scheduledEndTime: schedule.scheduledEndTime,
                scheduledDuration: schedule.scheduledDuration || 0,
                isOff: false,
                notes: schedule.notes,
                assignmentType: schedule.assignmentType
            };

            await scheduleAPI.create(submitData);

            // Delete the original schedule
            await scheduleAPI.delete(schedule._id);

            showMessage('success', 'Schedule moved successfully');
            fetchSchedules();
        } catch (error) {
            console.error('Failed to move schedule:', error);
            showMessage('error', 'Failed to move schedule');
        } finally {
            setDraggedSchedule(null);
        }
    };

    const handleDateRangeChange = (field, value) => {
        setDateRange(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const resetToCurrentWeek = () => {
        const scrollPosition = window.scrollY || document.documentElement.scrollTop;
        sessionStorage.setItem('scheduleScrollPosition', scrollPosition.toString());
        const monday = getMonday(new Date());
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        setDateRange({
            startDate: formatDateLocal(monday),
            endDate: formatDateLocal(sunday)
        });
    };

    const navigateToNextWeek = () => {
        const scrollPosition = window.scrollY || document.documentElement.scrollTop;
        sessionStorage.setItem('scheduleScrollPosition', scrollPosition.toString());
        const currentStart = new Date(dateRange.startDate);
        const nextMonday = new Date(currentStart);
        nextMonday.setDate(currentStart.getDate() + 7);
        const nextSunday = new Date(nextMonday);
        nextSunday.setDate(nextMonday.getDate() + 6);
        setDateRange({
            startDate: formatDateLocal(nextMonday),
            endDate: formatDateLocal(nextSunday)
        });
    };

    const navigateToPreviousWeek = () => {
        const scrollPosition = window.scrollY || document.documentElement.scrollTop;
        sessionStorage.setItem('scheduleScrollPosition', scrollPosition.toString());
        const currentStart = new Date(dateRange.startDate);
        const previousMonday = new Date(currentStart);
        previousMonday.setDate(currentStart.getDate() - 7);
        const previousSunday = new Date(previousMonday);
        previousSunday.setDate(previousMonday.getDate() + 6);
        setDateRange({
            startDate: formatDateLocal(previousMonday),
            endDate: formatDateLocal(previousSunday)
        });
    };

    if (loading) {
        return <div className="p-6">Loading calendar...</div>;
    }

    const dateRangeDates = getDateRangeDates();

    // Filter employees based on simplify view
    const filteredEmployees = simplifyView
        ? employees.filter(employee => {
            // Check if employee has any schedule in the selected date range
            return schedules.some(schedule => {
                const scheduleDate = new Date(schedule.date).toISOString().split('T')[0];
                return schedule.employeeName === employee.employeeName &&
                    dateRangeDates.some(date => date.toISOString().split('T')[0] === scheduleDate);
            });
        })
        : employees;

    return (
        <div className="bg-white rounded-lg shadow overflow-hidden">
            {message.text && (
                <div
                    className={`m-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                >
                    {message.text}
                </div>
            )}

            {/* Undo Toast */}
            {undoToastVisible && lastAction && (
                <div className="fixed top-4 right-4 z-50" style={{ zIndex: 9999 }}>
                    <UndoToast
                        action={lastAction}
                        onUndo={async () => {
                            const success = await undo();
                            setUndoToastVisible(false);
                            if (success) {
                                showMessage('success', 'Action undone');
                            } else {
                                showMessage('error', 'Failed to undo action');
                            }
                        }}
                        onDismiss={() => {
                            setUndoToastVisible(false);
                            clearHistory();
                        }}
                    />
                </div>
            )}

            {/* Main View rendering: Agenda (Google Calendar) vs Grid */}
            {calendarViewMode === 'agenda' ? (
                <GoogleCalendarScheduleView
                    dateRangeDates={dateRangeDates}
                    schedules={schedules}
                    employees={filteredEmployees}
                    assignmentTypes={assignmentTypes}
                    operatingHours={operatingHours}
                    holidays={holidays}
                    getAssignmentColor={getAssignmentColor}
                    onEditSchedule={handleEditScheduleFromAgenda}
                    onAddSchedule={handleAddScheduleFromAgenda}
                    onNavigatePrev={navigateToPreviousWeek}
                    onNavigateNext={navigateToNextWeek}
                    onNavigateToday={resetToCurrentWeek}
                    getWeekLabel={getWeekLabel}
                    dateRange={dateRange}
                    user={user}
                    onOpenExportICal={() => setIsExportICalModalOpen(true)}
                    onOpenShiftTargets={() => setIsShiftTargetsModalOpen(true)}
                    onComputeSalary={handleComputeEstimatedSalary}
                    loadingEstimatedSalary={loadingEstimatedSalary}
                    viewMode={calendarViewMode}
                    onToggleViewMode={setCalendarViewMode}
                />
            ) : (
                <>
                    {/* Date Range Navigation */}
                    <div className="p-4 border-b">
                        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                            <h2 className="text-lg font-semibold text-gray-800">{getWeekLabel()}</h2>

                            {/* View Switcher Toggle */}
                            <div className="bg-gray-100 p-1 rounded-lg inline-flex text-xs">
                                <button
                                    onClick={() => setCalendarViewMode('agenda')}
                                    className={`px-3 py-1.5 font-medium rounded-md transition-colors ${calendarViewMode === 'agenda' ? 'bg-white text-blue-600 shadow-xs font-semibold' : 'text-gray-600 hover:text-gray-900'}`}
                                >
                                    📱 Schedule View
                                </button>
                                <button
                                    onClick={() => setCalendarViewMode('grid')}
                                    className={`px-3 py-1.5 font-medium rounded-md transition-colors ${calendarViewMode === 'grid' ? 'bg-white text-blue-600 shadow-xs font-semibold' : 'text-gray-600 hover:text-gray-900'}`}
                                >
                                    📊 Grid View
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                                <label className="text-sm font-medium text-gray-700">Start Date:</label>
                                <input
                                    type="date"
                                    value={dateRange.startDate || ''}
                                    onChange={(e) => handleDateRangeChange('startDate', e.target.value)}
                                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                                />
                                <label className="text-sm font-medium text-gray-700">End Date:</label>
                                <input
                                    type="date"
                                    value={dateRange.endDate || ''}
                                    onChange={(e) => handleDateRangeChange('endDate', e.target.value)}
                                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                                />
                                <button
                                    onClick={() => setShowAvailability(!showAvailability)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium ${showAvailability
                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    {showAvailability ? 'Hide Availability' : 'Show Availability'}
                                </button>
                                <button
                                    onClick={() => setIsShiftTargetsModalOpen(true)}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700"
                                >
                                    Shift Targets
                                </button>
                                <button
                                    onClick={() => {
                                        const scrollPosition = window.scrollY || document.documentElement.scrollTop;
                                        sessionStorage.setItem('scheduleScrollPosition', scrollPosition.toString());
                                        setSimplifyView(!simplifyView);
                                    }}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium ${simplifyView
                                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    {simplifyView ? '✓ Simplify' : 'Simplify'}
                                </button>
                                {user?.role === 'admin' && (
                                    <button
                                        onClick={handleComputeEstimatedSalary}
                                        disabled={loadingEstimatedSalary}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                                    >
                                        {loadingEstimatedSalary ? 'Computing...' : 'Compute Estimated Salary'}
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsExportICalModalOpen(true)}
                                    className="px-4 py-2 bg-amber-600 text-white hover:bg-amber-700 rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center gap-1.5"
                                >
                                    📅 Export to Google Calendar (.ics)
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={navigateToPreviousWeek}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                                >
                                    Previous Week
                                </button>
                                <button
                                    onClick={resetToCurrentWeek}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                                >
                                    Current Week
                                </button>
                                <button
                                    onClick={navigateToNextWeek}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                                >
                                    Next Week
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Assignment Legend */}
                    {assignmentTypes.length > 0 && (
                        <div className="flex items-center justify-between gap-2 p-4 border-b flex-wrap">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold mr-2">ASSIGNMENT:</span>
                                {assignmentTypes.map((type) => (
                                    <div
                                        key={type.value}
                                        className="px-3 py-1 text-xs font-semibold text-white rounded"
                                        style={{ backgroundColor: type.color }}
                                    >
                                        {type.label.toUpperCase()}
                                    </div>
                                ))}
                            </div>
                            {copiedSchedule && (
                                <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm">
                                    <span>📋 Copied: {copiedSchedule.scheduledStartTime} - {copiedSchedule.scheduledEndTime}</span>
                                    <button
                                        onClick={() => setCopiedSchedule(null)}
                                        className="text-blue-600 hover:text-blue-800"
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Schedule Grid */}
                    <div className="overflow-x-auto">
                        <table className="min-w-full" style={{ borderCollapse: 'separate', borderSpacing: 0, border: '1px solid #d1d5db' }}>
                            <thead>
                                <tr className="bg-orange-100">
                                    <td className="px-2 py-3 font-semibold sticky left-0 bg-orange-100 z-30" colSpan="2" style={{ border: '1px solid #d1d5db', borderRight: '1px solid #d1d5db', backgroundColor: '#fed7aa' }}>
                                        OPERATING HOURS
                                    </td>
                                    {dateRangeDates.map((date, idx) => {
                                        const dateStr = date.toISOString().split('T')[0];
                                        const isEditing = editingHours?.date === dateStr;

                                        return (
                                            <td
                                                key={idx}
                                                className="px-2 py-3 text-center text-sm font-semibold cursor-pointer hover:bg-orange-200"
                                                style={{ border: '1px solid #d1d5db' }}
                                                onClick={() => !isEditing && handleOperatingHoursClick(date)}
                                            >
                                                {isEditing ? (
                                                    <div className="flex items-center gap-1">
                                                        <textarea
                                                            value={editingHours.value}
                                                            onChange={(e) => setEditingHours({ ...editingHours, value: e.target.value })}
                                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                            placeholder="e.g. 4PM - 2AM"
                                                            rows={2}
                                                            autoFocus
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                                    e.preventDefault();
                                                                    handleOperatingHoursSave();
                                                                }
                                                                if (e.key === 'Escape') handleOperatingHoursCancel();
                                                            }}
                                                        />
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOperatingHoursSave();
                                                            }}
                                                            className="px-2 py-1 bg-green-500 text-white rounded text-xs"
                                                        >
                                                            ✓
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOperatingHoursCancel();
                                                            }}
                                                            className="px-2 py-1 bg-red-500 text-white rounded text-xs"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div style={{ whiteSpace: 'pre-line' }}>
                                                        {getDefaultOperatingHours(date)}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                                <tr className="bg-blue-50">
                                    <td className="px-2 py-3 font-semibold sticky left-0 bg-blue-50 z-30" colSpan="2" style={{ border: '1px solid #d1d5db', borderRight: '1px solid #d1d5db', backgroundColor: '#eff6ff' }}>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-blue-900 tracking-wider font-bold">SHIFT TARGETS</span>
                                            <button
                                                onClick={() => setIsShiftTargetsModalOpen(true)}
                                                className="text-blue-600 hover:text-blue-800 text-[10px] underline ml-2 font-medium"
                                                title="Configure targets"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                    </td>
                                    {dateRangeDates.map((date, idx) => {
                                        const stats = getShiftCoverageStats(date);
                                        
                                        if (!stats.hasTargets) {
                                            return (
                                                <td
                                                    key={idx}
                                                    className="px-2 py-2 text-center text-xs text-gray-500 bg-gray-50 font-medium"
                                                    style={{ border: '1px solid #d1d5db' }}
                                                >
                                                    No targets set
                                                </td>
                                            );
                                        }

                                        const isMet = stats.isMet;
                                        return (
                                            <td
                                                key={idx}
                                                className={`px-2 py-2 text-center text-xs border ${
                                                    isMet
                                                        ? 'bg-green-50 text-green-800 border-green-200'
                                                        : 'bg-red-50 text-red-800 border-red-200'
                                                }`}
                                                style={{ border: '1px solid #d1d5db' }}
                                            >
                                                <div className="font-semibold mb-0.5 text-[10px]">
                                                    {isMet ? '✓ Targets Met' : '✗ Understaffed'}
                                                </div>
                                                <div className="text-[9px] space-y-0.5 max-h-[60px] overflow-y-auto">
                                                    {isMet ? (
                                                        <div className="text-green-600 text-[9px] italic">
                                                            All shifts fully staffed
                                                        </div>
                                                    ) : (
                                                        stats.understaffedShifts.map((us, uIdx) => (
                                                            <div key={uIdx} className="truncate font-medium text-left" title={`${us.name}: ${us.scheduled}/${us.required}`}>
                                                                • {us.name}: <span className="text-red-600 font-bold">{us.scheduled}</span>/{us.required}
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                                <tr className="bg-orange-500 text-white">
                                    <th className="px-2 py-3 text-center font-bold sticky left-0 bg-orange-500 z-30" style={{ border: '1px solid #d1d5db', borderRight: 'none', width: '60px', backgroundColor: '#f97316', boxShadow: '1px 0 0 0 #d1d5db' }}>
                                        #
                                    </th>
                                    <th className="px-2 py-3 text-left font-bold sticky left-0 bg-orange-500 z-30" style={{ left: '59px', border: '1px solid #d1d5db', borderLeft: 'none', minWidth: '180px', backgroundColor: '#f97316' }}>
                                        Employee
                                    </th>
                                    {dateRangeDates.map((date, idx) => {
                                        const holidayInfo = getHolidayInfo(date);
                                        return (
                                            <th
                                                key={idx}
                                                className="px-2 py-3 text-center font-bold min-w-[120px]"
                                                style={{
                                                    border: '1px solid #d1d5db',
                                                    borderLeft: idx === 0 ? 'none' : '1px solid #d1d5db'
                                                }}
                                            >
                                                <div className="relative flex flex-col items-center justify-center">
                                                    <span>
                                                        {date.toLocaleDateString('en-US', { weekday: 'short' })} {date.getMonth() + 1}/{date.getDate()}
                                                    </span>
                                                    {holidayInfo && (
                                                        <div className="text-xs font-normal mt-1 text-white">
                                                            {holidayInfo.name} - {(holidayInfo.type === 'REGULAR' || holidayInfo.type === 'Regular') ? 'Regular' : 'Special'}
                                                        </div>
                                                    )}
                                                    {getAvailabilityForDate(date).length > 0 && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleAvailabilityIconClick(date);
                                                            }}
                                                            className="absolute right-1 top-1 inline-flex items-center justify-center w-4 h-4 bg-white text-blue-600 rounded-full shadow-sm hover:bg-gray-50 transition-colors"
                                                            title="View Availability"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            </svg>
                                                        </button>
                                                    )}

                                                    {/* Shift Availability Display */}
                                                    {showAvailability && (
                                                        <div className="mt-1 space-y-0.5 w-full px-0.5">
                                                            {shifts.map(shift => {
                                                                const slots = getAvailableSlots(date, shift);
                                                                if (!slots) return null;

                                                                return (
                                                                    <div key={shift._id} className="text-[10px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded-full border border-red-100 flex justify-between items-center shadow-sm mx-auto max-w-[95%]">
                                                                        <span className="font-medium truncate mr-1 max-w-[70px]">{shift.name}</span>
                                                                        <span className="font-bold bg-red-200 text-red-800 px-1 rounded-full text-[9px]">{slots.available}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEmployees.map((employee, empIdx) => {
                                    return (
                                        <tr key={employee._id} className="hover:bg-gray-50">
                                            <td className="px-2 py-3 text-center sticky left-0 bg-white z-30" style={{ border: '1px solid #d1d5db', borderRight: 'none', width: '60px', backgroundColor: 'white', boxShadow: '1px 0 0 0 #d1d5db' }}>
                                                {empIdx + 1}
                                            </td>
                                            <td className="px-2 py-3 text-left font-medium sticky bg-white z-30" style={{ left: '59px', border: '1px solid #d1d5db', borderLeft: 'none', minWidth: '180px', backgroundColor: 'white' }}>
                                                <div>{employee.employeeName}</div>
                                                {(employee.position || employee.employmentType) && (
                                                    <div className="text-xs text-gray-500 italic">
                                                        {[
                                                            employee.position,
                                                            employee.employmentType === 'FULL_TIME' ? 'Full Time' :
                                                                employee.employmentType === 'PART_TIME' ? 'Part Time' :
                                                                    employee.employmentType === 'ON_CALL' ? 'On Call' :
                                                                        employee.employmentType
                                                        ].filter(Boolean).join(' - ')}
                                                    </div>
                                                )}
                                            </td>
                                            {dateRangeDates.map((date, dateIdx) => {
                                                const cellSchedules = getScheduleForCell(employee.employeeName, date);
                                                const closed = isClosed(date);
                                                const holidayColor = getHolidayColor(date);
                                                const isDragOver = dragOverCell &&
                                                    dragOverCell.employee.employeeName === employee.employeeName &&
                                                    dragOverCell.date.toISOString().split('T')[0] === date.toISOString().split('T')[0];
                                                const isDragging = draggedSchedule &&
                                                    draggedSchedule.employee.employeeName === employee.employeeName &&
                                                    draggedSchedule.date.toISOString().split('T')[0] === date.toISOString().split('T')[0];

                                                // Determine background color
                                                let bgColor = '';
                                                if (closed) {
                                                    bgColor = 'bg-gray-200';
                                                } else if (isDragOver) {
                                                    bgColor = 'bg-blue-200';
                                                } else if (holidayColor) {
                                                    bgColor = '';
                                                } else if (isDragging) {
                                                    bgColor = 'opacity-50';
                                                }

                                                return (
                                                    <td
                                                        key={dateIdx}
                                                        className={`px-2 py-3 text-center cursor-pointer align-middle ${bgColor} ${!closed && !isDragOver && !holidayColor && !isDragging ? 'hover:bg-blue-50' : ''} ${isDragOver ? 'border-2 border-blue-500' : ''}`}
                                                        style={{
                                                            border: '1px solid #d1d5db',
                                                            borderLeft: dateIdx === 0 ? 'none' : '1px solid #d1d5db',
                                                            backgroundColor: holidayColor || (isDragOver ? '' : undefined)
                                                        }}
                                                        onClick={(e) => handleCellClick(employee, date, e)}
                                                        onContextMenu={(e) => handleCellRightClick(employee, date, e)}
                                                        onDragOver={(e) => handleDragOver(e, employee, date)}
                                                        onDragLeave={handleDragLeave}
                                                        onDrop={(e) => handleDrop(e, employee, date)}
                                                    >
                                                        {cellSchedules.length > 0 ? (
                                                            <div className="space-y-1">
                                                                {cellSchedules.map((schedule, idx) => (
                                                                    schedule.isOff ? (
                                                                        <div key={idx} className="bg-gray-300 text-gray-700 px-2 py-1 rounded text-sm font-semibold">
                                                                            OFF
                                                                        </div>
                                                                    ) : (
                                                                        <div
                                                                            key={idx}
                                                                            className="px-2 py-1 rounded text-white text-sm font-semibold"
                                                                            style={{ backgroundColor: getAssignmentColor(schedule.assignmentType) }}
                                                                            draggable
                                                                            onDragStart={(e) => handleDragStart(e, schedule, employee, date)}
                                                                            onDragEnd={handleDragEnd}
                                                                        >
                                                                            {schedule.scheduledStartTime} - {schedule.scheduledEndTime}
                                                                            {schedule.notes && (
                                                                                <div className="mt-1 italic" style={{ fontSize: '0.6rem', lineHeight: '1.2' }}>
                                                                                    {schedule.notes}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )
                                                                ))}
                                                            </div>
                                                        ) : null}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Context Menu */}
            {contextMenu && (
                <>
                    <div
                        className="fixed inset-0 z-50"
                        onClick={() => setContextMenu(null)}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            setContextMenu(null);
                        }}
                    />
                    <div
                        className="fixed z-50 bg-white border border-gray-300 rounded-lg shadow-lg py-1 min-w-[150px]"
                        style={{
                            left: `${contextMenu.x}px`,
                            top: `${contextMenu.y}px`
                        }}
                    >
                        {contextMenu.hasSchedule && (
                            <button
                                onClick={handleContextMenuCopy}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                                Copy
                            </button>
                        )}
                        <button
                            onClick={handleContextMenuAddSchedule}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                            Add Schedule
                        </button>
                        {contextMenu.hasSchedule && (
                            <button
                                onClick={handleContextMenuDelete}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                                Delete
                            </button>
                        )}
                    </div>
                </>
            )}

            {/* Estimated Salary Modal */}
            <Modal
                isOpen={isEstimatedSalaryModalOpen}
                onClose={() => setIsEstimatedSalaryModalOpen(false)}
                title="Estimated Salary for Schedules Without Timesheets"
                maxWidth="6xl"
            >
                {estimatedSalaryData && (
                    <div className="max-h-[70vh] overflow-y-auto">
                        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                            <p className="text-sm text-gray-700">
                                <strong>Date Range:</strong> {new Date(estimatedSalaryData.dateRange.startDate).toLocaleDateString()} - {new Date(estimatedSalaryData.dateRange.endDate).toLocaleDateString()}
                            </p>
                            <p className="text-sm text-gray-700 mt-1">
                                <strong>Total Employees:</strong> {estimatedSalaryData.totals.totalEmployees} |
                                <strong> Total Schedules:</strong> {estimatedSalaryData.totals.totalSchedules}
                            </p>
                        </div>

                        {estimatedSalaryData.results.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                No schedules without timesheet entries found in this date range.
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto mb-4">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Hours</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ND Hours</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">OT Hours</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Basic</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ND Pay</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">OT Pay</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Holiday Pay</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {estimatedSalaryData.results.map((emp) => (
                                                <tr key={emp.employeeId} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                                        {emp.employeeName}
                                                        <div className="text-xs text-gray-500">
                                                            {emp.wageType} @ {formatMoney(emp.hourlyRate)}/hr
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                                                        {emp.totalEstimatedHours.toFixed(2)}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                                                        {emp.totalNDHours.toFixed(2)}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                                                        {emp.totalOvertimeHours.toFixed(2)}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                                                        {formatMoney(emp.basicSalary)}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                                                        {formatMoney(emp.nightDiffPay)}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                                                        {formatMoney(emp.overtimePay)}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                                                        {formatMoney(emp.regularHolidayPay + emp.specialHolidayPay)}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                                                        {formatMoney(emp.totalEstimatedSalary)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-gray-100">
                                            <tr>
                                                <td className="px-4 py-3 text-sm font-bold text-gray-900">TOTAL</td>
                                                <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                                                    {estimatedSalaryData.totals.totalEstimatedHours.toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">-</td>
                                                <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">-</td>
                                                <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                                                    {formatMoney(estimatedSalaryData.totals.totalBasicSalary)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                                                    {formatMoney(estimatedSalaryData.totals.totalNightDiffPay)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                                                    {formatMoney(estimatedSalaryData.totals.totalOvertimePay)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                                                    {formatMoney(estimatedSalaryData.totals.totalRegularHolidayPay + estimatedSalaryData.totals.totalSpecialHolidayPay)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right font-bold text-green-600 text-lg">
                                                    {formatMoney(estimatedSalaryData.totals.grandTotal)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                                <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                                    <p className="text-xs text-yellow-800">
                                        <strong>Note:</strong> This is an estimate based on scheduled hours. Actual salary may vary based on actual timesheet entries, allowances, and deductions.
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </Modal>

            {/* Availability Info Modal */}
            <Modal
                isOpen={isAvailabilityModalOpen}
                onClose={() => setIsAvailabilityModalOpen(false)}
                title={selectedAvailabilityDate ? `Available Employees - ${selectedAvailabilityDate.toLocaleDateString()}` : 'Availability'}
            >
                {selectedAvailabilityDate && (
                    <div className="space-y-4">
                        {getAvailabilityForDate(selectedAvailabilityDate).length === 0 ? (
                            <p className="text-gray-500 text-center py-4">No employees have set availability for this date.</p>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {getAvailabilityForDate(selectedAvailabilityDate).map((item, idx) => (
                                    <div key={idx} className="py-3 flex justify-between items-start">
                                        <div>
                                            <p className="font-medium text-gray-900">{item.employeeName}</p>
                                            <p className="text-sm text-gray-500">{item.notes || 'No notes'}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                {item.shiftType}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={selectedCell ? `Schedule for ${formData.employeeName || selectedCell.employee.employeeName} - ${selectedCell.date.toLocaleDateString()}` : 'Schedule'}
            >
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1 font-semibold">Employee</label>
                        <select
                            value={formData.employeeName || ''}
                            onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-medium focus:ring-2 focus:ring-blue-500"
                            required
                        >
                            <option value="">Select Employee</option>
                            {employees.map((emp) => (
                                <option key={emp._id} value={emp.employeeName}>
                                    {emp.employeeName} {[emp.position, emp.employmentType === 'FULL_TIME' ? 'Full Time' : emp.employmentType === 'PART_TIME' ? 'Part Time' : emp.employmentType].filter(Boolean).join(' - ')}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Shifts Guide</label>
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4">
                            {shifts.filter(s => {
                                if (!selectedCell?.date) return false;
                                const day = selectedCell.date.toLocaleDateString('en-US', { weekday: 'long' });
                                return s.daysOfWeek.includes(day) || s.daysOfWeek.length === 0;
                            }).length === 0 ? (
                                <p className="text-xs text-gray-500 italic">No shifts configured for this day.</p>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    {shifts.filter(s => {
                                        if (!selectedCell?.date) return false;
                                        const day = selectedCell.date.toLocaleDateString('en-US', { weekday: 'long' });
                                        return s.daysOfWeek.includes(day);
                                    }).map(s => (
                                        <div
                                            key={s._id}
                                            className={`flex flex-col items-center justify-center p-1.5 rounded border transition-colors cursor-pointer ${getShiftColor(s.name)}`}
                                            onClick={() => {
                                                const newDuration = calculateDuration(s.startTime, s.endTime);
                                                setFormData({
                                                    ...formData,
                                                    scheduledStartTime: s.startTime,
                                                    scheduledEndTime: s.endTime,
                                                    scheduledDuration: newDuration > 0 ? (newDuration % 1 === 0 ? newDuration.toString() : newDuration.toFixed(2)) : formData.scheduledDuration
                                                });
                                            }}
                                        >
                                            <span className="text-xs font-bold">{s.name}</span>
                                            <span className="text-[10px] opacity-80">{s.startTime} - {s.endTime}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <label className="block text-sm font-medium text-gray-700 mb-2">Assignment Type</label>
                        {assignmentTypes.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {assignmentTypes.map((type) => (
                                    <button
                                        key={type.value}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, assignmentType: type.value })}
                                        className={`px-3 py-1 text-sm rounded-full border ${formData.assignmentType === type.value
                                            ? 'ring-2 ring-offset-1 ring-gray-400 font-semibold'
                                            : 'opacity-70 hover:opacity-100'
                                            }`}
                                        style={{
                                            backgroundColor: type.color,
                                            color: 'white',
                                            borderColor: type.color
                                        }}
                                    >
                                        {type.label}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded-lg">
                                No assignments available. Please create assignments in the Assignments management page.
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Start Time
                            </label>
                            <input
                                type="text"
                                value={formData.scheduledStartTime}
                                onChange={(e) => {
                                    const newStartTime = e.target.value;
                                    const newDuration = calculateDuration(newStartTime, formData.scheduledEndTime);
                                    setFormData({
                                        ...formData,
                                        scheduledStartTime: newStartTime,
                                        scheduledDuration: newDuration > 0 ? (newDuration % 1 === 0 ? newDuration.toString() : newDuration.toFixed(2)) : formData.scheduledDuration
                                    });
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                placeholder="e.g. 3PM"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                End Time
                            </label>
                            <input
                                type="text"
                                value={formData.scheduledEndTime}
                                onChange={(e) => {
                                    const newEndTime = e.target.value;
                                    const newDuration = calculateDuration(formData.scheduledStartTime, newEndTime);
                                    setFormData({
                                        ...formData,
                                        scheduledEndTime: newEndTime,
                                        scheduledDuration: newDuration > 0 ? (newDuration % 1 === 0 ? newDuration.toString() : newDuration.toFixed(2)) : formData.scheduledDuration
                                    });
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                placeholder="e.g. 12AM"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Duration (hours)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.scheduledDuration}
                                onChange={(e) => setFormData({ ...formData, scheduledDuration: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                placeholder="e.g. 8"
                            />
                            <div className="text-xs text-gray-500 mt-1">(auto-calculated)</div>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                        <input
                            type="text"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            placeholder="Optional notes"
                        />
                    </div>

                    <div className="flex justify-between pt-4 border-t">
                        <div className="flex gap-2">
                            {selectedCell?.existing && (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg border border-red-300"
                                >
                                    Delete
                                </button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </form>
            </Modal>

            {/* Shift Targets Modal */}
            <Modal
                isOpen={isShiftTargetsModalOpen}
                onClose={() => setIsShiftTargetsModalOpen(false)}
                title="Configure Shift Targets (Headcount)"
                maxWidth="4xl"
            >
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shift</th>
                                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                                    <th key={day} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {day.substring(0, 3)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {shifts.map(shift => (
                                <tr key={shift._id}>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {shift.name}
                                        <div className="text-xs text-gray-500 font-normal">
                                            {shift.startTime} - {shift.endTime}
                                        </div>
                                    </td>
                                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                                        const key = `${day}_${shift._id}`;
                                        return (
                                            <td key={day} className="px-2 py-2 text-center">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    className="w-16 text-center border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                    value={editingAllocations[key] || 0}
                                                    onChange={(e) => setEditingAllocations({
                                                        ...editingAllocations,
                                                        [key]: parseInt(e.target.value) || 0
                                                    })}
                                                />
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={() => setIsShiftTargetsModalOpen(false)}
                        className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSaveShiftAllocations}
                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                    >
                        Save Targets
                    </button>
                </div>
            </Modal>

            {/* Export iCal Modal */}
            <ExportICalModal
                isOpen={isExportICalModalOpen}
                onClose={() => setIsExportICalModalOpen(false)}
                initialStartDate={dateRange.startDate}
                initialEndDate={dateRange.endDate}
            />
        </div>
    );
};

export default SchedulesCalendarPage;

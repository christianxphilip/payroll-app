# Payroll App Updates v1.2

## Date: November 7, 2025

This document summarizes all bug fixes and new features implemented in this update.

---

## 1. Fixed Review Flag Filter Bug 🐛

**Issue:** When filtering timesheets by "All" (empty review flag), the system was showing only records where reviewFlag = false, instead of showing ALL records. This caused Leanard Nasol's 12 logs from the CSV to show only 6 in the "All" view.

**Root Cause:** The backend was checking `if (reviewFlag !== undefined)` but an empty string `''` is not undefined, so it was being treated as a filter value.

**Solution:** Updated the filter logic to check both for `undefined` AND empty string:
```javascript
if (reviewFlag !== undefined && reviewFlag !== '') {
  query.reviewFlag = reviewFlag === 'true';
}
```

**Files Modified:**
- `backend/src/routes/timesheetRoutes.js`

**Result:** Now "All" filter correctly shows all records regardless of review flag status.

---

## 2. Table Sorting Functionality ⬆️⬇️

**Feature:** Added clickable column headers with sort indicators to both Schedules and Timesheets tables.

### Backend Implementation
- Added `sortBy` and `sortOrder` query parameters to both routes
- Default sort for Timesheets: `date` (descending)
- Default sort for Schedules: `date` (ascending)
- Secondary sorting maintained for better data organization

**Sortable Columns:**

**Timesheets:**
- Employee Name
- Date
- Time In
- Time Out
- Hours Worked
- ND Hours
- Scheduled Hours
- Adjusted Hours Worked
- Review Flag

**Schedules:**
- Employee Name
- Date
- Start Time
- End Time
- Duration
- Status (ON/OFF)

### Frontend Implementation
- Clickable column headers with hover effects
- Sort indicators:
  - `⇅` - Column is sortable but not currently sorted
  - `↑` - Sorted ascending
  - `↓` - Sorted descending
- Clicking a sorted column toggles between ascending and descending
- Clicking a new column sorts by that column (ascending first)
- Pagination automatically resets to page 1 when sorting changes

**Files Modified:**
- `backend/src/routes/timesheetRoutes.js` - Added sorting logic
- `backend/src/routes/scheduleRoutes.js` - Added sorting logic
- `frontend/src/pages/TimesheetsPage.jsx` - Added sort UI and handlers
- `frontend/src/pages/SchedulesPage.jsx` - Added sort UI and handlers

---

## 3. Redesigned Timesheet Workflow 🔄

**Feature:** Improved user experience with a clearer workflow for adding timesheets and submitting for payroll.

### New Design

**Before:**
- Two separate buttons: "Upload CSV" and "Add Timesheet Log"
- Unclear workflow for submission

**After:**
1. **"Add Timesheet" Button** with dropdown menu containing:
   - **Upload CSV** - Bulk import attendance data
   - **Manual Entry** - Add individual time log

2. **"Submit Timesheet" Button** - Navigate to payroll report for consolidated data

### Features:
- **Dropdown Menu:** Provides clear options for different entry methods
- **Better Labels:** "Manual Entry" is more intuitive than "Add Timesheet Log"
- **Workflow Clarity:** Separate buttons for data entry vs. submission
- **Visual Feedback:** Dropdown shows helpful descriptions for each option

**Files Modified:**
- `frontend/src/pages/TimesheetsPage.jsx`

**User Flow:**
1. Click "Add Timesheet" → Dropdown opens
2. Choose "Upload CSV" or "Manual Entry"
3. Submit data → Returns to timesheet view
4. Review and adjust timesheets as needed
5. Click "Submit Timesheet" → Generate payroll report

---

## Summary of Changes

### Backend Files Modified:
1. `backend/src/routes/timesheetRoutes.js`
   - Fixed review flag filter bug
   - Added sorting functionality

2. `backend/src/routes/scheduleRoutes.js`
   - Added sorting functionality

### Frontend Files Modified:
1. `frontend/src/pages/TimesheetsPage.jsx`
   - Added sortable column headers
   - Implemented new workflow UI with dropdown menu
   - Updated modal names for clarity

2. `frontend/src/pages/SchedulesPage.jsx`
   - Added sortable column headers

---

## Testing Instructions

### 1. Test Review Flag Filter Fix
1. Upload `Attendance (hr.attendance) (7).csv`
2. Go to Timesheets page
3. Set "Review Flag" filter to "All"
4. Verify Leanard Nasol shows **12 records** (not just 6)
5. Filter by "Flagged" - should show flagged records only
6. Filter by "Not Flagged" - should show non-flagged records only

### 2. Test Sorting Functionality

**Timesheets:**
1. Go to Timesheets page
2. Click "Date" column header
   - First click: Sorts ascending (oldest first) ↑
   - Second click: Sorts descending (newest first) ↓
3. Click "Employee" column header
   - Sorts alphabetically A-Z ↑
4. Click "Hours Worked" column header
   - Sorts by hours (lowest to highest) ↑
5. Verify sort indicator shows on the active column
6. Verify pagination resets to page 1 when sorting changes

**Schedules:**
1. Go to Schedules page
2. Test sorting on various columns (Date, Employee, Duration, etc.)
3. Verify sort indicators work correctly

### 3. Test New Timesheet Workflow
1. Go to Timesheets page
2. Click "Add Timesheet" button
3. Verify dropdown menu appears with two options:
   - Upload CSV (with description)
   - Manual Entry (with description)
4. Click "Upload CSV"
   - Upload modal opens
   - Upload a file
   - Verify returns to timesheet view after successful upload
5. Click "Add Timesheet" → "Manual Entry"
   - Manual entry form opens
   - Add a time log
   - Verify returns to timesheet view after successful save
6. Click "Submit Timesheet"
   - Verify navigates to Payroll Report page

### 4. Test Dropdown Behavior
1. Click "Add Timesheet" - dropdown opens
2. Click "Add Timesheet" again - dropdown closes
3. Click outside dropdown - dropdown closes
4. Select an option - dropdown closes

---

## API Changes

### Timesheet Endpoint
**GET /api/timesheets**

New Query Parameters:
- `sortBy` (optional) - Column to sort by (default: `date`)
- `sortOrder` (optional) - Sort direction: `asc` or `desc` (default: `desc`)

Example:
```
GET /api/timesheets?sortBy=employeeName&sortOrder=asc&page=1&limit=50
```

### Schedule Endpoint
**GET /api/schedules**

New Query Parameters:
- `sortBy` (optional) - Column to sort by (default: `date`)
- `sortOrder` (optional) - Sort direction: `asc` or `desc` (default: `asc`)

Example:
```
GET /api/schedules?sortBy=scheduledDuration&sortOrder=desc&page=1&limit=50
```

---

## Technical Details

### Sort Implementation
The backend builds a dynamic sort object based on the `sortBy` and `sortOrder` parameters:

```javascript
const sortObj = {};
sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;
// Add secondary sorts
if (sortBy !== 'date') sortObj.date = -1;
if (sortBy !== 'employeeName') sortObj.employeeName = 1;
```

This ensures:
1. Primary sort by the selected column
2. Secondary sort by date (for consistency)
3. Tertiary sort by employee name (for consistency)

### Filter Logic
The filter now correctly handles empty strings:

```javascript
// Before (BUG)
if (reviewFlag !== undefined) {
  query.reviewFlag = reviewFlag === 'true';
}

// After (FIXED)
if (reviewFlag !== undefined && reviewFlag !== '') {
  query.reviewFlag = reviewFlag === 'true';
}
```

---

## Known Behaviors

1. **Sorting:**
   - Clicking the same column toggles between asc/desc
   - Clicking a new column starts with asc
   - Pagination resets when sort changes

2. **Dropdown Menu:**
   - Closes when an option is selected
   - Closes when clicking outside
   - Toggle with the "Add Timesheet" button

3. **Submit Timesheet:**
   - Navigates to Payroll Report page
   - Does not modify the timesheets (read-only navigation)

---

## Benefits

✅ **Bug Fix:** All timesheet records now visible in "All" filter  
✅ **Better Data Navigation:** Sort by any column for easier data review  
✅ **Improved UX:** Clearer workflow with dropdown menu  
✅ **Professional UI:** Visual sort indicators and hover effects  
✅ **Workflow Clarity:** Separate data entry from payroll submission  

---

## Notes

- All changes are backward compatible
- No database migrations required
- Backend has been restarted and is ready to use
- Frontend will automatically pick up changes on next page load/refresh
- Sort state persists during pagination but resets on page refresh


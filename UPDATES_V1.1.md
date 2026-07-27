# Payroll App Updates v1.1

## Date: November 7, 2025

This document summarizes all the improvements and bug fixes implemented in this update.

---

## 1. Fixed Review Flag Bug 🐛

**Issue:** Timesheet records with 0 hours or very short durations (like clock-in at 00:31:26 and clock-out at 00:31:41) were not being flagged for review.

**Solution:** Enhanced the `calculateReviewFlag` function to flag records when:
- Hours worked = 0
- Hours worked < 0.5 hours (30 minutes)

**File Modified:** `backend/src/services/calculationService.js`

---

## 2. Upsert Functionality for All Uploads ✨

**Feature:** Changed upload behavior from "skip duplicates" to "upsert" (insert new, update existing).

### Schedule CSV Upload
- When uploading a schedule CSV, existing records (same employee + same date) are now **updated** instead of skipped
- Response shows count of both inserted and updated records
- **File Modified:** `backend/src/routes/scheduleRoutes.js`

### Timesheet CSV Upload
- When uploading attendance CSV, existing records (same employee + date + timeIn + timeOut) are now **updated** instead of skipped
- Response shows count of created, updated, and errors
- **File Modified:** `backend/src/routes/timesheetRoutes.js`

**Benefits:**
- Re-uploading files with corrections will update the data
- No need to manually delete old records before re-uploading
- More flexible workflow for data management

---

## 3. Bulk Delete in Timesheets 🗑️

**Feature:** Added ability to select multiple timesheet records and delete them at once.

**Implementation:**
- Added "Delete Selected" button to the batch operations bar (appears when records are selected)
- Uses the existing checkbox selection system
- Shows confirmation dialog before deletion
- Displays success message with count of deleted records

**File Modified:** `frontend/src/pages/TimesheetsPage.jsx`

---

## 4. Pagination System 📄

**Feature:** Added pagination to both Schedules and Timesheets to handle large datasets efficiently.

### Backend Pagination
- **Timesheets:** Default 50 records per page, maximum 100
- **Schedules:** Default 50 records per page, maximum 100
- Returns pagination metadata: `page`, `limit`, `total`, `totalPages`, `hasMore`

**Files Modified:**
- `backend/src/routes/timesheetRoutes.js`
- `backend/src/routes/scheduleRoutes.js`

### Frontend Pagination
- Clean pagination controls at the bottom of tables
- Shows current page, total pages, and total records
- Previous/Next buttons with disabled states
- Page number buttons (up to 5 pages displayed)
- Responsive design (mobile and desktop views)
- Automatically resets to page 1 when filters are applied

**Files Modified:**
- `frontend/src/pages/TimesheetsPage.jsx`
- `frontend/src/pages/SchedulesPage.jsx`

**Benefits:**
- Faster page loads with large datasets
- Better performance and user experience
- Easier navigation through records

---

## Summary of Changes

### Backend Files Modified:
1. `backend/src/services/calculationService.js` - Fixed review flag logic
2. `backend/src/routes/scheduleRoutes.js` - Added upsert logic, pagination
3. `backend/src/routes/timesheetRoutes.js` - Added upsert logic, pagination

### Frontend Files Modified:
1. `frontend/src/pages/TimesheetsPage.jsx` - Added bulk delete, pagination
2. `frontend/src/pages/SchedulesPage.jsx` - Added pagination

---

## Testing Instructions

### 1. Test Review Flag Bug Fix
1. Upload the attendance CSV file `Attendance (hr.attendance) (7).csv`
2. Check the timesheets for Leanard Nasol on 2025-10-21 (00:31:26 to 00:31:41)
3. Verify this record is **flagged for review** (⚠ icon appears)

### 2. Test Upsert Functionality
1. Upload a schedule CSV file
2. Note the counts of inserted and updated records
3. Modify the same CSV file (change some hours)
4. Re-upload the file
5. Verify records are **updated** (not duplicated)

### 3. Test Bulk Delete
1. Go to Timesheets page
2. Select multiple records using checkboxes
3. Verify the batch operations bar appears
4. Click "Delete Selected" button
5. Confirm deletion
6. Verify selected records are deleted

### 4. Test Pagination
1. Ensure you have more than 50 records in timesheets or schedules
2. Verify pagination controls appear at the bottom
3. Click through different pages
4. Verify page numbers and record counts are correct
5. Apply filters and verify pagination resets to page 1

---

## Notes

- All changes are backward compatible
- No database migrations required
- Default pagination is 50 records per page (can be adjusted via API parameters)
- Backend has been restarted and is ready to use
- Frontend will automatically pick up changes on next page load/refresh

---

## Known Behaviors

1. **Upsert Logic:**
   - Schedules: Matches on `employeeName` + `date` (same day)
   - Timesheets: Matches on `employeeName` + `date` + `timeIn` + `timeOut` (exact match)

2. **Pagination:**
   - Default limit: 50 records
   - Maximum limit: 100 records
   - Can be customized via API query parameters: `?page=1&limit=50`

3. **Review Flags:**
   - Triggered when hours < 0.5 (30 minutes)
   - Triggered when hours > 8
   - Triggered when hours > scheduled hours
   - Triggered when timeIn or timeOut is missing


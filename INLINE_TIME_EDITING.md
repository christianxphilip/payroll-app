# Inline Time Editing Feature

## Overview

You can now **edit Time In and Time Out directly in the timesheet table**, and the system will **automatically recalculate** all related fields.

---

## How It Works

### Editable Fields
- ✅ **Time In** - Click to edit, shows time picker
- ✅ **Time Out** - Click to edit, shows time picker

### Auto-Calculated Fields
When you change Time In or Time Out, the system automatically recalculates:
- **Hours Worked** (with 1-hour break deduction if ≥ 7 hours)
- **ND Hours** (10 PM - 6 AM night differential)
- **Review Flag** (flags if hours = 0, hours > 8, or hours > scheduled)
- **Adjusted Hours Worked** (defaults to Hours Worked)

---

## How to Use

### Step 1: Edit Time
1. **Click on the Time In or Time Out field** in the table
2. A time picker appears
3. **Select the new time** (e.g., 1:30 PM)
4. **Click outside** the field or press Tab/Enter

### Step 2: Auto-Recalculation
- System shows: "Recalculating..."
- Backend recalculates all fields
- Table refreshes with updated values
- Success message: "Time updated and recalculated"

### Step 3: Review Changes
- Check the recalculated values
- **Hours Worked** should reflect the new time difference
- **ND Hours** should update if the shift overlaps 10 PM - 6 AM
- **Review Flag** (⚠) appears if needed

---

## Examples

### Example 1: Adjust Time In

**Original:**
- Time In: 8:43 PM
- Time Out: 5:02 AM
- Hours Worked: 7.32 hours

**Edit Time In to 12:43 PM:**
- Time In: **12:43 PM** ← Changed
- Time Out: 5:02 AM
- Hours Worked: **15.32 hours** ← Auto-recalculated
- Review Flag: ⚠ (flagged for > 8 hours)

### Example 2: Fix Overnight Shift

**Original:**
- Time In: 9:54 PM
- Time Out: 7:30 AM (next day)
- Hours Worked: 8.60 hours
- ND Hours: 1.51 hours

**Edit Time In to 1:54 PM:**
- Time In: **1:54 PM** ← Changed
- Time Out: 7:30 AM (next day)
- Hours Worked: **16.60 hours** ← Recalculated
- ND Hours: **7.50 hours** ← Recalculated (10 PM - 6 AM)
- Review Flag: ⚠ (flagged for > 8 hours)

### Example 3: Correct Time Out

**Original:**
- Time In: 2:00 PM
- Time Out: 11:00 PM
- Hours Worked: 8.00 hours

**Edit Time Out to 10:00 PM:**
- Time In: 2:00 PM
- Time Out: **10:00 PM** ← Changed
- Hours Worked: **8.00 hours** ← Still 8 hours (already max)
- No review flag

---

## UI Features

### Time Input Fields
- **Type:** Native HTML5 time picker
- **Format:** 12-hour or 24-hour (based on browser/OS)
- **Styling:** 
  - Small compact input (width: 24px)
  - Bordered with rounded corners
  - Changes on blur (when you click away)

### Visual Feedback
1. **During Edit:** Input field is active
2. **While Recalculating:** "Recalculating..." message
3. **After Success:** "Time updated and recalculated" message
4. **On Error:** Red error message with details

### Review Flags
After recalculation, the ⚠ icon appears if:
- Hours worked = 0 or < 30 minutes
- Hours worked > 8 hours
- Hours worked > scheduled hours

---

## Technical Details

### Frontend
**File:** `frontend/src/pages/TimesheetsPage.jsx`

**Function:** `handleTimeEdit(timesheet, field, newTimeValue)`
1. Takes the new time value (HH:MM format)
2. Combines with the existing date
3. Creates a full DateTime object
4. Sends to backend as ISO string
5. Refreshes data to show recalculated values

### Backend
**File:** `backend/src/routes/timesheetRoutes.js`

**Endpoint:** `PUT /api/timesheets/:id`
1. Receives the updated timeIn or timeOut
2. Merges with existing data
3. **Auto-triggers recalculation** when time fields change
4. Calls `calculateTimesheetFields()` service
5. Returns updated record with all recalculated fields

**Recalculation Service:** `backend/src/services/calculationService.js`
- Calculates actual duration
- Applies break deduction (1 hour if ≥ 7 hours)
- Calculates ND hours (10 PM - 6 AM)
- Looks up holiday status
- Looks up scheduled hours
- Sets review flag based on conditions

---

## Benefits

✅ **Fast Corrections** - Fix time entry errors quickly  
✅ **No Manual Math** - System recalculates automatically  
✅ **Accurate ND Hours** - Night differential updates correctly  
✅ **Immediate Feedback** - See results right away  
✅ **Error Detection** - Review flags appear automatically  
✅ **Audit Trail** - Changes are logged and tracked  

---

## Important Notes

### 1. Overnight Shifts
- When editing overnight shifts (e.g., 11 PM to 7 AM), the system correctly handles date boundaries
- ND hours are calculated for the correct overnight period

### 2. Break Deduction
- If Hours Worked ≥ 7 hours → System deducts 1 hour for break
- If Hours Worked < 7 hours → No break deduction

### 3. Review Flags
After editing, check the review flag (⚠):
- May need to manually approve extended hours
- May need to apply 8-hour cap
- Use "Approve Extended Hours" batch action if overtime is correct

### 4. Adjusted Hours Worked
- Defaults to calculated Hours Worked
- You can still manually edit this field separately if needed
- Manual adjustments are preserved unless you edit times again

---

## Workflow Example

### Scenario: Employee clocked in at wrong time

1. **Upload CSV** - Times are imported
2. **Notice error** - Time In shows 8:43 PM (should be 12:43 PM)
3. **Click Time In field** - Time picker appears
4. **Change to 12:43 PM** - Select correct time
5. **Click away** - System recalculates
6. **Review changes:**
   - Hours Worked updated
   - ND Hours recalculated
   - Review flag appears (if needed)
7. **Adjust if needed:**
   - Apply 8-hour cap if needed
   - Or approve extended hours
8. **Submit timesheet** - All corrections saved

---

## Keyboard Shortcuts

When focused on a time input:
- **Tab** - Move to next field (triggers save)
- **Shift+Tab** - Move to previous field (triggers save)
- **Arrow Up/Down** - Adjust time (when picker is open)
- **Esc** - Cancel edit (reverts to original value)

---

## Troubleshooting

**Issue:** Time picker doesn't appear
- **Fix:** Click directly on the time value, not the cell

**Issue:** Changes don't save
- **Fix:** Click outside the field to trigger blur event

**Issue:** Wrong calculations after edit
- **Fix:** Refresh the page and verify the data

**Issue:** Can't edit time
- **Fix:** Make sure you're not on a submitted/locked timesheet

---

## Status

- ✅ Inline editing for Time In implemented
- ✅ Inline editing for Time Out implemented
- ✅ Auto-recalculation working
- ✅ All fields update correctly
- ✅ Review flags update automatically
- ✅ No linter errors
- ✅ Ready to use!

**Refresh your browser to see the new feature!** 🎉


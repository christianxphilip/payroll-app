# Timesheet Module V2 - Two-Level Hierarchy

## Date: November 7, 2025

This document describes the completely restructured Timesheet Module with a two-level hierarchy system.

---

## Overview

The Timesheet Module now uses a **parent-child relationship** where:

1. **Timesheet Entries** (Parent/Container) - High-level payroll periods
2. **Time Logs** (Child/Detail) - Individual attendance records belonging to a timesheet entry

```
Timesheet Entry: "October 2025 - First Half"
├── Time Log: John Doe, Oct 1, 8:00 AM - 5:00 PM
├── Time Log: John Doe, Oct 2, 8:00 AM - 5:00 PM
├── Time Log: Jane Smith, Oct 1, 9:00 AM - 6:00 PM
└── ... more time logs
```

---

## Two-Level Structure

### Level 1: Timesheet Entries (Containers)

**Purpose:** Organize time logs into payroll periods

**Fields:**
- `name` - Descriptive name (e.g., "October 2025 Payroll")
- `payrollPeriod` - Period description (e.g., "October 1-15, 2025")
- `payPeriod` - Frequency (e.g., "Semi-Monthly", "Bi-Weekly")
- `startDate` - Period start date
- `endDate` - Period end date
- `status` - `draft`, `submitted`, or `approved`
- `notes` - Optional notes

**Route:** `/timesheet-entries`

**API Endpoints:**
- `GET /api/timesheet-entries` - List all entries
- `GET /api/timesheet-entries/:id` - Get single entry
- `POST /api/timesheet-entries` - Create new entry
- `PUT /api/timesheet-entries/:id` - Update entry
- `DELETE /api/timesheet-entries/:id` - Delete entry (only if no logs)
- `POST /api/timesheet-entries/:id/submit` - Submit for approval

### Level 2: Time Logs (Details)

**Purpose:** Individual attendance records for employees

**Fields:**
- `timesheetId` - Reference to parent Timesheet Entry
- `employeeName` - Employee name
- `date` - Date of attendance
- `timeIn` / `timeOut` - Clock in/out times
- `hoursWorked` - Calculated hours (with break deduction)
- `ndHours` - Night differential hours
- `scheduledHours` - Expected hours from schedule
- `adjustedHoursWorked` - Final approved hours
- `reviewFlag` - Needs review (yes/no)
- Plus other fields for holidays, OT, etc.

**Route:** `/timesheets/:timesheetId`

**API Endpoints:**
- `GET /api/timesheets?timesheetId=xxx` - Get logs for a timesheet
- `POST /api/timesheets` - Create individual log
- `POST /api/timesheets/upload-csv` - Bulk upload logs
- `PUT /api/timesheets/:id` - Update log
- `DELETE /api/timesheets/:id` - Delete log

---

## User Workflow

### Step 1: Create Timesheet Entry

1. Navigate to "Timesheets" in the nav bar
2. See list of existing timesheet entries (card view)
3. Click "Add Timesheet Entry"
4. Fill in form:
   - **Name:** "October 2025 Payroll - First Half"
   - **Payroll Period:** "October 1-15, 2025"
   - **Pay Period:** "Semi-Monthly"
   - **Start Date:** 2025-10-01
   - **End Date:** 2025-10-15
   - **Notes:** (optional)
5. Click "Create"

### Step 2: Add Time Logs

1. Click on a timesheet entry card to open it
2. See header with entry details and time log count
3. Click "Add Time Log" dropdown
4. Choose either:
   - **Upload CSV** - Bulk import from attendance system
   - **Manual Entry** - Add individual log

#### Option A: Upload CSV

1. Select "Upload CSV"
2. Choose file (format: Employee, Check In, Check Out)
3. Click "Upload"
4. System automatically:
   - Associates all logs with this timesheet entry
   - Calculates hours worked, ND hours, etc.
   - Flags records needing review
5. View uploaded logs in table

#### Option B: Manual Entry

1. Select "Manual Entry"
2. Fill form:
   - Employee (dropdown)
   - Date
   - Time In
   - Time Out
3. Click "Create"
4. System automatically calculates fields
5. New log appears in table

### Step 3: Review and Adjust

1. View all time logs in sortable, filterable table
2. Identify flagged records (⚠ icon)
3. Edit inline:
   - Click hours to adjust
   - Modify time in/out
4. Use batch operations:
   - Select multiple records
   - Apply 8-hour cap
   - Approve extended hours
   - Delete selected
5. Filter and sort as needed

### Step 4: Submit Timesheet

1. When all logs are reviewed and approved
2. Go back to timesheet entries list
3. Click "Submit" on the entry card
4. Confirms submission
5. Status changes from `draft` → `submitted`
6. Entry locked from further editing

---

## UI/UX Changes

### Timesheet Entries Page (`/timesheet-entries`)

**Layout:** Card Grid View

**Each Card Shows:**
- Entry name (large, bold)
- Status badge (Draft/Submitted/Approved)
- Payroll period
- Pay period
- Date range
- Time log count
- Notes (if any)
- Action buttons:
  - "Submit" (if draft)
  - "Delete" (if draft and no logs)

**Interaction:**
- Click card to open time logs
- Hover effect for better UX
- Color-coded status badges

### Time Logs Page (`/timesheets/:timesheetId`)

**Header:**
- Back button to entries list
- Entry info card showing:
  - Name, periods, date range
  - Total log count
  - Add Time Log dropdown button

**Main Content:**
- Filters (employee, date range, review flag)
- Sortable table with all columns
- Batch operation bar (when items selected)
- Pagination controls
- Inline editing

---

## Database Schema

### Timesheet (Collection: `timesheets`)

```javascript
{
  _id: ObjectId,
  name: String (required),
  payrollPeriod: String (required),
  payPeriod: String (required),
  startDate: Date (required),
  endDate: Date (required),
  status: String (enum: ['draft', 'submitted', 'approved'], default: 'draft'),
  isSubmitted: Boolean (default: false),
  submittedAt: Date,
  notes: String,
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

### TimesheetLog (Collection: `timesheetlogs`)

```javascript
{
  _id: ObjectId,
  timesheetId: ObjectId (ref: 'Timesheet', indexed),
  employeeName: String (required, indexed),
  date: Date (required, indexed),
  timeIn: Date,
  timeOut: Date,
  // ... all other fields from before
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

**Indexes:**
- `timesheetId` (for filtering logs by parent)
- `employeeName, date` (compound for duplicate detection)
- `reviewFlag`, `isSubmitted` (for filtering)

---

## API Examples

### Create Timesheet Entry

```http
POST /api/timesheet-entries
Content-Type: application/json

{
  "name": "October 2025 - First Half",
  "payrollPeriod": "October 1-15, 2025",
  "payPeriod": "Semi-Monthly",
  "startDate": "2025-10-01",
  "endDate": "2025-10-15",
  "notes": "First payroll of October"
}
```

### Get Time Logs for Entry

```http
GET /api/timesheets?timesheetId=67xxxxx&page=1&limit=50&sortBy=date&sortOrder=desc
```

### Upload CSV to Entry

```http
POST /api/timesheets/upload-csv
Content-Type: multipart/form-data

file: [CSV file]
timesheetId: 67xxxxx
```

### Submit Entry for Approval

```http
POST /api/timesheet-entries/67xxxxx/submit
```

---

## Frontend Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/timesheet-entries` | `TimesheetEntriesPage` | List of all timesheet entries |
| `/timesheets/:timesheetId` | `TimesheetsPage` | Time logs for specific entry |

**Navigation:**
- Main nav "Timesheets" → `/timesheet-entries`
- Click entry card → `/timesheets/:id`
- Back button → `/timesheet-entries`

---

## Key Features

### 1. Container-Based Organization

✅ Group logs by payroll period  
✅ Clear separation between different pay cycles  
✅ Easy to manage multiple active periods  

### 2. Flexible Data Entry

✅ Bulk upload via CSV  
✅ Manual single-entry form  
✅ Both methods link to parent entry automatically  

### 3. Review Workflow

✅ Draft → Review → Submit → Approve  
✅ Lock submitted entries from editing  
✅ Track submission dates  

### 4. Visual Hierarchy

✅ Card view for entries (high-level)  
✅ Table view for logs (detail-level)  
✅ Breadcrumbs for navigation  
✅ Clear parent-child relationship  

---

## Benefits

### For Users

1. **Better Organization:** Logs grouped by pay period
2. **Clearer Workflow:** Create entry → Add logs → Review → Submit
3. **Flexibility:** Upload CSV or add manually within same context
4. **Visual Clarity:** Card view makes it easy to see all pay periods
5. **Track Status:** Know which periods are draft vs submitted

### For System

1. **Data Isolation:** Logs isolated per timesheet entry
2. **Batch Operations:** Easy to submit entire pay period at once
3. **Audit Trail:** Track when entries were created/submitted
4. **Scalability:** Handle multiple concurrent pay periods
5. **Future Features:** Can add approval workflows, comments, etc.

---

## Migration Notes

### Existing Data

- Old time logs without `timesheetId` still work (field is optional)
- You can create a "Legacy" timesheet entry and migrate old logs
- Or continue using old logs for reporting

### Backward Compatibility

- API still supports filtering without `timesheetId`
- Old routes removed to enforce new workflow
- All calculations remain the same

---

## Testing Checklist

### Timesheet Entries

- [ ] Create new entry with all fields
- [ ] View list of entries in card grid
- [ ] Check status badges display correctly
- [ ] Edit entry (draft only)
- [ ] Delete entry (draft with no logs)
- [ ] Try to delete entry with logs (should fail)
- [ ] Submit entry for approval
- [ ] Verify status changes to submitted
- [ ] Check submitted entries are read-only

### Time Logs

- [ ] Navigate to entry's time logs
- [ ] Upload CSV with timesheetId
- [ ] Verify logs associated with entry
- [ ] Add manual time log
- [ ] Check calculated fields are correct
- [ ] Edit time log inline
- [ ] Filter logs by employee/date/review flag
- [ ] Sort by different columns
- [ ] Select multiple and batch delete
- [ ] Apply batch operations (cap, approve)
- [ ] Verify pagination works
- [ ] Check "Back" button returns to entries list

### Integration

- [ ] Upload CSV → logs link to entry
- [ ] Entry log count updates after adding logs
- [ ] Deleting log updates count
- [ ] Submit entry → locks all logs
- [ ] Nav "Timesheets" goes to entries list

---

## Troubleshooting

**Issue:** Can't see timesheet entry

- **Fix:** Make sure you created an entry first from `/timesheet-entries`

**Issue:** Time logs not appearing

- **Fix:** Check that `timesheetId` is being passed in API request

**Issue:** Can't edit submitted entry

- **Fix:** This is by design. Status must be `draft` to edit

**Issue:** Delete entry fails

- **Fix:** Delete all time logs first, then delete entry

---

## Future Enhancements

1. **Approval Workflow:** Manager approval before finalizing
2. **Comments:** Add comments to entries or logs
3. **Notifications:** Email when entry submitted/approved
4. **Templates:** Save common entry settings
5. **Bulk Operations:** Duplicate entry for next period
6. **Advanced Filtering:** Filter entries by date range/status
7. **Export:** Export entire entry with all logs

---

## Summary

The new two-level hierarchy provides:

**Level 1: Timesheet Entries**
- Card-based list view
- Create/manage pay periods
- Submit for approval
- Track status

**Level 2: Time Logs**
- Detail view for specific entry
- Upload CSV or manual entry
- Review and adjust
- Batch operations

This structure makes the timesheet workflow **clearer**, **more organized**, and **easier to manage** at scale!


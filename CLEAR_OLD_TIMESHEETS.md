# How to Clear Old Timesheet Records

## Problem
Old timesheet records were uploaded with the timezone bug and show incorrect times.

## Solution
You need to delete the old records and re-upload the CSV with the fixed parser.

---

## Method 1: Via UI (Recommended)

1. Go to the timesheet entry's time logs page
2. **Select all records** using the checkbox in the header
3. Click **"Delete Selected"** button in the blue bar
4. Confirm deletion
5. **Re-upload your CSV file**

---

## Method 2: Via API (Advanced)

If you have many records, you can use the API directly:

### Delete all logs for a specific timesheet entry:

```bash
# Get the timesheet entry ID from the URL
# Example URL: http://localhost:5173/timesheets/67xxxxx
# The ID is: 67xxxxx

# Then run this in your terminal:
curl -X DELETE "http://localhost:9001/api/timesheets/bulk-delete?timesheetId=YOUR_TIMESHEET_ID_HERE" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Method 3: Via MongoDB (If you have access)

```javascript
// Connect to MongoDB
use payroll_db

// Delete all timesheet logs for a specific timesheet entry
db.timesheetlogs.deleteMany({ timesheetId: ObjectId("YOUR_TIMESHEET_ID") })

// Or delete all logs for a specific employee
db.timesheetlogs.deleteMany({ employeeName: "Alyssa Dela Cruz" })

// Or delete all logs in a date range
db.timesheetlogs.deleteMany({ 
  date: { 
    $gte: ISODate("2025-10-01"), 
    $lte: ISODate("2025-10-31") 
  }
})
```

---

## After Deletion

1. **Re-upload your CSV file**
2. **Verify times are correct**:
   - Alyssa Dela Cruz (10/31): Should show **1:54 PM to 11:30 PM** ✅
   - Alyssa Dela Cruz (10/21): Should show **12:43 PM to 9:02 PM** ✅

---

## Why This Happened

- Old records were parsed with UTC timezone (before the fix)
- Database stores the incorrect Date objects
- The fix only applies to **new uploads**
- Existing records need to be deleted and re-uploaded

---

## Verification

After re-uploading, check that:
- ✅ Time In/Out match the CSV exactly
- ✅ Hours worked are calculated correctly
- ✅ Night differential hours are correct
- ✅ No more 8-hour offset


# Quick Start Guide

## Getting Started in 3 Steps

### 1. Start the Application
```bash
cd /Users/cpolidan/Documents/espro/payroll-app
./start.sh
```

### 2. Access the System
- Open your browser: **http://localhost:5174**
- Login with password: **admin123**

### 3. Set Up Your System

#### Step 1: Add Employees
1. Click "Employees" in the navigation
2. Click "Add Employee"
3. Enter employee names
4. Click "Add"

#### Step 2: Configure Holidays
1. Click "Holidays"
2. Add regular holidays (e.g., Christmas, New Year)
3. Add special holidays (e.g., Special Non-working days)

#### Step 3: Upload Schedules
1. Click "Schedules"
2. Click "Upload CSV"
3. Select your weekly schedule CSV file
4. Enter the year
5. Click "Upload"

**OR** manually add schedules:
1. Click "Add Schedule"
2. Select employee, date, times
3. Click "Add"

#### Step 4: Log Timesheets
1. Click "Timesheets"
2. Click "Add Timesheet Log"
3. Enter employee, date, time in, time out
4. System auto-calculates everything!

#### Step 5: Generate Payroll Report
1. Click "Payroll Report"
2. Select date range
3. Click "Generate Report"
4. Review consolidated hours
5. Export to CSV or Submit timesheets

## Key Features at a Glance

### Automatic Calculations
✓ Hours worked (with break deduction)  
✓ Night differential (10 PM - 6 AM)  
✓ Holiday detection  
✓ Overtime tracking  
✓ Review flagging  

### Batch Operations
✓ Apply 8-hour cap  
✓ Approve extended hours  
✓ Clear review flags  

### Reports
✓ Total consolidated hours  
✓ Night differential totals  
✓ Holiday days count  
✓ Overtime hours  
✓ CSV export  

## Common Tasks

### Add Multiple Employees Quickly
1. Go to Employees page
2. Keep clicking "Add Employee"
3. Enter name and save
4. Repeat

### Upload Weekly Schedule
Your CSV should look like:
```csv
,Weekly Shift Schedule,,Mon 11/10,Tue 11/11,...
,1,John Doe,3PM - 12AM,4PM - 1AM,...
,2,Jane Smith,OFF,4PM - 1AM,...
```

### Review Flagged Timesheets
1. Go to Timesheets
2. Filter by "Review Flag: Flagged"
3. Review highlighted rows (yellow background)
4. Either:
   - Adjust hours manually
   - Use batch operations
   - Clear review flag

### Generate Bi-weekly Report
1. Set Start Date: 2024-11-01
2. Set End Date: 2024-11-15
3. Click "Generate Report"
4. Export to CSV for payroll processing

## Troubleshooting

**Can't login?**
- Default password is: admin123
- Clear browser cache and try again

**CSV upload fails?**
- Check if employee names exist in system
- Verify CSV format matches example
- Try manual entry first

**Calculations look wrong?**
- Verify schedules are uploaded
- Check holiday configurations
- Review time entries

**Container won't start?**
- Stop: `docker-compose down`
- Start: `./start.sh`
- View logs: `docker-compose logs -f`

## Need Help?

- Read the full README.md for detailed documentation
- Check API endpoints in README.md
- View logs: `docker-compose logs -f backend`
- Restart: `docker-compose restart`

---

**Support**: Review the main README.md for comprehensive documentation.


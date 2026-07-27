# Payroll Timesheet System

A comprehensive web-based payroll and timesheet management system built with the MERN stack (MongoDB, Express, React, Node.js). This system automates timesheet calculations, manages employee schedules, tracks night differential hours, handles holidays, and generates consolidated payroll reports.

## Features

### Core Functionality
- **Employee Management**: Add, edit, and manage employee records
- **Holiday Management**: Configure regular and special holidays
- **Schedule Module**: 
  - Upload weekly schedules via CSV
  - Manual schedule entry with OFF day tracking
  - Automatic schedule duration calculation
- **Timesheet Management**:
  - Automated calculations (hours worked, night differential, breaks)
  - Holiday cross-reference
  - Schedule comparison for overtime validation
  - Review flag system for anomalies
  - Inline editing and batch operations
- **Payroll Consolidation**:
  - Generate comprehensive payroll reports
  - Export to CSV
  - Archive/submit timesheets
  - Overtime calculation based on scheduled hours

### Automated Calculations
- **Hours Worked**: Actual duration minus 1-hour break (if ≥7 hours)
- **Night Differential**: Calculates overlap between 10:00 PM - 6:00 AM
- **Holiday Detection**: Automatic flagging of regular and special holidays
- **Overtime**: Tracks hours exceeding scheduled hours
- **Review Flagging**: Auto-flags missing data or unusual hours

## Tech Stack

- **Backend**: Node.js + Express + MongoDB + Mongoose
- **Frontend**: React + Vite + TailwindCSS + React Router
- **Authentication**: JWT with simple password protection
- **File Processing**: PapaParse for CSV handling
- **Deployment**: Docker + Docker Compose

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development without Docker)
- MongoDB (if running without Docker)

## Quick Start

### Using Docker (Recommended)

1. **Clone or navigate to the project directory**:
   ```bash
   cd payroll-app
   ```

2. **Run the start script**:
   ```bash
   chmod +x start.sh
   ./start.sh
   ```

3. **Access the application**:
   - Frontend: http://localhost:5174
   - Backend API: http://localhost:9001
   - MongoDB: localhost:27020

4. **Default login password**: `admin123`

### Manual Setup (Without Docker)

#### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create .env file**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and configure:
   ```
   PORT=9001
   MONGODB_URI=mongodb://localhost:27017/payroll
   JWT_SECRET=your-secret-key
   AUTH_PASSWORD=admin123
   NODE_ENV=development
   ```

4. **Start MongoDB** (if not running)

5. **Start backend server**:
   ```bash
   npm start
   ```

#### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Access frontend**: http://localhost:5173

## Usage Guide

### 1. Initial Setup

1. **Login** with the default password (admin123)
2. **Add Employees**: Navigate to Employees page and add your staff
3. **Configure Holidays**: Add regular and special holidays
4. **Upload Schedules**: Use the Schedules page to upload CSV files or manually enter schedules

### 2. Schedule CSV Format

Your CSV file should follow this format:

```csv
,Weekly Shift Schedule,,Mon 11/10,Tue 11/11,Wed 11/12,...
,OPERATING HOURS,,3PM—12AM,3PM—12AM,3PM—12AM,...
,1,John Doe,3PM - 12AM,4PM - 1AM,OFF,...
,2,Jane Smith,4PM - 1AM,4PM - 1AM,4PM - 1AM,...
```

- Employee names should be in a consistent column
- Dates in headers (e.g., "Mon 11/10")
- Shift format: "3PM - 12AM" or "OFF"
- Notes can be marked with asterisks (*, **)

### 3. Timesheet Management

1. **Add Timesheet Logs**: Enter employee, date, time in, and time out
2. **Auto-calculations**: System automatically calculates:
   - Actual duration
   - Hours worked (with break deduction)
   - Night differential hours
   - Holiday status
   - Scheduled hours comparison
3. **Review Flagged Items**: Items with ⚠ require attention
4. **Batch Operations**:
   - **Apply 8-Hour Cap**: Limits adjusted hours to 8
   - **Approve Extended Hours**: Accepts overtime as-is
   - **Clear Review Flag**: Manually approve items

### 4. Payroll Reports

1. **Set Date Range**: Select the pay period
2. **Filter** (optional): Select specific employee
3. **Generate Report**: View consolidated summary
4. **Review Totals**:
   - Total consolidated hours
   - Night differential hours
   - Holiday days (regular/special)
   - Overtime hours
5. **Export to CSV**: Download for payroll processing
6. **Submit Timesheets**: Archives and locks records

## Calculation Rules

### Hours Worked
```
If actualDuration >= 7 hours:
  hoursWorked = actualDuration - 1 (break deduction)
Else:
  hoursWorked = actualDuration
```

### Night Differential
- Calculates overlap between work hours and 10:00 PM - 6:00 AM
- Handles overnight shifts correctly

### Scheduled Hours
- Lookup from Schedule module
- Returns 0 if marked as OFF or not found

### Overtime
```
If scheduledHours > 0 AND adjustedHoursWorked > scheduledHours:
  overtime = adjustedHoursWorked - scheduledHours
```

### Review Flag
Automatically set if:
- Time In missing
- Time Out missing
- hoursWorked > 8
- hoursWorked > scheduledHours

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with password
- `POST /api/auth/verify` - Verify token

### Employees
- `GET /api/employees` - List all employees
- `POST /api/employees` - Create employee
- `PUT /api/employees/:name` - Update employee
- `DELETE /api/employees/:name` - Delete employee

### Holidays
- `GET /api/holidays` - List holidays
- `POST /api/holidays` - Create holiday
- `POST /api/holidays/bulk` - Bulk create
- `PUT /api/holidays/:id` - Update holiday
- `DELETE /api/holidays/:id` - Delete holiday

### Schedules
- `GET /api/schedules` - List schedules
- `POST /api/schedules` - Create schedule
- `POST /api/schedules/bulk` - Bulk create
- `POST /api/schedules/upload-csv` - Upload CSV
- `PUT /api/schedules/:id` - Update schedule
- `DELETE /api/schedules/:id` - Delete schedule

### Timesheets
- `GET /api/timesheets` - List timesheet logs
- `POST /api/timesheets` - Create timesheet log
- `PUT /api/timesheets/:id` - Update timesheet log
- `DELETE /api/timesheets/:id` - Delete timesheet log
- `POST /api/timesheets/batch-adjust` - Batch adjust
- `POST /api/timesheets/submit` - Submit/archive
- `GET /api/timesheets/report` - Generate report

## Environment Variables

### Backend (.env)
```
PORT=9001
MONGODB_URI=mongodb://mongodb:27017/payroll
JWT_SECRET=your-super-secret-jwt-key-change-in-production
AUTH_PASSWORD=admin123
NODE_ENV=development
```

### Frontend
Set `VITE_API_URL` if backend is not at default location:
```
VITE_API_URL=http://your-backend-url:9001/api
```

## Docker Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Rebuild images
docker-compose build

# Remove volumes (WARNING: deletes data)
docker-compose down -v
```

## Development

### Backend Development
```bash
cd backend
npm install
npm run dev  # Uses nodemon for auto-reload
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev  # Vite dev server with HMR
```

## Project Structure

```
payroll-app/
├── backend/
│   ├── src/
│   │   ├── models/          # Mongoose models
│   │   ├── routes/          # Express routes
│   │   ├── middleware/      # Auth & error handling
│   │   ├── services/        # Business logic
│   │   └── server.js        # Entry point
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API services
│   │   ├── context/         # React context
│   │   ├── utils/           # Utilities
│   │   └── App.jsx          # Main app
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── start.sh
└── README.md
```

## Troubleshooting

### Cannot connect to backend
- Check if backend container is running: `docker ps`
- View backend logs: `docker-compose logs backend`
- Verify MongoDB is healthy: `docker-compose logs mongodb`

### CSV upload fails
- Ensure CSV format matches expected structure
- Check employee names exist in system
- Verify dates are in correct format (MM/DD)

### Calculations seem incorrect
- Verify schedules are uploaded for the period
- Check holiday configurations
- Review time in/out entries for accuracy

### Login doesn't work
- Verify JWT_SECRET is set in backend .env
- Check AUTH_PASSWORD matches in backend
- Clear browser localStorage and try again

## Security Notes

- Change default AUTH_PASSWORD in production
- Use strong JWT_SECRET (randomly generated)
- Consider implementing individual user accounts for production
- Enable HTTPS for production deployment
- Regularly backup MongoDB data

## License

ISC

## Support

For issues or questions, please check:
1. This README documentation
2. API endpoint documentation above
3. Console logs for error messages
4. Docker logs: `docker-compose logs -f`

---

**Version**: 1.0.0  
**Last Updated**: 2024


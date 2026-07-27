# Changelog

## [1.0.0] - 2024-11-07

### Initial Release

#### Features
- **Employee Management**: Full CRUD operations for employee records
- **Holiday Management**: Configure regular and special holidays
- **Schedule Module**: 
  - CSV upload parser for weekly schedules
  - Manual schedule entry interface
  - Support for OFF days and shift notes
- **Timesheet Management**:
  - Automated calculations (hours, breaks, ND, holidays)
  - Schedule cross-reference
  - Review flag system
  - Inline editing
  - Batch adjustment operations
- **Payroll Reports**:
  - Consolidated report generation
  - CSV export functionality
  - Timesheet submission/archival
  - Overtime calculations

#### Technical Implementation
- **Backend**: Node.js + Express + MongoDB
- **Frontend**: React + Vite + TailwindCSS
- **Authentication**: JWT-based simple password auth
- **Deployment**: Docker containerization
- **File Processing**: CSV parsing with PapaParse

#### Calculation Rules
- Hours Worked: Actual duration minus 1-hour break (if ≥7 hours)
- Night Differential: 10:00 PM - 6:00 AM overlap
- Overtime: Hours exceeding scheduled hours
- Review Flagging: Missing data or unusual hours

#### API Endpoints
- Authentication routes (login, verify)
- Employee CRUD operations
- Holiday CRUD operations
- Schedule CRUD and CSV upload
- Timesheet CRUD, batch operations, and reports

### Known Limitations
- Single password authentication (not multi-user)
- No role-based access control
- CSV format is specific to provided template
- No email notifications
- Manual backup required for data

### Future Enhancements (Potential)
- Multi-user authentication
- Role-based permissions
- Email notifications for flagged items
- Automatic schedule recurrence
- Mobile app
- Advanced reporting and analytics
- Integration with payroll systems
- Audit trail logging


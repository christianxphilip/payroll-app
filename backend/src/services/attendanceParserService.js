/**
 * Parse attendance/timesheet CSV file
 * Format: Employee, Check In, Check Out
 * Example: "Romel Aaron Querimit","2025-10-01 15:59:34","2025-10-02 00:31:10"
 */

/**
 * Parse attendance CSV data and return timesheet records
 */
export const parseAttendanceCSV = (csvData) => {
  const timesheets = [];
  
  console.log('=== Attendance CSV Parser Debug ===');
  console.log('CSV Data length:', csvData.length);
  
  if (!csvData || csvData.length < 2) {
    throw new Error('Invalid CSV format: insufficient rows');
  }
  
  // First row should be headers: Employee, Check In, Check Out
  const headers = csvData[0];
  console.log('Headers:', headers);
  
  // Find column indices
  let employeeCol = -1;
  let checkInCol = -1;
  let checkOutCol = -1;
  
  Object.keys(headers).forEach(key => {
    const header = String(headers[key]).toLowerCase().trim();
    if (header.includes('employee')) employeeCol = key;
    if (header.includes('check in') || header.includes('checkin')) checkInCol = key;
    if (header.includes('check out') || header.includes('checkout')) checkOutCol = key;
  });
  
  console.log('Column indices:', { employeeCol, checkInCol, checkOutCol });
  
  if (employeeCol === -1 || checkInCol === -1 || checkOutCol === -1) {
    throw new Error('CSV must have columns: Employee, Check In, Check Out');
  }
  
  // Parse data rows (skip header row)
  let validCount = 0;
  let errorCount = 0;
  
  for (let i = 1; i < csvData.length; i++) {
    const row = csvData[i];
    
    // Skip empty rows
    if (!row || Object.keys(row).length === 0) continue;
    
    const employeeName = row[employeeCol];
    const checkIn = row[checkInCol];
    const checkOut = row[checkOutCol];
    
    // Skip if any required field is missing
    if (!employeeName || !checkIn || !checkOut) {
      console.log(`Row ${i}: Missing data, skipping`);
      errorCount++;
      continue;
    }
    
    // Parse dates - treat as Philippines time (UTC+8)
    // Format: "2025-10-21 12:43:19" should be treated as Philippines local time
    const timeInStr = String(checkIn).trim();
    const timeOutStr = String(checkOut).trim();
    
    // Parse as Philippines time (UTC+8) and convert to UTC for storage
    const parsePhilippinesDateTime = (dateTimeStr) => {
      // Expected format: "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD HH:MM"
      const parts = dateTimeStr.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
      if (!parts) return new Date(dateTimeStr); // Fallback to default parsing
      
      const [, year, month, day, hour, minute, second = '0'] = parts;
      
      // Create ISO string with explicit timezone offset for Philippines (UTC+8)
      // This ensures the time is interpreted as Philippines time regardless of server timezone
      const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`;
      return new Date(isoString);
    };
    
    const timeIn = parsePhilippinesDateTime(timeInStr);
    const timeOut = parsePhilippinesDateTime(timeOutStr);
    
    // Validate dates
    if (isNaN(timeIn.getTime()) || isNaN(timeOut.getTime())) {
      console.log(`Row ${i}: Invalid date format for ${employeeName}`);
      console.log(`  Check In: ${timeInStr} -> ${timeIn}`);
      console.log(`  Check Out: ${timeOutStr} -> ${timeOut}`);
      errorCount++;
      continue;
    }
    
    // Extract date (without time) for the timesheet log
    const date = new Date(timeIn);
    date.setHours(0, 0, 0, 0);
    
    console.log(`Row ${i}: ${employeeName} - ${timeIn.toLocaleString()} to ${timeOut.toLocaleString()}`);
    
    timesheets.push({
      employeeName: employeeName.trim(),
      date: date,
      timeIn: timeIn,
      timeOut: timeOut
    });
    
    validCount++;
  }
  
  console.log(`Parsed ${validCount} valid records, ${errorCount} errors`);
  console.log('=== End Attendance Parser Debug ===');
  
  if (timesheets.length === 0) {
    throw new Error('No valid timesheet records found in CSV');
  }
  
  return timesheets;
};

/**
 * Validate timesheet records
 */
export const validateTimesheets = (timesheets) => {
  const errors = [];
  
  timesheets.forEach((timesheet, index) => {
    if (!timesheet.employeeName) {
      errors.push(`Record ${index + 1}: Missing employee name`);
    }
    if (!timesheet.date) {
      errors.push(`Record ${index + 1}: Missing date`);
    }
    if (!timesheet.timeIn) {
      errors.push(`Record ${index + 1}: Missing time in`);
    }
    if (!timesheet.timeOut) {
      errors.push(`Record ${index + 1}: Missing time out`);
    }
    
    // Check if timeOut is after timeIn
    if (timesheet.timeIn && timesheet.timeOut && timesheet.timeOut <= timesheet.timeIn) {
      // Allow overnight shifts where timeOut is the next day
      const timeDiff = timesheet.timeOut - timesheet.timeIn;
      if (timeDiff < 0) {
        errors.push(`Record ${index + 1}: Time out is before time in`);
      }
    }
  });
  
  return errors;
};


/**
 * Parse CSV schedule file and normalize into schedule records
 * Handles the staffing sheet format with employee names and shifts
 */

/**
 * Parse time string like "3PM" or "12AM" to 24-hour format hour
 */
const parseTimeString = (timeStr) => {
  if (!timeStr) return null;
  
  const match = timeStr.match(/(\d+)(AM|PM)/i);
  if (!match) return null;
  
  let hour = parseInt(match[1]);
  const period = match[2].toUpperCase();
  
  if (period === 'PM' && hour !== 12) {
    hour += 12;
  } else if (period === 'AM' && hour === 12) {
    hour = 0;
  }
  
  return hour;
};

/**
 * Parse shift string like "3PM - 12AM" or "OFF"
 * Returns { startTime, endTime, duration, isOff, notes }
 */
const parseShiftString = (shiftStr) => {
  if (!shiftStr || shiftStr.trim() === '') {
    return {
      startTime: null,
      endTime: null,
      duration: 0,
      isOff: true,
      notes: null
    };
  }
  
  const trimmed = shiftStr.trim();
  
  // Extract notes (markers like * or **)
  let notes = null;
  let cleanShift = trimmed;
  const noteMatch = trimmed.match(/(\*+)$/);
  if (noteMatch) {
    notes = noteMatch[1];
    cleanShift = trimmed.replace(/\*+$/, '').trim();
  }
  
  // Check for OFF
  if (cleanShift.toUpperCase() === 'OFF') {
    return {
      startTime: null,
      endTime: null,
      duration: 0,
      isOff: true,
      notes
    };
  }
  
  // Parse shift range like "3PM - 12AM"
  const shiftMatch = cleanShift.match(/(\d+[AP]M)\s*-\s*(\d+[AP]M)/i);
  if (!shiftMatch) {
    // Invalid format, treat as OFF
    return {
      startTime: null,
      endTime: null,
      duration: 0,
      isOff: true,
      notes
    };
  }
  
  const startTime = shiftMatch[1];
  const endTime = shiftMatch[2];
  
  // Calculate raw duration
  const startHour = parseTimeString(startTime);
  const endHour = parseTimeString(endTime);
  
  let rawDuration = 0;
  if (startHour !== null && endHour !== null) {
    if (endHour >= startHour) {
      rawDuration = endHour - startHour;
    } else {
      // Overnight shift (e.g., 6PM - 3AM = 9 hours)
      rawDuration = (24 - startHour) + endHour;
    }
  }
  
  // Apply break deduction: if >= 7.5 hours, subtract 1 hour for break
  let duration = rawDuration;
  if (rawDuration >= 7.5) {
    duration = rawDuration - 1;
  }
  
  return {
    startTime,
    endTime,
    duration, // This is now the payable hours (after break deduction)
    isOff: false,
    notes
  };
};

/**
 * Parse date string from column header
 * Formats like "Mon 11/10" or "11/10"
 */
const parseDateHeader = (headerStr, year = new Date().getFullYear()) => {
  if (!headerStr) return null;
  
  // Extract date pattern like "11/10"
  const dateMatch = headerStr.match(/(\d+)\/(\d+)/);
  if (!dateMatch) return null;
  
  const month = parseInt(dateMatch[1]) - 1; // JS months are 0-indexed
  const day = parseInt(dateMatch[2]);
  
  return new Date(year, month, day);
};

/**
 * Main parser function
 * Parses CSV data and returns array of schedule records
 */
export const parseScheduleCSV = (csvData, year = new Date().getFullYear()) => {
  const schedules = [];
  
  console.log('=== Schedule CSV Parser Debug ===');
  console.log('CSV Data length:', csvData.length);
  console.log('Year:', year);
  
  if (!csvData || csvData.length < 3) {
    throw new Error('Invalid CSV format: insufficient rows');
  }
  
  // Find the header row with dates
  let headerRow = null;
  let dataStartRow = 0;
  
  // Look for the row with date headers (more flexible search)
  for (let i = 0; i < Math.min(10, csvData.length); i++) {
    const row = csvData[i];
    console.log(`Row ${i}:`, Object.values(row).slice(0, 10));
    
    // Check if this row contains dates (look for pattern like "9/29" or "11/10")
    const dateCount = Object.values(row).filter(cell => 
      typeof cell === 'string' && /\d+\/\d+/.test(cell)
    ).length;
    
    if (dateCount >= 3) { // At least 3 date columns
      headerRow = row;
      dataStartRow = i + 1;
      console.log(`Found header row at index ${i} with ${dateCount} dates`);
      break;
    }
  }
  
  if (!headerRow) {
    throw new Error('Could not find date header row in CSV. Make sure dates are in format like "Mon 9/29"');
  }
  
  // Parse date columns - try all columns
  const dateColumns = [];
  const keys = Object.keys(headerRow);
  
  console.log('Parsing date columns...');
  keys.forEach(colKey => {
    const cellValue = headerRow[colKey];
    if (cellValue && typeof cellValue === 'string') {
      const date = parseDateHeader(cellValue, year);
      if (date && !isNaN(date.getTime())) {
        dateColumns.push({
          key: colKey,
          date,
          header: cellValue
        });
        console.log(`Column ${colKey}: "${cellValue}" -> ${date.toDateString()}`);
      }
    }
  });
  
  if (dateColumns.length === 0) {
    throw new Error('No valid date columns found. Expected format like "Mon 9/29" or "11/10"');
  }
  
  console.log(`Found ${dateColumns.length} date columns`);
  
  // Parse employee data rows
  let employeeCount = 0;
  for (let i = dataStartRow; i < csvData.length; i++) {
    const row = csvData[i];
    
    // Find employee name - check multiple columns more flexibly
    let employeeName = null;
    
    // Try columns 0-5 to find employee name
    for (let colIdx = 0; colIdx < 6; colIdx++) {
      const colKey = String(colIdx);
      if (row[colKey] && typeof row[colKey] === 'string') {
        const value = row[colKey].trim();
        // Skip if it's just a number, too short, or common header text
        // Also skip rows with mixed case that contain common header words
        const lowerValue = value.toLowerCase();
        const skipWords = [
          'operating', 'hours', 'weekly', 'schedule', 'assignment', 
          'bar', 'kitchen', 'flex', 'event', 'training', 'admin',
          'main bar', 'tentative', 'floor'
        ];
        const hasSkipWord = skipWords.some(word => lowerValue.includes(word));
        
        // Also skip if value is ALL CAPS (likely a header/assignment)
        const isAllCaps = value === value.toUpperCase() && /[A-Z]/.test(value);
        
        if (value && 
            !/^\d+$/.test(value) && 
            value.length > 2 && 
            !hasSkipWord &&
            !isAllCaps) { // Skip all-caps words
          employeeName = value;
          break;
        }
      }
    }
    
    if (!employeeName) {
      console.log(`Row ${i}: No employee name found, skipping`);
      continue;
    }
    
    employeeCount++;
    console.log(`Row ${i}: Found employee "${employeeName}"`);
    
    // Parse shifts for each date column
    let shiftsAdded = 0;
    dateColumns.forEach(({ key, date }) => {
      const shiftValue = row[key];
      
      if (shiftValue && typeof shiftValue === 'string' && shiftValue.trim()) {
        const parsed = parseShiftString(shiftValue);
        
        // Skip OFF days - don't insert them into the database
        if (!parsed.isOff) {
          schedules.push({
            employeeName,
            date: new Date(date), // Create new Date object
            scheduledStartTime: parsed.startTime,
            scheduledEndTime: parsed.endTime,
            scheduledDuration: parsed.duration,
            isOff: parsed.isOff,
            notes: parsed.notes
          });
          shiftsAdded++;
        } else {
          console.log(`  Skipping OFF day for ${employeeName} on ${date.toLocaleDateString()}`);
        }
      }
    });
    
    console.log(`  Added ${shiftsAdded} shifts for ${employeeName}`);
  }
  
  console.log(`Total: ${employeeCount} employees, ${schedules.length} schedule records`);
  console.log('=== End Parser Debug ===');
  
  if (schedules.length === 0) {
    throw new Error(`No valid schedules found. Parsed ${employeeCount} employees but no shifts were valid.`);
  }
  
  return schedules;
};

/**
 * Validate schedule records before inserting
 */
export const validateSchedules = (schedules) => {
  const errors = [];
  
  schedules.forEach((schedule, index) => {
    if (!schedule.employeeName) {
      errors.push(`Record ${index + 1}: Missing employee name`);
    }
    if (!schedule.date) {
      errors.push(`Record ${index + 1}: Missing date`);
    }
  });
  
  return errors;
};


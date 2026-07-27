/**
 * Format date to YYYY-MM-DD
 */
export const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

/**
 * Format datetime to local string
 */
export const formatDateTime = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleString();
};

/**
 * Format time to 12-hour format
 */
export const formatTime = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Format hours to 2 decimal places
 */
export const formatHours = (hours) => {
  if (hours === null || hours === undefined) return '0.00';
  return Number(hours).toFixed(2);
};

/**
 * Format money to 2 decimal places with thousands separator
 */
export const formatMoney = (value) => {
  if (value === null || value === undefined) return '0.00';
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

/**
 * Parse time input (e.g., "3:00 PM") to Date object for a given date
 */
export const parseTimeInput = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;
  
  const date = new Date(dateStr);
  const timeParts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  
  if (!timeParts) return null;
  
  let hours = parseInt(timeParts[1]);
  const minutes = parseInt(timeParts[2]);
  const period = timeParts[3].toUpperCase();
  
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }
  
  date.setHours(hours, minutes, 0, 0);
  return date;
};

/**
 * Download CSV file
 */
export const downloadCSV = (csvContent, filename = 'export.csv') => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};


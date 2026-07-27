import { AppError } from '../middleware/errorHandler.js';

const REGULAR_HOLIDAYS = [
  'new year',
  'maundy thursday',
  'good friday',
  'araw ng kagitingan',
  'day of valor',
  'labor day',
  'labour day',
  'independence day',
  'national heroes',
  'bonifacio',
  'christmas day',
  'rizal day',
  'eid\'l fitr',
  'eid\'l adha',
  'eid al-fitr',
  'eid al-adha'
];

/**
 * Classifies a holiday as Regular or Special according to Philippine Labor Code rules.
 */
export const classifyHoliday = (name) => {
  const lowerName = name.toLowerCase();
  for (const keyword of REGULAR_HOLIDAYS) {
    if (lowerName.includes(keyword)) {
      return 'Regular';
    }
  }
  return 'Special';
};

/**
 * Parses raw HTML string from Official Gazette for holidays.
 * Expected structure contains list items or paragraphs with dates and holiday names.
 */
function parseOfficialGazetteHTML(html, year) {
  const holidays = [];
  
  // Clean HTML a bit for easier regex matching
  const textContent = html.replace(/<[^>]*>/g, ' ');
  
  // Look for patterns like "January 1 – New Year's Day"
  const monthNames = 'January|February|March|April|May|June|July|August|September|October|November|December';
  const regex = new RegExp(`(${monthNames})\\s+(\\d{1,2})\\s*(?:,\\s*\\d{4})?\\s*[-–—:]\\s*([^\\n\\r]+)`, 'gi');
  
  let match;
  while ((match = regex.exec(textContent)) !== null) {
    const monthStr = match[1];
    const dayStr = match[2];
    const descriptionRaw = match[3].trim();
    
    // Parse description to clean up extra spacing and end boundaries
    const description = descriptionRaw.split(/[.;]/)[0].trim();
    
    const monthIndex = new Date(`${monthStr} 1, 2000`).getMonth();
    const date = new Date(Date.UTC(year, monthIndex, parseInt(dayStr)));
    
    holidays.push({
      date,
      description,
      type: classifyHoliday(description)
    });
  }
  
  return holidays;
}

/**
 * Fetches holidays for a specific year.
 * Attempts Official Gazette, and falls back to Nager.Date if blocked.
 */
export const fetchHolidaysFromExternal = async (year) => {
  console.log(`[Holiday Crawler] Initiating holiday fetch for year ${year}...`);
  
  try {
    const gazetteUrl = `https://www.officialgazette.gov.ph/nationwide-holidays/`;
    const response = await fetch(gazetteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    if (response.ok) {
      const html = await response.text();
      const parsedHolidays = parseOfficialGazetteHTML(html, year);
      
      if (parsedHolidays.length > 0) {
        console.log(`[Holiday Crawler] Successfully parsed ${parsedHolidays.length} holidays from Official Gazette.`);
        return parsedHolidays;
      }
      
      console.warn(`[Holiday Crawler] Fetch succeeded but parsed 0 holidays. Falling back to Nager.Date...`);
    } else {
      console.warn(`[Holiday Crawler] Official Gazette returned status ${response.status}. Falling back to Nager.Date...`);
    }
  } catch (error) {
    console.warn(`[Holiday Crawler] Failed to connect to Official Gazette: ${error.message}. Falling back to Nager.Date...`);
  }
  
  // Fallback to Nager.Date API
  try {
    const fallbackUrl = `https://date.nager.at/api/v3/PublicHolidays/${year}/PH`;
    console.log(`[Holiday Crawler] Fetching fallback from: ${fallbackUrl}`);
    
    const response = await fetch(fallbackUrl);
    if (!response.ok) {
      throw new AppError(`Fallback holiday source returned status ${response.status}`, response.status);
    }
    
    const data = await response.json();
    console.log(`[Holiday Crawler] Successfully fetched ${data.length} holidays from Nager.Date.`);
    
    return data.map(item => {
      // Create local date object interpreting the YYYY-MM-DD string
      const [y, m, d] = item.date.split('-').map(Number);
      // Construct UTC date for consistent storage
      const date = new Date(Date.UTC(y, m - 1, d));
      
      return {
        date,
        description: item.name,
        type: classifyHoliday(item.name)
      };
    });
  } catch (error) {
    console.error(`[Holiday Crawler] Fallback also failed:`, error);
    throw new AppError(`Failed to fetch holidays from both Official Gazette and Nager.Date fallback: ${error.message}`, 500);
  }
};

/**
 * Comprehensive Location Normalizer
 * Parses raw location strings from career pages and job boards into structured location metadata.
 */

export interface NormalizedLocation {
  country: string;
  stateProvince: string;
  city: string;
  metro: string;
  locationRaw: string;
  workMode: 'REMOTE' | 'HYBRID' | 'ONSITE';
  isRemote: boolean;
  formatted: string;
}

const HYDERABAD_SUB_AREAS = [
  'hyderabad',
  'secunderabad',
  'gachibowli',
  'hitec city',
  'hiteccity',
  'madhapur',
  'kondapur',
  'financial district',
  'nanakramguda',
  'telangana',
  'cyberabad',
  'jubilee hills',
  'banjara hills',
  'kukatpally',
  'begumpet',
];

const BANGALORE_SUB_AREAS = [
  'bengaluru',
  'bangalore',
  'whitefield',
  'electronic city',
  'electronics city',
  'koramangala',
  'indiranagar',
  'hsr layout',
  'hsr',
  'bellandur',
  'manyata',
  'marathahalli',
  'domlur',
  'jayanagar',
  'karnataka',
];

export function parseLocation(rawLoc?: string | null): NormalizedLocation {
  const raw = (rawLoc || '').trim();
  const lower = raw.toLowerCase();

  // Detect work mode
  let workMode: 'REMOTE' | 'HYBRID' | 'ONSITE' = 'ONSITE';
  let isRemote = false;

  if (
    lower.includes('remote') ||
    lower.includes('work from anywhere') ||
    lower.includes('wfh') ||
    lower.includes('anywhere')
  ) {
    if (lower.includes('hybrid') || lower.includes('flexible')) {
      workMode = 'HYBRID';
    } else {
      workMode = 'REMOTE';
      isRemote = true;
    }
  } else if (lower.includes('hybrid')) {
    workMode = 'HYBRID';
  }

  let country = 'India';
  let stateProvince = '';
  let city = '';
  let metro = '';

  // 1. Check Hyderabad / Telangana
  if (HYDERABAD_SUB_AREAS.some((sub) => lower.includes(sub))) {
    city = 'Hyderabad';
    stateProvince = 'Telangana';
    country = 'India';
    metro = 'Hyderabad Metro';
  }
  // 2. Check Bangalore / Karnataka
  else if (BANGALORE_SUB_AREAS.some((sub) => lower.includes(sub))) {
    city = 'Bengaluru';
    stateProvince = 'Karnataka';
    country = 'India';
    metro = 'Bengaluru Metro';
  }
  // 3. Pune / Maharashtra
  else if (lower.includes('pune') || lower.includes('yerawada') || lower.includes('hinjawadi') || lower.includes('magarpatta') || lower.includes('koregaon')) {
    city = 'Pune';
    stateProvince = 'Maharashtra';
    country = 'India';
    metro = 'Pune Metro';
  }
  // 4. Mumbai / Maharashtra
  else if (lower.includes('mumbai') || lower.includes('navi mumbai') || lower.includes('thane') || lower.includes('andheri') || lower.includes('bkc')) {
    city = 'Mumbai';
    stateProvince = 'Maharashtra';
    country = 'India';
    metro = 'Mumbai Metropolitan Region';
  }
  // 5. Gurugram / Gurgaon / Haryana
  else if (lower.includes('gurugram') || lower.includes('gurgaon') || lower.includes('cyber city') || lower.includes('manesar')) {
    city = 'Gurugram';
    stateProvince = 'Haryana';
    country = 'India';
    metro = 'Delhi NCR';
  }
  // 6. Delhi / NCR
  else if (lower.includes('delhi') || lower.includes('new delhi') || lower.includes('ncr')) {
    city = 'Delhi';
    stateProvince = 'National Capital Territory';
    country = 'India';
    metro = 'Delhi NCR';
  }
  // 7. Noida / UP
  else if (lower.includes('noida') || lower.includes('greater noida')) {
    city = 'Noida';
    stateProvince = 'Uttar Pradesh';
    country = 'India';
    metro = 'Delhi NCR';
  }
  // 8. Chennai / Tamil Nadu
  else if (lower.includes('chennai') || lower.includes('madras') || lower.includes('sholinganallur') || lower.includes('guindy')) {
    city = 'Chennai';
    stateProvince = 'Tamil Nadu';
    country = 'India';
    metro = 'Chennai Metro';
  }
  // 9. Kolkata / West Bengal
  else if (lower.includes('kolkata') || lower.includes('calcutta') || lower.includes('salt lake')) {
    city = 'Kolkata';
    stateProvince = 'West Bengal';
    country = 'India';
    metro = 'Kolkata Metro';
  }
  // 10. Ahmedabad / Gujarat
  else if (lower.includes('ahmedabad') || lower.includes('gandhinagar') || lower.includes('gift city')) {
    city = 'Ahmedabad';
    stateProvince = 'Gujarat';
    country = 'India';
    metro = 'Ahmedabad Metro';
  }
  // 11. Kerala / Kochi / Trivandrum
  else if (lower.includes('kochi') || lower.includes('cochin') || lower.includes('trivandrum') || lower.includes('thiruvananthapuram')) {
    city = lower.includes('kochi') ? 'Kochi' : 'Thiruvananthapuram';
    stateProvince = 'Kerala';
    country = 'India';
  }
  // 12. Jaipur / Rajasthan
  else if (lower.includes('jaipur')) {
    city = 'Jaipur';
    stateProvince = 'Rajasthan';
    country = 'India';
  }
  // 13. Singapore
  else if (lower.includes('singapore') || lower.includes('sg')) {
    city = 'Singapore';
    stateProvince = 'Singapore';
    country = 'Singapore';
    metro = 'Singapore';
  }
  // 14. US / Bay Area / New York / Boston
  else if (
    lower.includes('san francisco') ||
    lower.includes('san jose') ||
    lower.includes('sunnyvale') ||
    lower.includes('palo alto') ||
    lower.includes('mountain view') ||
    lower.includes('silicon valley') ||
    lower.includes('ca,') ||
    lower.includes('california')
  ) {
    city = lower.includes('san francisco') ? 'San Francisco' : 'Silicon Valley';
    stateProvince = 'California';
    country = 'United States';
    metro = 'San Francisco Bay Area';
  } else if (lower.includes('new york') || lower.includes('nyc') || lower.includes('ny,')) {
    city = 'New York';
    stateProvince = 'New York';
    country = 'United States';
    metro = 'New York Metropolitan';
  } else if (lower.includes('boston') || lower.includes('cambridge, ma') || lower.includes('ma,')) {
    city = 'Boston';
    stateProvince = 'Massachusetts';
    country = 'United States';
    metro = 'Greater Boston';
  } else if (lower.includes('usa') || lower.includes('united states')) {
    city = 'United States';
    country = 'United States';
  } else if (lower.includes('london') || lower.includes('uk') || lower.includes('united kingdom')) {
    city = 'London';
    country = 'United Kingdom';
  } else if (isRemote) {
    city = 'Remote';
    stateProvince = 'Remote';
    country = 'Global';
    metro = 'Remote';
  } else {
    // Unknown or custom
    city = raw.split(/[,|\/]/)[0]?.trim() || 'Undisclosed';
    stateProvince = raw.split(/[,|\/]/)[1]?.trim() || '';
  }

  const parts = [city, stateProvince, country].filter(Boolean);
  const formatted = parts.length > 0 ? parts.join(', ') : raw || 'Undisclosed Location';

  return {
    country,
    stateProvince,
    city,
    metro,
    locationRaw: raw || formatted,
    workMode,
    isRemote,
    formatted,
  };
}

export function isHyderabadJob(loc: NormalizedLocation | string): boolean {
  if (typeof loc === 'string') {
    const parsed = parseLocation(loc);
    return isHyderabadJob(parsed);
  }
  const target = `${loc.city} ${loc.stateProvince} ${loc.metro} ${loc.locationRaw}`.toLowerCase();
  return HYDERABAD_SUB_AREAS.some((sub) => target.includes(sub));
}

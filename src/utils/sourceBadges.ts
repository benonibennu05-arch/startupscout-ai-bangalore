export interface SourceBadgeInfo {
  label: string;
  sourceKey: 'BANGALORE' | 'HYDERABAD' | 'WHEREWEWORK' | 'FRONTLINES' | 'OFFICIAL_CAREERS';
  url: string;
  style: string;
  provenance: string;
}

export function getSourceBadge(item: {
  sourceMap?: string;
  sourceType?: string;
  sourceUrl?: string;
  discoveredViaSource?: string;
  applicationUrl?: string;
  location?: string;
  sources?: any[];
  companySources?: any[];
}): SourceBadgeInfo {
  const src = (item.sourceMap || item.sourceType || item.discoveredViaSource || '').toUpperCase();
  const url = item.sourceUrl || item.applicationUrl || '';
  const loc = (item.location || '').toLowerCase();

  // 1. WhereWeWork.co.in
  if (
    src.includes('WHEREWEWORK') ||
    url.includes('wherewework.co.in') ||
    item.discoveredViaSource === 'WHEREWEWORK' ||
    item.sources?.some((s: any) => (s.sourceMap || '').toUpperCase().includes('WHEREWEWORK'))
  ) {
    return {
      label: 'WhereWeWork.co.in',
      sourceKey: 'WHEREWEWORK',
      url: url && url.includes('wherewework.co.in') ? url : 'https://wherewework.co.in/',
      style: 'bg-emerald-50 text-emerald-800 border-emerald-300',
      provenance: 'WhereWeWork.co.in Job Board',
    };
  }

  // 2. Frontlines Media
  if (
    src.includes('FRONTLINES') ||
    url.includes('frontlinesmedia.in') ||
    item.discoveredViaSource?.includes('FRONTLINES') ||
    item.sources?.some((s: any) => (s.sourceMap || '').toUpperCase().includes('FRONTLINES'))
  ) {
    return {
      label: 'Frontlines Media (302 Directory)',
      sourceKey: 'FRONTLINES',
      url: url && url.includes('frontlinesmedia') ? url : 'https://frontlinesmedia.in/all-companies-career-pages-links/',
      style: 'bg-amber-50 text-amber-800 border-amber-300',
      provenance: item.discoveredViaSource?.includes('FRONTLINES')
        ? 'Discovered via Frontlines Media 302 Directory'
        : 'Frontlines Media 302 Directory',
    };
  }

  // 3. Official Company Career Portals
  if (
    src.includes('OFFICIAL') ||
    item.sourceType === 'OFFICIAL_CAREERS' ||
    item.discoveredViaSource === 'OFFICIAL_CAREERS' ||
    item.sources?.some((s: any) => (s.sourceMap || '').toUpperCase().includes('OFFICIAL'))
  ) {
    return {
      label: 'Official Career Portal',
      sourceKey: 'OFFICIAL_CAREERS',
      url: item.applicationUrl || item.sourceUrl || '#',
      style: 'bg-purple-50 text-purple-800 border-purple-300',
      provenance: item.discoveredViaSource
        ? `Discovered via ${item.discoveredViaSource}`
        : 'Official Company Career Page',
    };
  }

  // 4. Hyderabad Startup Map
  if (
    src.includes('HYDERABAD') ||
    url.includes('hyderabadstartupsmap.lol') ||
    loc.includes('hyderabad') ||
    item.sources?.some((s: any) => (s.sourceMap || '').toUpperCase().includes('HYDERABAD'))
  ) {
    return {
      label: 'Hyderabad Startup Map',
      sourceKey: 'HYDERABAD',
      url: url && url.includes('hyderabadstartupsmap.lol') ? url : 'https://www.hyderabadstartupsmap.lol',
      style: 'bg-indigo-50 text-indigo-800 border-indigo-300',
      provenance: 'Hyderabad Startup Map Directory',
    };
  }

  // 5. Default: Bangalore Startup Map
  return {
    label: 'Bangalore Startup Map',
    sourceKey: 'BANGALORE',
    url: url && url.includes('bangalorestartupmap.com') ? url : 'https://www.bangalorestartupmap.com',
    style: 'bg-blue-50 text-blue-800 border-blue-300',
    provenance: 'Bangalore Startup Map Directory',
  };
}

export function getAtsProvider(item: {
  atsProvider?: string;
  applicationUrl?: string;
  sourceUrl?: string;
}): string | null {
  if (item.atsProvider && item.atsProvider !== 'UNKNOWN' && item.atsProvider !== 'CUSTOM') {
    return item.atsProvider;
  }
  const url = (item.applicationUrl || item.sourceUrl || '').toLowerCase();
  if (url.includes('greenhouse.io') || url.includes('grnh.se')) return 'Greenhouse';
  if (url.includes('lever.co')) return 'Lever';
  if (url.includes('ashbyhq.com')) return 'Ashby';
  if (url.includes('workable.com')) return 'Workable';
  if (url.includes('bamboohr.com')) return 'BambooHR';
  if (url.includes('rippling-ats.com') || url.includes('rippling.com')) return 'Rippling';
  if (url.includes('myworkdayjobs.com') || url.includes('workday.com')) return 'Workday';
  if (url.includes('smartrecruiters.com')) return 'SmartRecruiters';
  if (url.includes('breezy.hr')) return 'Breezy HR';
  if (url.includes('recruitee.com')) return 'Recruitee';
  if (url.includes('taleo.net')) return 'Taleo';
  if (url.includes('jobvite.com')) return 'Jobvite';
  if (url.includes('keka.com')) return 'Keka Hire';
  return null;
}

export function getVerificationBadge(status?: string): {
  label: string;
  style: string;
  isVerified: boolean;
} {
  const norm = (status || 'UNVERIFIED').toUpperCase();
  if (norm === 'VERIFIED') {
    return {
      label: 'Verified Live',
      style: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      isVerified: true,
    };
  }
  if (norm === 'EXPIRED') {
    return {
      label: 'Expired',
      style: 'bg-rose-50 text-rose-700 border-rose-200',
      isVerified: false,
    };
  }
  if (norm === 'STALE') {
    return {
      label: 'Needs Recheck',
      style: 'bg-amber-50 text-amber-700 border-amber-200',
      isVerified: false,
    };
  }
  return {
    label: 'Unverified',
    style: 'bg-gray-50 text-gray-600 border-gray-200',
    isVerified: false,
  };
}

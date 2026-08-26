import * as cheerio from 'cheerio';
import { OpportunityType, ExperienceLevel, RemotePolicy, SourceType } from '../types.ts';
import { resolveUrl, isValidHttpUrl } from '../utils/url.ts';

export interface RawJobSnippet {
  title: string;
  location: string;
  description: string;
  applicationUrl: string;
  sourceUrl: string;
  sourceType: SourceType;
  department?: string;
  type?: OpportunityType;
}

export const ATS_DETECTION_RULES = [
  { name: 'Greenhouse', match: /boards\.greenhouse\.io\/([a-zA-Z0-9_-]+)/i, type: 'ATS_BOARD' as SourceType },
  { name: 'Lever', match: /jobs\.lever\.co\/([a-zA-Z0-9_-]+)/i, type: 'ATS_BOARD' as SourceType },
  { name: 'Ashby', match: /jobs\.ashbyhq\.com\/([a-zA-Z0-9_.-]+)/i, type: 'ATS_BOARD' as SourceType },
  { name: 'Workable', match: /apply\.workable\.com\/([a-zA-Z0-9_-]+)/i, type: 'ATS_BOARD' as SourceType },
  { name: 'SmartRecruiters', match: /smartrecruiters\.com\/([a-zA-Z0-9_-]+)/i, type: 'ATS_BOARD' as SourceType },
  { name: 'BreezyHR', match: /([a-zA-Z0-9_-]+)\.breezy\.hr/i, type: 'ATS_BOARD' as SourceType },
  { name: 'Recruitee', match: /([a-zA-Z0-9_-]+)\.recruitee\.com/i, type: 'ATS_BOARD' as SourceType },
  { name: 'Wellfound', match: /wellfound\.com\/company\/([a-zA-Z0-9_-]+)\/jobs/i, type: 'EXTERNAL_BOARD' as SourceType },
];

export const CAREER_PAGE_KEYWORDS = [
  'careers',
  'career',
  'jobs',
  'job openings',
  'open positions',
  'join us',
  'work with us',
  'hiring',
  'opportunities',
  'internship',
  'intern',
  'graduate',
  'fresher',
  'trainee',
];

export function detectAtsOrJobBoard(html: string, currentUrl: string): { name: string; url: string; type: SourceType } | null {
  const $ = cheerio.load(html);

  // Check iframe sources
  let found: { name: string; url: string; type: SourceType } | null = null;
  $('iframe[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    for (const rule of ATS_DETECTION_RULES) {
      if (rule.match.test(src)) {
        found = { name: rule.name, url: src, type: rule.type };
        return false;
      }
    }
  });

  if (found) return found;

  // Check link references
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    for (const rule of ATS_DETECTION_RULES) {
      if (rule.match.test(href)) {
        found = { name: rule.name, url: href, type: rule.type };
        return false;
      }
    }
  });

  return found;
}

export function extractJobSnippetsFromHtml(html: string, pageUrl: string, companyName: string): RawJobSnippet[] {
  const $ = cheerio.load(html);
  const snippets: RawJobSnippet[] = [];
  const seenTitles = new Set<string>();

  // 1. Structured JSON-LD JobPosting detection
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}');
      const items = Array.isArray(json) ? json : json['@graph'] || [json];
      for (const item of items) {
        if (item['@type'] === 'JobPosting' && item.title) {
          const title = String(item.title).trim();
          if (!seenTitles.has(title.toLowerCase())) {
            seenTitles.add(title.toLowerCase());
            snippets.push({
              title,
              location: item.jobLocation?.address?.addressLocality || 'Bangalore, India',
              description: typeof item.description === 'string' ? item.description.replace(/<[^>]*>?/gm, '').slice(0, 800) : `Job opening for ${title} at ${companyName}`,
              applicationUrl: item.url ? resolveUrl(pageUrl, item.url) : pageUrl,
              sourceUrl: pageUrl,
              sourceType: 'OFFICIAL_CAREERS',
              type: item.employmentType?.includes('INTERN') ? 'INTERNSHIP' : 'FULL_TIME',
            });
          }
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
  });

  if (snippets.length > 0) return snippets;

  // 2. DOM-based Job Listing cards
  const jobCardSelectors = [
    '.job-item', '.job-card', '.posting', '.opening', '.career-item',
    '[class*="job-item"]', '[class*="job-card"]', '[class*="position-card"]',
    'li[class*="job"]', 'div[class*="opening"]'
  ];

  $(jobCardSelectors.join(', ')).each((_, el) => {
    const card = $(el);
    const title = card.find('h2, h3, h4, .job-title, [class*="title"]').first().text().trim();
    const link = card.find('a[href]').first().attr('href');
    const loc = card.find('.location, [class*="location"]').first().text().trim() || 'Bangalore, India';
    const desc = card.text().replace(/\s+/g, ' ').trim().slice(0, 500);

    if (title && title.length >= 3 && title.length <= 80 && !seenTitles.has(title.toLowerCase())) {
      seenTitles.add(title.toLowerCase());
      snippets.push({
        title,
        location: loc,
        description: desc || `Opportunity for ${title} at ${companyName}`,
        applicationUrl: link ? resolveUrl(pageUrl, link) : pageUrl,
        sourceUrl: pageUrl,
        sourceType: 'OFFICIAL_CAREERS',
      });
    }
  });

  return snippets;
}

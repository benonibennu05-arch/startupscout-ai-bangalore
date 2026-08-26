import * as cheerio from 'cheerio';
import { Company } from '../types.ts';
import { normalizeUrl, resolveUrl, isValidHttpUrl } from '../utils/url.ts';

export interface ExtractedPersonnel {
  name: string;
  role: string;
  profileUrl: string | null;
}

export interface ExtractedCompanyData {
  name?: string;
  officialWebsite?: string | null;
  description?: string | null;
  sector?: string | null;
  category?: string | null;
  tags: string[];
  startupStage?: string | null;
  teamSize?: string | null;
  foundedYear?: number | null;
  linkedinUrl?: string | null;
  careersUrl?: string | null;
  jobBoardUrl?: string | null;
  personnel: ExtractedPersonnel[];
}

export function extractCompanyFromStartupMapPage(html: string, pageUrl: string): ExtractedCompanyData {
  const $ = cheerio.load(html);
  const data: ExtractedCompanyData = { tags: [], personnel: [] };

  // Title / Name
  const title = $('h1').first().text().trim() || $('meta[property="og:title"]').attr('content') || '';
  if (title) {
    data.name = title.replace(/\s*\|\s*Bangalore Startup Map.*/i, '').trim();
  }

  // Description
  const desc =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    $('.company-description, .description, p').first().text().trim();
  if (desc) {
    data.description = desc;
  }

  // Stage extraction (Seed, Series A, Series B, Bootstrapped, Growth, etc.)
  const pageText = $('body').text();
  const stageMatch = pageText.match(/(?:Stage|Funding Stage|Round)\s*[:\-]?\s*(Seed|Series\s+[A-F]|Bootstrapped|Early Stage|Growth|Public|Pre-Seed)/i);
  if (stageMatch && stageMatch[1]) {
    data.startupStage = stageMatch[1].trim();
  }

  // Founded Year
  const yearMatch = pageText.match(/(?:Founded|Est\.?|Established)\s*[:\-]?\s*(20\d\d|19\d\d)/i);
  if (yearMatch && yearMatch[1]) {
    data.foundedYear = parseInt(yearMatch[1], 10);
  }

  // Team Size
  const teamMatch = pageText.match(/(?:Team Size|Employees|Company Size)\s*[:\-]?\s*([0-9+\-kK\s]+(?:employees|people)?)/i);
  if (teamMatch && teamMatch[1]) {
    data.teamSize = teamMatch[1].trim();
  }

  // Website & External Links & Personnel links
  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    const lowerText = text.toLowerCase();

    // Check for Google search / LinkedIn personnel link (e.g. "Tanmai Gopal ↗" or "Tanmai Gopal LinkedIn")
    if (href.includes('google.com/search') && href.includes('LinkedIn')) {
      const cleanName = text.replace(/[\u2197\u2190-\u21FF\s]+/g, ' ').replace(/LinkedIn/gi, '').trim();
      if (cleanName && cleanName.length > 2 && cleanName.length < 50 && !data.personnel.some(p => p.name.toLowerCase() === cleanName.toLowerCase())) {
        data.personnel.push({
          name: cleanName,
          role: 'Founder / Key Personnel',
          profileUrl: `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(cleanName)}`,
        });
      }
    } else if (href.includes('linkedin.com/in/')) {
      const cleanName = text.replace(/[\u2197\u2190-\u21FF\s]+/g, ' ').trim();
      if (cleanName && cleanName.length > 2 && cleanName.length < 50 && !data.personnel.some(p => p.name.toLowerCase() === cleanName.toLowerCase())) {
        data.personnel.push({
          name: cleanName,
          role: 'Founder / Key Personnel',
          profileUrl: href,
        });
      }
    }

    if (href.startsWith('http')) {
      if (href.includes('linkedin.com/company')) {
        data.linkedinUrl = href;
      } else if (
        !href.includes('bangalorestartupmap') &&
        !href.includes('twitter.com') &&
        !href.includes('x.com') &&
        !href.includes('facebook.com') &&
        !href.includes('instagram.com') &&
        !href.includes('google.com') &&
        !data.officialWebsite &&
        isValidHttpUrl(href)
      ) {
        data.officialWebsite = normalizeUrl(href);
      }

      if (lowerText.includes('career') || lowerText.includes('job') || lowerText.includes('join') || lowerText.includes('we are hiring')) {
        data.careersUrl = resolveUrl(pageUrl, href);
      }
    }
  });

  // Sector / Tags
  $('.badge, .tag, .category, .sector, [class*="badge"], [class*="tag"]').each((_, el) => {
    const tag = $(el).text().trim();
    if (tag && tag.length < 40 && !data.tags.includes(tag) && !tag.toLowerCase().includes('bangalore')) {
      data.tags.push(tag);
    }
  });

  // Extract from "Tags: ..." text block if available
  const tagBlockMatch = pageText.match(/Tags\s*[:\-]\s*([^\n\r.]+)/i);
  if (tagBlockMatch && tagBlockMatch[1]) {
    const rawTags = tagBlockMatch[1].split(/[,|•/]/).map(t => t.trim()).filter(t => t.length > 1 && t.length < 35);
    for (const t of rawTags) {
      if (!data.tags.includes(t)) {
        data.tags.push(t);
      }
    }
  }

  return data;
}

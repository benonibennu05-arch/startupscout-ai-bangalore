import crypto from 'crypto';
import { CareerPlatformAdapter, ExtractedJob } from './careerPage.interface.ts';
import { parseLocation } from './careerLocationParser.ts';
import { classifyOpportunity } from './careerClassifier.ts';
import { logger } from '../../utils/logger.ts';

export class SmartRecruitersAdapter implements CareerPlatformAdapter {
  public name = 'SmartRecruiters';

  public matches(url: string, html?: string): boolean {
    const u = url.toLowerCase();
    if (u.includes('smartrecruiters.com')) return true;
    if (html && html.includes('smartrecruiters.com')) return true;
    return false;
  }

  public async extractJobs(
    companyName: string,
    careerUrl: string,
    html?: string
  ): Promise<{ jobs: ExtractedJob[]; error?: string; statusText?: string }> {
    try {
      let companySlug = '';
      const match = careerUrl.match(/smartrecruiters\.com\/([a-zA-Z0-9_\-]+)/i);
      if (match) companySlug = match[1];
      else if (html) {
        const hMatch = html.match(/smartrecruiters\.com\/([a-zA-Z0-9_\-]+)/i);
        if (hMatch) companySlug = hMatch[1];
      }

      if (!companySlug) {
        companySlug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
      }

      const apiUrl = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(companySlug)}/postings?limit=50`;
      const res = await fetch(apiUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        return { jobs: [], statusText: `SmartRecruiters API returned HTTP ${res.status}` };
      }

      const data = await res.json();
      const rawJobs = Array.isArray(data?.content) ? data.content : [];
      const jobs: ExtractedJob[] = [];

      for (const item of rawJobs) {
        const title = item.name || 'Untitled Role';
        const rawLoc = [item.location?.city, item.location?.region, item.location?.country].filter(Boolean).join(', ');
        const loc = parseLocation(rawLoc);
        const appUrl = `https://jobs.smartrecruiters.com/${companySlug}/${item.id}`;
        const classification = classifyOpportunity(title, item.department?.label || '');
        const contentHash = crypto.createHash('sha256').update(`${title}|${rawLoc}|${item.id}`).digest('hex');

        jobs.push({
          sourceJobId: item.id || String(Math.random()),
          title,
          description: `Department: ${item.department?.label || 'General'}. Location: ${rawLoc}`,
          department: item.department?.label,
          location: loc,
          applicationUrl: appUrl,
          sourceJobUrl: appUrl,
          classification,
          contentHash,
          sourcePublishedAt: item.releasedDate || null,
        });
      }

      return { jobs, statusText: `Discovered ${jobs.length} jobs via SmartRecruiters API` };
    } catch (err: any) {
      logger.warn(`[SmartRecruitersAdapter] Error extracting for ${companyName}: ${err.message}`);
      return { jobs: [], error: err.message };
    }
  }
}

export const smartRecruitersAdapter = new SmartRecruitersAdapter();

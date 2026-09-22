import crypto from 'crypto';
import { CareerPlatformAdapter, ExtractedJob } from './careerPage.interface.ts';
import { parseLocation } from './careerLocationParser.ts';
import { classifyOpportunity } from './careerClassifier.ts';
import { logger } from '../../utils/logger.ts';

export class AshbyAdapter implements CareerPlatformAdapter {
  public name = 'Ashby';

  public matches(url: string, html?: string): boolean {
    const u = url.toLowerCase();
    if (u.includes('ashbyhq.com') || u.includes('jobs.ashbyhq.com')) return true;
    if (html && (html.includes('ashbyhq.com') || html.includes('ashby-job-board'))) return true;
    return false;
  }

  public async extractJobs(
    companyName: string,
    careerUrl: string,
    html?: string
  ): Promise<{ jobs: ExtractedJob[]; error?: string; statusText?: string }> {
    try {
      let companySlug = '';
      const match = careerUrl.match(/ashbyhq\.com\/([a-zA-Z0-9_\-]+)/i);
      if (match) companySlug = match[1];
      else if (html) {
        const hMatch = html.match(/ashbyhq\.com\/([a-zA-Z0-9_\-]+)/i);
        if (hMatch) companySlug = hMatch[1];
      }

      if (!companySlug) {
        companySlug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
      }

      const apiUrl = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(companySlug)}`;
      const res = await fetch(apiUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        return { jobs: [], statusText: `Ashby API returned HTTP ${res.status}` };
      }

      const data = await res.json();
      const rawJobs = Array.isArray(data?.jobs) ? data.jobs : [];
      const jobs: ExtractedJob[] = [];

      for (const item of rawJobs) {
        const title = item.title || 'Untitled Role';
        const rawLoc = item.location || item.secondaryLocations?.join(', ') || '';
        const loc = parseLocation(rawLoc);
        const appUrl = item.jobUrl || `https://jobs.ashbyhq.com/${companySlug}/${item.id}`;
        const desc = item.descriptionPlain || item.descriptionHtml || '';
        const classification = classifyOpportunity(title, desc);
        const contentHash = crypto.createHash('sha256').update(`${title}|${rawLoc}|${item.id}`).digest('hex');

        jobs.push({
          sourceJobId: item.id || String(Math.random()),
          title,
          description: desc.slice(0, 1000).trim(),
          department: item.department,
          location: loc,
          applicationUrl: appUrl,
          sourceJobUrl: appUrl,
          classification,
          contentHash,
          sourcePublishedAt: item.publishedAt || null,
        });
      }

      return { jobs, statusText: `Discovered ${jobs.length} jobs via Ashby API` };
    } catch (err: any) {
      logger.warn(`[AshbyAdapter] Error extracting for ${companyName}: ${err.message}`);
      return { jobs: [], error: err.message };
    }
  }
}

export const ashbyAdapter = new AshbyAdapter();

import crypto from 'crypto';
import { CareerPlatformAdapter, ExtractedJob } from './careerPage.interface.ts';
import { parseLocation } from './careerLocationParser.ts';
import { classifyOpportunity } from './careerClassifier.ts';
import { logger } from '../../utils/logger.ts';

export class LeverAdapter implements CareerPlatformAdapter {
  public name = 'Lever';

  public matches(url: string, html?: string): boolean {
    const u = url.toLowerCase();
    if (u.includes('lever.co') || u.includes('jobs.lever.co')) return true;
    if (html && (html.includes('jobs.lever.co') || html.includes('lever-jobs-embed'))) return true;
    return false;
  }

  public async extractJobs(
    companyName: string,
    careerUrl: string,
    html?: string
  ): Promise<{ jobs: ExtractedJob[]; error?: string; statusText?: string }> {
    try {
      let site = '';
      const match = careerUrl.match(/jobs\.lever\.co\/([a-zA-Z0-9_\-]+)/i);
      if (match) {
        site = match[1];
      } else if (html) {
        const hMatch = html.match(/jobs\.lever\.co\/([a-zA-Z0-9_\-]+)/i);
        if (hMatch) site = hMatch[1];
      }

      if (!site) {
        site = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
      }

      // Public Lever JSON API: https://api.lever.co/v0/postings/{site}?mode=json
      const apiUrl = `https://api.lever.co/v0/postings/${encodeURIComponent(site)}?mode=json`;
      const res = await fetch(apiUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        return {
          jobs: [],
          statusText: `Lever API returned HTTP ${res.status} for site ${site}`,
        };
      }

      const data = await res.json();
      const rawJobs = Array.isArray(data) ? data : [];
      const jobs: ExtractedJob[] = [];

      for (const item of rawJobs) {
        const title = item.text || 'Untitled Role';
        const rawLoc = [item.categories?.location, item.categories?.workplaceType].filter(Boolean).join(' - ');
        const loc = parseLocation(rawLoc);
        const desc = item.descriptionPlain || item.description || '';
        const appUrl = item.hostedUrl || item.applyUrl || careerUrl;
        const classification = classifyOpportunity(title, desc);
        const contentHash = crypto.createHash('sha256').update(`${title}|${rawLoc}|${desc.slice(0, 300)}`).digest('hex');

        jobs.push({
          sourceJobId: item.id || String(Math.random()),
          title,
          description: desc.slice(0, 1000).trim(),
          department: item.categories?.department || item.categories?.team,
          location: loc,
          applicationUrl: appUrl,
          sourceJobUrl: appUrl,
          classification,
          contentHash,
          sourcePublishedAt: item.createdAt ? new Date(item.createdAt).toISOString() : null,
        });
      }

      return { jobs, statusText: `Discovered ${jobs.length} jobs via Lever API` };
    } catch (err: any) {
      logger.warn(`[LeverAdapter] Error extracting for ${companyName}: ${err.message}`);
      return { jobs: [], error: err.message };
    }
  }
}

export const leverAdapter = new LeverAdapter();

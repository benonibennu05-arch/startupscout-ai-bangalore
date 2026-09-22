import crypto from 'crypto';
import { CareerPlatformAdapter, ExtractedJob } from './careerPage.interface.ts';
import { parseLocation } from './careerLocationParser.ts';
import { classifyOpportunity } from './careerClassifier.ts';
import { logger } from '../../utils/logger.ts';

export class WorkdayAdapter implements CareerPlatformAdapter {
  public name = 'Workday';

  public matches(url: string, html?: string): boolean {
    const u = url.toLowerCase();
    if (u.includes('myworkdayjobs.com') || u.includes('/wday/cxs/')) return true;
    if (html && (html.includes('myworkdayjobs.com') || html.includes('workday.com/en-us/careers'))) return true;
    return false;
  }

  public async extractJobs(
    companyName: string,
    careerUrl: string,
    html?: string
  ): Promise<{ jobs: ExtractedJob[]; error?: string; statusText?: string }> {
    try {
      const u = careerUrl;
      const match = u.match(/https?:\/\/([a-zA-Z0-9_\-\.]+)\.myworkdayjobs\.com\/(?:[a-zA-Z\-]+\/)?([a-zA-Z0-9_\-]+)/i);
      if (!match) {
        return { jobs: [], statusText: 'Workday URL did not match standard tenant structure' };
      }

      const host = `${match[1]}.myworkdayjobs.com`;
      const tenant = match[1].split('.')[0];
      const site = match[2];

      const cxsUrl = `https://${host}/wday/cxs/${tenant}/${site}/jobs`;
      const res = await fetch(cxsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          appliedFacets: {},
          limit: 25,
          offset: 0,
          searchText: '',
        }),
        signal: AbortSignal.timeout(9000),
      });

      if (!res.ok) {
        return { jobs: [], statusText: `Workday CXS API returned HTTP ${res.status}` };
      }

      const data = await res.json();
      const jobPostings = Array.isArray(data?.jobPostings) ? data.jobPostings : [];
      const jobs: ExtractedJob[] = [];

      for (const jp of jobPostings) {
        const title = jp.title || 'Untitled Role';
        const rawLoc = jp.locationsText || '';
        const loc = parseLocation(rawLoc);
        const externalPath = jp.externalPath || '';
        const appUrl = `https://${host}/en-US/${site}${externalPath}`;
        const classification = classifyOpportunity(title, jp.bulletFields?.join(' ') || '');
        const contentHash = crypto.createHash('sha256').update(`${title}|${rawLoc}|${jp.bulletFields?.join('') || ''}`).digest('hex');

        jobs.push({
          sourceJobId: jp.bulletFields?.[0] || externalPath || String(Math.random()),
          title,
          description: jp.bulletFields?.join('\n') || title,
          location: loc,
          applicationUrl: appUrl,
          sourceJobUrl: appUrl,
          classification,
          contentHash,
          sourcePublishedAt: jp.postedOn || null,
        });
      }

      return { jobs, statusText: `Discovered ${jobs.length} jobs via Workday CXS API` };
    } catch (err: any) {
      logger.warn(`[WorkdayAdapter] Error extracting for ${companyName}: ${err.message}`);
      return { jobs: [], error: err.message };
    }
  }
}

export const workdayAdapter = new WorkdayAdapter();

import crypto from 'crypto';
import { CareerPlatformAdapter, ExtractedJob } from './careerPage.interface.ts';
import { parseLocation } from './careerLocationParser.ts';
import { classifyOpportunity } from './careerClassifier.ts';
import { logger } from '../../utils/logger.ts';

export class WorkableAdapter implements CareerPlatformAdapter {
  public name = 'Workable';

  public matches(url: string, html?: string): boolean {
    const u = url.toLowerCase();
    if (u.includes('apply.workable.com') || u.includes('workable.com')) return true;
    if (html && (html.includes('apply.workable.com') || html.includes('workable.com/j/'))) return true;
    return false;
  }

  public async extractJobs(
    companyName: string,
    careerUrl: string,
    html?: string
  ): Promise<{ jobs: ExtractedJob[]; error?: string; statusText?: string }> {
    try {
      let account = '';
      const match = careerUrl.match(/apply\.workable\.com\/([a-zA-Z0-9_\-]+)/i);
      if (match) {
        account = match[1];
      } else if (html) {
        const hMatch = html.match(/apply\.workable\.com\/([a-zA-Z0-9_\-]+)/i);
        if (hMatch) account = hMatch[1];
      }

      if (!account) {
        account = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      }

      const apiUrl = `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(account)}?details=true`;
      const res = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        return {
          jobs: [],
          error: `Workable API HTTP ${res.status}: ${res.statusText}`,
          statusText: `Failed with HTTP ${res.status}`,
        };
      }

      const data = await res.json();
      const rawJobs = Array.isArray(data?.jobs) ? data.jobs : [];

      const jobs: ExtractedJob[] = rawJobs.map((item: any) => {
        const title = item.title || 'Untitled Role';
        const locParts = [item.city, item.state, item.country].filter(Boolean);
        const loc = parseLocation(locParts.join(', '));
        if (item.telecommuting) {
          loc.isRemote = true;
          loc.workMode = 'REMOTE';
        }
        const desc = item.description || item.requirements || '';
        const appUrl = item.url || item.shortlink || `https://apply.workable.com/${account}/j/${item.shortcode}/`;
        const classification = classifyOpportunity(title, desc);
        const contentHash = crypto
          .createHash('sha256')
          .update(`${title}|${loc.formatted}|${item.shortcode || ''}`)
          .digest('hex');

        return {
          sourceJobId: item.shortcode || String(item.id || Math.random()),
          title,
          description: desc.replace(/<[^>]+>/g, ' ').slice(0, 1000).trim(),
          department: item.department,
          location: loc,
          applicationUrl: appUrl,
          sourceJobUrl: appUrl,
          classification,
          contentHash,
          sourcePublishedAt: item.published_on || null,
        };
      });

      return {
        jobs,
        statusText: `Discovered ${jobs.length} jobs via Workable API`,
      };
    } catch (err: any) {
      logger.warn(`[WorkableAdapter] Error extracting for ${companyName}: ${err.message}`);
      return {
        jobs: [],
        error: `Workable extraction failed: ${err.message}`,
        statusText: `Parse failed: ${err.message}`,
      };
    }
  }
}

export const workableAdapter = new WorkableAdapter();

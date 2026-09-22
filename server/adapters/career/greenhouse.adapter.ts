import crypto from 'crypto';
import { CareerPlatformAdapter, ExtractedJob } from './careerPage.interface.ts';
import { parseLocation } from './careerLocationParser.ts';
import { classifyOpportunity } from './careerClassifier.ts';
import { logger } from '../../utils/logger.ts';

export class GreenhouseAdapter implements CareerPlatformAdapter {
  public name = 'Greenhouse';

  public matches(url: string, html?: string): boolean {
    const u = url.toLowerCase();
    if (u.includes('greenhouse.io') || u.includes('boards.greenhouse')) return true;
    if (html && (html.includes('greenhouse.io') || html.includes('gh_src') || html.includes('grnhse_app'))) return true;
    return false;
  }

  public async extractJobs(
    companyName: string,
    careerUrl: string,
    html?: string
  ): Promise<{ jobs: ExtractedJob[]; error?: string; statusText?: string }> {
    try {
      // Determine board token from URL or HTML
      let token = '';
      const urlMatch = careerUrl.match(/greenhouse\.io\/(?:embed\/jobs\?for=|)([a-zA-Z0-9_\-]+)/i);
      if (urlMatch) {
        token = urlMatch[1];
      } else if (html) {
        const ghMatch = html.match(/boards\.greenhouse\.io\/(?:embed\/job_board\?for=|)([a-zA-Z0-9_\-]+)/i) ||
                        html.match(/greenhouse\.io\/([a-zA-Z0-9_\-]+)/i);
        if (ghMatch) token = ghMatch[1];
      }

      if (!token) {
        token = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
      }

      // Greenhouse provides a public REST JSON API for job boards:
      // https://api.greenhouse.io/v1/boards/{board_token}/jobs?content=true
      const apiUrl = `https://api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`;
      const res = await fetch(apiUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        return {
          jobs: [],
          statusText: `Greenhouse board API returned HTTP ${res.status} for token ${token}`,
        };
      }

      const data = await res.json();
      const rawJobs = Array.isArray(data?.jobs) ? data.jobs : [];
      const jobs: ExtractedJob[] = [];

      for (const item of rawJobs) {
        const title = item.title || 'Untitled Role';
        const rawLoc = item.location?.name || '';
        const loc = parseLocation(rawLoc);
        const desc = item.content || '';
        const appUrl = item.absolute_url || `${careerUrl}#${item.id}`;
        const classification = classifyOpportunity(title, desc);
        const contentHash = crypto.createHash('sha256').update(`${title}|${rawLoc}|${desc.slice(0, 300)}`).digest('hex');

        jobs.push({
          sourceJobId: String(item.id),
          title,
          description: desc.replace(/<[^>]+>/g, ' ').slice(0, 1000).trim(),
          department: item.departments?.[0]?.name,
          location: loc,
          applicationUrl: appUrl,
          sourceJobUrl: appUrl,
          classification,
          contentHash,
          sourcePublishedAt: item.updated_at || null,
        });
      }

      return { jobs, statusText: `Discovered ${jobs.length} jobs via Greenhouse API` };
    } catch (err: any) {
      logger.warn(`[GreenhouseAdapter] Error extracting for ${companyName}: ${err.message}`);
      return { jobs: [], error: err.message };
    }
  }
}

export const greenhouseAdapter = new GreenhouseAdapter();

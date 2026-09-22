import { CareerPlatformAdapter, ExtractedJob } from './careerPage.interface.ts';
import { greenhouseAdapter } from './greenhouse.adapter.ts';
import { leverAdapter } from './lever.adapter.ts';
import { workdayAdapter } from './workday.adapter.ts';
import { smartRecruitersAdapter } from './smartrecruiters.adapter.ts';
import { ashbyAdapter } from './ashby.adapter.ts';
import { workableAdapter } from './workable.adapter.ts';
import { genericCareerPageAdapter } from './genericCareerPage.adapter.ts';
import { logger } from '../../utils/logger.ts';

export class CareerPageService {
  private specializedAdapters: CareerPlatformAdapter[] = [
    greenhouseAdapter,
    leverAdapter,
    workdayAdapter,
    smartRecruitersAdapter,
    ashbyAdapter,
    workableAdapter,
  ];

  /**
   * Automatically detects the career platform and extracts all jobs and internships.
   */
  public async extractCareerPage(
    companyName: string,
    careerUrl: string
  ): Promise<{
    jobs: ExtractedJob[];
    platform: string;
    error?: string;
    statusText: string;
    success: boolean;
  }> {
    const cleanUrl = (careerUrl || '').trim();
    if (!cleanUrl.startsWith('http')) {
      return {
        jobs: [],
        platform: 'Unknown',
        error: `Invalid career URL: "${careerUrl}"`,
        statusText: 'Invalid URL',
        success: false,
      };
    }

    // Step 1: Check if URL directly matches a specialized ATS
    for (const adapter of this.specializedAdapters) {
      if (adapter.matches(cleanUrl)) {
        logger.info(`[CareerPageService] Detected ${adapter.name} via URL for ${companyName}`);
        const result = await adapter.extractJobs(companyName, cleanUrl);
        return {
          jobs: result.jobs,
          platform: adapter.name,
          error: result.error,
          statusText: result.statusText || `${result.jobs.length} jobs discovered via ${adapter.name}`,
          success: !result.error,
        };
      }
    }

    // Step 2: Fetch HTML page to inspect for platform markers, embedded ATS, and content
    let html = '';
    let httpStatus = 0;
    try {
      const res = await fetch(cleanUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(12000),
      });

      httpStatus = res.status;
      if (!res.ok) {
        return {
          jobs: [],
          platform: 'Custom',
          error: `HTTP ${res.status}: ${res.statusText}`,
          statusText: `Failed with HTTP ${res.status}`,
          success: false,
        };
      }
      html = await res.text();
    } catch (fetchErr: any) {
      return {
        jobs: [],
        platform: 'Custom',
        error: fetchErr.message || 'Connection failed',
        statusText: `Fetch failed: ${fetchErr.message}`,
        success: false,
      };
    }

    // Step 3: Check for embedded iframes or external links pointing to an ATS
    const iframeMatches = [...html.matchAll(/<iframe[^>]+src="([^"]+)"/gi)];
    for (const ifm of iframeMatches) {
      const iframeSrc = ifm[1].trim();
      for (const adapter of this.specializedAdapters) {
        if (adapter.matches(iframeSrc)) {
          logger.info(`[CareerPageService] Detected embedded iframe ${adapter.name} (${iframeSrc}) for ${companyName}`);
          const result = await adapter.extractJobs(companyName, iframeSrc);
          if (result.jobs.length > 0) {
            return {
              jobs: result.jobs,
              platform: adapter.name,
              statusText: result.statusText || `${result.jobs.length} jobs discovered via embedded ${adapter.name}`,
              success: true,
            };
          }
        }
      }
    }

    // Step 4: Check if page HTML contains specialized ATS signature
    for (const adapter of this.specializedAdapters) {
      if (adapter.matches(cleanUrl, html)) {
        logger.info(`[CareerPageService] Detected ${adapter.name} via HTML signature for ${companyName}`);
        const result = await adapter.extractJobs(companyName, cleanUrl, html);
        return {
          jobs: result.jobs,
          platform: adapter.name,
          error: result.error,
          statusText: result.statusText || `${result.jobs.length} jobs discovered via ${adapter.name}`,
          success: !result.error,
        };
      }
    }

    // Step 5: Fallback to generic career page adapter (JSON-LD, Next.js, semantic links)
    const genericResult = await genericCareerPageAdapter.extractJobs(companyName, cleanUrl, html);
    return {
      jobs: genericResult.jobs,
      platform: 'Custom / Semantic',
      error: genericResult.error,
      statusText: genericResult.statusText || `${genericResult.jobs.length} jobs discovered`,
      success: !genericResult.error,
    };
  }
}

export const careerPageService = new CareerPageService();

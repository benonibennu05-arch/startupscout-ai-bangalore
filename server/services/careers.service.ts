import * as cheerio from 'cheerio';
import { crawlerService } from './crawler.service.ts';
import { detectAtsOrJobBoard, CAREER_PAGE_KEYWORDS } from '../extractors/job.extractor.ts';
import { resolveUrl } from '../utils/url.ts';
import { logger } from '../utils/logger.ts';

export interface CareersDiscoveryResult {
  careersUrl: string | null;
  jobBoardUrl: string | null;
  atsProvider: string | null;
  sourceHtml: string | null;
}

export class CareersService {
  /**
   * Scans official website and well-known paths (/careers, /jobs, /join-us) to discover career portal and ATS
   */
  public async discoverCareersChannel(officialWebsite: string, timeoutMs = 8000): Promise<CareersDiscoveryResult> {
    const result: CareersDiscoveryResult = {
      careersUrl: null,
      jobBoardUrl: null,
      atsProvider: null,
      sourceHtml: null,
    };

    if (!officialWebsite || !officialWebsite.startsWith('http')) {
      return result;
    }

    try {
      // Step 1: Scan Homepage
      const homeHtml = await crawlerService.fetchHtml(officialWebsite, { timeoutMs });
      if (homeHtml) {
        result.sourceHtml = homeHtml;
        const ats = detectAtsOrJobBoard(homeHtml, officialWebsite);
        if (ats) {
          result.jobBoardUrl = ats.url;
          result.atsProvider = ats.name;
        }

        // Find career link in navigation/footer
        const $ = cheerio.load(homeHtml);
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href') || '';
          const text = $(el).text().toLowerCase().trim();

          for (const kw of CAREER_PAGE_KEYWORDS) {
            if (text === kw || text.includes(kw) || href.toLowerCase().includes(`/${kw}`)) {
              if (href.startsWith('http')) {
                result.careersUrl = href;
              } else if (href.startsWith('/')) {
                result.careersUrl = resolveUrl(officialWebsite, href);
              }
              break;
            }
          }
        });
      }

      // Step 2: If no career page was linked, probe standard candidate paths
      if (!result.careersUrl && !result.jobBoardUrl) {
        const candidatePaths = ['/careers', '/jobs', '/about/careers', '/join-us', '/open-positions'];
        for (const path of candidatePaths) {
          const testUrl = resolveUrl(officialWebsite, path);
          const probe = await crawlerService.fetchHtml(testUrl, { timeoutMs: 4000 });
          if (probe && (probe.toLowerCase().includes('position') || probe.toLowerCase().includes('openings') || probe.toLowerCase().includes('career'))) {
            result.careersUrl = testUrl;
            result.sourceHtml = probe;
            const ats = detectAtsOrJobBoard(probe, testUrl);
            if (ats) {
              result.jobBoardUrl = ats.url;
              result.atsProvider = ats.name;
            }
            break;
          }
        }
      }
    } catch (err: any) {
      logger.debug(`Careers discovery failed for ${officialWebsite}: ${err?.message}`);
    }

    return result;
  }
}

export const careersService = new CareersService();

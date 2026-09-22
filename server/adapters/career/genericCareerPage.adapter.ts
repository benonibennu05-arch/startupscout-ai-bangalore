import crypto from 'crypto';
import { CareerPlatformAdapter, ExtractedJob } from './careerPage.interface.ts';
import { parseLocation } from './careerLocationParser.ts';
import { classifyOpportunity } from './careerClassifier.ts';
import { logger } from '../../utils/logger.ts';

export class GenericCareerPageAdapter implements CareerPlatformAdapter {
  public name = 'GenericCareerPage';

  public matches(): boolean {
    return true; // Fallback adapter matches all
  }

  public async extractJobs(
    companyName: string,
    careerUrl: string,
    html?: string
  ): Promise<{ jobs: ExtractedJob[]; error?: string; statusText?: string }> {
    try {
      let pageHtml = html;
      if (!pageHtml) {
        const res = await fetch(careerUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          return {
            jobs: [],
            error: `Career page returned HTTP ${res.status}: ${res.statusText}`,
            statusText: `Failed with HTTP ${res.status}`,
          };
        }
        pageHtml = await res.text();
      }

      if (!pageHtml || pageHtml.trim().length === 0) {
        return {
          jobs: [],
          error: 'Career page returned empty response',
          statusText: 'Empty response',
        };
      }

      // Check for contact email explicitly mentioned in the career text
      let contactEmail: string | undefined;
      const emailMatch = pageHtml.match(/([a-zA-Z0-9._%+-]+@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})/i);
      if (emailMatch) {
        const found = emailMatch[1].toLowerCase();
        if (
          (found.includes('career') || found.includes('job') || found.includes('talent') || found.includes('hr') || found.includes('hire') || found.includes('join')) &&
          !found.includes('example.com') &&
          !found.includes('w3.org')
        ) {
          contactEmail = found;
        }
      }

      const jobs: ExtractedJob[] = [];
      const seenTitles = new Set<string>();

      // Strategy 1: JSON-LD Schema (JobPosting)
      const ldJsons = [...pageHtml.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
      for (const ld of ldJsons) {
        try {
          const parsed = JSON.parse(ld[1]);
          const postings: any[] = [];
          if (parsed['@type'] === 'JobPosting') postings.push(parsed);
          else if (Array.isArray(parsed['@graph'])) {
            postings.push(...parsed['@graph'].filter((g: any) => g['@type'] === 'JobPosting'));
          } else if (Array.isArray(parsed)) {
            postings.push(...parsed.filter((p: any) => p['@type'] === 'JobPosting'));
          }

          for (const jp of postings) {
            const title = jp.title || 'Untitled Role';
            if (seenTitles.has(title.toLowerCase())) continue;
            seenTitles.add(title.toLowerCase());

            const locRaw =
              jp.jobLocation?.address?.addressLocality ||
              jp.jobLocation?.address?.addressRegion ||
              jp.jobLocation?.address?.addressCountry ||
              jp.jobLocationType ||
              '';
            const loc = parseLocation(locRaw);
            const desc = jp.description || '';
            const appUrl = jp.url || careerUrl;
            const classification = classifyOpportunity(title, desc);
            const contentHash = crypto.createHash('sha256').update(`${title}|${locRaw}|${desc.slice(0, 200)}`).digest('hex');

            jobs.push({
              sourceJobId: jp.identifier?.value || jp.identifier || String(Math.random()),
              title,
              description: desc.replace(/<[^>]+>/g, ' ').slice(0, 1000).trim(),
              location: loc,
              applicationUrl: appUrl,
              sourceJobUrl: appUrl,
              classification,
              contentHash,
              sourcePublishedAt: jp.datePosted || null,
              contactEmail,
            });
          }
        } catch {
          // continue
        }
      }

      if (jobs.length > 0) {
        return { jobs, statusText: `Discovered ${jobs.length} jobs via JSON-LD schema` };
      }

      // Strategy 2: Next.js embedded data __NEXT_DATA__
      const nextDataMatch = pageHtml.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i);
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]);
          const props = nextData.props?.pageProps;
          const candidateLists = [props?.jobs, props?.openings, props?.positions, props?.careerList, props?.data?.jobs];
          for (const list of candidateLists) {
            if (Array.isArray(list) && list.length > 0) {
              for (const item of list) {
                const title = item.title || item.name || item.roleName;
                if (!title || seenTitles.has(title.toLowerCase())) continue;
                seenTitles.add(title.toLowerCase());

                const locRaw = item.location || item.city || item.country || '';
                const loc = parseLocation(locRaw);
                const desc = item.description || item.summary || '';
                const appUrl = item.url || item.applyUrl || `${careerUrl}#${item.id || ''}`;
                const classification = classifyOpportunity(title, desc);
                const contentHash = crypto.createHash('sha256').update(`${title}|${locRaw}|${desc.slice(0, 200)}`).digest('hex');

                jobs.push({
                  sourceJobId: String(item.id || Math.random()),
                  title,
                  description: desc.replace(/<[^>]+>/g, ' ').slice(0, 1000).trim(),
                  department: item.department,
                  location: loc,
                  applicationUrl: appUrl,
                  sourceJobUrl: appUrl,
                  classification,
                  contentHash,
                  sourcePublishedAt: item.createdAt || null,
                  contactEmail,
                });
              }
            }
          }
        } catch {
          // continue
        }
      }

      if (jobs.length > 0) {
        return { jobs, statusText: `Discovered ${jobs.length} jobs via Next.js state data` };
      }

      // Strategy 3: Semantic HTML Anchor Links to Job Detail Pages
      // Matches links like href="/careers/software-engineer", href="/jobs/123", href="/position/...", etc.
      const jobLinkRegex = /<a[^>]+href="([^"]*(?:\/jobs\/|\/careers\/|\/positions?\/|\/openings\/|\/apply\/)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      const anchorMatches = [...pageHtml.matchAll(jobLinkRegex)];

      for (const m of anchorMatches) {
        const rawHref = m[1];
        const linkText = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (
          !linkText ||
          linkText.length < 3 ||
          linkText.length > 120 ||
          linkText.toLowerCase() === 'apply now' ||
          linkText.toLowerCase() === 'view all' ||
          linkText.toLowerCase() === 'learn more' ||
          linkText.toLowerCase() === 'read more' ||
          linkText.toLowerCase().includes('privacy policy')
        ) {
          continue;
        }

        if (seenTitles.has(linkText.toLowerCase())) continue;
        seenTitles.add(linkText.toLowerCase());

        let fullUrl = rawHref;
        try {
          fullUrl = new URL(rawHref, careerUrl).toString();
        } catch {
          // fallback
        }

        const classification = classifyOpportunity(linkText, '');
        const loc = parseLocation('');
        const contentHash = crypto.createHash('sha256').update(`${linkText}|${fullUrl}`).digest('hex');

        jobs.push({
          sourceJobId: fullUrl,
          title: linkText,
          description: `Role at ${companyName}: ${linkText}. Source application portal: ${fullUrl}`,
          location: loc,
          applicationUrl: fullUrl,
          sourceJobUrl: fullUrl,
          classification,
          contentHash,
          contactEmail,
        });

        if (jobs.length >= 25) break; // Limit per page to prevent scraping menus
      }

      if (jobs.length > 0) {
        return { jobs, statusText: `Discovered ${jobs.length} jobs via HTML job links` };
      }

      // Check if the page contains a direct email application route
      if (contactEmail) {
        return {
          jobs: [],
          statusText: `Career page directs applicants to email: ${contactEmail}`,
        };
      }

      // Explicitly report why parsing returned 0 rather than saying fake "no jobs"
      return {
        jobs: [],
        statusText: 'No open positions listed on official career landing page',
      };
    } catch (err: any) {
      logger.warn(`[GenericCareerPageAdapter] Error extracting for ${companyName}: ${err.message}`);
      return {
        jobs: [],
        error: `Career page could not be parsed: ${err.message}`,
        statusText: `Parse failed: ${err.message}`,
      };
    }
  }
}

export const genericCareerPageAdapter = new GenericCareerPageAdapter();

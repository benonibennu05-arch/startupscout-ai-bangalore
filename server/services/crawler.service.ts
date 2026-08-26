import { isValidHttpUrl } from '../utils/url.ts';
import { logger } from '../utils/logger.ts';
import { domainLimiter } from '../utils/domainLimiter.ts';

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 StartupScoutAI/1.0';

export interface FetchOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  followRedirects?: boolean;
  maxRetries?: number;
}

export class CrawlerService {
  /**
   * Fetch HTML content with safety checks, domain-level rate limiting, fast 1-retry with backoff, and timeout
   */
  public async fetchHtml(url: string, options: FetchOptions = {}): Promise<string | null> {
    if (!isValidHttpUrl(url)) {
      return null;
    }

    const timeoutMs = Math.min(15000, options.timeoutMs ?? 10000);
    const maxRetries = options.maxRetries ?? 1;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const release = await domainLimiter.acquire(url);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          redirect: options.followRedirects !== false ? 'follow' : 'manual',
          headers: {
            'User-Agent': DEFAULT_USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            ...(options.headers || {}),
          },
        });

        clearTimeout(timeoutId);
        release();

        if (!response.ok) {
          if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
            continue;
          }
          return null;
        }

        const contentType = response.headers.get('content-type') || '';
        if (
          !contentType.includes('text/html') &&
          !contentType.includes('application/xhtml+xml') &&
          !contentType.includes('text/plain') &&
          !contentType.includes('application/xml') &&
          !contentType.includes('text/xml')
        ) {
          return null;
        }

        return await response.text();
      } catch (err: any) {
        clearTimeout(timeoutId);
        release();

        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        return null;
      }
    }

    return null;
  }

  /**
   * Fast HEAD / GET check to verify if a link is alive (200 / 300 series)
   */
  public async checkLinkStatus(url: string, timeoutMs = 6000): Promise<{ ok: boolean; status: number }> {
    if (!isValidHttpUrl(url)) {
      return { ok: false, status: 400 };
    }

    const release = await domainLimiter.acquire(url);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.min(10000, timeoutMs));

    try {
      const res = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: { 'User-Agent': DEFAULT_USER_AGENT },
      });
      clearTimeout(timeoutId);
      release();
      return { ok: res.ok, status: res.status };
    } catch {
      clearTimeout(timeoutId);
      release();

      // Fallback to quick GET
      const getRelease = await domainLimiter.acquire(url);
      const getController = new AbortController();
      const getTimeout = setTimeout(() => getController.abort(), Math.min(8000, timeoutMs));
      try {
        const res = await fetch(url, {
          method: 'GET',
          signal: getController.signal,
          headers: { 'User-Agent': DEFAULT_USER_AGENT },
        });
        clearTimeout(getTimeout);
        getRelease();
        return { ok: res.ok, status: res.status };
      } catch {
        clearTimeout(getTimeout);
        getRelease();
        return { ok: false, status: 500 };
      }
    }
  }
}

export const crawlerService = new CrawlerService();

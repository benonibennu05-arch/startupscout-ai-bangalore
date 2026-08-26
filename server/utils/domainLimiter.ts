/**
 * Domain-Level Concurrency Limiter
 * Ensures we do not send more than 2 concurrent requests to the same hostname/domain at once.
 */

class DomainRateLimiter {
  private activeCounts: Map<string, number> = new Map();
  private waitQueues: Map<string, Array<() => void>> = new Map();
  private readonly maxPerDomain: number;

  constructor(maxPerDomain = 2) {
    this.maxPerDomain = maxPerDomain;
  }

  private extractDomain(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname.toLowerCase();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Acquire a lock for the domain before firing an HTTP request
   */
  public async acquire(url: string): Promise<() => void> {
    const domain = this.extractDomain(url);
    const current = this.activeCounts.get(domain) || 0;

    if (current < this.maxPerDomain) {
      this.activeCounts.set(domain, current + 1);
      return () => this.release(domain);
    }

    // Queue request until an existing request to this domain completes
    return new Promise<() => void>((resolve) => {
      const queue = this.waitQueues.get(domain) || [];
      queue.push(() => {
        const active = this.activeCounts.get(domain) || 0;
        this.activeCounts.set(domain, active + 1);
        resolve(() => this.release(domain));
      });
      this.waitQueues.set(domain, queue);
    });
  }

  private release(domain: string) {
    const active = (this.activeCounts.get(domain) || 1) - 1;
    if (active <= 0) {
      this.activeCounts.delete(domain);
    } else {
      this.activeCounts.set(domain, active);
    }

    const queue = this.waitQueues.get(domain);
    if (queue && queue.length > 0) {
      const next = queue.shift();
      if (queue.length === 0) {
        this.waitQueues.delete(domain);
      }
      if (next) next();
    }
  }
}

export const domainLimiter = new DomainRateLimiter(2);

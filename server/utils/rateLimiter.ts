/**
 * Rate Limiter and Task Concurrency Pool
 */

export class RateLimiter {
  private queue: Array<() => void> = [];
  private activeCount = 0;
  private concurrency: number;
  private delayMs: number;

  constructor(concurrency = 2, delayMs = 600) {
    this.concurrency = concurrency;
    this.delayMs = delayMs;
  }

  public setConcurrency(concurrency: number) {
    this.concurrency = Math.max(1, concurrency);
  }

  public setDelayMs(delayMs: number) {
    this.delayMs = Math.max(0, delayMs);
  }

  public async schedule<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const execute = async () => {
        this.activeCount++;
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeCount--;
          if (this.delayMs > 0) {
            setTimeout(() => this.next(), this.delayMs);
          } else {
            this.next();
          }
        }
      };

      if (this.activeCount < this.concurrency) {
        execute();
      } else {
        this.queue.push(execute);
      }
    });
  }

  private next() {
    if (this.queue.length > 0 && this.activeCount < this.concurrency) {
      const task = this.queue.shift();
      if (task) task();
    }
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public getActiveCount(): number {
    return this.activeCount;
  }
}

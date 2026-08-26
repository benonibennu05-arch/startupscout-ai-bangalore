import { logger } from './logger.ts';

export interface RetryOptions {
  retries?: number;
  minTimeoutMs?: number;
  factor?: number;
  onRetry?: (error: any, attempt: number) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const retries = options.retries ?? 3;
  const minTimeoutMs = options.minTimeoutMs ?? 500;
  const factor = options.factor ?? 2;

  let attempt = 0;
  let delay = minTimeoutMs;

  while (true) {
    try {
      attempt++;
      return await fn();
    } catch (err: any) {
      if (attempt > retries) {
        throw err;
      }
      if (options.onRetry) {
        options.onRetry(err, attempt);
      } else {
        logger.warn(`Operation failed (attempt ${attempt}/${retries}): ${err?.message || err}. Retrying in ${delay}ms...`);
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= factor;
    }
  }
}

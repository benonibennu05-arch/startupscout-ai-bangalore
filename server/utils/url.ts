/**
 * URL sanitization and safety utilities
 */

const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254', // Cloud metadata
  'metadata.google.internal',
]);

export function isValidHttpUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTS.has(hostname)) {
      return false;
    }
    // Block private IP ranges (10.x, 192.168.x, 172.16-31.x)
    if (
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function normalizeUrl(rawUrl: string): string {
  try {
    let url = rawUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    const parsed = new URL(url);
    // Remove trailing slash from pathname if root, remove default ports
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return rawUrl.trim();
  }
}

export function extractDomain(urlString: string): string | null {
  try {
    const parsed = new URL(urlString.startsWith('http') ? urlString : `https://${urlString}`);
    return parsed.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return null;
  }
}

export function resolveUrl(base: string, relative: string): string {
  try {
    const resolved = new URL(relative, base);
    return resolved.toString();
  } catch {
    return relative;
  }
}

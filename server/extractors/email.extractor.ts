import * as cheerio from 'cheerio';
import { EmailType } from '../types.ts';

export interface ExtractedEmail {
  email: string;
  emailType: EmailType;
  sourceUrl: string;
  context?: string;
  name?: string | null;
  role?: string | null;
}

const EMAIL_REGEX = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

const IGNORED_DOMAINS = [
  'sentry.io',
  'wixpress.com',
  'example.com',
  'domain.com',
  'email.com',
  'github.com',
  'google.com',
  'schema.org',
  'w3.org',
  'png',
  'jpg',
];

const IGNORED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.css', '.js'];

export function classifyEmailType(email: string): EmailType {
  const lower = email.toLowerCase();
  if (lower.startsWith('career') || lower.startsWith('careers') || lower.includes('.careers@') || lower.includes('jobs@') || lower.includes('job@')) {
    return 'CAREERS';
  }
  if (lower.startsWith('campus') || lower.includes('university') || lower.includes('graduate@')) {
    return 'CAMPUS_HIRING';
  }
  if (lower.startsWith('recruiting') || lower.startsWith('recruit') || lower.includes('recruiter@')) {
    return 'RECRUITING';
  }
  if (lower.startsWith('talent') || lower.startsWith('hiring') || lower.includes('talentacquisition@')) {
    return 'TALENT';
  }
  if (lower.startsWith('hr') || lower.startsWith('people') || lower.includes('@hr.') || lower.includes('humanresources@')) {
    return 'HR';
  }
  if (lower.startsWith('founder') || lower.startsWith('ceo') || lower.startsWith('co-founder')) {
    return 'FOUNDER';
  }
  return 'GENERAL_CONTACT';
}

export function extractPublicEmailsFromHtml(html: string, sourceUrl: string): ExtractedEmail[] {
  const $ = cheerio.load(html);
  const found = new Map<string, ExtractedEmail>();

  // 1. Mailto links
  $('a[href^="mailto:"]').each((_, el) => {
    const rawHref = $(el).attr('href') || '';
    const clean = rawHref.replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
    if (isValidEmail(clean)) {
      const linkText = $(el).text().trim();
      const parentText = $(el).parent().text().trim();
      found.set(clean, {
        email: clean,
        emailType: classifyEmailType(clean),
        sourceUrl,
        context: linkText || parentText || 'mailto link',
      });
    }
  });

  // 2. Visible text scanning
  const text = $('body').text();
  const matches = text.match(EMAIL_REGEX) || [];

  for (const raw of matches) {
    const email = raw.toLowerCase().trim();
    if (isValidEmail(email) && !found.has(email)) {
      found.set(email, {
        email,
        emailType: classifyEmailType(email),
        sourceUrl,
        context: 'Page content',
      });
    }
  }

  return Array.from(found.values());
}

export function isValidEmail(email: string): boolean {
  if (!email || email.length < 5 || email.length > 80) return false;
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) return false;

  for (const ext of IGNORED_EXTENSIONS) {
    if (email.endsWith(ext)) return false;
  }

  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain || IGNORED_DOMAINS.includes(domain)) return false;

  return true;
}

import * as cheerio from 'cheerio';
import { EmailType, EmailSourceType, EmailVerificationStatus } from '../types.ts';

export interface ExtractedEmail {
  email: string; // Exact email, or "NOT PUBLICLY AVAILABLE"
  emailType: EmailType;
  domain: string | null;
  sourceUrl: string;
  sourceType: EmailSourceType;
  sourceTitle?: string | null;
  sourceText: string; // Verifiable context snippet
  evidenceFound: string; // Exact occurrence string in source
  confidence: number; // 0 to 100
  exactMatch: boolean;
  verificationStatus: EmailVerificationStatus;
  name?: string | null;
  role?: string | null;
  profileUrl?: string | null;
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
// Pattern for obfuscated emails: name [at] domain.com, name(at)domain.com, name @ domain.com
const OBFUSCATED_EMAIL_REGEX = /([a-zA-Z0-9._%+-]+)\s*(?:\[at\]|\(at\)|\bat\b|@)\s*([a-zA-Z0-9.-]+)\s*(?:\[dot\]|\(dot\)|\bdot\b|\.)\s*([a-zA-Z]{2,})/gi;

const IGNORED_DOMAINS = new Set([
  'sentry.io',
  'wixpress.com',
  'example.com',
  'domain.com',
  'email.com',
  'github.com',
  'google.com',
  'schema.org',
  'w3.org',
  'w3schools.com',
  'cloudflare.com',
  'facebook.com',
  'twitter.com',
  'instagram.com',
  'linkedin.com',
  'youtube.com',
  'gravatar.com',
  'fontawesome.com',
  'googleapis.com',
  'gstatic.com',
  'apple.com',
  'microsoft.com',
]);

const GENERIC_PUBLIC_PROVIDERS = new Set([
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'rediffmail.com',
  'protonmail.com',
  'zoho.com',
]);

const IGNORED_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.css',
  '.js',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
];

/**
 * Validates whether an email string is well-formed and not an asset/system artifact
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  if (clean.length < 5 || clean.length > 90) return false;
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(clean)) return false;

  for (const ext of IGNORED_EXTENSIONS) {
    if (clean.endsWith(ext)) return false;
  }

  const domain = clean.split('@')[1];
  if (!domain || IGNORED_DOMAINS.has(domain)) return false;

  // Ignore dummy placeholder emails
  if (
    clean.includes('user@') ||
    clean.includes('test@') ||
    clean.includes('yourname@') ||
    clean.includes('name@') ||
    clean.includes('someone@') ||
    clean.includes('sample@') ||
    clean.includes('demo@')
  ) {
    return false;
  }

  return true;
}

/**
 * Independent exact match check: verifies that the exact email string
 * exists in the source content (HTML or plain text) or inside a mailto tag.
 */
export function verifyExactMatchInSource(email: string, sourceContent: string): boolean {
  if (!email || !sourceContent) return false;
  const cleanEmail = email.trim().toLowerCase();
  const lowerSource = sourceContent.toLowerCase();

  if (lowerSource.includes(cleanEmail)) {
    return true;
  }
  if (lowerSource.includes(`mailto:${cleanEmail}`)) {
    return true;
  }

  // Also check obfuscated representation match
  const parts = cleanEmail.split('@');
  if (parts.length === 2) {
    const [user, domain] = parts;
    const domainPrefix = domain.split('.')[0];
    if (
      lowerSource.includes(`${user} [at] ${domain}`) ||
      lowerSource.includes(`${user}(at)${domain}`) ||
      lowerSource.includes(`${user} at ${domain}`) ||
      lowerSource.includes(`${user} [at] ${domainPrefix}`)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Classifies the role / inbox type based on the email username and surrounding context
 */
export function classifyEmailType(email: string, context = ''): EmailType {
  const lower = email.toLowerCase();
  const lowerContext = context.toLowerCase();

  if (
    lower.startsWith('career') ||
    lower.startsWith('careers') ||
    lower.includes('.careers@') ||
    lower.includes('jobs@') ||
    lower.includes('job@') ||
    lowerContext.includes('career inbox') ||
    lowerContext.includes('careers at')
  ) {
    return 'CAREERS';
  }
  if (
    lower.startsWith('talent') ||
    lower.startsWith('hiring') ||
    lower.startsWith('ta@') ||
    lower.includes('talentacquisition@') ||
    lowerContext.includes('talent acquisition')
  ) {
    return 'TALENT';
  }
  if (
    lower.startsWith('recruiting') ||
    lower.startsWith('recruit') ||
    lower.startsWith('recruiter') ||
    lower.includes('recruiting@') ||
    lowerContext.includes('recruiting team')
  ) {
    return 'RECRUITING';
  }
  if (
    lower.startsWith('campus') ||
    lower.startsWith('university') ||
    lower.startsWith('grad') ||
    lower.startsWith('graduate') ||
    lower.includes('earlytalent@') ||
    lowerContext.includes('campus hiring') ||
    lowerContext.includes('internship application')
  ) {
    return 'CAMPUS_HIRING';
  }
  if (
    lower.startsWith('hr') ||
    lower.startsWith('people') ||
    lower.startsWith('peopleops') ||
    lower.includes('@hr.') ||
    lower.includes('humanresources@') ||
    lowerContext.includes('human resources')
  ) {
    return 'HR';
  }
  if (
    lower.startsWith('founder') ||
    lower.startsWith('founders') ||
    lower.startsWith('ceo@') ||
    lower.startsWith('cto@') ||
    lower.startsWith('leadership') ||
    lowerContext.includes('co-founder') ||
    lowerContext.includes('chief executive')
  ) {
    return 'FOUNDER';
  }
  if (
    lower.startsWith('contact') ||
    lower.startsWith('hello') ||
    lower.startsWith('info') ||
    lower.startsWith('hi@') ||
    lower.startsWith('support')
  ) {
    return 'GENERAL_COMPANY';
  }

  return 'GENERAL_CONTACT';
}

/**
 * Calculates a 0-100 quality confidence score based on source type and domain context
 */
export function calculateSourceQualityScore(
  sourceType: EmailSourceType,
  email: string,
  officialDomain?: string | null,
  hasExactMatch = true
): number {
  if (!hasExactMatch) return 0;

  let baseScore = 70;
  switch (sourceType) {
    case 'OFFICIAL_CAREERS_PAGE':
      baseScore = 100;
      break;
    case 'OFFICIAL_JOB_POSTING':
      baseScore = 95;
      break;
    case 'OFFICIAL_CONTACT_PAGE':
      baseScore = 90;
      break;
    case 'OFFICIAL_COMPANY_PAGE':
      baseScore = 85;
      break;
    case 'OFFICIAL_TEAM_PAGE':
      baseScore = 80;
      break;
    case 'PUBLIC_PROFESSIONAL_PROFILE':
      baseScore = 70;
      break;
    case 'PUBLIC_JOB_BOARD':
      baseScore = 50;
      break;
    case 'MAILTO':
      baseScore = 90;
      break;
    default:
      baseScore = 60;
  }

  const emailDomain = email.split('@')[1]?.toLowerCase();
  if (emailDomain) {
    if (GENERIC_PUBLIC_PROVIDERS.has(emailDomain)) {
      // Generic public email on company page (e.g. startup founders using gmail)
      baseScore = Math.min(baseScore - 15, 65);
    } else if (officialDomain) {
      const cleanOfficial = officialDomain
        .replace(/^https?:\/\//i, '')
        .replace(/^www\./i, '')
        .split('/')[0]
        .toLowerCase();
      if (emailDomain === cleanOfficial || emailDomain.endsWith(`.${cleanOfficial}`)) {
        baseScore = Math.min(baseScore + 5, 100);
      }
    }
  }

  return Math.max(0, Math.min(100, baseScore));
}

/**
 * Extracts verifiable surrounding context snippet (40-160 chars)
 */
function extractContextSnippet(fullText: string, searchTarget: string): string {
  const lowerText = fullText.toLowerCase();
  const lowerTarget = searchTarget.toLowerCase();
  const idx = lowerText.indexOf(lowerTarget);
  if (idx === -1) {
    return `Found on source page (${searchTarget})`;
  }

  const start = Math.max(0, idx - 70);
  const end = Math.min(fullText.length, idx + searchTarget.length + 70);
  let snippet = fullText.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < fullText.length) snippet = snippet + '...';
  return snippet;
}

/**
 * Main public email extractor with exact evidence collection
 */
export function extractPublicEmailsFromHtml(
  html: string,
  sourceUrl: string,
  officialWebsite?: string | null,
  inferredSourceType?: EmailSourceType
): ExtractedEmail[] {
  if (!html || typeof html !== 'string') return [];

  const $ = cheerio.load(html);
  const pageTitle = $('title').text().trim() || null;
  const pageText = $('body').text() || '';
  const results = new Map<string, ExtractedEmail>();

  // Determine default source type from URL or parameter
  let defaultSourceType: EmailSourceType = inferredSourceType || 'OFFICIAL_COMPANY_PAGE';
  const lowerUrl = sourceUrl.toLowerCase();
  if (lowerUrl.includes('career') || lowerUrl.includes('job') || lowerUrl.includes('work-with-us')) {
    defaultSourceType = 'OFFICIAL_CAREERS_PAGE';
  } else if (lowerUrl.includes('contact') || lowerUrl.includes('about/contact')) {
    defaultSourceType = 'OFFICIAL_CONTACT_PAGE';
  } else if (lowerUrl.includes('team') || lowerUrl.includes('people') || lowerUrl.includes('leadership')) {
    defaultSourceType = 'OFFICIAL_TEAM_PAGE';
  }

  // 1. Process explicit mailto: links
  $('a[href^="mailto:"]').each((_, el) => {
    const rawHref = $(el).attr('href') || '';
    const rawEmail = rawHref.replace(/^mailto:/i, '').split('?')[0].trim();
    const clean = rawEmail.toLowerCase();

    if (isValidEmail(clean)) {
      const linkText = $(el).text().trim();
      const parentEl = $(el).parent();
      const parentText = parentEl.text().replace(/\s+/g, ' ').trim();
      const context = linkText || parentText || `mailto:${clean}`;
      const evidence = parentText.length > 20 ? parentText.slice(0, 180) : `mailto:${clean} in link [${linkText || 'Direct Link'}]`;

      const domain = clean.split('@')[1] || null;
      const emailType = classifyEmailType(clean, context);
      const isExact = verifyExactMatchInSource(clean, html);
      const confidence = calculateSourceQualityScore(defaultSourceType, clean, officialWebsite, isExact);

      results.set(clean, {
        email: clean,
        emailType,
        domain,
        sourceUrl,
        sourceType: defaultSourceType,
        sourceTitle: pageTitle,
        sourceText: context.slice(0, 200),
        evidenceFound: evidence,
        confidence,
        exactMatch: isExact,
        verificationStatus: isExact ? 'VERIFIED_PUBLIC' : 'REJECTED',
      });
    }
  });

  // 2. Process visible text exact email occurrences
  const textMatches = pageText.match(EMAIL_REGEX) || [];
  for (const raw of textMatches) {
    const clean = raw.toLowerCase().trim().replace(/[.,;:)\]]+$/, '');
    if (isValidEmail(clean) && !results.has(clean)) {
      const snippet = extractContextSnippet(pageText, clean);
      const domain = clean.split('@')[1] || null;
      const isExact = verifyExactMatchInSource(clean, pageText);
      const emailType = classifyEmailType(clean, snippet);
      const confidence = calculateSourceQualityScore(defaultSourceType, clean, officialWebsite, isExact);

      results.set(clean, {
        email: clean,
        emailType,
        domain,
        sourceUrl,
        sourceType: defaultSourceType,
        sourceTitle: pageTitle,
        sourceText: snippet,
        evidenceFound: `Visible text occurrence: "${snippet}"`,
        confidence,
        exactMatch: isExact,
        verificationStatus: isExact ? 'VERIFIED_PUBLIC' : 'REJECTED',
      });
    }
  }

  // 3. Process visible obfuscated emails (e.g. name [at] domain.com)
  let obfMatch: RegExpExecArray | null;
  const obfRegexCopy = new RegExp(OBFUSCATED_EMAIL_REGEX.source, 'gi');
  while ((obfMatch = obfRegexCopy.exec(pageText)) !== null) {
    const user = obfMatch[1]?.trim();
    const domainHost = obfMatch[2]?.trim();
    const tld = obfMatch[3]?.trim();
    if (user && domainHost && tld) {
      const clean = `${user}@${domainHost}.${tld}`.toLowerCase();
      if (isValidEmail(clean) && !results.has(clean)) {
        const originalString = obfMatch[0];
        const snippet = extractContextSnippet(pageText, originalString);
        const isExact = verifyExactMatchInSource(clean, pageText);
        const emailType = classifyEmailType(clean, snippet);
        const confidence = calculateSourceQualityScore(defaultSourceType, clean, officialWebsite, isExact);

        results.set(clean, {
          email: clean,
          emailType,
          domain: `${domainHost}.${tld}`.toLowerCase(),
          sourceUrl,
          sourceType: defaultSourceType,
          sourceTitle: pageTitle,
          sourceText: snippet,
          evidenceFound: `Obfuscated email in text: "${originalString}" -> normalized to "${clean}"`,
          confidence: Math.max(confidence - 5, 50),
          exactMatch: isExact,
          verificationStatus: isExact ? 'VERIFIED_PUBLIC' : 'REJECTED',
        });
      }
    }
  }

  // 4. Extract verified leadership / recruiter personnel without inventing emails
  // Look for team cards or recruiter mentions
  $('.team-member, .person, .leadership-card, .recruiter-card, .founder-card, [data-team-member]').each((_, el) => {
    const memberName = $(el).find('h3, h4, .name, strong').first().text().trim();
    const memberRole = $(el).find('.role, .title, p, span').first().text().trim();
    const memberProfile = $(el).find('a[href*="linkedin.com"], a[href*="twitter.com"]').attr('href') || null;
    const cardText = $(el).text().replace(/\s+/g, ' ').trim();

    if (memberName && memberName.length > 2 && memberName.length < 50) {
      // Check if this card contains an exact email
      const cardEmails = cardText.match(EMAIL_REGEX) || [];
      const validCardEmail = cardEmails.map((e) => e.toLowerCase().trim()).find((e) => isValidEmail(e));

      if (validCardEmail && results.has(validCardEmail)) {
        const existing = results.get(validCardEmail)!;
        existing.name = memberName;
        existing.role = memberRole || existing.role;
        existing.profileUrl = memberProfile || existing.profileUrl;
        if (memberRole && (memberRole.toLowerCase().includes('founder') || memberRole.toLowerCase().includes('ceo'))) {
          existing.emailType = 'FOUNDER';
        } else if (memberRole && memberRole.toLowerCase().includes('talent') || memberRole?.toLowerCase().includes('recruiter')) {
          existing.emailType = 'TALENT';
        }
      } else if (!validCardEmail && memberProfile) {
        // Person found with profile, but NO public email shown -> Store verified person record with "NOT PUBLICLY AVAILABLE"
        const personKey = `person_${memberName.toLowerCase().replace(/\s+/g, '_')}`;
        if (!results.has(personKey)) {
          results.set(personKey, {
            email: 'NOT PUBLICLY AVAILABLE',
            emailType: memberRole?.toLowerCase().includes('founder') ? 'FOUNDER' : 'TALENT',
            domain: officialWebsite ? officialWebsite.replace(/^https?:\/\//, '').split('/')[0] : null,
            name: memberName,
            role: memberRole || 'Leadership / Team',
            profileUrl: memberProfile,
            sourceUrl,
            sourceType: 'OFFICIAL_TEAM_PAGE',
            sourceTitle: pageTitle,
            sourceText: cardText.slice(0, 160),
            evidenceFound: `Public profile listed on team page: "${memberName} - ${memberRole || 'Team'}"`,
            confidence: 80,
            exactMatch: true,
            verificationStatus: 'VERIFIED_PUBLIC',
          });
        }
      }
    }
  });

  return Array.from(results.values());
}

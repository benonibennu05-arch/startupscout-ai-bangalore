import * as cheerio from 'cheerio';
import { OpenApplication, EmailVerificationStatus } from '../types.ts';
import { extractPublicEmailsFromHtml } from './email.extractor.ts';

export const OPEN_APPLICATION_KEYWORDS = [
  'always looking for talent',
  'always looking for passionate',
  'always hiring',
  'send your resume',
  'send us your resume',
  'send us your cv',
  'send your cv',
  'submit your resume',
  'submit your cv',
  'tell us what you are looking for',
  'tell us what you\'re looking for',
  'interested in joining our team',
  'interested in joining us',
  'join our team',
  'future opportunities',
  'talent pool',
  'general application',
  'open application',
  'speculative application',
  'we\'d love to hear from you',
  'we would love to hear from you',
  'we are always on the lookout',
  'always on the lookout',
  'career opportunities',
  'reach out to our hiring team',
  'contact our hiring team',
  'email your resume',
  'email your cv',
  'send your profile',
  'share your resume',
  'share your cv',
  'drop us a note',
  'work with us',
  'join us',
  'looking for passionate people',
  'no vacancies at this time',
  'no open positions',
  'no current openings',
  'nothing suitable?',
  'don\'t see a suitable role',
  'dont see a suitable role',
  'no suitable openings',
  'get in touch with our team',
  'connect with our talent team',
];

export interface ExtractedOpenApp {
  evidence: string;
  sourceText: string;
  sourceUrl: string;
  contactEmail: string | null;
  contactName: string | null;
  contactRole: string | null;
  verificationStatus: EmailVerificationStatus;
  relevanceScore: number;
}

/**
 * Inspects HTML content for open-application and talent-pool opportunities
 */
export function extractOpenApplicationFromHtml(
  html: string,
  pageUrl: string,
  companyName: string,
  officialWebsite?: string | null
): ExtractedOpenApp | null {
  if (!html || html.length < 50) return null;

  const $ = cheerio.load(html);

  // Strip script, style, svg, noscript, nav headers to avoid false positives
  $('script, style, noscript, svg').remove();

  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const lowerBody = bodyText.toLowerCase();

  // Find matching phrases
  let matchedKeyword: string | null = null;
  for (const kw of OPEN_APPLICATION_KEYWORDS) {
    if (lowerBody.includes(kw)) {
      matchedKeyword = kw;
      break;
    }
  }

  if (!matchedKeyword) {
    return null;
  }

  // Find the exact snippet/paragraph containing the keyword
  let bestSentence = '';
  let bestElement: any = null;

  $('p, div, section, h2, h3, h4, span, li, blockquote').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length >= 20 && text.length <= 600 && text.toLowerCase().includes(matchedKeyword!)) {
      if (!bestSentence || text.length < bestSentence.length) {
        bestSentence = text;
        bestElement = $(el);
      }
    }
  });

  if (!bestSentence) {
    // Fallback: extract surrounding characters from raw body text
    const idx = lowerBody.indexOf(matchedKeyword);
    const start = Math.max(0, idx - 100);
    const end = Math.min(bodyText.length, idx + matchedKeyword.length + 150);
    bestSentence = bodyText.slice(start, end).trim();
  }

  // Check if an email is mentioned in the evidence snippet or nearby element
  let contactEmail: string | null = null;
  let contactName: string | null = null;
  let contactRole: string | null = null;
  let verificationStatus: EmailVerificationStatus = 'NOT_FOUND';

  // 1. Check inside bestSentence for explicit email address
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const sentenceMatches = bestSentence.match(emailRegex);

  if (sentenceMatches && sentenceMatches.length > 0) {
    const clean = sentenceMatches[0].toLowerCase().replace(/[.,;:]$/, '');
    if (!clean.includes('.png') && !clean.includes('.jpg') && !clean.includes('example.com') && !clean.includes('sentry.io')) {
      contactEmail = clean;
      verificationStatus = 'VERIFIED_PUBLIC';
      if (clean.includes('hiring')) contactRole = 'Hiring Team';
      else if (clean.includes('careers')) contactRole = 'Careers Team';
      else if (clean.includes('talent')) contactRole = 'Talent Acquisition';
      else if (clean.includes('recruiting') || clean.includes('recruit')) contactRole = 'Recruiting Team';
      else if (clean.includes('hr')) contactRole = 'Human Resources';
    }
  }

  // 2. If no direct match in sentence, check all candidate emails on this page
  if (!contactEmail) {
    const candidateEmails = extractPublicEmailsFromHtml(html, pageUrl, officialWebsite);
    // Prioritize hiring, careers, talent, recruiting
    const priorityEmail = candidateEmails.find((c) =>
      ['HIRING', 'CAREERS', 'TALENT', 'RECRUITING', 'HR'].includes(c.emailType)
    ) || candidateEmails[0];

    if (priorityEmail && priorityEmail.exactMatch) {
      contactEmail = priorityEmail.email;
      verificationStatus = 'VERIFIED_PUBLIC';
      contactRole = priorityEmail.emailType === 'HIRING' ? 'Hiring Team'
        : priorityEmail.emailType === 'CAREERS' ? 'Careers Team'
        : priorityEmail.emailType === 'TALENT' ? 'Talent Acquisition'
        : priorityEmail.emailType === 'RECRUITING' ? 'Recruiting Team'
        : 'Recruitment & People Team';
    }
  }

  // Calculate open application relevance score (high for AI/ML/Tech startups in Bangalore)
  let relevanceScore = 85;
  if (contactEmail) relevanceScore += 10;
  if (lowerBody.includes('ai') || lowerBody.includes('machine learning') || lowerBody.includes('software') || lowerBody.includes('engineer')) {
    relevanceScore = Math.min(100, relevanceScore + 5);
  }

  return {
    evidence: bestSentence,
    sourceText: bestSentence,
    sourceUrl: pageUrl,
    contactEmail,
    contactName,
    contactRole: contactRole || 'Hiring & Talent Team',
    verificationStatus,
    relevanceScore,
  };
}

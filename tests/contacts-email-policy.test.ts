import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidEmail,
  verifyExactMatchInSource,
  classifyEmailType,
  calculateSourceQualityScore,
  extractPublicEmailsFromHtml,
} from '../server/extractors/email.extractor.ts';

describe('Strict Public Professional Email Policy Tests', () => {
  it('should accept valid company email addresses', () => {
    assert.equal(isValidEmail('careers@darwinbox.com'), true);
    assert.equal(isValidEmail('jobs@zenoti.com'), true);
    assert.equal(isValidEmail('talent.acquisition@highradius.com'), true);
    assert.equal(isValidEmail('contact@skyroot.in'), true);
  });

  it('should reject dummy, fake, or placeholder emails', () => {
    assert.equal(isValidEmail('user@example.com'), false);
    assert.equal(isValidEmail('test@test.com'), false);
    assert.equal(isValidEmail('someone@domain.com'), false);
    assert.equal(isValidEmail('placeholder@email.com'), false);
    assert.equal(isValidEmail('error@sentry.io'), false);
  });

  it('should reject malformed or invalid syntax strings', () => {
    assert.equal(isValidEmail('not-an-email'), false);
    assert.equal(isValidEmail('user@'), false);
    assert.equal(isValidEmail('@domain.com'), false);
    assert.equal(isValidEmail('user..name@domain.com'), false);
    assert.equal(isValidEmail('user@domain'), false);
    assert.equal(isValidEmail('user@domain..com'), false);
  });

  it('should verify exact match in source HTML or text', () => {
    const html = `
      <html>
        <body>
          <p>For career inquiries, email us at <a href="mailto:careers@acme.com">careers@acme.com</a></p>
        </body>
      </html>
    `;

    assert.equal(verifyExactMatchInSource('careers@acme.com', html), true);
    assert.equal(verifyExactMatchInSource('unlisted@acme.com', html), false);
  });

  it('should classify inbox and role types accurately', () => {
    assert.equal(classifyEmailType('careers@company.com'), 'CAREERS');
    assert.equal(classifyEmailType('jobs@company.com'), 'CAREERS');
    assert.equal(classifyEmailType('talent@company.com'), 'TALENT');
    assert.equal(classifyEmailType('recruiting@company.com'), 'RECRUITING');
    assert.equal(classifyEmailType('campus@company.com'), 'CAMPUS_HIRING');
    assert.equal(classifyEmailType('hr@company.com'), 'HR');
    assert.equal(classifyEmailType('founder@company.com'), 'FOUNDER');
    assert.equal(classifyEmailType('hello@company.com'), 'GENERAL_COMPANY');
  });

  it('should compute high confidence score for verified company domain match', () => {
    const scoreOfficial = calculateSourceQualityScore(
      'OFFICIAL_CAREERS_PAGE',
      'careers@darwinbox.com',
      'https://darwinbox.com',
      true
    );
    assert.ok(scoreOfficial >= 95, `Expected score >= 95, got ${scoreOfficial}`);

    const scoreUnverified = calculateSourceQualityScore(
      'OFFICIAL_CAREERS_PAGE',
      'careers@darwinbox.com',
      'https://darwinbox.com',
      false
    );
    assert.equal(scoreUnverified, 0, 'Confidence must be 0 if not an exact match');
  });

  it('should extract emails from HTML without fabricating non-existent addresses', () => {
    const mockHtml = `
      <div class="footer">
        <h3>Contact Us</h3>
        <p>Careers: careers@skyroot.in</p>
        <a href="mailto:press@skyroot.in">Press Inquiries</a>
      </div>
    `;

    const extracted = extractPublicEmailsFromHtml(mockHtml, 'https://skyroot.in/contact', 'https://skyroot.in');
    assert.equal(extracted.length, 2);

    const emails = extracted.map((e) => e.email);
    assert.ok(emails.includes('careers@skyroot.in'));
    assert.ok(emails.includes('press@skyroot.in'));
    assert.equal(emails.includes('fake@skyroot.in'), false);
  });
});

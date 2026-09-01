import { Router } from 'express';
import { store } from '../database/store.ts';
import { outreachService } from '../services/outreach.service.ts';
import { gmailService, EXPECTED_SENDER_EMAIL } from '../services/gmail.service.ts';
import { OutreachStatus, OutreachType } from '../types.ts';

export const outreachRouter = Router();

// --- Outreach Records Querying ---

outreachRouter.get('/', (req, res) => {
  const { status, outreachType, companyId, search, location, sourceMap } = req.query;
  const records = store.getOutreachRecords({
    status: status as string,
    outreachType: outreachType as string,
    companyId: companyId as string,
    search: search as string,
    location: (location as string) || (sourceMap as string),
  });
  res.json(records);
});

outreachRouter.get('/ready', (req, res) => {
  const { location, sourceMap } = req.query;
  const records = store.getOutreachRecords({ location: (location as string) || (sourceMap as string) }).filter(
    (r) => r.status === 'DRAFT_READY' || r.status === 'REVIEW_REQUIRED' || r.status === 'APPROVED'
  );
  res.json(records);
});

outreachRouter.get('/sent', (req, res) => {
  const { location, sourceMap } = req.query;
  const records = store.getOutreachRecords({ location: (location as string) || (sourceMap as string) }).filter((r) => r.status === 'SENT');
  res.json(records);
});

outreachRouter.get('/scheduled', (req, res) => {
  const { location, sourceMap } = req.query;
  const records = store.getOutreachRecords({ location: (location as string) || (sourceMap as string) }).filter((r) => r.status === 'SCHEDULED');
  res.json(records);
});

outreachRouter.get('/stats', (req, res) => {
  const { location, sourceMap } = req.query;
  res.json(store.getOutreachStats((location as string) || (sourceMap as string)));
});

// --- Pipeline Actions & Generation ---

// Test Outreach: Generates drafts for 5 researched companies without sending them
outreachRouter.post('/test-pipeline', async (req, res) => {
  try {
    const count = req.body.count ? parseInt(req.body.count, 10) : 5;
    const result = await outreachService.generateTestOutreachBatch(count);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to generate test outreach batch' });
  }
});

// Auto-Draft All eligible researched companies
outreachRouter.post('/auto-draft', async (req, res) => {
  try {
    const result = await outreachService.autoDraftAllEligible();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to auto-draft outreach' });
  }
});

// Generate draft for a single company / opportunity
outreachRouter.post('/generate', async (req, res) => {
  try {
    const { companyId, opportunityId, openApplicationId, outreachType, recipientEmail } = req.body;
    if (!companyId) {
      return res.status(400).json({ error: 'companyId is required' });
    }

    const company = store.getCompany(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const opp = opportunityId ? store.getOpportunity(opportunityId) : null;
    const openApp = openApplicationId ? store.getOpenApplication(openApplicationId) : null;

    let targetRecipient = recipientEmail;
    if (!targetRecipient) {
      const contacts = store.getContactsForCompany(companyId);
      const verified = contacts.filter((c) => c.verificationStatus === 'VERIFIED_PUBLIC' && c.email && c.email !== 'NOT PUBLICLY AVAILABLE');
      const best = verified.find((c) => ['HIRING', 'CAREERS', 'TALENT', 'RECRUITING'].includes(c.emailType)) || verified[0];
      if (best) targetRecipient = best.email;
    }

    if (!targetRecipient || targetRecipient === 'NOT PUBLICLY AVAILABLE') {
      return res.status(400).json({ error: 'No verified public email address available for this company.' });
    }

    const determinedType: OutreachType =
      outreachType ||
      (opp ? (opp.type === 'INTERNSHIP' ? 'INTERNSHIP_APPLICATION' : 'JOB_APPLICATION') : openApp ? 'OPEN_APPLICATION' : 'AI_ML_CAREER_INQUIRY');

    const generated = await outreachService.generateDraftContent({
      company,
      opportunity: opp,
      openApplication: openApp,
      outreachType: determinedType,
      recipientEmail: targetRecipient,
    });

    const candidate = store.getCandidateProfile();

    const record = store.upsertOutreachRecord({
      companyId: company.id,
      companyName: company.name,
      opportunityId: opp?.id || null,
      openApplicationId: openApp?.id || null,
      outreachType: determinedType,
      roleTitle: opp?.title || (openApp ? 'Open Application / Talent Pool' : 'AI/ML & Software Career Inquiry'),
      recipientEmail: targetRecipient,
      recipientName: `${company.name} Talent Team`,
      recipientRole: 'Talent Acquisition',
      emailSourceUrl: opp?.sourceUrl || openApp?.sourceUrl || company.officialWebsite || '',
      emailVerificationStatus: 'VERIFIED_PUBLIC',
      exactMatch: true,
      subject: generated.subject,
      body: generated.body,
      resumeFile: candidate.resumeFileName || 'Teja_Matta_Resume.pdf',
      portfolioUrl: candidate.portfolio,
      linkedinUrl: candidate.linkedin,
      githubUrl: candidate.github,
      status: 'DRAFT_READY',
      matchScore: generated.matchScore,
      matchReason: generated.matchReason,
      sourceUrl: opp?.sourceUrl || openApp?.sourceUrl || company.officialWebsite || '',
      sourceEvidence: opp?.description || openApp?.evidence || 'Official company careers contact',
    });

    res.json({ success: true, outreach: record });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to generate outreach' });
  }
});

// Single Record Operations
outreachRouter.get('/:id', (req, res) => {
  const item = store.getOutreachRecord(req.params.id);
  if (!item) return res.status(404).json({ error: 'Outreach record not found' });
  res.json(item);
});

outreachRouter.put('/:id', (req, res) => {
  const item = store.getOutreachRecord(req.params.id);
  if (!item) return res.status(404).json({ error: 'Outreach record not found' });

  const { subject, body, recipientEmail, recipientName, recipientRole, status, notes } = req.body;

  const updated = store.upsertOutreachRecord({
    ...item,
    ...(subject !== undefined && { subject }),
    ...(body !== undefined && { body }),
    ...(recipientEmail !== undefined && { recipientEmail }),
    ...(recipientName !== undefined && { recipientName }),
    ...(recipientRole !== undefined && { recipientRole }),
    ...(status !== undefined && { status: status as OutreachStatus }),
    ...(notes !== undefined && { notes }),
  });

  res.json(updated);
});

outreachRouter.delete('/:id', (req, res) => {
  const deleted = store.deleteOutreachRecord(req.params.id);
  res.json({ success: deleted });
});

// Approve Draft
outreachRouter.post('/:id/approve', (req, res) => {
  const updated = store.updateOutreachStatus(req.params.id, 'APPROVED', {
    approvedAt: new Date().toISOString(),
  });
  if (!updated) return res.status(404).json({ error: 'Outreach record not found' });
  res.json({ success: true, outreach: updated });
});

// Skip Draft
outreachRouter.post('/:id/skip', (req, res) => {
  const updated = store.updateOutreachStatus(req.params.id, 'SKIPPED', {
    notes: req.body.reason || 'Skipped by user',
  });
  if (!updated) return res.status(404).json({ error: 'Outreach record not found' });
  res.json({ success: true, outreach: updated });
});

// Schedule Send
outreachRouter.post('/:id/schedule', (req, res) => {
  const { scheduledAt } = req.body;
  const updated = store.updateOutreachStatus(req.params.id, 'SCHEDULED', {
    scheduledAt: scheduledAt || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  if (!updated) return res.status(404).json({ error: 'Outreach record not found' });
  res.json({ success: true, outreach: updated });
});

// Single Dispatch Send
outreachRouter.post('/:id/send', async (req, res) => {
  try {
    const { subject, body, recipientEmail } = req.body;
    const result = await outreachService.sendOutreach(req.params.id, {
      subject,
      body,
      recipientEmail,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Send failed' });
  }
});

// Batch Send
outreachRouter.post('/batch-send', async (req, res) => {
  try {
    const { outreachIds } = req.body;
    if (!Array.isArray(outreachIds) || outreachIds.length === 0) {
      return res.status(400).json({ error: 'outreachIds array is required' });
    }

    const result = await outreachService.sendBatchOutreach(outreachIds);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Batch send failed' });
  }
});

// Toggle Do Not Contact
outreachRouter.post('/company/:companyId/toggle-dnc', (req, res) => {
  const isDnc = store.toggleDoNotContactCompany(req.params.companyId, req.body.flag);
  res.json({ success: true, isDoNotContact: isDnc });
});

// --- Email Provider and OAuth Endpoints ---

export const emailRouter = Router();

emailRouter.get('/status', async (req, res) => {
  const settings = store.getOutreachSettings();
  const todaySent = store.getTodaySentCount();
  const candidate = store.getCandidateProfile();
  const accountInfo = await gmailService.getAccount();

  res.json({
    connected: accountInfo.connected,
    email: accountInfo.email,
    accountEmail: accountInfo.email || settings.gmailAccountEmail || EXPECTED_SENDER_EMAIL,
    expectedEmail: EXPECTED_SENDER_EMAIL,
    canSend: accountInfo.canSend,
    isAuthConfigured: gmailService.isAuthConfigured(),
    clientId: gmailService.getClientId(),
    error: accountInfo.error,
    scopes: accountInfo.scopes || [],
    provider: 'gmail',
    dailyLimit: settings.dailySendLimit || 20,
    sentToday: todaySent,
    remainingToday: Math.max(0, (settings.dailySendLimit || 20) - todaySent),
    hasResume: Boolean(candidate.resumeFileName),
    resumeFileName: candidate.resumeFileName,
    automationMode: settings.automationMode,
    cooldownDays: settings.cooldownDays,
  });
});

emailRouter.post('/test-connection', async (req, res) => {
  try {
    const result = await gmailService.verifyGmailConnection();
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Connection test failed' });
  }
});

emailRouter.get('/test-connection', async (req, res) => {
  try {
    const result = await gmailService.verifyGmailConnection();
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Connection test failed' });
  }
});

emailRouter.post('/disconnect', async (req, res) => {
  await gmailService.disconnect();
  res.json({ success: true, message: 'Gmail account disconnected successfully' });
});

emailRouter.post('/test', async (req, res) => {
  try {
    const { toEmail } = req.body;
    const recipient = toEmail || store.getOutreachSettings().gmailAccountEmail || EXPECTED_SENDER_EMAIL;
    const result = await outreachService.sendTestEmail(recipient);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'Test email failed' });
  }
});

// --- Outreach Settings Endpoints ---

export const outreachSettingsRouter = Router();

outreachSettingsRouter.get('/', (req, res) => {
  res.json(store.getOutreachSettings());
});

outreachSettingsRouter.put('/', (req, res) => {
  const updated = store.updateOutreachSettings(req.body);
  res.json({ success: true, settings: updated });
});

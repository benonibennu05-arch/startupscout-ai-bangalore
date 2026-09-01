import { Router } from 'express';
import { store } from '../database/store.ts';
import { applicationEmailService } from '../services/applicationEmail.service.ts';
import { ApplicationStatus, ApplicationType } from '../types.ts';

export const applicationsRouter = Router();

// --- Open Applications Discovery Endpoints ---
applicationsRouter.get('/open-applications', (req, res) => {
  const { companyId, status, onlyWithEmail, search, location, sourceMap } = req.query;
  const list = store.getOpenApplications({
    companyId: companyId as string,
    status: status as string,
    onlyWithEmail: onlyWithEmail === 'true',
    search: search as string,
    location: (location as string) || (sourceMap as string),
  });
  res.json(list);
});

applicationsRouter.get('/open-applications/:id', (req, res) => {
  const item = store.getOpenApplication(req.params.id);
  if (!item) return res.status(404).json({ error: 'Open application opportunity not found' });
  res.json(item);
});

// --- Candidate Applications Pipeline Endpoints ---
applicationsRouter.get('/applications', (req, res) => {
  const { status, applicationType, companyId, search, location, sourceMap } = req.query;
  const list = store.getApplications({
    status: status as string,
    applicationType: applicationType as string,
    companyId: companyId as string,
    search: search as string,
    location: (location as string) || (sourceMap as string),
  });
  res.json(list);
});

// Sent emails history - MUST be before /applications/:id
applicationsRouter.get('/applications/sent-history', (req, res) => {
  const history = store.getSentEmails();
  res.json(history);
});

// Update follow-up status on sent email - MUST be before /applications/:id
applicationsRouter.put('/applications/sent-history/:id/follow-up', (req, res) => {
  const { followUpReminderDate, followUpStatus } = req.body;
  const updated = store.updateSentEmailFollowUp(
    req.params.id,
    followUpReminderDate,
    followUpStatus
  );
  if (!updated) return res.status(404).json({ error: 'Sent email record not found' });
  res.json(updated);
});

// Generate email draft for a company / opportunity / open application
applicationsRouter.post('/applications/generate', async (req, res) => {
  try {
    const { companyId, opportunityId, openApplicationId } = req.body;
    if (!companyId) {
      return res.status(400).json({ error: 'companyId is required' });
    }

    const company = store.getCompany(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const opp = opportunityId ? store.getOpportunity(opportunityId) : null;
    const openApp = openApplicationId ? store.getOpenApplication(openApplicationId) : null;
    const candidate = store.getCandidateProfile();

    const generated = await applicationEmailService.generateEmailContent({
      company,
      opportunity: opp,
      openApplication: openApp,
      candidate,
    });

    // Determine recipient
    let recipientEmail = 'NOT PUBLICLY AVAILABLE';
    let recipientName = `${company.name} Talent Team`;
    let recipientRole = 'Talent Acquisition';

    if (openApp && openApp.contactEmail && openApp.contactEmail !== 'NOT PUBLICLY AVAILABLE') {
      recipientEmail = openApp.contactEmail;
      if (openApp.contactName) recipientName = openApp.contactName;
      if (openApp.contactRole) recipientRole = openApp.contactRole;
    } else {
      const contacts = store.getContactsForCompany(companyId);
      const verified = contacts.filter((c) => c.verificationStatus === 'VERIFIED_PUBLIC' && c.email && c.email !== 'NOT PUBLICLY AVAILABLE');
      const best = verified.find((c) => ['HIRING', 'CAREERS', 'TALENT', 'RECRUITING'].includes(c.emailType)) || verified[0];
      if (best) {
        recipientEmail = best.email;
        if (best.name) recipientName = best.name;
        if (best.role) recipientRole = best.role;
      }
    }

    const application = store.upsertApplication({
      companyId: company.id,
      companyName: company.name,
      opportunityId: opp ? opp.id : null,
      openApplicationId: openApp ? openApp.id : null,
      applicationType: opp ? 'CURRENT_ROLE' : 'OPEN_APPLICATION',
      roleTitle: opp ? opp.title : 'Open Application / Talent Pool',
      recipientEmail,
      recipientName,
      recipientRole,
      subject: generated.subject,
      body: generated.body,
      resumeFile: candidate.resumeFileName || 'Teja_Matta_Resume.pdf',
      sourceUrl: opp?.sourceUrl || openApp?.sourceUrl || company.officialWebsite || '',
      sourceEvidence: opp?.description || openApp?.evidence || 'Official company careers page',
      status: 'READY_TO_SEND',
      matchScore: generated.matchScore,
      matchReason: generated.matchReason,
    });

    res.json({ success: true, application });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to generate application email' });
  }
});

// Auto-draft all pending applications
applicationsRouter.post('/applications/auto-draft', async (req, res) => {
  try {
    const result = await applicationEmailService.autoDraftApplications();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to auto-draft applications' });
  }
});

// Batch send approved applications
applicationsRouter.post('/applications/batch-send', async (req, res) => {
  try {
    const { applicationIds } = req.body;
    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      return res.status(400).json({ error: 'applicationIds array is required' });
    }

    const result = await applicationEmailService.sendBatchApplications(applicationIds);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Batch send failed' });
  }
});

applicationsRouter.get('/applications/:id', (req, res) => {
  const app = store.getApplication(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  res.json(app);
});

// Update application draft
applicationsRouter.put('/applications/:id', (req, res) => {
  const { subject, body, recipientEmail, recipientName, recipientRole, status, notes } = req.body;
  const app = store.getApplication(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const updated = store.upsertApplication({
    ...app,
    ...(subject !== undefined && { subject }),
    ...(body !== undefined && { body }),
    ...(recipientEmail !== undefined && { recipientEmail }),
    ...(recipientName !== undefined && { recipientName }),
    ...(recipientRole !== undefined && { recipientRole }),
    ...(status !== undefined && { status: status as ApplicationStatus }),
    ...(notes !== undefined && { notes }),
  });

  res.json(updated);
});

// Delete application
applicationsRouter.delete('/applications/:id', (req, res) => {
  const deleted = store.deleteApplication(req.params.id);
  res.json({ success: deleted });
});

// Approve application
applicationsRouter.post('/applications/:id/approve', (req, res) => {
  const app = store.updateApplicationStatus(req.params.id, 'READY_TO_SEND', {
    approvedAt: new Date().toISOString(),
  });
  if (!app) return res.status(404).json({ error: 'Application not found' });
  res.json({ success: true, application: app });
});

// Send single application (requires human trigger)
applicationsRouter.post('/applications/:id/send', async (req, res) => {
  try {
    const { subject, body, recipientEmail } = req.body;
    const result = await applicationEmailService.sendApplication(req.params.id, {
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

// --- Candidate Profile Endpoints ---
applicationsRouter.get('/candidate-profile', (req, res) => {
  res.json(store.getCandidateProfile());
});

applicationsRouter.put('/candidate-profile', (req, res) => {
  const updated = store.updateCandidateProfile(req.body);
  res.json(updated);
});

// --- Email Provider Config Endpoints ---
applicationsRouter.get('/email-config', (req, res) => {
  res.json(store.getEmailProviderConfig());
});

applicationsRouter.put('/email-config', (req, res) => {
  const updated = store.updateEmailProviderConfig(req.body);
  res.json(updated);
});

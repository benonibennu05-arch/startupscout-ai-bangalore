import {
  Company,
  Opportunity,
  Contact,
  ResearchRun,
  ResearchError,
  ResearchEvent,
  UserSettings,
  ResearchMode,
  ActiveWorkerInfo,
  ResearchMetrics,
  OpenApplication,
  Application,
  SentEmailRecord,
  CandidateProfile,
  EmailProviderConfig,
} from '../types';

export interface QueueStatusResponse {
  status: 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED';
  mode: ResearchMode;
  concurrency: number;
  currentRun: ResearchRun | null;
  queueLength: number;
  activeWorkers: ActiveWorkerInfo[];
  currentStage: string;
  metrics: ResearchMetrics;
  stats: {
    totalCompanies: number;
    researchedCompanies: number;
    pendingCompanies: number;
    failedCompanies: number;
    totalOpportunities: number;
    totalJobs: number;
    totalInternships: number;
    fresherRoles: number;
    aiMlRoles: number;
    verifiedOpportunities: number;
    publicEmails: number;
    unresolvedErrors: number;
  };
}

export const api = {
  // Status & Stats
  async getStatus(): Promise<QueueStatusResponse> {
    const res = await fetch('/api/status');
    return res.json();
  },

  async getStats() {
    const res = await fetch('/api/stats');
    return res.json();
  },

  async getEvents(limit = 50): Promise<ResearchEvent[]> {
    const res = await fetch(`/api/events?limit=${limit}`);
    return res.json();
  },

  // Research Controls
  async startTest10(mode: ResearchMode = 'FAST', concurrency = 10) {
    const res = await fetch('/api/research/test-10', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, concurrency }),
    });
    return res.json();
  },

  async startFullResearch(mode: ResearchMode = 'FAST', concurrency = 10, forceRefresh = false) {
    const res = await fetch('/api/research/full', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, concurrency, forceRefresh }),
    });
    return res.json();
  },

  async pauseResearch() {
    const res = await fetch('/api/research/pause', { method: 'POST' });
    return res.json();
  },

  async resumeResearch() {
    const res = await fetch('/api/research/resume', { method: 'POST' });
    return res.json();
  },

  async stopResearch() {
    const res = await fetch('/api/research/stop', { method: 'POST' });
    return res.json();
  },

  async retryFailed(concurrency = 10) {
    const res = await fetch('/api/research/retry-failed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ concurrency }),
    });
    return res.json();
  },

  async setConcurrency(concurrency: number) {
    const res = await fetch('/api/research/concurrency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ concurrency }),
    });
    return res.json();
  },

  async setMode(mode: ResearchMode) {
    const res = await fetch('/api/research/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    return res.json();
  },

  // Companies
  async getCompanies(params: {
    search?: string;
    status?: string;
    sector?: string;
    hasJobs?: boolean;
    hasEmail?: boolean;
    sort?: string;
  } = {}): Promise<{ total: number; companies: (Company & { jobsCount: number; internshipsCount: number; contactsCount: number; primaryEmail: string | null })[] }> {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    if (params.sector) query.set('sector', params.sector);
    if (params.hasJobs) query.set('hasJobs', 'true');
    if (params.hasEmail) query.set('hasEmail', 'true');
    if (params.sort) query.set('sort', params.sort);

    const res = await fetch(`/api/companies?${query.toString()}`);
    return res.json();
  },

  async getCompany(id: string): Promise<{
    company: Company;
    opportunities: Opportunity[];
    contacts: Contact[];
    errors: ResearchError[];
  }> {
    const res = await fetch(`/api/companies/${id}`);
    return res.json();
  },

  async researchCompany(id: string) {
    const res = await fetch(`/api/companies/${id}/research`, { method: 'POST' });
    return res.json();
  },

  // Opportunities
  async getOpportunities(params: {
    search?: string;
    category?: string;
    aiMlRelevance?: string;
    type?: string;
    experienceLevel?: string;
    remote?: string;
    verificationStatus?: string;
    minRelevance?: number;
    hasEmail?: boolean;
    hasApp?: boolean;
    isInternship?: boolean;
    isNew?: boolean;
    isSaved?: boolean;
    userApplicationStatus?: string;
    sort?: string;
  } = {}): Promise<{ total: number; opportunities: (Opportunity & { publicEmail: string | null })[] }> {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.category) query.set('category', params.category);
    if (params.aiMlRelevance) query.set('aiMlRelevance', params.aiMlRelevance);
    if (params.type) query.set('type', params.type);
    if (params.experienceLevel) query.set('experienceLevel', params.experienceLevel);
    if (params.remote) query.set('remote', params.remote);
    if (params.verificationStatus) query.set('verificationStatus', params.verificationStatus);
    if (params.minRelevance) query.set('minRelevance', params.minRelevance.toString());
    if (params.hasEmail) query.set('hasEmail', 'true');
    if (params.hasApp) query.set('hasApp', 'true');
    if (params.isInternship) query.set('isInternship', 'true');
    if (params.isNew) query.set('isNew', 'true');
    if (params.isSaved) query.set('isSaved', 'true');
    if (params.userApplicationStatus) query.set('userApplicationStatus', params.userApplicationStatus);
    if (params.sort) query.set('sort', params.sort);

    const res = await fetch(`/api/opportunities?${query.toString()}`);
    return res.json();
  },

  async getSavedJobs(): Promise<{ success: boolean; count: number; savedJobs: any[] }> {
    const res = await fetch('/api/opportunities/saved');
    return res.json();
  },

  async saveJob(id: string, priority = 'HIGH', notes = '') {
    const res = await fetch(`/api/opportunities/${id}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority, notes }),
    });
    return res.json();
  },

  async unsaveJob(id: string) {
    const res = await fetch(`/api/opportunities/${id}/save`, {
      method: 'DELETE',
    });
    return res.json();
  },

  async updateJobApplicationStatus(id: string, status: string) {
    const res = await fetch(`/api/opportunities/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return res.json();
  },

  // Monitoring
  async getMonitoringStatus() {
    const res = await fetch('/api/monitoring/status');
    return res.json();
  },

  async triggerMonitoring(limit = 10) {
    const res = await fetch('/api/monitoring/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit }),
    });
    return res.json();
  },

  // Notifications
  async getNotifications() {
    const res = await fetch('/api/notifications');
    return res.json();
  },

  async markNotificationRead(id: string) {
    const res = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    return res.json();
  },

  async markAllNotificationsRead() {
    const res = await fetch('/api/notifications/read-all', { method: 'POST' });
    return res.json();
  },

  async getOpportunity(id: string): Promise<{
    opportunity: Opportunity;
    company: Company;
    contacts: Contact[];
  }> {
    const res = await fetch(`/api/opportunities/${id}`);
    return res.json();
  },

  async verifyOpportunity(id: string) {
    const res = await fetch(`/api/opportunities/${id}/verify`, { method: 'POST' });
    return res.json();
  },

  async verifyAllOpportunities() {
    const res = await fetch('/api/opportunities/verify-all', { method: 'POST' });
    return res.json();
  },

  // Contacts
  async getContacts(params: {
    companyId?: string;
    emailType?: string;
    verificationStatus?: string;
    search?: string;
    onlyWithEmail?: boolean;
  } = {}): Promise<{ total: number; contacts: Contact[] }> {
    const query = new URLSearchParams();
    if (params.companyId) query.set('companyId', params.companyId);
    if (params.emailType) query.set('emailType', params.emailType);
    if (params.verificationStatus) query.set('verificationStatus', params.verificationStatus);
    if (params.search) query.set('search', params.search);
    if (params.onlyWithEmail) query.set('onlyWithEmail', 'true');

    const res = await fetch(`/api/contacts?${query.toString()}`);
    return res.json();
  },

  async getContactStats(): Promise<{ success: boolean; stats: any }> {
    const res = await fetch('/api/contacts/stats');
    return res.json();
  },

  async verifyContact(id: string): Promise<{ success: boolean; contact: Contact }> {
    const res = await fetch(`/api/contacts/${id}/verify`, { method: 'POST' });
    return res.json();
  },

  async verifyAllContacts(): Promise<{ success: boolean; summary: any }> {
    const res = await fetch('/api/contacts/verify-all', { method: 'POST' });
    return res.json();
  },

  async cleanContacts(): Promise<{ success: boolean; summary: any }> {
    const res = await fetch('/api/contacts/clean', { method: 'POST' });
    return res.json();
  },

  // Runs & Errors
  async getRuns(): Promise<ResearchRun[]> {
    const res = await fetch('/api/runs');
    return res.json();
  },

  async getErrors(): Promise<ResearchError[]> {
    const res = await fetch('/api/errors');
    return res.json();
  },

  async resolveError(id: string) {
    const res = await fetch(`/api/errors/${id}/resolve`, { method: 'POST' });
    return res.json();
  },

  // Open Applications
  async getOpenApplications(params: {
    companyId?: string;
    status?: string;
    onlyWithEmail?: boolean;
    search?: string;
  } = {}): Promise<OpenApplication[]> {
    const query = new URLSearchParams();
    if (params.companyId) query.set('companyId', params.companyId);
    if (params.status) query.set('status', params.status);
    if (params.onlyWithEmail) query.set('onlyWithEmail', 'true');
    if (params.search) query.set('search', params.search);

    const res = await fetch(`/api/open-applications?${query.toString()}`);
    return res.json();
  },

  async getOpenApplication(id: string): Promise<OpenApplication> {
    const res = await fetch(`/api/open-applications/${id}`);
    return res.json();
  },

  // Applications Pipeline
  async getApplications(params: {
    status?: string;
    applicationType?: string;
    companyId?: string;
    search?: string;
  } = {}): Promise<Application[]> {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.applicationType) query.set('applicationType', params.applicationType);
    if (params.companyId) query.set('companyId', params.companyId);
    if (params.search) query.set('search', params.search);

    const res = await fetch(`/api/applications?${query.toString()}`);
    return res.json();
  },

  async getApplication(id: string): Promise<Application> {
    const res = await fetch(`/api/applications/${id}`);
    return res.json();
  },

  async generateApplication(params: {
    companyId: string;
    opportunityId?: string | null;
    openApplicationId?: string | null;
  }): Promise<{ success: boolean; application: Application }> {
    const res = await fetch('/api/applications/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  async autoDraftApplications(): Promise<{ created: number; total: number }> {
    const res = await fetch('/api/applications/auto-draft', {
      method: 'POST',
    });
    return res.json();
  },

  async updateApplication(
    id: string,
    updates: Partial<Application>
  ): Promise<Application> {
    const res = await fetch(`/api/applications/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return res.json();
  },

  async deleteApplication(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/applications/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  async approveApplication(id: string): Promise<{ success: boolean; application: Application }> {
    const res = await fetch(`/api/applications/${id}/approve`, {
      method: 'POST',
    });
    return res.json();
  },

  async sendApplication(
    id: string,
    overrides?: { subject?: string; body?: string; recipientEmail?: string }
  ): Promise<{ success: boolean; message: string; record?: SentEmailRecord }> {
    const res = await fetch(`/api/applications/${id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(overrides || {}),
    });
    return res.json();
  },

  async sendBatchApplications(
    applicationIds: string[]
  ): Promise<{ sent: number; failed: number; skipped: number; results: { id: string; success: boolean; message: string }[] }> {
    const res = await fetch('/api/applications/batch-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationIds }),
    });
    return res.json();
  },

  async getSentHistory(): Promise<SentEmailRecord[]> {
    const res = await fetch('/api/applications/sent-history');
    return res.json();
  },

  async updateFollowUp(
    id: string,
    followUpReminderDate: string | null,
    followUpStatus?: 'PENDING' | 'DONE' | 'CANCELLED'
  ): Promise<SentEmailRecord> {
    const res = await fetch(`/api/applications/sent-history/${id}/follow-up`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followUpReminderDate, followUpStatus }),
    });
    return res.json();
  },

  // Candidate Profile & Resume
  async getProfile(): Promise<{ success: boolean; profile: CandidateProfile }> {
    const res = await fetch('/api/profile');
    return res.json();
  },

  async updateProfile(profile: Partial<CandidateProfile>): Promise<{ success: boolean; profile: CandidateProfile }> {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    return res.json();
  },

  async getCandidateProfile(): Promise<CandidateProfile> {
    const res = await fetch('/api/candidate-profile');
    return res.json();
  },

  async updateCandidateProfile(profile: Partial<CandidateProfile>): Promise<CandidateProfile> {
    const res = await fetch('/api/candidate-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    return res.json();
  },

  async getResumeStatus(): Promise<{
    uploaded: boolean;
    hasResume: boolean;
    fileId: string | null;
    filename: string | null;
    originalName?: string;
    mimeType?: string | null;
    size: number;
    uploadedAt: string | null;
    updatedAt?: string | null;
    version?: number;
    extractedSkills?: string[];
    extractedProjects?: string[];
    extractedExperience?: string;
    history?: any[];
  }> {
    const res = await fetch('/api/profile/resume');
    return res.json();
  },

  async uploadResume(
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<{
    success: boolean;
    message?: string;
    errorCode?: string;
    resume?: any;
    profile?: CandidateProfile;
  }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('resume', file);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        try {
          const json = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(json);
          } else {
            resolve(json || { success: false, message: `Upload failed with status ${xhr.status}` });
          }
        } catch (err) {
          resolve({ success: false, message: 'Invalid response from server' });
        }
      };

      xhr.onerror = () => {
        resolve({ success: false, message: 'Network error during resume upload.' });
      };

      xhr.open('POST', '/api/profile/resume');
      xhr.send(formData);
    });
  },

  async deleteResume(): Promise<{ success: boolean; message: string; profile?: CandidateProfile }> {
    const res = await fetch('/api/profile/resume', {
      method: 'DELETE',
    });
    return res.json();
  },

  getResumeDownloadUrl(fileId?: string): string {
    return fileId ? `/api/profile/resume/download?fileId=${encodeURIComponent(fileId)}` : '/api/profile/resume/download';
  },

  async selectResumeVersion(fileId: string): Promise<{ success: boolean; message?: string; resume?: any; profile?: CandidateProfile }> {
    const res = await fetch('/api/profile/resume/select-version', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId }),
    });
    return res.json();
  },

  async sendTestResumeEmail(recipientEmail: string): Promise<{
    success: boolean;
    message: string;
    attachmentName?: string;
    attachmentSize?: number;
  }> {
    const res = await fetch('/api/profile/resume/test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientEmail }),
    });
    return res.json();
  },

  // Email Config
  async getEmailConfig(): Promise<EmailProviderConfig> {
    const res = await fetch('/api/email-config');
    return res.json();
  },

  async updateEmailConfig(config: Partial<EmailProviderConfig>): Promise<EmailProviderConfig> {
    const res = await fetch('/api/email-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return res.json();
  },

  // Settings
  async getSettings(): Promise<UserSettings> {
    const res = await fetch('/api/settings');
    return res.json();
  },

  async updateSettings(settings: Partial<UserSettings>): Promise<{ success: boolean; settings: UserSettings }> {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    return res.json();
  },

  // =========================================================================
  // --- Automated Email Outreach Pipeline API Client ---
  // =========================================================================

  async getOutreachRecords(params: {
    status?: string;
    outreachType?: string;
    companyId?: string;
    search?: string;
  } = {}): Promise<any[]> {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.outreachType) query.set('outreachType', params.outreachType);
    if (params.companyId) query.set('companyId', params.companyId);
    if (params.search) query.set('search', params.search);

    const res = await fetch(`/api/outreach?${query.toString()}`);
    return res.json();
  },

  async getReadyOutreach(): Promise<any[]> {
    const res = await fetch('/api/outreach/ready');
    return res.json();
  },

  async getSentOutreach(): Promise<any[]> {
    const res = await fetch('/api/outreach/sent');
    return res.json();
  },

  async getScheduledOutreach(): Promise<any[]> {
    const res = await fetch('/api/outreach/scheduled');
    return res.json();
  },

  async getOutreachStats(): Promise<any> {
    const res = await fetch('/api/outreach/stats');
    return res.json();
  },

  async getOutreachRecord(id: string): Promise<any> {
    const res = await fetch(`/api/outreach/${id}`);
    return res.json();
  },

  async generateOutreach(params: {
    companyId: string;
    opportunityId?: string | null;
    openApplicationId?: string | null;
    outreachType?: string;
    recipientEmail?: string;
  }): Promise<{ success: boolean; outreach: any }> {
    const res = await fetch('/api/outreach/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  async testOutreachPipeline(count = 5): Promise<{ success: boolean; createdCount: number; items: any[] }> {
    const res = await fetch('/api/outreach/test-pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count }),
    });
    return res.json();
  },

  async autoDraftAllOutreach(): Promise<{ totalCompanies: number; eligible: number; draftsCreated: number }> {
    const res = await fetch('/api/outreach/auto-draft', {
      method: 'POST',
    });
    return res.json();
  },

  async updateOutreach(id: string, updates: any): Promise<any> {
    const res = await fetch(`/api/outreach/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return res.json();
  },

  async deleteOutreach(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/outreach/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  async approveOutreach(id: string): Promise<{ success: boolean; outreach: any }> {
    const res = await fetch(`/api/outreach/${id}/approve`, {
      method: 'POST',
    });
    return res.json();
  },

  async skipOutreach(id: string, reason?: string): Promise<{ success: boolean; outreach: any }> {
    const res = await fetch(`/api/outreach/${id}/skip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    return res.json();
  },

  async scheduleOutreach(id: string, scheduledAt: string): Promise<{ success: boolean; outreach: any }> {
    const res = await fetch(`/api/outreach/${id}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduledAt }),
    });
    return res.json();
  },

  async sendOutreach(
    id: string,
    overrides?: { subject?: string; body?: string; recipientEmail?: string }
  ): Promise<{ success: boolean; message: string; record?: any; outreach?: any }> {
    const res = await fetch(`/api/outreach/${id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(overrides || {}),
    });
    return res.json();
  },

  async sendBatchOutreach(
    outreachIds: string[]
  ): Promise<{ sent: number; failed: number; skipped: number; results: { id: string; success: boolean; message: string }[] }> {
    const res = await fetch('/api/outreach/batch-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outreachIds }),
    });
    return res.json();
  },

  async toggleCompanyDoNotContact(companyId: string, flag?: boolean): Promise<{ success: boolean; isDoNotContact: boolean }> {
    const res = await fetch(`/api/outreach/company/${companyId}/toggle-dnc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flag }),
    });
    return res.json();
  },

  // Email & Provider Management
  async getEmailStatus(): Promise<any> {
    const res = await fetch('/api/email/status');
    return res.json();
  },

  async connectGmail(accountEmail?: string, accessToken?: string): Promise<any> {
    const res = await fetch('/api/email/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountEmail, accessToken }),
    });
    return res.json();
  },

  async disconnectGmail(): Promise<any> {
    const res = await fetch('/api/email/disconnect', {
      method: 'POST',
    });
    return res.json();
  },

  async sendTestEmail(toEmail?: string): Promise<{ success: boolean; message: string; messageId?: string }> {
    const res = await fetch('/api/email/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toEmail }),
    });
    return res.json();
  },

  async getOutreachSettings(): Promise<any> {
    const res = await fetch('/api/settings/outreach');
    return res.json();
  },

  async updateOutreachSettings(settings: any): Promise<{ success: boolean; settings: any }> {
    const res = await fetch('/api/settings/outreach', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    return res.json();
  },

  // SSE Event Stream
  subscribeEvents(onMessage: (data: any) => void) {
    const eventSource = new EventSource('/api/events/stream');
    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onMessage(parsed);
      } catch (err) {
        console.error('SSE JSON error:', err);
      }
    };
    return () => {
      eventSource.close();
    };
  },
};

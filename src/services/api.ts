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
    type?: string;
    experienceLevel?: string;
    remote?: string;
    verificationStatus?: string;
    minRelevance?: number;
    hasEmail?: boolean;
    hasApp?: boolean;
    sort?: string;
  } = {}): Promise<{ total: number; opportunities: (Opportunity & { publicEmail: string | null })[] }> {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.type) query.set('type', params.type);
    if (params.experienceLevel) query.set('experienceLevel', params.experienceLevel);
    if (params.remote) query.set('remote', params.remote);
    if (params.verificationStatus) query.set('verificationStatus', params.verificationStatus);
    if (params.minRelevance) query.set('minRelevance', params.minRelevance.toString());
    if (params.hasEmail) query.set('hasEmail', 'true');
    if (params.hasApp) query.set('hasApp', 'true');
    if (params.sort) query.set('sort', params.sort);

    const res = await fetch(`/api/opportunities?${query.toString()}`);
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
  async getContacts(params: { emailType?: string; search?: string } = {}): Promise<{ total: number; contacts: Contact[] }> {
    const query = new URLSearchParams();
    if (params.emailType) query.set('emailType', params.emailType);
    if (params.search) query.set('search', params.search);
    const res = await fetch(`/api/contacts?${query.toString()}`);
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

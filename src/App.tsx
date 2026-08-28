import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar, NavTab } from './components/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { CompaniesPage } from './pages/CompaniesPage';
import { OpportunitiesPage } from './pages/OpportunitiesPage';
import { OpenApplicationsPage } from './pages/OpenApplicationsPage';
import { ApplicationsPipelinePage } from './pages/ApplicationsPipelinePage';
import { OutreachPipelinePage } from './pages/OutreachPipelinePage';
import { ContactsPage } from './pages/ContactsPage';
import { ResearchRunsPage } from './pages/ResearchRunsPage';
import { FailedResearchPage } from './pages/FailedResearchPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProfilePage } from './pages/ProfilePage';
import { CompanyDetailModal } from './components/CompanyDetailModal';
import { OpportunityDetailModal } from './components/OpportunityDetailModal';
import { ExportModal } from './components/ExportModal';
import { api, QueueStatusResponse } from './services/api';
import { ResearchEvent, Opportunity, Company, Contact, ResearchMode } from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [queueStatus, setQueueStatus] = useState<QueueStatusResponse | null>(null);
  const [selectedMode, setSelectedMode] = useState<ResearchMode>('FAST');
  const [selectedConcurrency, setSelectedConcurrency] = useState<number>(10);
  const [events, setEvents] = useState<ResearchEvent[]>([]);
  const [recentOpportunities, setRecentOpportunities] = useState<
    (Opportunity & { publicEmail: string | null })[]
  >([]);
  const [recentCompanies, setRecentCompanies] = useState<Company[]>([]);
  const [recentContacts, setRecentContacts] = useState<Contact[]>([]);

  // Modals state
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Fetch initial dashboard & state data
  const refreshDashboardData = useCallback(async () => {
    try {
      const [statusRes, oppsRes, compsRes, contactsRes, eventsRes] = await Promise.all([
        api.getStatus(),
        api.getOpportunities({ sort: 'relevance' }),
        api.getCompanies({ sort: 'newest' }),
        api.getContacts(),
        api.getEvents(20),
      ]);

      setQueueStatus(statusRes);
      if (statusRes?.mode) setSelectedMode(statusRes.mode);
      if (statusRes?.concurrency) setSelectedConcurrency(statusRes.concurrency);
      setRecentOpportunities(oppsRes.opportunities || []);
      setRecentCompanies(compsRes.companies || []);
      setRecentContacts(contactsRes.contacts || []);
      setEvents(eventsRes || []);
    } catch (err) {
      console.error('Error loading dashboard state:', err);
    }
  }, []);

  useEffect(() => {
    refreshDashboardData();

    // Subscribe to real-time SSE stream
    const unsubscribe = api.subscribeEvents((msg) => {
      if (
        msg.event === 'INITIAL_STATE' ||
        msg.event === 'STATUS_CHANGE' ||
        msg.event === 'RESEARCH_TICK' ||
        msg.event === 'RESEARCH_COMPLETED' ||
        msg.event === 'STAGE_CHANGE'
      ) {
        if (msg.payload) {
          setQueueStatus(msg.payload);
        }
      }

      // Re-fetch data on meaningful transitions
      if (
        msg.event === 'RESEARCH_TICK' ||
        msg.event === 'COMPANY_UPDATED' ||
        msg.event === 'RESEARCH_COMPLETED' ||
        msg.event === 'VERIFICATION_COMPLETED'
      ) {
        api.getStatus().then(setQueueStatus).catch(() => {});
        api.getEvents(20).then(setEvents).catch(() => {});
        api.getOpportunities({ sort: 'relevance' }).then((r) => setRecentOpportunities(r.opportunities || [])).catch(() => {});
        api.getCompanies({ sort: 'newest' }).then((r) => setRecentCompanies(r.companies || [])).catch(() => {});
        api.getContacts().then((r) => setRecentContacts(r.contacts || [])).catch(() => {});
      }
    });

    return () => {
      unsubscribe();
    };
  }, [refreshDashboardData]);

  // Actions
  const handleStartTest10 = async () => {
    try {
      const res = await api.startTest10(selectedMode, selectedConcurrency);
      if (res.status) setQueueStatus(res.status);
      refreshDashboardData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartFull = async () => {
    try {
      const res = await api.startFullResearch(selectedMode, selectedConcurrency);
      if (res.status) setQueueStatus(res.status);
      refreshDashboardData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleModeChange = async (mode: ResearchMode) => {
    setSelectedMode(mode);
    try {
      await api.setMode(mode);
    } catch (e) {
      console.error(e);
    }
  };

  const handleConcurrencyChange = async (concurrency: number) => {
    setSelectedConcurrency(concurrency);
    try {
      await api.setConcurrency(concurrency);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePause = async () => {
    const res = await api.pauseResearch();
    if (res.status) setQueueStatus(res.status);
  };

  const handleResume = async () => {
    const res = await api.resumeResearch();
    if (res.status) setQueueStatus(res.status);
  };

  const handleStop = async () => {
    const res = await api.stopResearch();
    if (res.status) setQueueStatus(res.status);
  };

  const handleRetryFailed = async () => {
    const res = await api.retryFailed(selectedConcurrency);
    if (res.status) setQueueStatus(res.status);
  };

  const handleVerifyAll = async () => {
    setIsVerifying(true);
    try {
      await api.verifyAllOpportunities();
      await refreshDashboardData();
    } catch (e) {
      console.error(e);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900 antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Top Header */}
      <Header
        queueStatus={queueStatus}
        selectedMode={selectedMode}
        onModeChange={handleModeChange}
        selectedConcurrency={selectedConcurrency}
        onConcurrencyChange={handleConcurrencyChange}
        onStartTest10={handleStartTest10}
        onStartFull={handleStartFull}
        onOpenExport={() => setIsExportOpen(true)}
        onVerifyAll={handleVerifyAll}
        isVerifying={isVerifying}
      />

      {/* Main Body with Sidebar and Active View */}
      <div className="flex-1 flex flex-col md:flex-row">
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          queueStatus={queueStatus}
        />

        <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto overflow-y-auto">
          {activeTab === 'dashboard' && (
            <DashboardPage
              queueStatus={queueStatus}
              events={events}
              onNavigate={setActiveTab}
              onPause={handlePause}
              onResume={handleResume}
              onStop={handleStop}
              onRetryFailed={handleRetryFailed}
              onSelectCompany={setSelectedCompanyId}
              onSelectOpportunity={setSelectedOpportunity}
              recentOpportunities={recentOpportunities}
              recentCompanies={recentCompanies}
              recentContacts={recentContacts}
            />
          )}

          {activeTab === 'profile' && (
            <ProfilePage />
          )}

          {activeTab === 'companies' && (
            <CompaniesPage onSelectCompany={setSelectedCompanyId} />
          )}

          {activeTab === 'opportunities' && (
            <OpportunitiesPage onSelectOpportunity={setSelectedOpportunity} />
          )}

          {activeTab === 'open_applications' && (
            <OpenApplicationsPage
              onSelectCompany={setSelectedCompanyId}
              onNavigateToPipeline={() => setActiveTab('outreach')}
            />
          )}

          {activeTab === 'outreach' && (
            <OutreachPipelinePage />
          )}

          {activeTab === 'applications' && (
            <ApplicationsPipelinePage />
          )}

          {activeTab === 'internships' && (
            <OpportunitiesPage
              onSelectOpportunity={setSelectedOpportunity}
              presetType="INTERNSHIP"
              pageTitle="Bangalore Startup Internships"
              pageSubtitle="Internships, summer trainee programs, and apprenticeship openings across Bangalore tech startups"
            />
          )}

          {activeTab === 'aiml' && (
            <OpportunitiesPage
              onSelectOpportunity={setSelectedOpportunity}
              presetMinScore={60}
              pageTitle="Bangalore AI / ML & GenAI Opportunities"
              pageSubtitle="Top ranked machine learning, LLM engineering, and data intelligence positions"
            />
          )}

          {activeTab === 'fresher' && (
            <OpportunitiesPage
              onSelectOpportunity={setSelectedOpportunity}
              presetExperience={['FRESHER', 'ENTRY_LEVEL', 'INTERN', 'JUNIOR']}
              pageTitle="Fresher & Early-Career Positions"
              pageSubtitle="0-2 years experience, college graduate, and entry-level startup roles"
            />
          )}

          {activeTab === 'contacts' && (
            <ContactsPage onSelectCompany={setSelectedCompanyId} />
          )}

          {activeTab === 'runs' && <ResearchRunsPage />}

          {activeTab === 'failed' && (
            <FailedResearchPage
              onSelectCompany={setSelectedCompanyId}
              onRetryAllFailed={handleRetryFailed}
            />
          )}

          {activeTab === 'settings' && <SettingsPage />}
        </main>
      </div>

      {/* Modals */}
      <CompanyDetailModal
        companyId={selectedCompanyId}
        onClose={() => setSelectedCompanyId(null)}
        onSelectOpportunity={(opp) => {
          setSelectedCompanyId(null);
          setSelectedOpportunity(opp);
        }}
        onRefreshData={refreshDashboardData}
      />

      <OpportunityDetailModal
        opportunity={selectedOpportunity}
        onClose={() => setSelectedOpportunity(null)}
        onRefresh={refreshDashboardData}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />
    </div>
  );
}

export default App;

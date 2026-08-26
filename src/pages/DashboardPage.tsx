import React from 'react';
import {
  Building2,
  Briefcase,
  GraduationCap,
  Sparkles,
  UserCheck,
  Mail,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { QueueStatusResponse } from '../services/api';
import { ResearchEvent, Opportunity, Company, Contact } from '../types';
import { StatCard } from '../components/StatCard';
import { ResearchLiveCard } from '../components/ResearchLiveCard';
import { NavTab } from '../components/Sidebar';

interface DashboardPageProps {
  queueStatus: QueueStatusResponse | null;
  events: ResearchEvent[];
  onNavigate: (tab: NavTab) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onRetryFailed: () => void;
  onSelectCompany: (companyId: string) => void;
  onSelectOpportunity: (opp: Opportunity) => void;
  recentOpportunities: (Opportunity & { publicEmail: string | null })[];
  recentCompanies: Company[];
  recentContacts: Contact[];
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  queueStatus,
  events,
  onNavigate,
  onPause,
  onResume,
  onStop,
  onRetryFailed,
  onSelectCompany,
  onSelectOpportunity,
  recentOpportunities,
  recentCompanies,
  recentContacts,
}) => {
  const stats = queueStatus?.stats;

  return (
    <div id="dashboard-page" className="space-y-6">
      {/* Live Research Activity Section */}
      <ResearchLiveCard
        queueStatus={queueStatus}
        events={events}
        onPause={onPause}
        onResume={onResume}
        onStop={onStop}
        onRetryFailed={onRetryFailed}
      />

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          id="stat-companies"
          title="Companies Discovered"
          value={stats?.totalCompanies || 0}
          subtitle={`${stats?.researchedCompanies || 0} fully researched`}
          icon={Building2}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          onClick={() => onNavigate('companies')}
        />
        <StatCard
          id="stat-opportunities"
          title="Jobs Discovered"
          value={stats?.totalJobs || 0}
          subtitle={`${stats?.verifiedOpportunities || 0} verified links`}
          icon={Briefcase}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
          onClick={() => onNavigate('opportunities')}
        />
        <StatCard
          id="stat-internships"
          title="Internships & Trainees"
          value={stats?.totalInternships || 0}
          subtitle="Early-career opportunities"
          icon={GraduationCap}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
          onClick={() => onNavigate('internships')}
        />
        <StatCard
          id="stat-aiml"
          title="AI / ML & GenAI Roles"
          value={stats?.aiMlRoles || 0}
          subtitle="Relevance Score ≥ 60"
          icon={Sparkles}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          onClick={() => onNavigate('aiml')}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          id="stat-fresher"
          title="Fresher & Graduate Roles"
          value={stats?.fresherRoles || 0}
          subtitle="0-2 years experience"
          icon={UserCheck}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          onClick={() => onNavigate('fresher')}
        />
        <StatCard
          id="stat-contacts"
          title="Public Recruitment Emails"
          value={stats?.publicEmails || 0}
          subtitle="Scraped public contacts"
          icon={Mail}
          iconColor="text-teal-600"
          iconBg="bg-teal-50"
          onClick={() => onNavigate('contacts')}
        />
        <StatCard
          id="stat-verified"
          title="Verified Opportunities"
          value={stats?.verifiedOpportunities || 0}
          subtitle="Official careers/ATS evidence"
          icon={ShieldCheck}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          onClick={() => onNavigate('opportunities')}
        />
        <StatCard
          id="stat-failed"
          title="Unresolved Errors"
          value={stats?.unresolvedErrors || 0}
          subtitle="Recoverable network/pages"
          icon={AlertTriangle}
          iconColor="text-rose-600"
          iconBg="bg-rose-50"
          onClick={() => onNavigate('failed')}
        />
      </div>

      {/* Two Column Layout: Recent High-Relevance Opportunities & Companies */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: High Relevance Opportunities */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                Top AI & Tech Opportunities in Bangalore
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                Ranked by AI relevance score and verification confidence
              </p>
            </div>
            <button
              onClick={() => onNavigate('opportunities')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View All ({stats?.totalOpportunities || 0}) <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentOpportunities.length === 0 ? (
            <div className="text-center py-10 text-xs text-gray-500 bg-gray-50 rounded-xl border border-gray-200/80">
              No opportunities discovered yet. Click "Test Batch (10 Startups)" to begin real-time crawling.
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentOpportunities.slice(0, 5).map((opp) => (
                <div
                  key={opp.id}
                  onClick={() => onSelectOpportunity(opp)}
                  className="p-3.5 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer bg-white flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-900">{opp.title}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          opp.type === 'INTERNSHIP'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {opp.type}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {opp.experienceLevel}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 font-medium">
                      <strong className="text-gray-800">{opp.companyName}</strong> • {opp.location} • {opp.remote}
                    </div>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {opp.skills.slice(0, 3).map((s, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 text-gray-600"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-extrabold text-blue-600">
                      {opp.relevanceScore}/100
                    </div>
                    <span className="text-[10px] text-gray-400 font-medium block mt-0.5">
                      {opp.verificationStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 1 Col: Bangalore Startups & Contacts */}
        <div className="space-y-6">
          {/* Companies card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
              <h2 className="text-sm font-bold text-gray-900">Bangalore Startups</h2>
              <button
                onClick={() => onNavigate('companies')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                All ({recentCompanies.length}) <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-2">
              {recentCompanies.slice(0, 5).map((c) => (
                <div
                  key={c.id}
                  onClick={() => onSelectCompany(c.id)}
                  className="p-2.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/20 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-gray-900">{c.name}</div>
                    <div className="text-[11px] text-gray-500 truncate max-w-[170px]">
                      {c.sector || 'Technology'}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      c.status === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Contacts card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
              <h2 className="text-sm font-bold text-gray-900">Public Recruitment Contacts</h2>
              <button
                onClick={() => onNavigate('contacts')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                All ({recentContacts.length}) <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-2">
              {recentContacts.slice(0, 4).map((cnt) => (
                <div
                  key={cnt.id}
                  className="p-2 rounded-lg border border-gray-200 bg-gray-50/50 flex items-center justify-between text-xs"
                >
                  <div className="truncate">
                    <div className="font-bold text-gray-900 truncate">{cnt.email}</div>
                    <div className="text-[10px] text-gray-500">{cnt.companyName} • {cnt.emailType}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

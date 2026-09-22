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
  Inbox,
  SendHorizontal,
  MapPin,
  Globe,
  Layers,
  Zap,
} from 'lucide-react';
import { QueueStatusResponse } from '../services/api';
import { ResearchEvent, Opportunity, Company, Contact, LocationScope } from '../types';
import { StatCard } from '../components/StatCard';
import { ResearchLiveCard } from '../components/ResearchLiveCard';
import { NavTab } from '../components/Sidebar';
import { getSourceBadge } from '../utils/sourceBadges';

interface DashboardPageProps {
  queueStatus: QueueStatusResponse | null;
  events: ResearchEvent[];
  selectedLocation: LocationScope;
  onLocationChange: (loc: LocationScope) => void;
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
  onStartTest10?: () => void;
  onStartFull?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  queueStatus,
  events,
  selectedLocation,
  onLocationChange,
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
  onStartTest10,
  onStartFull,
}) => {
  const stats = queueStatus?.stats as any;
  const companyStats = stats?.companyStats;
  const sourceStats = stats?.sourceStats || companyStats;

  const blrSrc = sourceStats?.bangalore || companyStats?.bangalore;
  const hydSrc = sourceStats?.hyderabad || companyStats?.hyderabad;
  const wwwSrc = sourceStats?.whereWeWork || companyStats?.whereWeWork;
  const flmSrc = sourceStats?.frontlines || companyStats?.frontlines;
  const offSrc = sourceStats?.officialCareers || companyStats?.officialCareers;

  const blrStored = blrSrc?.stored ?? (selectedLocation === 'BANGALORE' ? (stats?.totalCompanies || 0) : 0);
  const blrResearched = blrSrc?.researched ?? (selectedLocation === 'BANGALORE' ? (stats?.researchedCompanies || 0) : 0);

  const hydStored = hydSrc?.stored ?? (selectedLocation === 'HYDERABAD' ? (stats?.totalCompanies || 0) : 0);
  const hydResearched = hydSrc?.researched ?? (selectedLocation === 'HYDERABAD' ? (stats?.researchedCompanies || 0) : 0);

  const bothStored = companyStats?.combined?.stored ?? (selectedLocation === 'BOTH' ? (stats?.totalCompanies || 0) : (blrStored + hydStored));
  const bothResearched = companyStats?.combined?.researched ?? (selectedLocation === 'BOTH' ? (stats?.researchedCompanies || 0) : (blrResearched + hydResearched));

  const locationDetails: Record<LocationScope, { title: string; subtitle: string; sourceUrl: string; count: string }> = {
    BANGALORE: {
      title: 'Bangalore Startup Ecosystem',
      subtitle: 'Official source: bangalorestartupmap.com',
      sourceUrl: 'https://www.bangalorestartupmap.com/',
      count: `${blrStored} Startups in DB (${blrResearched} Researched)`,
    },
    HYDERABAD: {
      title: 'Hyderabad Startup Ecosystem',
      subtitle: 'Official source: hyderabadstartupsmap.lol',
      sourceUrl: 'https://www.hyderabadstartupsmap.lol/',
      count: `${hydStored} Startups in DB (${hydResearched} Researched)`,
    },
    BOTH: {
      title: 'Bangalore & Hyderabad Dual Ecosystems',
      subtitle: 'Combined parallel intelligence across both major Indian tech capitals',
      sourceUrl: 'https://www.bangalorestartupmap.com/ & https://www.hyderabadstartupsmap.lol/',
      count: `${bothStored} Total Startups in DB (${bothResearched} Researched)`,
    },
    WHEREWEWORK: {
      title: 'WhereWeWork.co.in Hubs',
      subtitle: 'Official source: wherewework.co.in (All discoverable locations, jobs & internships)',
      sourceUrl: 'https://wherewework.co.in/',
      count: 'Global Tech Hubs & Live Openings',
    },
    FRONTLINES: {
      title: 'Frontlines Media Directory',
      subtitle: 'Official source: frontlinesmedia.in (302 Company Career Directory & Official Career Pages)',
      sourceUrl: 'https://frontlinesmedia.in/302-company-career-pages/',
      count: '302 Verified Company Career Pages',
    },
    ALL: {
      title: 'All Opportunity Sources',
      subtitle: 'Unified intelligence across Bangalore Map, Hyderabad Map, WhereWeWork.co.in, and Frontlines Media',
      sourceUrl: 'Multi-Source Intelligence',
      count: `${bothStored} Total Startups in DB`,
    },
    GLOBAL: {
      title: 'Global Opportunities',
      subtitle: 'Live opportunities across all discoverable cities, tech hubs, and verified official career pages',
      sourceUrl: 'Worldwide Intelligence',
      count: `${bothStored} Total Startups in DB`,
    },
  };

  const currentLoc = locationDetails[selectedLocation];

  return (
    <div id="dashboard-page" className="space-y-6">
      {/* Multi-Source Architectural Metric Cards */}
      <div>
        <div className="flex items-center justify-between pb-2 mb-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900 tracking-tight">
              Verified Opportunity Sources
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Real-time database counts per source — Bangalore & Hyderabad maps, WhereWeWork.co.in, Frontlines Media & Official Portals
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onLocationChange('BANGALORE')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                selectedLocation === 'BANGALORE'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Bangalore
            </button>
            <button
              onClick={() => onLocationChange('HYDERABAD')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                selectedLocation === 'HYDERABAD'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Hyderabad
            </button>
            <button
              onClick={() => onLocationChange('WHEREWEWORK')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                selectedLocation === 'WHEREWEWORK'
                  ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              WhereWeWork
            </button>
            <button
              onClick={() => onLocationChange('FRONTLINES')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                selectedLocation === 'FRONTLINES'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Frontlines
            </button>
            <button
              onClick={() => onLocationChange('BOTH')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                selectedLocation === 'BOTH'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Both Hubs
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* 1. Bangalore Startup Map Card */}
          <div
            onClick={() => onLocationChange('BANGALORE')}
            className={`cursor-pointer rounded-xl p-4 transition-all border flex flex-col justify-between ${
              selectedLocation === 'BANGALORE'
                ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-1 mb-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    BLR
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-gray-900 leading-tight">Bangalore Startup Map</h3>
                    <a
                      href="https://www.bangalorestartupmap.com/"
                      target="_blank"
                      rel="noreferrer noopener"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5 font-medium"
                    >
                      bangalorestartupmap.com <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold ${
                  blrSrc?.status === 'RUNNING' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {blrSrc?.status || 'READY'}
                </span>
              </div>
              <div className="text-lg font-black text-gray-900 mt-1">
                {blrSrc?.stored || blrStored} <span className="text-xs font-medium text-gray-500">Startups</span>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-gray-100 grid grid-cols-2 gap-1 text-[11px] text-gray-600">
              <div>Jobs: <strong className="text-gray-900 font-bold">{blrSrc?.jobs || 0}</strong></div>
              <div>Interns: <strong className="text-gray-900 font-bold">{blrSrc?.internships || 0}</strong></div>
            </div>
          </div>

          {/* 2. Hyderabad Startup Map Card */}
          <div
            onClick={() => onLocationChange('HYDERABAD')}
            className={`cursor-pointer rounded-xl p-4 transition-all border flex flex-col justify-between ${
              selectedLocation === 'HYDERABAD'
                ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-1 mb-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    HYD
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-gray-900 leading-tight">Hyderabad Startup Map</h3>
                    <a
                      href="https://www.hyderabadstartupsmap.lol/"
                      target="_blank"
                      rel="noreferrer noopener"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] text-indigo-600 hover:underline flex items-center gap-0.5 font-medium"
                    >
                      hyderabadstartupsmap.lol <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold ${
                  hydSrc?.status === 'RUNNING' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {hydSrc?.status || 'READY'}
                </span>
              </div>
              <div className="text-lg font-black text-gray-900 mt-1">
                {hydSrc?.stored || hydStored} <span className="text-xs font-medium text-gray-500">Startups</span>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-gray-100 grid grid-cols-2 gap-1 text-[11px] text-gray-600">
              <div>Jobs: <strong className="text-gray-900 font-bold">{hydSrc?.jobs || 0}</strong></div>
              <div>Interns: <strong className="text-gray-900 font-bold">{hydSrc?.internships || 0}</strong></div>
            </div>
          </div>

          {/* 3. WhereWeWork.co.in Card */}
          <div
            onClick={() => onLocationChange('WHEREWEWORK')}
            className={`cursor-pointer rounded-xl p-4 transition-all border flex flex-col justify-between ${
              selectedLocation === 'WHEREWEWORK'
                ? 'bg-teal-50/90 border-teal-500 ring-2 ring-teal-500/20 shadow-xs'
                : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-1 mb-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    WWW
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-gray-900 leading-tight">WhereWeWork.co.in</h3>
                    <a
                      href="https://wherewework.co.in/"
                      target="_blank"
                      rel="noreferrer noopener"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] text-teal-700 hover:underline flex items-center gap-0.5 font-medium"
                    >
                      wherewework.co.in <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold ${
                  wwwSrc?.status === 'RUNNING' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {wwwSrc?.status || 'READY'}
                </span>
              </div>
              <div className="text-lg font-black text-gray-900 mt-1">
                {wwwSrc?.stored || 0} <span className="text-xs font-medium text-gray-500">Companies</span>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-600">
              <div>Jobs: <strong className="text-gray-900 font-bold">{wwwSrc?.jobs || 0}</strong></div>
              <div>Interns: <strong className="text-gray-900 font-bold">{wwwSrc?.internships || 0}</strong></div>
              <div><strong className="text-teal-700 font-bold">{wwwSrc?.locationsDiscovered || 0}</strong> Hubs</div>
            </div>
          </div>

          {/* 4. Frontlines Media Directory Card */}
          <div
            onClick={() => onLocationChange('FRONTLINES')}
            className={`cursor-pointer rounded-xl p-4 transition-all border flex flex-col justify-between ${
              selectedLocation === 'FRONTLINES'
                ? 'bg-amber-50/90 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-1 mb-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    FLM
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-gray-900 leading-tight">Frontlines Media</h3>
                    <a
                      href="https://frontlinesmedia.in/302-company-career-pages/"
                      target="_blank"
                      rel="noreferrer noopener"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] text-amber-700 hover:underline flex items-center gap-0.5 font-medium"
                    >
                      302 Career Pages <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold ${
                  flmSrc?.status === 'RUNNING' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {flmSrc?.status || 'READY'}
                </span>
              </div>
              <div className="text-lg font-black text-gray-900 mt-1">
                {flmSrc?.stored || flmSrc?.careerPagesDiscovered || 302} <span className="text-xs font-medium text-gray-500">Directory</span>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-600">
              <div>Discovered: <strong className="text-gray-900 font-bold">{flmSrc?.careerPagesDiscovered || 302}</strong></div>
              <div>Checked: <strong className="text-gray-900 font-bold">{flmSrc?.careerPagesChecked || 0}</strong></div>
            </div>
          </div>

          {/* 5. Official Company Career Pages Card */}
          <div
            className="rounded-xl p-4 border bg-gradient-to-br from-emerald-50/70 to-teal-50/40 border-emerald-300 flex flex-col justify-between shadow-xs"
          >
            <div>
              <div className="flex items-start justify-between gap-1 mb-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    ATS
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-gray-900 leading-tight">Official Career Portals</h3>
                    <span className="text-[10px] text-emerald-800 font-semibold block">Authoritative Crawling</span>
                  </div>
                </div>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800">
                  {offSrc?.status || 'READY'}
                </span>
              </div>
              <div className="text-lg font-black text-emerald-950 mt-1">
                {offSrc?.careersVisited || 0} <span className="text-xs font-medium text-gray-500">Visited</span>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-emerald-100 space-y-1 text-[11px] text-gray-700">
              <div className="flex justify-between">
                <span>Jobs Extracted: <strong className="font-bold text-gray-900">{offSrc?.jobs || 0}</strong></span>
                <span>Interns: <strong className="font-bold text-gray-900">{offSrc?.internships || 0}</strong></span>
              </div>
              <div className="truncate text-[10px] text-emerald-900 font-medium">
                ATS: {offSrc?.atsTypesDetected?.length ? offSrc.atsTypesDetected.slice(0, 3).join(', ') : 'Greenhouse, Lever, Ashby, Keka'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Research Activity Section */}
      <ResearchLiveCard
        queueStatus={queueStatus}
        events={events}
        selectedLocation={selectedLocation}
        onPause={onPause}
        onResume={onResume}
        onStop={onStop}
        onRetryFailed={onRetryFailed}
      />

      {/* Action Pipeline Quick Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-indigo-950 text-white rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
              Automated Outreach Pipeline
            </span>
            <span className="text-sm font-semibold">
              Cold Email Engine (Zero Guessed Emails)
            </span>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/10 text-emerald-200">
              {currentLoc.title}
            </span>
          </div>
          <p className="text-xs text-emerald-200/90 max-w-xl">
            Auto-discovers career portals, checks ATS platforms (Greenhouse, Lever, Ashby, Workable, Keka), and drafts customized outreach for verified job openings and talent pools across {currentLoc.title}.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onNavigate('open_applications')}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition border border-white/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Open Pools ({stats?.openApplications || 0})</span>
          </button>

          <button
            onClick={() => onNavigate('outreach')}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <SendHorizontal className="w-3.5 h-3.5" />
            <span>My Outreach Pipeline</span>
          </button>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          id="stat-companies"
          title={`Companies (${selectedLocation === 'BOTH' ? 'Both' : selectedLocation === 'HYDERABAD' ? 'Hyd' : 'Blr'})`}
          value={stats?.totalCompanies || 0}
          subtitle={`${stats?.researchedCompanies || 0} fully researched`}
          icon={Building2}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          onClick={() => onNavigate('companies')}
        />
        <StatCard
          id="stat-opportunities"
          title="All Opportunities"
          value={stats?.totalOpportunities || stats?.totalJobs || 0}
          subtitle={`${stats?.verifiedOpportunities || 0} verified career links`}
          icon={Briefcase}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
          onClick={() => onNavigate('opportunities')}
        />
        <StatCard
          id="stat-open-apps"
          title="Open Applications"
          value={stats?.openApplications || 0}
          subtitle="Talent pool opportunities"
          icon={Inbox}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
          onClick={() => onNavigate('open_applications')}
        />
        <StatCard
          id="stat-applications-ready"
          title="Ready to Send"
          value={stats?.applicationsReadyCount || 0}
          subtitle="Human review queue"
          icon={SendHorizontal}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          onClick={() => onNavigate('applications')}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          id="stat-aiml"
          title="AI / ML & GenAI Roles"
          value={stats?.aiMlRoles || 0}
          subtitle="AI/ML Priority Filter"
          icon={Sparkles}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          onClick={() => onNavigate('aiml')}
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
          id="stat-contacts"
          title="Public Recruitment Emails"
          value={stats?.publicEmails || 0}
          subtitle="Verified public contacts"
          icon={Mail}
          iconColor="text-teal-600"
          iconBg="bg-teal-50"
          onClick={() => onNavigate('contacts')}
        />
        <StatCard
          id="stat-sent-count"
          title="Sent Applications"
          value={stats?.sentApplicationsCount || 0}
          subtitle="Delivered & tracked"
          icon={ShieldCheck}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          onClick={() => onNavigate('applications')}
        />
      </div>

      {/* Role Category Distribution Strip */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-100">
          <div>
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Comprehensive Role Distribution ({selectedLocation === 'BOTH' ? 'Bangalore & Hyderabad' : selectedLocation === 'HYDERABAD' ? 'Hyderabad Map' : 'Bangalore Map'})
            </h3>
            <p className="text-[11px] text-gray-500 font-medium">
              Every job category discovered across {currentLoc.title}
            </p>
          </div>
          <button
            onClick={() => onNavigate('opportunities')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            Explore All <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <div
            onClick={() => onNavigate('aiml')}
            className="cursor-pointer px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200/80 transition flex items-center gap-2"
          >
            <span className="text-xs font-bold text-amber-900">AI / ML & GenAI:</span>
            <span className="px-1.5 py-0.5 rounded-md bg-amber-200/80 text-[11px] font-extrabold text-amber-900">
              {stats?.aiMlRoles || 0}
            </span>
          </div>

          <div
            onClick={() => onNavigate('opportunities')}
            className="cursor-pointer px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200/80 transition flex items-center gap-2"
          >
            <span className="text-xs font-bold text-blue-900">Software & Full-Stack:</span>
            <span className="px-1.5 py-0.5 rounded-md bg-blue-200/80 text-[11px] font-extrabold text-blue-900">
              {stats?.softwareRoles || 0}
            </span>
          </div>

          <div
            onClick={() => onNavigate('opportunities')}
            className="cursor-pointer px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 transition flex items-center gap-2"
          >
            <span className="text-xs font-bold text-emerald-900">Data Science & BI:</span>
            <span className="px-1.5 py-0.5 rounded-md bg-emerald-200/80 text-[11px] font-extrabold text-emerald-900">
              {stats?.dataRoles || 0}
            </span>
          </div>

          <div
            onClick={() => onNavigate('opportunities')}
            className="cursor-pointer px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 transition flex items-center gap-2"
          >
            <span className="text-xs font-bold text-indigo-900">Backend Systems:</span>
            <span className="px-1.5 py-0.5 rounded-md bg-indigo-200/80 text-[11px] font-extrabold text-indigo-900">
              {stats?.backendRoles || 0}
            </span>
          </div>

          <div
            onClick={() => onNavigate('opportunities')}
            className="cursor-pointer px-3 py-1.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 border border-cyan-200/80 transition flex items-center gap-2"
          >
            <span className="text-xs font-bold text-cyan-900">Frontend & UI:</span>
            <span className="px-1.5 py-0.5 rounded-md bg-cyan-200/80 text-[11px] font-extrabold text-cyan-900">
              {stats?.frontendRoles || 0}
            </span>
          </div>

          <div
            onClick={() => onNavigate('opportunities')}
            className="cursor-pointer px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200/80 transition flex items-center gap-2"
          >
            <span className="text-xs font-bold text-purple-900">Product & Design:</span>
            <span className="px-1.5 py-0.5 rounded-md bg-purple-200/80 text-[11px] font-extrabold text-purple-900">
              {stats?.productRoles || 0}
            </span>
          </div>

          <div
            onClick={() => onNavigate('internships')}
            className="cursor-pointer px-3 py-1.5 rounded-lg bg-pink-50 hover:bg-pink-100 border border-pink-200/80 transition flex items-center gap-2"
          >
            <span className="text-xs font-bold text-pink-900">Internships & Trainees:</span>
            <span className="px-1.5 py-0.5 rounded-md bg-pink-200/80 text-[11px] font-extrabold text-pink-900">
              {stats?.totalInternships || 0}
            </span>
          </div>

          <div
            onClick={() => onNavigate('opportunities')}
            className="cursor-pointer px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-200/80 transition flex items-center gap-2"
          >
            <span className="text-xs font-bold text-teal-900">Marketing, Sales & Ops:</span>
            <span className="px-1.5 py-0.5 rounded-md bg-teal-200/80 text-[11px] font-extrabold text-teal-900">
              {(stats?.marketingRoles || 0) + (stats?.salesRoles || 0) + (stats?.operationsRoles || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Recent High-Relevance Opportunities & Companies */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: High Relevance Opportunities */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                Top Opportunities in {selectedLocation === 'BOTH' ? 'Bangalore & Hyderabad' : selectedLocation === 'HYDERABAD' ? 'Hyderabad' : 'Bangalore'}
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                Ranked by AI relevance score and verified career link confidence
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
              No opportunities discovered for {currentLoc.title} yet. Click "Test 10" or "Research ALL" to begin crawling.
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-gray-900">{opp.title}</span>
                      {(() => {
                        const badge = getSourceBadge(opp);
                        return (
                          <a
                            href={badge.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            onClick={(e) => e.stopPropagation()}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 hover:underline ${badge.style}`}
                          >
                            {badge.label}
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        );
                      })()}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          opp.type === 'INTERNSHIP'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-gray-100 text-gray-700 border border-gray-200'
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

        {/* Right 1 Col: Startups & Contacts */}
        <div className="space-y-6">
          {/* Companies card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
              <h2 className="text-sm font-bold text-gray-900">
                {selectedLocation === 'BOTH' ? 'Discovered Startups' : selectedLocation === 'HYDERABAD' ? 'Hyderabad Startups' : 'Bangalore Startups'}
              </h2>
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
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-gray-900">{c.name}</span>
                      {(() => {
                        const badge = getSourceBadge(c as any);
                        return (
                          <a
                            href={badge.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            onClick={(e) => e.stopPropagation()}
                            className={`px-1.5 py-0.2 rounded-xs text-[9px] font-bold border flex items-center gap-0.5 hover:underline ${badge.style}`}
                          >
                            {badge.label.replace(' Startup Map', ' Map').replace('.co.in', '')}
                          </a>
                        );
                      })()}
                    </div>
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


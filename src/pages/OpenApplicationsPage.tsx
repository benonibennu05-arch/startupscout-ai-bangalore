import React, { useState, useEffect } from 'react';
import {
  Inbox,
  Mail,
  ExternalLink,
  Sparkles,
  SendHorizontal,
  CheckCircle2,
  Search,
  Filter,
  RefreshCw,
  Building2,
  Info,
  ArrowRight,
  Copy,
  Check,
} from 'lucide-react';
import { OpenApplication, Company } from '../types';
import { api } from '../services/api';

interface OpenApplicationsPageProps {
  onSelectCompany?: (companyId: string) => void;
  onNavigateToPipeline?: () => void;
}

export const OpenApplicationsPage: React.FC<OpenApplicationsPageProps> = ({
  onSelectCompany,
  onNavigateToPipeline,
}) => {
  const [openApps, setOpenApps] = useState<OpenApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [onlyWithEmail, setOnlyWithEmail] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [draftSuccessId, setDraftSuccessId] = useState<string | null>(null);
  const [isAutoDrafting, setIsAutoDrafting] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const fetchOpenApplications = async () => {
    setIsLoading(true);
    try {
      const data = await api.getOpenApplications({
        search,
        onlyWithEmail,
      });
      setOpenApps(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load open applications:', err);
      setOpenApps([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOpenApplications();
  }, [search, onlyWithEmail]);

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const handleGenerateApplication = async (app: OpenApplication) => {
    setGeneratingId(app.id);
    try {
      const res = await api.generateApplication({
        companyId: app.companyId,
        openApplicationId: app.id,
      });
      if (res.success) {
        setDraftSuccessId(app.id);
        setTimeout(() => setDraftSuccessId(null), 3000);
      }
    } catch (err) {
      console.error('Error generating application draft:', err);
    } finally {
      setGeneratingId(null);
    }
  };

  const handleAutoDraftAll = async () => {
    setIsAutoDrafting(true);
    try {
      await api.autoDraftApplications();
      await fetchOpenApplications();
      if (onNavigateToPipeline) {
        onNavigateToPipeline();
      }
    } catch (err) {
      console.error('Error auto-drafting applications:', err);
    } finally {
      setIsAutoDrafting(false);
    }
  };

  const withEmailCount = openApps.filter(
    (a) => a.contactEmail && a.contactEmail !== 'NOT PUBLICLY AVAILABLE'
  ).length;

  return (
    <div id="open-applications-page" className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                <Inbox className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold text-gray-900">
                Open Applications & Talent Pool Opportunities
              </h1>
            </div>
            <p className="text-sm text-gray-500 max-w-2xl">
              Companies that explicitly welcome spontaneous outreach, talent pool submissions, or have proactive hiring invitations on their official public pages.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="btn-auto-draft-all"
              onClick={handleAutoDraftAll}
              disabled={isAutoDrafting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition shadow-xs disabled:opacity-50"
            >
              {isAutoDrafting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating Drafts...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Auto-Draft All Emails
                </>
              )}
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
          <div>
            <div className="text-xs text-gray-500 font-medium">Total Open Opportunities</div>
            <div className="text-xl font-bold text-gray-900 mt-0.5">{openApps.length}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">With Verified Public Email</div>
            <div className="text-xl font-bold text-emerald-600 mt-0.5">{withEmailCount}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">AI & Software Alignment</div>
            <div className="text-xl font-bold text-blue-600 mt-0.5">High Priority</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            id="input-search-open-apps"
            placeholder="Search company, evidence quote, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
          />
        </div>

        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 select-none">
            <input
              type="checkbox"
              id="checkbox-only-with-email"
              checked={onlyWithEmail}
              onChange={(e) => setOnlyWithEmail(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 border-gray-300 w-4 h-4"
            />
            <span>Only with verified public email</span>
          </label>

          <button
            onClick={fetchOpenApplications}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
            title="Refresh list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* List / Cards */}
      {isLoading ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
          Loading open application opportunities...
        </div>
      ) : openApps.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-gray-200 space-y-3">
          <Inbox className="w-10 h-10 text-gray-300 mx-auto" />
          <h3 className="text-base font-semibold text-gray-900">No Open Application opportunities match your search</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Try adjusting your search query or running research on more Bangalore startups.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {openApps.map((app) => {
            const hasEmail = app.contactEmail && app.contactEmail !== 'NOT PUBLICLY AVAILABLE';

            return (
              <div
                key={app.id}
                id={`open-app-card-${app.id}`}
                className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs hover:border-gray-300 transition flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onSelectCompany && onSelectCompany(app.companyId)}
                          className="text-base font-bold text-gray-900 hover:text-blue-600 transition text-left"
                        >
                          {app.companyName}
                        </button>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700">
                          {app.relevanceScore}% Match
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                        <Building2 className="w-3.5 h-3.5 text-gray-400" />
                        <span>Bangalore Tech Startup</span>
                      </div>
                    </div>

                    <a
                      href={app.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="View Official Source Page"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>

                  {/* Evidence / Quoted Statement */}
                  <div className="bg-gray-50 border-l-3 border-blue-500 rounded-r-lg p-3 my-3">
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                      <Info className="w-3 h-3 text-blue-500" />
                      Official Public Evidence
                    </div>
                    <p className="text-xs text-gray-700 italic leading-relaxed">
                      "{app.evidence}"
                    </p>
                  </div>

                  {/* Recipient / Contact Badge */}
                  <div className="my-3 flex items-center justify-between bg-gray-50/80 px-3 py-2 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      {hasEmail ? (
                        <span className="text-xs font-semibold text-gray-800 font-mono">
                          {app.contactEmail}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">
                          No public email (Careers Portal only)
                        </span>
                      )}
                    </div>

                    {hasEmail && (
                      <button
                        onClick={() => handleCopyEmail(app.contactEmail!)}
                        className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1 transition"
                      >
                        {copiedEmail === app.contactEmail ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600 font-medium">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2 mt-2">
                  <span className="text-[11px] text-gray-400">
                    Discovered {new Date(app.discoveredAt).toLocaleDateString()}
                  </span>

                  {hasEmail ? (
                    <button
                      id={`btn-generate-app-${app.id}`}
                      onClick={() => handleGenerateApplication(app)}
                      disabled={generatingId === app.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition disabled:opacity-50"
                    >
                      {generatingId === app.id ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Drafting...</span>
                        </>
                      ) : draftSuccessId === app.id ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Draft Created!</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                          <span>Generate Application</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <a
                      href={app.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition"
                    >
                      <span>Submit on Website</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

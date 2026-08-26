import React, { useState, useEffect } from 'react';
import {
  Search,
  Briefcase,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Mail,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { Opportunity } from '../types';
import { api } from '../services/api';

interface OpportunitiesPageProps {
  onSelectOpportunity: (opp: Opportunity) => void;
  presetType?: string;
  presetMinScore?: number;
  presetExperience?: string[];
  pageTitle?: string;
  pageSubtitle?: string;
}

export const OpportunitiesPage: React.FC<OpportunitiesPageProps> = ({
  onSelectOpportunity,
  presetType,
  presetMinScore,
  presetExperience,
  pageTitle = 'Bangalore Startup Opportunities',
  pageSubtitle = 'Real jobs, internships, and entry-level positions discovered from Bangalore startups',
}) => {
  const [opportunities, setOpportunities] = useState<(Opportunity & { publicEmail: string | null })[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(presetType || 'ALL');
  const [expFilter, setExpFilter] = useState('ALL');
  const [remoteFilter, setRemoteFilter] = useState('ALL');
  const [verificationFilter, setVerificationFilter] = useState('ALL');
  const [minScore, setMinScore] = useState<number>(presetMinScore || 0);
  const [hasEmail, setHasEmail] = useState(false);
  const [hasApp, setHasApp] = useState(false);
  const [sort, setSort] = useState('relevance');

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      const res = await api.getOpportunities({
        search: search || undefined,
        type: typeFilter !== 'ALL' ? typeFilter : undefined,
        experienceLevel: expFilter !== 'ALL' ? expFilter : undefined,
        remote: remoteFilter !== 'ALL' ? remoteFilter : undefined,
        verificationStatus: verificationFilter !== 'ALL' ? verificationFilter : undefined,
        minRelevance: minScore > 0 ? minScore : undefined,
        hasEmail: hasEmail || undefined,
        hasApp: hasApp || undefined,
        sort,
      });

      let list = res.opportunities || [];
      if (presetExperience && presetExperience.length > 0) {
        list = list.filter((o) => presetExperience.includes(o.experienceLevel));
      }
      setOpportunities(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, [
    search,
    typeFilter,
    expFilter,
    remoteFilter,
    verificationFilter,
    minScore,
    hasEmail,
    hasApp,
    sort,
  ]);

  return (
    <div id="opportunities-page" className="space-y-5">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">
            {pageTitle} ({opportunities.length})
          </h2>
          <p className="text-xs text-gray-500 font-medium">{pageSubtitle}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search title, company, skills (Python, PyTorch, GraphQL, LLM)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50/50"
            />
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {!presetType && (
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-hidden"
              >
                <option value="ALL">All Types</option>
                <option value="FULL_TIME">Full Time</option>
                <option value="INTERNSHIP">Internship</option>
                <option value="CONTRACT">Contract</option>
                <option value="GRADUATE">Graduate</option>
                <option value="APPRENTICESHIP">Apprenticeship</option>
              </select>
            )}

            <select
              value={expFilter}
              onChange={(e) => setExpFilter(e.target.value)}
              className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-hidden"
            >
              <option value="ALL">All Experience Levels</option>
              <option value="INTERN">Intern</option>
              <option value="FRESHER">Fresher</option>
              <option value="ENTRY_LEVEL">Entry Level</option>
              <option value="JUNIOR">Junior (1-2y)</option>
              <option value="MID">Mid Level</option>
              <option value="SENIOR">Senior</option>
            </select>

            <select
              value={remoteFilter}
              onChange={(e) => setRemoteFilter(e.target.value)}
              className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-hidden"
            >
              <option value="ALL">All Work Modes</option>
              <option value="REMOTE">Remote</option>
              <option value="HYBRID">Hybrid</option>
              <option value="ON_SITE">On-Site</option>
            </select>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-hidden"
            >
              <option value="relevance">Highest Relevance</option>
              <option value="newest">Recently Discovered</option>
              <option value="company">Company Name</option>
            </select>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-4 pt-1 text-xs text-gray-600">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hasEmail}
              onChange={(e) => setHasEmail(e.target.checked)}
              className="rounded-xs text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
            />
            <span>Has Public Contact Email</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hasApp}
              onChange={(e) => setHasApp(e.target.checked)}
              className="rounded-xs text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
            />
            <span>Has Direct Application Link</span>
          </label>

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-gray-500 text-[11px] font-medium">Min AI Score:</span>
            <input
              type="range"
              min="0"
              max="90"
              step="10"
              value={minScore}
              onChange={(e) => setMinScore(parseInt(e.target.value, 10))}
              className="w-24 accent-blue-600"
            />
            <span className="font-bold text-blue-600 text-xs w-6">{minScore}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            Loading opportunities...
          </div>
        ) : opportunities.length === 0 ? (
          <div className="py-16 text-center text-xs text-gray-500">
            No current opportunities match these filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Opportunity</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Type & Experience</th>
                  <th className="py-3 px-4">Key Skills</th>
                  <th className="py-3 px-4">Relevance</th>
                  <th className="py-3 px-4">Verification</th>
                  <th className="py-3 px-4">Public Email</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200/80">
                {opportunities.map((opp) => (
                  <tr
                    key={opp.id}
                    className="hover:bg-blue-50/20 transition-colors cursor-pointer"
                    onClick={() => onSelectOpportunity(opp)}
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900">{opp.title}</div>
                      <div className="text-[11px] text-gray-500">
                        {opp.location} • <span className="font-medium">{opp.remote}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-blue-700">{opp.companyName}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
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
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {opp.skills.slice(0, 3).map((sk, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 text-gray-600"
                          >
                            {sk}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-blue-600">{opp.relevanceScore}</span>
                        <div className="w-12 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full"
                            style={{ width: `${opp.relevanceScore}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          opp.verificationStatus === 'VERIFIED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        <ShieldCheck className="w-3 h-3" />
                        {opp.verificationStatus}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {opp.publicEmail ? (
                        <div className="flex items-center gap-1 text-teal-700 font-medium truncate max-w-[150px]">
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{opp.publicEmail}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-[11px]">No public email</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {opp.applicationUrl ? (
                        <a
                          href={opp.applicationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md hover:bg-blue-100 transition-colors"
                        >
                          Apply <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectOpportunity(opp);
                          }}
                          className="text-xs font-bold text-gray-600 hover:text-gray-800"
                        >
                          Details →
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

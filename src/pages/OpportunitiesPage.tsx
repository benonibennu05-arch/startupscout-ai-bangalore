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
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Clock,
  Flame,
  UserCheck,
  GraduationCap,
  Code2,
  Database,
  Server,
  Layers,
  Palette,
  TrendingUp,
  BriefcaseBusiness,
  Building,
  MapPin,
} from 'lucide-react';
import { Opportunity, OpportunityCategory, AiMlRelevance, LocationScope } from '../types';
import { api } from '../services/api';

interface OpportunitiesPageProps {
  onSelectOpportunity: (opp: Opportunity) => void;
  presetType?: string;
  presetMinScore?: number;
  presetExperience?: string[];
  presetCategory?: OpportunityCategory;
  pageTitle?: string;
  pageSubtitle?: string;
  selectedLocation?: LocationScope;
}

const CATEGORY_TABS: { id: string; label: string; icon: React.ElementType }[] = [
  { id: 'ALL', label: 'All Roles', icon: Briefcase },
  { id: 'AI_ML', label: 'AI / ML (Priority)', icon: Sparkles },
  { id: 'INTERNSHIPS', label: 'Internships', icon: GraduationCap },
  { id: 'SOFTWARE', label: 'Software & Full-Stack', icon: Code2 },
  { id: 'DATA', label: 'Data Science & BI', icon: Database },
  { id: 'BACKEND', label: 'Backend Systems', icon: Server },
  { id: 'FRONTEND', label: 'Frontend & UI', icon: Layers },
  { id: 'PRODUCT', label: 'Product & Design', icon: Palette },
  { id: 'MARKETING', label: 'Marketing & Growth', icon: TrendingUp },
  { id: 'SALES_OPS', label: 'Sales & Ops', icon: BriefcaseBusiness },
  { id: 'SAVED', label: 'Saved Jobs', icon: BookmarkCheck },
];

export const OpportunitiesPage: React.FC<OpportunitiesPageProps> = ({
  onSelectOpportunity,
  presetType,
  presetMinScore,
  presetExperience,
  presetCategory,
  pageTitle,
  pageSubtitle,
  selectedLocation = 'BANGALORE',
}) => {
  const [opportunities, setOpportunities] = useState<(Opportunity & { publicEmail: string | null })[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(presetCategory || 'ALL');
  const [aiFilter, setAiFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState(presetType || 'ALL');
  const [expFilter, setExpFilter] = useState('ALL');
  const [remoteFilter, setRemoteFilter] = useState('ALL');
  const [verificationFilter, setVerificationFilter] = useState('ALL');
  const [minScore, setMinScore] = useState<number>(presetMinScore || 0);
  const [hasEmail, setHasEmail] = useState(false);
  const [hasApp, setHasApp] = useState(false);
  const [sort, setSort] = useState<'relevance' | 'match' | 'newest' | 'company'>('relevance');

  const dynamicTitle =
    pageTitle ||
    (selectedLocation === 'BOTH'
      ? 'Bangalore & Hyderabad Opportunities'
      : selectedLocation === 'HYDERABAD'
      ? 'Hyderabad Startup Opportunities'
      : 'Bangalore Startup Opportunities');

  const dynamicSubtitle =
    pageSubtitle ||
    (selectedLocation === 'BOTH'
      ? 'Discover ALL jobs, internships, and open roles across Bangalore and Hyderabad startup maps'
      : selectedLocation === 'HYDERABAD'
      ? 'Discover ALL jobs, internships, and open roles across 500+ Hyderabad startups from hyderabadstartupsmap.lol'
      : 'Discover ALL jobs, internships, and open roles across 957+ Bangalore startups from bangalorestartupmap.com');

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      const isSavedOnly = activeCategory === 'SAVED';
      const isInternshipOnly = activeCategory === 'INTERNSHIPS';
      const categoryParam =
        activeCategory !== 'ALL' && activeCategory !== 'SAVED' && activeCategory !== 'INTERNSHIPS'
          ? (activeCategory as OpportunityCategory)
          : undefined;

      const res = await api.getOpportunities({
        search: search || undefined,
        category: categoryParam,
        aiMlRelevance: aiFilter !== 'ALL' ? (aiFilter as AiMlRelevance) : undefined,
        type: isInternshipOnly ? 'INTERNSHIP' : typeFilter !== 'ALL' ? typeFilter : undefined,
        isInternship: isInternshipOnly || undefined,
        isSaved: isSavedOnly || undefined,
        experienceLevel: expFilter !== 'ALL' ? expFilter : undefined,
        remote: remoteFilter !== 'ALL' ? remoteFilter : undefined,
        verificationStatus: verificationFilter !== 'ALL' ? verificationFilter : undefined,
        minRelevance: minScore > 0 ? minScore : undefined,
        hasEmail: hasEmail || undefined,
        hasApp: hasApp || undefined,
        location: selectedLocation,
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
    activeCategory,
    aiFilter,
    typeFilter,
    expFilter,
    remoteFilter,
    verificationFilter,
    minScore,
    hasEmail,
    hasApp,
    sort,
    selectedLocation,
  ]);

  const handleToggleSave = async (e: React.MouseEvent, opp: Opportunity) => {
    e.stopPropagation();
    try {
      if (opp.isSaved) {
        await api.unsaveJob(opp.id);
        setOpportunities((prev) =>
          prev.map((o) => (o.id === opp.id ? { ...o, isSaved: false, userApplicationStatus: undefined } : o))
        );
      } else {
        await api.saveJob(opp.id, 'HIGH', 'Saved from Opportunities browser');
        setOpportunities((prev) =>
          prev.map((o) => (o.id === opp.id ? { ...o, isSaved: true, userApplicationStatus: 'SAVED' } : o))
        );
      }
    } catch (err) {
      console.error('Failed to toggle save:', err);
    }
  };

  const handleStatusChange = async (e: React.MouseEvent, oppId: string, newStatus: string) => {
    e.stopPropagation();
    try {
      await api.updateJobApplicationStatus(oppId, newStatus);
      setOpportunities((prev) =>
        prev.map((o) => (o.id === oppId ? { ...o, userApplicationStatus: newStatus as any } : o))
      );
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  return (
    <div id="opportunities-page" className="space-y-5">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900">
              {dynamicTitle}
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-blue-100 text-blue-800">
              {opportunities.length} Total
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-blue-600" />
              {selectedLocation}
            </span>
          </div>
          <p className="text-xs text-gray-500 font-medium">{dynamicSubtitle}</p>
        </div>
      </div>

      {/* Category Pills Navigation */}
      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                id={`cat-tab-${tab.id}`}
                onClick={() => setActiveCategory(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-gray-200/80'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search title, company, skills (Python, PyTorch, React, Go, Data, Sales)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50/50"
            />
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* AI Relevance Filter */}
            <select
              value={aiFilter}
              onChange={(e) => setAiFilter(e.target.value)}
              className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-hidden"
            >
              <option value="ALL">All AI Categories</option>
              <option value="CORE_AIML">Core AI/ML & LLMs</option>
              <option value="AI_ADJACENT">AI-Adjacent / Full-Stack</option>
              <option value="STANDARD_TECH">General Tech & Software</option>
              <option value="NON_AI">Business / Non-Tech</option>
            </select>

            {!presetType && (
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-hidden"
              >
                <option value="ALL">All Employment Types</option>
                <option value="FULL_TIME">Full-Time</option>
                <option value="INTERNSHIP">Internship</option>
                <option value="CONTRACT">Contract</option>
                <option value="GRADUATE">Graduate / Trainee</option>
              </select>
            )}

            <select
              value={expFilter}
              onChange={(e) => setExpFilter(e.target.value)}
              className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-hidden"
            >
              <option value="ALL">All Experience Levels</option>
              <option value="INTERN">Intern</option>
              <option value="FRESHER">Fresher / Graduate</option>
              <option value="ENTRY_LEVEL">Entry Level (0-1y)</option>
              <option value="JUNIOR">Junior (1-3y)</option>
              <option value="MID">Mid Level (3-5y)</option>
              <option value="SENIOR">Senior (5y+)</option>
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
              onChange={(e) => setSort(e.target.value as any)}
              className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-hidden"
            >
              <option value="relevance">Highest Relevance</option>
              <option value="match">Personal Profile Match</option>
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
            <span>Has Verified Contact Email</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hasApp}
              onChange={(e) => setHasApp(e.target.checked)}
              className="rounded-xs text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
            />
            <span>Direct Application Link Available</span>
          </label>

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-gray-500 text-[11px] font-medium">Min Relevance Score:</span>
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
          <div className="py-16 text-center text-xs text-gray-500 space-y-2">
            <Briefcase className="w-8 h-8 mx-auto text-gray-300" />
            <div className="font-semibold text-gray-700">No opportunities match these filters</div>
            <div className="text-gray-400 text-[11px]">Try selecting "All Roles" or clearing specific filter pills.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4 w-8"></th>
                  <th className="py-3 px-4">Opportunity & Category</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Type & Exp</th>
                  <th className="py-3 px-4">Skills & Profile Match</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4">Recruitment Email</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200/80">
                {opportunities.map((opp) => (
                  <tr
                    key={opp.id}
                    className="hover:bg-blue-50/20 transition-colors cursor-pointer"
                    onClick={() => onSelectOpportunity(opp)}
                  >
                    {/* Bookmark Toggle */}
                    <td className="py-3 px-2 text-center" onClick={(e) => handleToggleSave(e, opp)}>
                      <button
                        title={opp.isSaved ? 'Remove from Saved' : 'Save this job'}
                        className={`p-1 rounded-md transition-colors ${
                          opp.isSaved
                            ? 'text-amber-500 hover:text-amber-600 bg-amber-50'
                            : 'text-gray-300 hover:text-gray-500'
                        }`}
                      >
                        {opp.isSaved ? <BookmarkCheck className="w-4 h-4 fill-amber-500" /> : <Bookmark className="w-4 h-4" />}
                      </button>
                    </td>

                    {/* Opportunity & Category */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <div className="font-bold text-gray-900">{opp.title}</div>
                        {opp.isNew && (
                          <span className="px-1.5 py-0.2 rounded-md text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            NEW
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500 flex items-center gap-2 pt-0.5">
                        <span className="font-medium px-1.5 py-0.2 bg-gray-100 rounded-sm text-gray-700">
                          {opp.category || 'SOFTWARE'}
                        </span>
                        <span>{opp.location}</span>
                        <span>•</span>
                        <span className="font-medium text-gray-600">{opp.remote}</span>
                      </div>
                    </td>

                    {/* Company */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-blue-700">{opp.companyName}</div>
                      <div className="text-[10px] text-gray-500 font-medium">
                        {opp.location?.toLowerCase().includes('hyderabad') ? 'Hyderabad Startup Map' : 'Bangalore Startup Map'}
                      </div>
                    </td>

                    {/* Type & Experience */}
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

                    {/* Key Skills & Profile Match */}
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {opp.skills.slice(0, 3).map((sk, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 text-gray-600"
                          >
                            {sk}
                          </span>
                        ))}
                      </div>
                      {opp.personalMatchScore !== undefined && (
                        <div className="text-[10px] font-semibold text-indigo-600 pt-1 flex items-center gap-1">
                          <span>Profile Match:</span>
                          <span className="font-bold">{opp.personalMatchScore}%</span>
                        </div>
                      )}
                    </td>

                    {/* Relevance Score */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-blue-600">{opp.relevanceScore}</span>
                        <div className="w-10 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full"
                            style={{ width: `${opp.relevanceScore}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Public Contact Email */}
                    <td className="py-3 px-4">
                      {opp.publicEmail ? (
                        <div className="flex items-center gap-1 text-teal-700 font-medium truncate max-w-[150px]">
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{opp.publicEmail}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-[11px]">Direct Apply Only</span>
                      )}
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
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
                        ) : null}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectOpportunity(opp);
                          }}
                          className="text-xs font-bold text-gray-700 hover:text-blue-600 bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-md transition-colors"
                        >
                          Details
                        </button>
                      </div>
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


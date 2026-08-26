import React, { useEffect, useState } from 'react';
import {
  X,
  Globe,
  ExternalLink,
  Briefcase,
  GraduationCap,
  Mail,
  ShieldCheck,
  Building2,
  MapPin,
  Calendar,
  Layers,
  Users,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { Company, Opportunity, Contact, ResearchError } from '../types';
import { api } from '../services/api';

interface CompanyDetailModalProps {
  companyId: string | null;
  onClose: () => void;
  onSelectOpportunity?: (opp: Opportunity) => void;
  onRefreshData?: () => void;
}

export const CompanyDetailModal: React.FC<CompanyDetailModalProps> = ({
  companyId,
  onClose,
  onSelectOpportunity,
  onRefreshData,
}) => {
  const [data, setData] = useState<{
    company: Company;
    opportunities: Opportunity[];
    contacts: Contact[];
    errors: ResearchError[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [researching, setResearching] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    api
      .getCompany(companyId)
      .then((res) => {
        setData(res);
      })
      .finally(() => setLoading(false));
  }, [companyId]);

  if (!companyId) return null;

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const handleResearchNow = async () => {
    if (!companyId) return;
    setResearching(true);
    try {
      await api.researchCompany(companyId);
      const updated = await api.getCompany(companyId);
      setData(updated);
      onRefreshData?.();
    } catch (e) {
      console.error(e);
    } finally {
      setResearching(false);
    }
  };

  return (
    <div
      id="company-detail-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-xs">
              {data?.company.name ? data.company.name.charAt(0) : 'S'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">
                  {data?.company.name || 'Loading Company...'}
                </h2>
                {data?.company.websiteVerified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" /> Verified Domain
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 font-medium">
                {data?.company.sector || 'Technology Startup'} • {data?.company.location || 'Bangalore, India'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="btn-modal-research"
              onClick={handleResearchNow}
              disabled={researching}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${researching ? 'animate-spin' : ''}`} />
              {researching ? 'Researching...' : 'Research Company'}
            </button>
            <button
              id="btn-close-modal"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              Loading startup details...
            </div>
          ) : data ? (
            <>
              {/* Description */}
              {data.company.description && (
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Overview
                  </h3>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {data.company.description}
                  </p>
                </div>
              )}

              {/* Company Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200/80">
                <div>
                  <div className="text-[11px] text-gray-500 font-medium">Stage</div>
                  <div className="text-xs font-bold text-gray-900 mt-0.5">
                    {data.company.startupStage || 'Early Stage'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500 font-medium">Founded</div>
                  <div className="text-xs font-bold text-gray-900 mt-0.5">
                    {data.company.foundedYear || 'Unknown'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500 font-medium">Team Size</div>
                  <div className="text-xs font-bold text-gray-900 mt-0.5">
                    {data.company.teamSize || '50-200'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500 font-medium">Research Status</div>
                  <div className="text-xs font-bold text-blue-700 mt-0.5">
                    {data.company.status}
                  </div>
                </div>
              </div>

              {/* Tags */}
              {data.company.tags && data.company.tags.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Industry & Technology Tags
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {data.company.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Web & Source Evidence Links */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Evidence Sources & Official Portals
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {data.company.officialWebsite && (
                    <a
                      href={data.company.officialWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 text-xs font-medium text-gray-700 transition-colors"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Globe className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="truncate">Official Website: {data.company.officialWebsite}</span>
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    </a>
                  )}

                  {data.company.startupMapUrl && (
                    <a
                      href={data.company.startupMapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 text-xs font-medium text-gray-700 transition-colors"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span className="truncate">Bangalore Startup Map Profile</span>
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    </a>
                  )}

                  {data.company.careersUrl && (
                    <a
                      href={data.company.careersUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 text-xs font-medium text-gray-700 transition-colors"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Briefcase className="w-4 h-4 text-purple-600 shrink-0" />
                        <span className="truncate">Careers Portal</span>
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    </a>
                  )}

                  {data.company.jobBoardUrl && (
                    <a
                      href={data.company.jobBoardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 text-xs font-medium text-gray-700 transition-colors"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Briefcase className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="truncate">ATS Board: {data.company.jobBoardUrl}</span>
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    </a>
                  )}
                </div>
              </div>

              {/* Discovered Opportunities */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Discovered Opportunities ({data.opportunities.length})
                  </h3>
                </div>

                {data.opportunities.length === 0 ? (
                  <div className="text-xs text-gray-500 bg-gray-50 p-4 rounded-xl border border-gray-200 text-center">
                    No current opportunities found yet for this company. Click "Research Company" above to trigger a fresh scan.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.opportunities.map((opp) => (
                      <div
                        key={opp.id}
                        onClick={() => onSelectOpportunity?.(opp)}
                        className="p-3.5 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer bg-white"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-gray-900">
                                {opp.title}
                              </h4>
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
                            <p className="text-xs text-gray-600 line-clamp-2 mt-1">
                              {opp.description}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {opp.skills.slice(0, 4).map((sk, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 text-gray-600"
                                >
                                  {sk}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-xs font-bold text-blue-700">
                              Score: {opp.relevanceScore}/100
                            </div>
                            <span className="text-[10px] text-gray-400 font-medium block mt-0.5">
                              {opp.verificationStatus}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Public Recruitment Contacts */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">
                  Public Recruitment & Contact Emails ({data.contacts.length})
                </h3>
                {data.contacts.length === 0 ? (
                  <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-xl border border-gray-200 text-center">
                    No public recruitment email found.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {data.contacts.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-gray-200 bg-gray-50/50"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Mail className="w-4 h-4 text-teal-600 shrink-0" />
                          <div>
                            <div className="text-xs font-bold text-gray-900 truncate">
                              {c.email}
                            </div>
                            <div className="text-[10px] text-gray-500">
                              Type: <span className="font-semibold">{c.emailType}</span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleCopyEmail(c.email)}
                          className="p-1.5 rounded-md hover:bg-gray-200 text-gray-600 transition-colors"
                          title="Copy Email"
                        >
                          {copiedEmail === c.email ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  ShieldCheck,
  Building2,
  MapPin,
  Sparkles,
  CheckCircle2,
  Copy,
  Check,
  RotateCw,
  Mail,
  Briefcase,
  DollarSign,
  Layers,
} from 'lucide-react';
import { Opportunity } from '../types';
import { api } from '../services/api';

interface OpportunityDetailModalProps {
  opportunity: Opportunity | null;
  onClose: () => void;
  onRefresh?: () => void;
}

export const OpportunityDetailModal: React.FC<OpportunityDetailModalProps> = ({
  opportunity,
  onClose,
  onRefresh,
}) => {
  const [copiedApp, setCopiedApp] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [currentOpp, setCurrentOpp] = useState<Opportunity | null>(opportunity);

  if (!currentOpp && !opportunity) return null;
  const opp = currentOpp || opportunity!;

  const handleCopyAppUrl = () => {
    if (opp.applicationUrl) {
      navigator.clipboard.writeText(opp.applicationUrl);
      setCopiedApp(true);
      setTimeout(() => setCopiedApp(false), 2000);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await api.verifyOpportunity(opp.id);
      if (res.success && res.opportunity) {
        setCurrentOpp(res.opportunity);
        onRefresh?.();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div
      id="opportunity-detail-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/70 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                {opp.companyName}
              </span>
              <span className="text-gray-300">•</span>
              <span className="text-xs text-gray-500 font-medium">{opp.location}</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mt-0.5">{opp.title}</h2>
          </div>
          <button
            id="btn-close-opp-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Badges Bar */}
          <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-gray-100">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                opp.type === 'INTERNSHIP'
                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}
            >
              {opp.type}
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {opp.experienceLevel}
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
              {opp.remote}
            </span>
            {opp.salary && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                💰 {opp.salary}
              </span>
            )}
            <span
              className={`ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                opp.verificationStatus === 'VERIFIED'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-gray-100 text-gray-600 border border-gray-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {opp.verificationStatus} ({opp.confidence} Confidence)
            </span>
          </div>

          {/* AI Relevance Card */}
          <div className="bg-blue-50/60 rounded-xl p-4 border border-blue-100">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>AI Relevance Score</span>
              </div>
              <span className="text-sm font-extrabold text-blue-700">
                {opp.relevanceScore} / 100
              </span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden mb-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${opp.relevanceScore}%` }}
              />
            </div>
            <p className="text-[11px] text-blue-800 font-medium">
              Scored with Gemini AI against tech stack, early-career/intern match, and relevance to modern engineering.
            </p>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Opportunity Description
            </h3>
            <p className="text-xs text-gray-700 leading-relaxed bg-gray-50 p-3.5 rounded-xl border border-gray-200">
              {opp.description}
            </p>
          </div>

          {/* Responsibilities */}
          {opp.responsibilities && opp.responsibilities.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Key Responsibilities
              </h3>
              <ul className="space-y-1.5">
                {opp.responsibilities.map((resp, i) => (
                  <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
                    <span>{resp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Requirements */}
          {opp.requirements && opp.requirements.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Requirements & Qualifications
              </h3>
              <ul className="space-y-1.5">
                {opp.requirements.map((req, i) => (
                  <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Skills */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Extracted Technologies & Skills
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {opp.skills.map((skill, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Evidence Sources */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Verified Evidence & Sources
            </h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-gray-200 bg-gray-50/50">
                <span className="text-gray-500 truncate">Source URL: {opp.sourceUrl}</span>
                <a
                  href={opp.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 font-semibold hover:underline flex items-center gap-1 shrink-0 ml-2"
                >
                  Visit <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-400 px-1">
                <span>Discovered: {new Date(opp.discoveredAt).toLocaleDateString()}</span>
                <span>Last Verified: {new Date(opp.lastVerifiedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-2 shrink-0">
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <RotateCw className={`w-3.5 h-3.5 text-emerald-600 ${verifying ? 'animate-spin' : ''}`} />
            {verifying ? 'Verifying...' : 'Re-verify Link'}
          </button>

          <div className="flex items-center gap-2">
            {opp.applicationUrl && (
              <button
                onClick={handleCopyAppUrl}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                {copiedApp ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedApp ? 'Copied Link' : 'Copy Application Link'}
              </button>
            )}

            {opp.applicationUrl ? (
              <a
                href={opp.applicationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-xs"
              >
                Open Official Application <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <a
                href={opp.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-xs"
              >
                Open Careers Source <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

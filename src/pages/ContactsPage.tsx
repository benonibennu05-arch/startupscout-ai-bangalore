import React, { useState, useEffect } from 'react';
import {
  Mail,
  Search,
  Copy,
  Check,
  Building2,
  ExternalLink,
  RefreshCw,
  User,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  FileText,
  Sparkles,
  Info,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { Contact, EmailVerificationStatus } from '../types';
import { api } from '../services/api';

interface ContactsPageProps {
  onSelectCompany: (companyId: string) => void;
}

export const ContactsPage: React.FC<ContactsPageProps> = ({ onSelectCompany }) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [emailType, setEmailType] = useState('ALL');
  const [verificationStatus, setVerificationStatus] = useState<EmailVerificationStatus | 'ALL'>('VERIFIED_PUBLIC');
  const [onlyWithEmail, setOnlyWithEmail] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [selectedContactForEvidence, setSelectedContactForEvidence] = useState<Contact | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null);
  const [isVerifyingAll, setIsVerifyingAll] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await api.getContactStats();
      if (res.success) {
        setStats(res.stats);
      }
    } catch (e) {
      console.error('Failed to load contact stats', e);
    }
  };

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const res = await api.getContacts({
        search: search || undefined,
        emailType: emailType !== 'ALL' ? emailType : undefined,
        verificationStatus: verificationStatus !== 'ALL' ? verificationStatus : undefined,
        onlyWithEmail: onlyWithEmail,
      });
      setContacts(res.contacts || []);
      fetchStats();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [search, emailType, verificationStatus, onlyWithEmail]);

  const handleCopy = (id: string, email: string) => {
    if (email && email.toLowerCase() !== 'not publicly available') {
      navigator.clipboard.writeText(email);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleVerifySingle = async (contact: Contact) => {
    setVerifyingId(contact.id);
    try {
      const res = await api.verifyContact(contact.id);
      if (res.success) {
        setContacts((prev) => prev.map((c) => (c.id === contact.id ? res.contact : c)));
        if (selectedContactForEvidence?.id === contact.id) {
          setSelectedContactForEvidence(res.contact);
        }
        setActionMessage({
          text: `Verified ${contact.email}: ${res.contact.verificationStatus}`,
          type: res.contact.verificationStatus === 'VERIFIED_PUBLIC' ? 'success' : 'info',
        });
        setTimeout(() => setActionMessage(null), 4000);
        fetchStats();
      }
    } catch (e) {
      console.error('Verification failed', e);
    } finally {
      setVerifyingId(null);
    }
  };

  const handleVerifyAll = async () => {
    setIsVerifyingAll(true);
    try {
      const res = await api.verifyAllContacts();
      if (res.success) {
        setActionMessage({
          text: `Audit complete: ${res.summary.verified} verified, ${res.summary.removed} removed/stale.`,
          type: 'success',
        });
        setTimeout(() => setActionMessage(null), 5000);
        fetchContacts();
      }
    } catch (e) {
      console.error('Verify all failed', e);
    } finally {
      setIsVerifyingAll(false);
    }
  };

  const handleCleanContacts = async () => {
    setIsCleaning(true);
    try {
      const res = await api.cleanContacts();
      if (res.success) {
        setActionMessage({
          text: `Sanitized database: ${res.summary.cleaned} unproven/invalid records cleaned.`,
          type: 'success',
        });
        setTimeout(() => setActionMessage(null), 5000);
        fetchContacts();
      }
    } catch (e) {
      console.error('Clean contacts failed', e);
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div id="contacts-page" className="space-y-5">
      {/* Top Banner & Verification Policy */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-bold text-gray-900">
              Public Recruitment & Talent Inboxes ({contacts.length})
            </h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck className="w-3 h-3 text-emerald-600" /> Evidence-Backed Guarantee
            </span>
          </div>
          <p className="text-xs text-gray-500 font-medium">
            Strict policy: Every email address is verified verbatim against public source web pages. Never guessed, inferred, or generated.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleVerifyAll}
            disabled={isVerifyingAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isVerifyingAll ? 'animate-spin' : ''}`} />
            {isVerifyingAll ? 'Auditing URLs...' : 'Re-verify All Live'}
          </button>

          <button
            onClick={handleCleanContacts}
            disabled={isCleaning}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5 text-gray-500" />
            {isCleaning ? 'Sanitizing...' : 'Clean Unverified'}
          </button>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-between transition-all ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-[11px] hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
        {/* Verification Status Tabs */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 border-b border-gray-100 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setVerificationStatus('VERIFIED_PUBLIC')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 ${
                verificationStatus === 'VERIFIED_PUBLIC'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Verified Public ({stats?.verifiedPublic ?? contacts.length})
            </button>

            <button
              onClick={() => setVerificationStatus('ALL')}
              className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-colors ${
                verificationStatus === 'ALL'
                  ? 'bg-gray-800 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Records ({stats?.total ?? '–'})
            </button>

            <button
              onClick={() => setVerificationStatus('NEEDS_REVIEW')}
              className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-colors flex items-center gap-1 ${
                verificationStatus === 'NEEDS_REVIEW'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              Needs Review ({stats?.unverified ?? 0})
            </button>

            <button
              onClick={() => setVerificationStatus('REJECTED')}
              className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-colors flex items-center gap-1 ${
                verificationStatus === 'REJECTED'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <ShieldAlert className="w-3 h-3" />
              Rejected ({stats?.rejected ?? 0})
            </button>
          </div>

          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyWithEmail}
              onChange={(e) => setOnlyWithEmail(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
            />
            <span className="font-medium">Only with Email</span>
          </label>
        </div>

        {/* Search & Category Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by exact email, person name, company, or domain..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50/50"
            />
          </div>

          <select
            value={emailType}
            onChange={(e) => setEmailType(e.target.value)}
            className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-hidden"
          >
            <option value="ALL">All Inbox Types</option>
            <option value="CAREERS">Careers Inboxes</option>
            <option value="TALENT">Talent Acquisition</option>
            <option value="RECRUITING">Recruiting & Jobs</option>
            <option value="CAMPUS_HIRING">Campus & Fresher Hiring</option>
            <option value="HR">HR & People</option>
            <option value="FOUNDER">Founders & Leadership</option>
            <option value="GENERAL_COMPANY">Official Inboxes</option>
            <option value="GENERAL_CONTACT">General Contact</option>
          </select>
        </div>
      </div>

      {/* Grid of Verified Contacts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            Verifying and loading contact records...
          </div>
        ) : contacts.length === 0 ? (
          <div className="col-span-full py-16 text-center text-xs text-gray-500 bg-white rounded-xl border border-gray-200 space-y-2">
            <p className="font-semibold text-gray-700">No contacts match the active filter criteria.</p>
            <p className="text-gray-400">
              Only publicly evidenced contacts from verified official web pages are displayed.
            </p>
          </div>
        ) : (
          contacts.map((c) => {
            const hasEmail = c.email && c.email.toLowerCase() !== 'not publicly available';
            const isVerified = c.verificationStatus === 'VERIFIED_PUBLIC' && c.exactMatch !== false;
            const isRejected = c.verificationStatus === 'REJECTED' || c.exactMatch === false;
            const isVerifyingThis = verifyingId === c.id;

            return (
              <div
                key={c.id}
                className={`bg-white p-4 rounded-xl border shadow-xs transition-all flex flex-col justify-between gap-3 ${
                  isVerified
                    ? 'border-gray-200 hover:border-emerald-300 hover:shadow-sm'
                    : isRejected
                    ? 'border-rose-200 bg-rose-50/20'
                    : 'border-amber-200 bg-amber-50/20'
                }`}
              >
                <div>
                  {/* Status & Badge Row */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        c.emailType === 'CAREERS' || c.emailType === 'TALENT' || c.emailType === 'CAMPUS_HIRING'
                          ? 'bg-teal-50 text-teal-700 border border-teal-200'
                          : c.emailType === 'FOUNDER'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : c.emailType === 'RECRUITING' || c.emailType === 'HR'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-gray-100 text-gray-700 border border-gray-200'
                      }`}
                    >
                      {c.emailType?.replace('_', ' ')}
                    </span>

                    {isVerified ? (
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Exact Match ({c.confidence ?? 90}%)
                      </span>
                    ) : isRejected ? (
                      <span className="text-[10px] text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3 text-rose-600" />
                        Rejected / No Proof
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        Needs Review
                      </span>
                    )}
                  </div>

                  {/* Name & Role if present */}
                  {c.name ? (
                    <div className="mb-2">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="text-xs font-bold text-gray-900">{c.name}</span>
                      </div>
                      {c.role && (
                        <div className="text-[11px] text-gray-500 font-medium ml-5">{c.role}</div>
                      )}
                    </div>
                  ) : null}

                  {/* Email row */}
                  <div className="flex items-center gap-2">
                    <Mail className={`w-3.5 h-3.5 shrink-0 ${hasEmail ? 'text-teal-600' : 'text-gray-400'}`} />
                    <span
                      className={`text-xs font-mono font-semibold truncate ${
                        hasEmail ? 'text-gray-900' : 'text-gray-400 italic'
                      }`}
                    >
                      {hasEmail ? c.email : 'Public email not listed'}
                    </span>
                  </div>

                  {/* Company link */}
                  <button
                    onClick={() => onSelectCompany(c.companyId)}
                    className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1 mt-2.5"
                  >
                    <Building2 className="w-3 h-3 text-blue-500" />
                    <span>{c.companyName}</span>
                  </button>

                  {/* Evidence Snippet preview */}
                  <div className="mt-2.5 pt-2 border-t border-gray-100">
                    <div className="text-[10px] text-gray-500 font-medium flex items-center gap-1 mb-1">
                      <FileText className="w-2.5 h-2.5 text-gray-400" />
                      <span>Evidence Source:</span>
                      <span className="font-semibold text-gray-700 truncate max-w-[170px]">
                        {c.sourceType?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {c.sourceText && (
                      <p className="text-[10px] text-gray-600 bg-gray-50 p-1.5 rounded-md font-mono line-clamp-2 border border-gray-100">
                        "{c.sourceText}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs gap-2">
                  <div className="flex items-center gap-2">
                    {c.sourceUrl && (
                      <a
                        href={c.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-medium text-blue-600 hover:text-blue-800 flex items-center gap-0.5 truncate max-w-[120px]"
                        title={c.sourceUrl}
                      >
                        Inspect Source <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </a>
                    )}

                    <button
                      onClick={() => handleVerifySingle(c)}
                      disabled={isVerifyingThis}
                      className="text-[11px] text-gray-500 hover:text-gray-800 flex items-center gap-1"
                      title="Re-fetch and verify exact match right now"
                    >
                      <RefreshCw className={`w-2.5 h-2.5 ${isVerifyingThis ? 'animate-spin text-blue-600' : ''}`} />
                      {isVerifyingThis ? 'Verifying...' : 'Verify'}
                    </button>
                  </div>

                  {hasEmail && (
                    <button
                      onClick={() => handleCopy(c.id, c.email)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 transition-colors shrink-0"
                    >
                      {copiedId === c.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

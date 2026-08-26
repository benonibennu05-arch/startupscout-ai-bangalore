import React, { useState, useEffect } from 'react';
import { Mail, Search, Copy, Check, Building2, ExternalLink, RefreshCw, User, ShieldCheck, Linkedin } from 'lucide-react';
import { Contact } from '../types';
import { api } from '../services/api';

interface ContactsPageProps {
  onSelectCompany: (companyId: string) => void;
}

export const ContactsPage: React.FC<ContactsPageProps> = ({ onSelectCompany }) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [emailType, setEmailType] = useState('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const res = await api.getContacts({
        search: search || undefined,
        emailType: emailType !== 'ALL' ? emailType : undefined,
      });
      setContacts(res.contacts || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [search, emailType]);

  const handleCopy = (id: string, email: string) => {
    if (email && email.toLowerCase() !== 'not publicly available') {
      navigator.clipboard.writeText(email);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <div id="contacts-page" className="space-y-5">
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">
            Public Recruitment, Talent & Founder Contacts ({contacts.length})
          </h2>
          <p className="text-xs text-gray-500 font-medium">
            Strictly public recruiting inboxes, careers addresses, talent partners, and key leadership discovered from verified pages
          </p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search email address, person name, role, or company..."
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
          <option value="ALL">All Contact Types</option>
          <option value="CAREERS">Careers Inboxes</option>
          <option value="TALENT">Talent Acquisition</option>
          <option value="RECRUITING">Recruiting</option>
          <option value="CAMPUS_HIRING">Campus & Fresher Hiring</option>
          <option value="HR">HR & People</option>
          <option value="FOUNDER">Founders & Leadership</option>
          <option value="GENERAL_CONTACT">General Contact</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            Loading contact records...
          </div>
        ) : contacts.length === 0 ? (
          <div className="col-span-full py-16 text-center text-xs text-gray-500 bg-white rounded-xl border border-gray-200">
            No public contact records match this query.
          </div>
        ) : (
          contacts.map((c) => {
            const hasEmail = c.email && c.email.toLowerCase() !== 'not publicly available';
            return (
              <div
                key={c.id}
                className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs hover:border-blue-300 hover:shadow-sm transition-all flex flex-col justify-between gap-3"
              >
                <div>
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
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-2.5 h-2.5" /> Public Verified
                    </span>
                  </div>

                  {c.name ? (
                    <div className="mb-2">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="text-xs font-bold text-gray-900">{c.name}</span>
                      </div>
                      {c.role && (
                        <div className="text-[11px] text-gray-500 font-medium ml-5">{c.role}</div>
                      )}
                    </div>
                  ) : null}

                  <div className="flex items-center gap-2">
                    <Mail className={`w-3.5 h-3.5 shrink-0 ${hasEmail ? 'text-teal-600' : 'text-gray-400'}`} />
                    <span className={`text-xs font-semibold truncate ${hasEmail ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                      {hasEmail ? c.email : 'Public email not listed'}
                    </span>
                  </div>

                  <button
                    onClick={() => onSelectCompany(c.companyId)}
                    className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-1 mt-2"
                  >
                    <Building2 className="w-3 h-3" />
                    <span>{c.companyName}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                  {c.profileUrl ? (
                    <a
                      href={c.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 truncate max-w-[150px]"
                    >
                      <Linkedin className="w-2.5 h-2.5" /> Profile ↗
                    </a>
                  ) : (
                    <a
                      href={c.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1 truncate max-w-[150px]"
                    >
                      Source <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}

                  {hasEmail && (
                    <button
                      onClick={() => handleCopy(c.id, c.email)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 transition-colors"
                    >
                      {copiedId === c.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy Email
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

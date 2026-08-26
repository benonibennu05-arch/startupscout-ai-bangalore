import React, { useState, useEffect } from 'react';
import {
  Search,
  Building2,
  Globe,
  ExternalLink,
  ShieldCheck,
  Briefcase,
  GraduationCap,
  Mail,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { Company } from '../types';
import { api } from '../services/api';

interface CompaniesPageProps {
  onSelectCompany: (id: string) => void;
}

export const CompaniesPage: React.FC<CompaniesPageProps> = ({ onSelectCompany }) => {
  const [companies, setCompanies] = useState<
    (Company & { jobsCount: number; internshipsCount: number; contactsCount: number; primaryEmail: string | null })[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [hasJobsFilter, setHasJobsFilter] = useState(false);
  const [hasEmailFilter, setHasEmailFilter] = useState(false);
  const [sort, setSort] = useState('newest');

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const res = await api.getCompanies({
        search: search || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        hasJobs: hasJobsFilter || undefined,
        hasEmail: hasEmailFilter || undefined,
        sort,
      });
      setCompanies(res.companies || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, [search, statusFilter, hasJobsFilter, hasEmailFilter, sort]);

  return (
    <div id="companies-page" className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-gray-900">
            Bangalore Startup Directory ({companies.length})
          </h2>
          <p className="text-xs text-gray-500 font-medium">
            Discovered from Bangalore Startup Map with official domains, careers, and contacts
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search company name, sector, or tags (e.g. AI, FinTech, Python)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50/50"
          />
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Researched (Completed)</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
          </select>

          <label className="flex items-center gap-1.5 text-xs text-gray-700 font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hasJobsFilter}
              onChange={(e) => setHasJobsFilter(e.target.checked)}
              className="rounded-xs text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
            />
            <span>Has Jobs</span>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-gray-700 font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hasEmailFilter}
              onChange={(e) => setHasEmailFilter(e.target.checked)}
              className="rounded-xs text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
            />
            <span>Has Email</span>
          </label>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="newest">Recently Discovered</option>
            <option value="name_asc">Company Name (A-Z)</option>
            <option value="last_checked">Last Researched</option>
          </select>
        </div>
      </div>

      {/* Companies Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            Loading startup directory...
          </div>
        ) : companies.length === 0 ? (
          <div className="py-16 text-center text-xs text-gray-500">
            No companies matching your criteria. Try adjusting filters or starting research.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Sector & Tags</th>
                  <th className="py-3 px-4">Official Website</th>
                  <th className="py-3 px-4 text-center">Jobs</th>
                  <th className="py-3 px-4 text-center">Internships</th>
                  <th className="py-3 px-4">Public Email</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200/80">
                {companies.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-blue-50/20 transition-colors cursor-pointer"
                    onClick={() => onSelectCompany(c.id)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                          {c.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">{c.name}</div>
                          <div className="text-[11px] text-gray-500 font-medium">
                            {c.location || 'Bangalore, India'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-800">{c.sector || 'Technology'}</div>
                      <div className="flex flex-wrap gap-1 mt-1 max-w-xs">
                        {c.tags.slice(0, 2).map((t, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 text-gray-600"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {c.officialWebsite ? (
                        <a
                          href={c.officialWebsite}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-600 font-semibold hover:underline flex items-center gap-1 truncate max-w-[160px]"
                        >
                          <Globe className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{c.officialWebsite.replace(/^https?:\/\//, '')}</span>
                        </a>
                      ) : (
                        <span className="text-gray-400 text-[11px]">Unverified</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                        {c.jobsCount}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700">
                        {c.internshipsCount}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {c.primaryEmail ? (
                        <div className="flex items-center gap-1 text-teal-700 font-medium truncate max-w-[180px]">
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{c.primaryEmail}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-[11px]">None found</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          c.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : c.status === 'FAILED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : c.status === 'RESEARCHING'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCompany(c.id);
                        }}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 px-2.5 py-1 rounded-md hover:bg-blue-50 transition-colors"
                      >
                        Details →
                      </button>
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

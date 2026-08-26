import React, { useState, useEffect } from 'react';
import { AlertOctagon, RefreshCw, CheckCircle2, Building2, ShieldAlert } from 'lucide-react';
import { ResearchError } from '../types';
import { api } from '../services/api';

interface FailedResearchPageProps {
  onSelectCompany: (companyId: string) => void;
  onRetryAllFailed: () => void;
}

export const FailedResearchPage: React.FC<FailedResearchPageProps> = ({
  onSelectCompany,
  onRetryAllFailed,
}) => {
  const [errors, setErrors] = useState<ResearchError[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchErrors = async () => {
    setLoading(true);
    try {
      const data = await api.getErrors();
      setErrors(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchErrors();
  }, []);

  const handleResolve = async (id: string) => {
    await api.resolveError(id);
    fetchErrors();
  };

  const unresolved = errors.filter((e) => !e.resolved);

  return (
    <div id="failed-research-page" className="space-y-5">
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">
            Failed Research & Error Recovery ({unresolved.length} Unresolved)
          </h2>
          <p className="text-xs text-gray-500 font-medium">
            Track and retry companies that encountered anti-scraping, bot blocks, or malformed careers pages
          </p>
        </div>

        {unresolved.length > 0 && (
          <button
            onClick={onRetryAllFailed}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry All Failed Companies
          </button>
        )}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="py-16 text-center text-xs text-gray-500 flex items-center justify-center gap-2 bg-white rounded-xl border border-gray-200">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            Loading error logs...
          </div>
        ) : unresolved.length === 0 ? (
          <div className="py-16 text-center text-xs text-gray-500 bg-white rounded-xl border border-gray-200">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <div className="font-bold text-gray-900 text-sm">No Unresolved Errors</div>
            <div className="text-gray-500 mt-1">All company research tasks executed smoothly.</div>
          </div>
        ) : (
          unresolved.map((err) => (
            <div
              key={err.id}
              className="bg-white p-4 rounded-xl border border-rose-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 text-xs">{err.companyName}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    Stage: {err.stage}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    Attempts: {err.attempt}
                  </span>
                </div>
                <p className="text-xs text-rose-800 font-medium">
                  {err.error}
                </p>
                <div className="text-[11px] text-gray-400">
                  Occurred: {new Date(err.timestamp).toLocaleString()}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onSelectCompany(err.companyId)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                >
                  View Company
                </button>
                <button
                  onClick={() => handleResolve(err.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors"
                >
                  Mark Resolved
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

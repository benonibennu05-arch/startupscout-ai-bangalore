import React, { useState, useEffect } from 'react';
import { History, Play, CheckCircle2, Clock, Briefcase, GraduationCap, Mail, AlertTriangle, RefreshCw } from 'lucide-react';
import { ResearchRun } from '../types';
import { api } from '../services/api';

export const ResearchRunsPage: React.FC = () => {
  const [runs, setRuns] = useState<ResearchRun[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const data = await api.getRuns();
      setRuns(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  return (
    <div id="research-runs-page" className="space-y-5">
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900">Research Run History ({runs.length})</h2>
          <p className="text-xs text-gray-500 font-medium">
            Audit logs of test batches and full Bangalore startup research cycles
          </p>
        </div>
        <button
          onClick={fetchRuns}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          title="Refresh run history"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="py-16 text-center text-xs text-gray-500 flex items-center justify-center gap-2 bg-white rounded-xl border border-gray-200">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            Loading research runs...
          </div>
        ) : runs.length === 0 ? (
          <div className="py-16 text-center text-xs text-gray-500 bg-white rounded-xl border border-gray-200">
            No research runs recorded yet. Start a test batch or full research from the top header.
          </div>
        ) : (
          runs.map((run) => (
            <div
              key={run.id}
              className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
                    <History className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900">
                      Run Type: <span className="text-blue-700">{run.runType}</span>
                    </div>
                    <div className="text-[11px] text-gray-500">
                      Started: {new Date(run.startedAt).toLocaleString()}
                      {run.completedAt && ` • Finished: ${new Date(run.completedAt).toLocaleString()}`}
                    </div>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                    run.status === 'COMPLETED'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : run.status === 'RUNNING'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse'
                      : run.status === 'PAUSED'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  <Clock className="w-3 h-3" /> {run.status}
                </span>
              </div>

              {/* Stats pill row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-100">
                <div className="bg-gray-50 rounded-lg p-2 text-xs">
                  <span className="text-gray-500 text-[11px]">Companies:</span>
                  <div className="font-bold text-gray-900 mt-0.5">
                    {run.completedCompanies} / {run.totalCompanies}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-2 text-xs">
                  <span className="text-gray-500 text-[11px]">Jobs Found:</span>
                  <div className="font-bold text-blue-700 mt-0.5">{run.jobsFound}</div>
                </div>

                <div className="bg-gray-50 rounded-lg p-2 text-xs">
                  <span className="text-gray-500 text-[11px]">Internships:</span>
                  <div className="font-bold text-purple-700 mt-0.5">{run.internshipsFound}</div>
                </div>

                <div className="bg-gray-50 rounded-lg p-2 text-xs">
                  <span className="text-gray-500 text-[11px]">Emails Found:</span>
                  <div className="font-bold text-teal-700 mt-0.5">{run.emailsFound}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

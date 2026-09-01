import React from 'react';
import {
  Pause,
  Play,
  Square,
  RefreshCw,
  Activity,
  CheckCircle2,
  Briefcase,
  GraduationCap,
  Mail,
  AlertTriangle,
  Zap,
  Clock,
  Cpu,
  Layers,
  Users,
  MapPin,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { QueueStatusResponse } from '../services/api';
import { ResearchEvent, LocationScope } from '../types';

interface ResearchLiveCardProps {
  queueStatus: QueueStatusResponse | null;
  events: ResearchEvent[];
  selectedLocation?: LocationScope;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onRetryFailed: () => void;
}

export const ResearchLiveCard: React.FC<ResearchLiveCardProps> = ({
  queueStatus,
  events,
  selectedLocation = 'BANGALORE',
  onPause,
  onResume,
  onStop,
  onRetryFailed,
}) => {
  const isRunning = queueStatus?.status === 'RUNNING';
  const isPaused = queueStatus?.status === 'PAUSED';
  const currentRun = queueStatus?.currentRun;
  const stats = queueStatus?.stats;
  const metrics = queueStatus?.metrics;
  const activeWorkers = queueStatus?.activeWorkers || [];

  const total = currentRun?.totalCompanies || stats?.totalCompanies || 0;
  const completed = currentRun?.completedCompanies || stats?.researchedCompanies || 0;
  const progressPercent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  const currentSourceUrl =
    selectedLocation === 'HYDERABAD'
      ? 'https://www.hyderabadstartupsmap.lol/'
      : selectedLocation === 'BOTH'
      ? 'https://www.bangalorestartupmap.com/ + https://www.hyderabadstartupsmap.lol/'
      : 'https://www.bangalorestartupmap.com/';

  return (
    <div
      id="research-live-card"
      className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 transition-all space-y-4"
    >
      {/* Top Header & State */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              isRunning
                ? 'bg-blue-600 animate-ping'
                : isPaused
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
          />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Parallel Research Engine:
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                  isRunning
                    ? 'bg-blue-100 text-blue-800'
                    : isPaused
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {queueStatus?.status || 'IDLE'}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                <Zap className="w-3 h-3 text-amber-500" />
                {queueStatus?.concurrency || 10} Workers ({queueStatus?.mode || 'FAST'})
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                <MapPin className="w-3 h-3 text-blue-600" />
                {selectedLocation === 'BOTH' ? 'Both Hubs' : selectedLocation === 'HYDERABAD' ? 'Hyderabad' : 'Bangalore'}
              </span>
            </div>

            <div className="text-xs text-gray-600 mt-1 flex items-center gap-2 flex-wrap">
              {isRunning ? (
                <>
                  <span>
                    Active Workers: <strong className="text-blue-700 font-bold">{activeWorkers.length}</strong> / {queueStatus?.concurrency || 10}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span>
                    Queued: <strong className="text-gray-900 font-semibold">{queueStatus?.queueLength || 0}</strong> companies
                  </span>
                </>
              ) : (
                <span className="flex items-center gap-1">
                  Source: <a href={selectedLocation === 'HYDERABAD' ? 'https://www.hyderabadstartupsmap.lol/' : 'https://www.bangalorestartupmap.com/'} target="_blank" rel="noreferrer noopener" className="text-blue-600 hover:underline font-medium flex items-center gap-0.5">{currentSourceUrl} <ExternalLink className="w-2.5 h-2.5" /></a>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isRunning && (
            <button
              id="btn-pause-research"
              onClick={onPause}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors shadow-xs"
            >
              <Pause className="w-3.5 h-3.5" /> Pause
            </button>
          )}

          {isPaused && (
            <button
              id="btn-resume-research"
              onClick={onResume}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors shadow-xs"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Resume
            </button>
          )}

          {(isRunning || isPaused) && (
            <button
              id="btn-stop-research"
              onClick={onStop}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors shadow-xs"
            >
              <Square className="w-3.5 h-3.5" /> Stop
            </button>
          )}

          {(stats?.failedCompanies || 0) > 0 && !isRunning && (
            <button
              id="btn-retry-failed"
              onClick={onRetryFailed}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-300 transition-colors shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry Failed ({stats?.failedCompanies})
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar & Throughput Metrics */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-gray-600 font-medium">
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            <span>
              Overall Progress:{' '}
              <strong className="text-gray-900 font-semibold">
                {completed} / {total} companies
              </strong>
            </span>
          </span>
          <span className="font-bold text-blue-600">{progressPercent}%</span>
        </div>

        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden border border-gray-200">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Real-time Throughput KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <div className="bg-blue-50/70 rounded-lg p-2.5 border border-blue-200/60">
            <div className="text-[11px] text-blue-700 font-medium flex items-center gap-1">
              <Zap className="w-3 h-3 text-blue-600" /> Throughput
            </div>
            <div className="text-sm font-extrabold text-blue-950 mt-0.5">
              {metrics?.companiesPerMinute || 0} <span className="text-[11px] font-normal text-blue-700">comps/min</span>
            </div>
          </div>

          <div className="bg-indigo-50/70 rounded-lg p-2.5 border border-indigo-200/60">
            <div className="text-[11px] text-indigo-700 font-medium flex items-center gap-1">
              <Clock className="w-3 h-3 text-indigo-600" /> Est. Remaining
            </div>
            <div className="text-sm font-extrabold text-indigo-950 mt-0.5">
              {metrics?.estimatedRemainingMinutes !== null && metrics?.estimatedRemainingMinutes !== undefined
                ? `~${metrics.estimatedRemainingMinutes} mins`
                : 'Calculating...'}
            </div>
          </div>

          <div className="bg-emerald-50/70 rounded-lg p-2.5 border border-emerald-200/60">
            <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
              <Layers className="w-3 h-3 text-emerald-600" /> Avg. Latency
            </div>
            <div className="text-sm font-extrabold text-emerald-950 mt-0.5">
              {metrics?.avgCompanyDurationMs ? `${(metrics.avgCompanyDurationMs / 1000).toFixed(1)}s` : '0.8s'}
            </div>
          </div>

          <div className="bg-purple-50/70 rounded-lg p-2.5 border border-purple-200/60">
            <div className="text-[11px] text-purple-700 font-medium flex items-center gap-1">
              <Cpu className="w-3 h-3 text-purple-600" /> Gemini Calls
            </div>
            <div className="text-sm font-extrabold text-purple-950 mt-0.5">
              {metrics?.geminiCallsCount || 0} <span className="text-[11px] font-normal text-purple-700">targeted</span>
            </div>
          </div>
        </div>

        {/* Live Active Workers Matrix (shows multiple companies researching in parallel) */}
        {isRunning && activeWorkers.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-600" />
              <span>Parallel Workers Active ({activeWorkers.length})</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {activeWorkers.map((w) => (
                <div
                  key={w.workerId}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-gray-50 border border-gray-200 text-gray-800"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  <span className="font-semibold text-[11px] text-blue-700">W{w.workerId}:</span>
                  <span className="font-bold text-[11px] max-w-[130px] truncate">{w.companyName}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-100">
          <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-200/70 flex items-center gap-2.5">
            <Briefcase className="w-4 h-4 text-blue-600 shrink-0" />
            <div>
              <div className="text-[11px] text-gray-500 font-medium">Jobs Found</div>
              <div className="text-sm font-bold text-gray-900">
                {currentRun ? currentRun.jobsFound : stats?.totalJobs || 0}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-200/70 flex items-center gap-2.5">
            <GraduationCap className="w-4 h-4 text-purple-600 shrink-0" />
            <div>
              <div className="text-[11px] text-gray-500 font-medium">Internships</div>
              <div className="text-sm font-bold text-gray-900">
                {currentRun ? currentRun.internshipsFound : stats?.totalInternships || 0}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-200/70 flex items-center gap-2.5">
            <Mail className="w-4 h-4 text-teal-600 shrink-0" />
            <div>
              <div className="text-[11px] text-gray-500 font-medium">Public Emails</div>
              <div className="text-sm font-bold text-gray-900">
                {currentRun ? currentRun.emailsFound : stats?.publicEmails || 0}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-200/70 flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <div className="text-[11px] text-gray-500 font-medium">Failures</div>
              <div className="text-sm font-bold text-gray-900">
                {currentRun ? currentRun.failedCompanies : stats?.failedCompanies || 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Event Stream Ticker */}
      <div className="pt-2 border-t border-gray-100">
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>Live Research Activity Stream</span>
          <span className="text-[10px] text-gray-400 font-normal">Real-time log</span>
        </div>
        <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
          {events.length === 0 ? (
            <div className="text-xs text-gray-400 py-1 italic">
              Awaiting research start. Click "Test 10 (Parallel)" or "Research ALL Startups".
            </div>
          ) : (
            events.slice(0, 5).map((evt) => (
              <div
                key={evt.id}
                className="text-xs text-gray-600 flex items-start gap-2 py-0.5 leading-relaxed"
              >
                <CheckCircle2
                  className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                    evt.type === 'error'
                      ? 'text-rose-500'
                      : evt.type === 'warning'
                      ? 'text-amber-500'
                      : 'text-emerald-500'
                  }`}
                />
                <span className="truncate">
                  <strong className="text-gray-800 font-semibold">{evt.companyName}:</strong>{' '}
                  {evt.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

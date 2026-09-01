import React from 'react';
import {
  Compass,
  Play,
  FlaskConical,
  Download,
  RotateCw,
  Sparkles,
  Zap,
  Layers,
  Cpu,
  MapPin,
  Globe,
} from 'lucide-react';
import { QueueStatusResponse } from '../services/api';
import { ResearchMode, LocationScope } from '../types';

interface HeaderProps {
  queueStatus: QueueStatusResponse | null;
  selectedMode: ResearchMode;
  onModeChange: (mode: ResearchMode) => void;
  selectedConcurrency: number;
  onConcurrencyChange: (concurrency: number) => void;
  selectedLocation: LocationScope;
  onLocationChange: (loc: LocationScope) => void;
  onStartTest10: () => void;
  onStartFull: () => void;
  onOpenExport: () => void;
  onVerifyAll: () => void;
  isVerifying: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  queueStatus,
  selectedMode,
  onModeChange,
  selectedConcurrency,
  onConcurrencyChange,
  selectedLocation,
  onLocationChange,
  onStartTest10,
  onStartFull,
  onOpenExport,
  onVerifyAll,
  isVerifying,
}) => {
  const isRunning = queueStatus?.status === 'RUNNING';
  const stats = queueStatus?.stats as any;
  const companyStats = stats?.companyStats;

  const blrCount = companyStats?.bangalore?.stored ?? (stats?.totalCompanies && selectedLocation === 'BANGALORE' ? stats.totalCompanies : 'Live');
  const hydCount = companyStats?.hyderabad?.stored ?? (stats?.totalCompanies && selectedLocation === 'HYDERABAD' ? stats.totalCompanies : 'Live');
  const bothCount = companyStats?.combined?.stored ?? (stats?.totalCompanies && selectedLocation === 'BOTH' ? stats.totalCompanies : 'Live');

  const locationLabels: Record<LocationScope, { title: string; subtitle: string; badge: string }> = {
    BANGALORE: {
      title: 'Bangalore Startup Map',
      subtitle: `bangalorestartupmap.com (${blrCount} Startups in Database)`,
      badge: 'Bangalore',
    },
    HYDERABAD: {
      title: 'Hyderabad Startups Map',
      subtitle: `hyderabadstartupsmap.lol (${hydCount} Startups in Database)`,
      badge: 'Hyderabad',
    },
    BOTH: {
      title: 'Bangalore & Hyderabad Maps',
      subtitle: `Dual Ecosystem Research (${bothCount} Canonical Startups)`,
      badge: 'Both Hubs',
    },
  };

  return (
    <header
      id="app-header"
      className="sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-4 shadow-xs"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm ring-4 ring-blue-50">
          <Compass className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">
              StartupScout <span className="text-blue-600">AI</span>
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <Sparkles className="w-3 h-3 text-blue-600" /> Dual Map Intelligence
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Zap className="w-3 h-3 text-emerald-600" /> High-Speed Worker Pool
            </span>
          </div>
          <p className="text-xs text-gray-500 font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span>Target: <strong className="text-gray-800">{locationLabels[selectedLocation].title}</strong> ({locationLabels[selectedLocation].subtitle})</span>
          </p>
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-2.5">
        {/* Location / Startup Map Source Selector */}
        <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs">
          <button
            type="button"
            disabled={isRunning}
            onClick={() => onLocationChange('BANGALORE')}
            className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
              selectedLocation === 'BANGALORE'
                ? 'bg-white text-blue-700 shadow-xs ring-1 ring-blue-600/10'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Bangalore Startup Map: https://www.bangalorestartupmap.com/"
          >
            <MapPin className="w-3.5 h-3.5 text-blue-600" />
            <span>Bangalore</span>
          </button>
          <button
            type="button"
            disabled={isRunning}
            onClick={() => onLocationChange('HYDERABAD')}
            className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
              selectedLocation === 'HYDERABAD'
                ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-indigo-600/10'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Hyderabad Startups Map: https://www.hyderabadstartupsmap.lol/"
          >
            <MapPin className="w-3.5 h-3.5 text-indigo-600" />
            <span>Hyderabad</span>
          </button>
          <button
            type="button"
            disabled={isRunning}
            onClick={() => onLocationChange('BOTH')}
            className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
              selectedLocation === 'BOTH'
                ? 'bg-white text-emerald-700 shadow-xs ring-1 ring-emerald-600/10'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Research both Bangalore and Hyderabad maps simultaneously"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-600" />
            <span>Both</span>
          </button>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs">
          <button
            type="button"
            disabled={isRunning}
            onClick={() => onModeChange('FAST')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1 ${
              selectedMode === 'FAST'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Fast Mode: Heuristic extraction, max throughput, 10+ workers"
          >
            <Zap className="w-3 h-3 text-amber-500" /> Fast
          </button>
          <button
            type="button"
            disabled={isRunning}
            onClick={() => onModeChange('BALANCED')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1 ${
              selectedMode === 'BALANCED'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Balanced: Targeted AI analysis for ambiguous jobs"
          >
            <Layers className="w-3 h-3 text-indigo-500" /> Balanced
          </button>
          <button
            type="button"
            disabled={isRunning}
            onClick={() => onModeChange('DEEP')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1 ${
              selectedMode === 'DEEP'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Deep: Full Gemini intelligence analysis"
          >
            <Cpu className="w-3 h-3 text-purple-500" /> Deep
          </button>
        </div>

        {/* Concurrency Selector */}
        <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg text-xs">
          <span className="text-gray-500 font-medium">Workers:</span>
          <select
            value={selectedConcurrency}
            disabled={isRunning}
            onChange={(e) => onConcurrencyChange(Number(e.target.value))}
            className="bg-transparent font-bold text-blue-700 outline-none cursor-pointer"
          >
            <option value={5}>5x Parallel</option>
            <option value={10}>10x Parallel (Default)</option>
            <option value={15}>15x Parallel</option>
            <option value={20}>20x Ultra</option>
          </select>
        </div>

        {/* Test Batch */}
        <button
          id="btn-test-batch"
          onClick={onStartTest10}
          disabled={isRunning}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
            isRunning
              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100 shadow-xs'
          }`}
          title={`Tests high-speed parallel research on a batch of 10 startups in ${selectedLocation}`}
        >
          <FlaskConical className="w-3.5 h-3.5 text-indigo-600" />
          Test 10 ({selectedLocation === 'BOTH' ? 'Both' : selectedLocation === 'HYDERABAD' ? 'Hyd' : 'Blr'})
        </button>

        {/* Research All Startups */}
        <button
          id="btn-full-research"
          onClick={onStartFull}
          disabled={isRunning}
          className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs ${
            isRunning
              ? 'bg-blue-400 text-white cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 ring-2 ring-blue-600/20'
          }`}
          title={`Dynamically discovers and researches startups for ${selectedLocation}`}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          {isRunning ? 'Running...' : `Research ALL (${selectedLocation === 'BOTH' ? 'Both Hubs' : selectedLocation === 'HYDERABAD' ? 'Hyderabad' : 'Bangalore'})`}
        </button>

        {/* Asynchronous Verify All */}
        <button
          id="btn-verify-all"
          onClick={onVerifyAll}
          disabled={isVerifying}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 active:bg-gray-100 transition-colors shadow-xs"
          title="Asynchronously re-verifies live status for all discovered job links"
        >
          <RotateCw className={`w-3.5 h-3.5 text-emerald-600 ${isVerifying ? 'animate-spin' : ''}`} />
          {isVerifying ? 'Verifying...' : 'Verify Links'}
        </button>

        {/* Export */}
        <button
          id="btn-export"
          onClick={onOpenExport}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-800 bg-gray-50 hover:bg-gray-100 border border-gray-300 transition-colors shadow-xs"
        >
          <Download className="w-3.5 h-3.5 text-gray-600" />
          Export
        </button>
      </div>
    </header>
  );
};


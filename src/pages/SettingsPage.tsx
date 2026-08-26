import React, { useState, useEffect } from 'react';
import { Settings, Save, Sparkles, Sliders, Shield, RefreshCw, Check } from 'lucide-react';
import { UserSettings } from '../types';
import { api } from '../services/api';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .getSettings()
      .then((s) => setSettings(s))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setLoading(true);
    try {
      const res = await api.updateSettings(settings);
      if (res.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!settings) {
    return (
      <div className="py-20 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
        Loading settings...
      </div>
    );
  }

  return (
    <div id="settings-page" className="max-w-3xl space-y-6">
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
        <h2 className="text-base font-bold text-gray-900">Intelligence Engine Settings</h2>
        <p className="text-xs text-gray-500 font-medium">
          Configure crawler speed, Gemini AI classification thresholds, and verification options
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-6">
        {/* Gemini AI Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Gemini AI Classification
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Gemini Model
              </label>
              <input
                type="text"
                value={settings.geminiModel}
                onChange={(e) => setSettings({ ...settings, geminiModel: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 font-mono"
                disabled
              />
              <span className="text-[11px] text-gray-400 mt-1 block">
                Standard model: gemini-2.5-flash for structured role evaluation
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Min Relevance Score Threshold: {settings.minRelevanceScore}
              </label>
              <input
                type="range"
                min="0"
                max="90"
                step="5"
                value={settings.minRelevanceScore}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    minRelevanceScore: parseInt(e.target.value, 10),
                  })
                }
                className="w-full accent-blue-600 mt-2"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">
                Roles scoring below this are categorized as lower priority
              </span>
            </div>
          </div>
        </div>

        {/* Crawler Politeness & Concurrency */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <Sliders className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Crawler Politeness & Concurrency
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Request Delay (ms): {settings.requestDelayMs} ms
              </label>
              <input
                type="range"
                min="100"
                max="3000"
                step="100"
                value={settings.requestDelayMs}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    requestDelayMs: parseInt(e.target.value, 10),
                  })
                }
                className="w-full accent-blue-600 mt-2"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">
                Delay between requests to avoid server throttling or IP blocking
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Max Concurrency: {settings.maxConcurrency}
              </label>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={settings.maxConcurrency}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maxConcurrency: parseInt(e.target.value, 10),
                  })
                }
                className="w-full accent-blue-600 mt-2"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">
                Concurrent company research workers
              </span>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
              <Check className="w-4 h-4" /> Settings Saved!
            </span>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-xs"
          >
            <Save className="w-3.5 h-3.5" /> Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
};

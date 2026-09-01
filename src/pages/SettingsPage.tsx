import React, { useState, useEffect } from 'react';
import { Settings, Save, Sparkles, Sliders, Shield, RefreshCw, Check, Mail, CheckCircle2, AlertCircle, AlertTriangle, Send } from 'lucide-react';
import { UserSettings } from '../types';
import { api } from '../services/api';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [emailStatus, setEmailStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('tejamatta05@gmail.com');
  const [testStatus, setTestStatus] = useState<{ text: string; success: boolean } | null>(null);
  const [testSending, setTestSending] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, email] = await Promise.all([
        api.getSettings(),
        api.getEmailStatus(),
      ]);
      setSettings(s);
      setEmailStatus(email);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleConnectGmail = async () => {
    try {
      const clientId = emailStatus?.clientId;
      if (clientId && (window as any).google?.accounts?.oauth2) {
        const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              alert(`Google Sign-In failed: ${tokenResponse.error}`);
              return;
            }
            try {
              const res = await api.submitGoogleAccessToken(tokenResponse.access_token, tokenResponse.expires_in);
              if (res.success) {
                await loadData();
              } else {
                alert(res.error || 'Failed to authenticate Google account');
              }
            } catch (err: any) {
              alert(err?.message || 'Failed to submit access token');
            }
          },
        });
        tokenClient.requestAccessToken({ prompt: 'consent' });
        return;
      }

      const res = await api.getGoogleAuthUrl(window.location.pathname);
      if (res.authUrl) {
        window.location.href = res.authUrl;
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to initiate Google OAuth');
    }
  };

  const handleDisconnectGmail = async () => {
    try {
      await api.disconnectGmail();
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to disconnect');
    }
  };

  const handleSendTestEmail = async () => {
    setTestSending(true);
    setTestStatus(null);
    try {
      const res = await api.sendTestEmail(testEmailAddress);
      setTestStatus({ text: res.message, success: res.success });
    } catch (err: any) {
      setTestStatus({ text: err?.message || 'Test send failed', success: false });
    } finally {
      setTestSending(false);
    }
  };

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
        <h2 className="text-base font-bold text-gray-900">Intelligence & Email Engine Settings</h2>
        <p className="text-xs text-gray-500 font-medium">
          Configure crawler speed, Gemini AI classification thresholds, and real Gmail OAuth credentials
        </p>
      </div>

      {/* Gmail OAuth Sender Section */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Gmail Sender Account (Google OAuth 2.0)
            </h3>
          </div>
          {emailStatus?.connected ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Connected ({emailStatus.accountEmail})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Disconnected
            </span>
          )}
        </div>

        <div className="text-xs space-y-2 text-gray-600">
          <p>
            Authorized sender address: <strong className="text-gray-900 font-mono">tejamatta05@gmail.com</strong>
          </p>
          <p className="text-[11px] text-gray-500">
            Uses real Google OAuth 2.0 with the <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800">gmail.send</code> scope. No passwords or secrets are ever stored.
          </p>
        </div>

        {emailStatus?.error && (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{emailStatus.error}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          {emailStatus?.connected ? (
            <button
              type="button"
              onClick={handleDisconnectGmail}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition cursor-pointer"
            >
              Disconnect Gmail Account
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnectGmail}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-200" /> Connect tejamatta05@gmail.com
            </button>
          )}
        </div>

        {/* Test Email Widget */}
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
          <label className="text-xs font-bold text-gray-700 block">
            Send Test Dispatch Verification
          </label>
          <div className="flex items-center gap-2 max-w-md">
            <input
              type="email"
              value={testEmailAddress}
              onChange={(e) => setTestEmailAddress(e.target.value)}
              placeholder="Recipient email address"
              className="w-full text-xs px-3 py-1.5 rounded-lg border border-gray-300 font-mono"
            />
            <button
              type="button"
              onClick={handleSendTestEmail}
              disabled={testSending}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition shrink-0 cursor-pointer disabled:opacity-50"
            >
              {testSending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              <span>Send Test</span>
            </button>
          </div>
          {testStatus && (
            <div
              className={`text-xs p-2 rounded-lg flex items-center gap-1.5 ${
                testStatus.success
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {testStatus.success ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              )}
              <span>{testStatus.text}</span>
            </div>
          )}
        </div>
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

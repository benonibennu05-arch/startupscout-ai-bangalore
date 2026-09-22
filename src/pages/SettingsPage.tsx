import React, { useState, useEffect } from 'react';
import { Settings, Save, Sparkles, Sliders, Shield, RefreshCw, Check, Mail, CheckCircle2, AlertCircle, AlertTriangle, Send, Copy, ExternalLink } from 'lucide-react';
import { UserSettings } from '../types';
import { api } from '../services/api';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [emailStatus, setEmailStatus] = useState<any>(null);
  const [diagnostic, setDiagnostic] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('tejamatta05@gmail.com');
  const [testStatus, setTestStatus] = useState<{ text: string; success: boolean } | null>(null);
  const [testSending, setTestSending] = useState(false);
  const [copiedOrigin, setCopiedOrigin] = useState(false);
  const [copiedRedirect, setCopiedRedirect] = useState(false);

  const handleCopyOrigin = () => {
    navigator.clipboard.writeText(diagnostic?.expectedJavaScriptOrigin || window.location.origin);
    setCopiedOrigin(true);
    setTimeout(() => setCopiedOrigin(false), 2000);
  };

  const handleCopyRedirect = () => {
    navigator.clipboard.writeText(diagnostic?.expectedRedirectUri || `${window.location.origin}/api/auth/google/callback`);
    setCopiedRedirect(true);
    setTimeout(() => setCopiedRedirect(false), 2000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, email, diag] = await Promise.all([
        api.getSettings(),
        api.getEmailStatus(),
        api.getOAuthDiagnostic().catch(() => null),
      ]);
      setSettings(s);
      setEmailStatus(email);
      setDiagnostic(diag);
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

  const handleConnectGmailRedirect = async () => {
    try {
      const res = await api.getGoogleAuthUrl(window.location.pathname);
      if (res.authUrl) {
        window.location.href = res.authUrl;
      } else if (res.error) {
        alert(res.error);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to initiate Google OAuth redirect');
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
          {diagnostic?.status === 'Connected' || emailStatus?.connected ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Connected ({emailStatus?.accountEmail || diagnostic?.connectedAccount})
            </span>
          ) : diagnostic?.status === 'Wrong Account' || emailStatus?.error?.includes('Wrong') ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Wrong Account
            </span>
          ) : diagnostic?.status === 'Token Expired' || emailStatus?.tokenExpired ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200">
              <AlertCircle className="w-3.5 h-3.5 text-orange-600" /> Token Expired
            </span>
          ) : emailStatus?.error ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> OAuth Error
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
            Uses real Google OAuth 2.0 with the <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800">gmail.send</code> scope. After authorization, system verifies the connected account matches <strong className="text-gray-800">tejamatta05@gmail.com</strong>.
          </p>
        </div>

        {(emailStatus?.error || diagnostic?.lastError) && (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-lg flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">
                {emailStatus?.error?.includes('Wrong') || diagnostic?.lastError?.includes('Wrong')
                  ? 'Wrong Google account. Please connect with: tejamatta05@gmail.com'
                  : 'OAuth Connection Issue'}
              </p>
              <p className="text-[11px] text-rose-600 font-mono">
                {emailStatus?.error || diagnostic?.lastError}
              </p>
            </div>
          </div>
        )}

        {/* Diagnostic Panel */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
            <span className="font-bold text-slate-800 text-xs">OAuth Diagnostic & Credentials Panel</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
              Environment: {diagnostic?.environment || 'Development'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[11px] font-medium text-slate-500 block mb-0.5">Current Browser Origin:</span>
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1.5 rounded font-mono text-[11px] text-slate-800">
                <span className="truncate flex-1">{window.location.origin}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.origin);
                    setCopiedOrigin(true);
                    setTimeout(() => setCopiedOrigin(false), 2000);
                  }}
                  type="button"
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-sans text-[10px] shrink-0"
                >
                  {copiedOrigin ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedOrigin ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-medium text-slate-500 block mb-0.5">Configured OAuth Client ID:</span>
              <div className="bg-white border border-slate-200 px-2 py-1.5 rounded font-mono text-[11px] text-slate-700 truncate select-all">
                {diagnostic?.configuredClientId || emailStatus?.clientId || 'NOT_CONFIGURED'}
              </div>
            </div>

            <div className="md:col-span-2">
              <span className="text-[11px] font-medium text-slate-500 block mb-0.5">Configured Redirect URI:</span>
              <div className="bg-white border border-slate-200 px-2 py-1.5 rounded font-mono text-[11px] text-slate-700 truncate select-all">
                {diagnostic?.configuredRedirectUri || `${window.location.origin}/api/auth/google/callback`}
              </div>
            </div>

            <div>
              <span className="text-[11px] font-medium text-slate-500 block mb-0.5">Expected JavaScript Origin:</span>
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1.5 rounded font-mono text-[11px] text-slate-800">
                <span className="truncate flex-1">{diagnostic?.expectedJavaScriptOrigin || window.location.origin}</span>
                <button
                  onClick={handleCopyOrigin}
                  type="button"
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-sans text-[10px] shrink-0"
                >
                  {copiedOrigin ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedOrigin ? 'Copied' : 'Copy Origin'}</span>
                </button>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-medium text-slate-500 block mb-0.5">Expected Redirect URI:</span>
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1.5 rounded font-mono text-[11px] text-slate-800">
                <span className="truncate flex-1">{diagnostic?.expectedRedirectUri || `${window.location.origin}/api/auth/google/callback`}</span>
                <button
                  onClick={handleCopyRedirect}
                  type="button"
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-sans text-[10px] shrink-0"
                >
                  {copiedRedirect ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedRedirect ? 'Copied' : 'Copy URI'}</span>
                </button>
              </div>
            </div>

            {/* Structured Diagnostics Grid */}
            <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/60">
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 block uppercase font-medium">Token Status</span>
                <span className={`text-xs font-bold font-mono ${
                  diagnostic?.tokenStatus === 'VALID'
                    ? 'text-emerald-700'
                    : diagnostic?.tokenStatus === 'EXPIRED'
                    ? 'text-amber-700'
                    : diagnostic?.tokenStatus === 'WRONG_USER'
                    ? 'text-rose-700'
                    : 'text-slate-600'
                }`}>
                  {diagnostic?.tokenStatus || (emailStatus?.connected ? 'VALID' : 'MISSING')}
                </span>
              </div>

              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 block uppercase font-medium">Target User</span>
                <span className="text-xs font-bold font-mono text-slate-800 truncate block" title={diagnostic?.expectedUser || 'tejamatta05@gmail.com'}>
                  {diagnostic?.expectedUser || 'tejamatta05@gmail.com'}
                </span>
              </div>

              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 block uppercase font-medium">Secret Configured</span>
                <span className={`text-xs font-bold ${diagnostic?.clientSecretConfigured || diagnostic?.hasClientSecret ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {diagnostic?.clientSecretConfigured || diagnostic?.hasClientSecret ? 'YES (Active)' : 'NO'}
                </span>
              </div>

              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 block uppercase font-medium">Gmail API Reachable</span>
                <span className={`text-xs font-bold ${diagnostic?.gmailApiReachable ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {diagnostic?.gmailApiReachable ? 'YES (Live)' : 'NO / Offline'}
                </span>
              </div>
            </div>

            {diagnostic?.scopes && diagnostic.scopes.length > 0 && (
              <div className="md:col-span-2 pt-1">
                <span className="text-[11px] font-medium text-slate-500 block mb-1">Active OAuth Scopes:</span>
                <div className="flex flex-wrap gap-1">
                  {diagnostic.scopes.map((scope: string) => (
                    <span key={scope} className="text-[10px] font-mono bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded">
                      {scope.replace('https://www.googleapis.com/auth/', '')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          {emailStatus?.connected || diagnostic?.status === 'Connected' ? (
            <button
              type="button"
              onClick={handleDisconnectGmail}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition cursor-pointer"
            >
              Disconnect Gmail Account
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleConnectGmail}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-200" /> Connect via Google Popup
              </button>
              <button
                type="button"
                onClick={handleConnectGmailRedirect}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition shadow-xs cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-gray-500" /> Connect via Server Redirect (Full Page)
              </button>
            </div>
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

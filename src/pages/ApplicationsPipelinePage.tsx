import React, { useState, useEffect } from 'react';
import {
  SendHorizontal,
  FileText,
  CheckCircle2,
  Clock,
  User,
  Settings,
  Sparkles,
  AlertCircle,
  ExternalLink,
  Edit3,
  Trash2,
  RefreshCw,
  Search,
  ShieldCheck,
  Building2,
  Mail,
  FileCheck,
  Check,
  AlertTriangle,
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  Application,
  SentEmailRecord,
  CandidateProfile,
  EmailProviderConfig,
  ApplicationStatus,
} from '../types';
import { api } from '../services/api';

type PipelineTab = 'ready' | 'drafts' | 'sent' | 'profile' | 'provider';

export const ApplicationsPipelinePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PipelineTab>('ready');
  const [applications, setApplications] = useState<Application[]>([]);
  const [sentHistory, setSentHistory] = useState<SentEmailRecord[]>([]);
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile | null>(null);
  const [emailConfig, setEmailConfig] = useState<EmailProviderConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Active reviewing/editing modal
  const [editingApp, setEditingApp] = useState<Application | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editRecipient, setEditRecipient] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Batch sending state
  const [isBatchSending, setIsBatchSending] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ sent: number; total: number } | null>(null);

  // Candidate Profile editing form
  const [profileForm, setProfileForm] = useState<Partial<CandidateProfile>>({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState(false);

  // Provider config editing
  const [configForm, setConfigForm] = useState<Partial<EmailProviderConfig>>({});
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [appsData, sentData, profileData, configData] = await Promise.all([
        api.getApplications({ search }),
        api.getSentHistory(),
        api.getCandidateProfile(),
        api.getEmailConfig(),
      ]);

      setApplications(Array.isArray(appsData) ? appsData : []);
      setSentHistory(Array.isArray(sentData) ? sentData : []);
      setCandidateProfile(profileData);
      setProfileForm(profileData || {});
      setEmailConfig(configData);
      setConfigForm(configData || {});
    } catch (err) {
      console.error('Failed to load application pipeline data:', err);
      setApplications([]);
      setSentHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  // Open modal for reviewing
  const handleOpenReview = (app: Application) => {
    setEditingApp(app);
    setEditSubject(app.subject);
    setEditBody(app.body);
    setEditRecipient(app.recipientEmail);
    setSendFeedback(null);
  };

  // Send single application
  const handleSendSingle = async () => {
    if (!editingApp) return;
    setIsSending(true);
    setSendFeedback(null);

    try {
      const res = await api.sendApplication(editingApp.id, {
        subject: editSubject,
        body: editBody,
        recipientEmail: editRecipient,
      });

      if (res.success) {
        setSendFeedback({ success: true, message: res.message });
        await loadData();
        setTimeout(() => {
          setEditingApp(null);
        }, 1500);
      } else {
        setSendFeedback({ success: false, message: res.message });
      }
    } catch (err: any) {
      setSendFeedback({ success: false, message: err?.message || 'Send error' });
    } finally {
      setIsSending(false);
    }
  };

  // Save changes to draft
  const handleSaveDraft = async () => {
    if (!editingApp) return;
    try {
      await api.updateApplication(editingApp.id, {
        subject: editSubject,
        body: editBody,
        recipientEmail: editRecipient,
      });
      await loadData();
      setEditingApp(null);
    } catch (err) {
      console.error('Failed to update draft:', err);
    }
  };

  // Delete draft
  const handleDeleteDraft = async (id: string) => {
    if (!confirm('Are you sure you want to delete this application draft?')) return;
    try {
      await api.deleteApplication(id);
      await loadData();
      if (editingApp?.id === id) setEditingApp(null);
    } catch (err) {
      console.error('Failed to delete draft:', err);
    }
  };

  // Batch Send All Ready to Send
  const handleBatchSend = async () => {
    const readyApps = applications.filter((a) => a.status === 'READY_TO_SEND');
    if (readyApps.length === 0) return;

    if (!confirm(`Are you ready to send ${readyApps.length} approved applications? Each will be sent with safety delay and duplicate checks.`)) {
      return;
    }

    setIsBatchSending(true);
    setBatchProgress({ sent: 0, total: readyApps.length });

    try {
      const ids = readyApps.map((a) => a.id);
      const res = await api.sendBatchApplications(ids);
      alert(`Batch completed: ${res.sent} sent successfully, ${res.skipped} skipped (limits/duplicates), ${res.failed} failed.`);
      await loadData();
    } catch (err: any) {
      alert(`Batch sending encountered an issue: ${err?.message}`);
    } finally {
      setIsBatchSending(false);
      setBatchProgress(null);
    }
  };

  // Save candidate profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const updated = await api.updateCandidateProfile(profileForm);
      setCandidateProfile(updated);
      setProfileSuccessMsg(true);
      setTimeout(() => setProfileSuccessMsg(false), 3000);
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Save email config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      const updated = await api.updateEmailConfig(configForm);
      setEmailConfig(updated);
      setConfigSuccessMsg(true);
      setTimeout(() => setConfigSuccessMsg(false), 3000);
    } catch (err) {
      console.error('Failed to save config:', err);
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Follow-up status update
  const handleUpdateFollowUp = async (id: string, status: 'DONE' | 'PENDING' | 'CANCELLED') => {
    try {
      await api.updateFollowUp(id, null, status);
      await loadData();
    } catch (err) {
      console.error('Failed to update follow up:', err);
    }
  };

  const readyList = applications.filter((a) => a.status === 'READY_TO_SEND');
  const draftList = applications.filter((a) => a.status === 'DRAFT');

  return (
    <div id="applications-pipeline-page" className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                <SendHorizontal className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold text-gray-900">
                Application Review & Cold Email Pipeline
              </h1>
            </div>
            <p className="text-sm text-gray-500 max-w-2xl">
              Human-in-the-loop review station. Inspect AI-generated emails, verify evidence quotes, and dispatch personalized applications with duplicate and rate protection.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'ready' && readyList.length > 0 && (
              <button
                id="btn-batch-send-approved"
                onClick={handleBatchSend}
                disabled={isBatchSending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition shadow-xs disabled:opacity-50"
              >
                {isBatchSending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Sending Batch...
                  </>
                ) : (
                  <>
                    <SendHorizontal className="w-4 h-4" />
                    Send All Approved ({readyList.length})
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Sub-Tab Navigation */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-gray-100 overflow-x-auto">
          <button
            onClick={() => setActiveTab('ready')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'ready'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            <span>Ready to Send</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
              {readyList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('drafts')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'drafts'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <FileText className="w-4 h-4 text-gray-500" />
            <span>Drafts</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700">
              {draftList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('sent')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'sent'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>Sent & Follow-Ups</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              {sentHistory.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'profile'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <User className="w-4 h-4 text-purple-600" />
            <span>Candidate Profile & Resume</span>
          </button>

          <button
            onClick={() => setActiveTab('provider')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'provider'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Settings className="w-4 h-4 text-amber-600" />
            <span>Email Provider & Limits</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'ready' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search ready applications..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-hidden"
              />
            </div>
            <div className="text-xs text-gray-500 font-medium">
              Daily quota: {sentHistory.filter((s) => s.sentAt.startsWith(new Date().toISOString().split('T')[0])).length} / {emailConfig?.dailySendLimit || 20} sent today
            </div>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
              Loading pipeline...
            </div>
          ) : readyList.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-gray-200 space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 className="text-base font-semibold text-gray-900">No applications currently waiting for review</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Generate new drafts from the Open Applications or Opportunities pages to queue them here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {readyList.map((app) => (
                <div
                  key={app.id}
                  id={`app-ready-card-${app.id}`}
                  className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs hover:border-gray-300 transition"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-gray-900">{app.companyName}</span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700">
                          {app.applicationType === 'OPEN_APPLICATION' ? 'Open Talent Pool' : app.roleTitle}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                          {app.matchScore}% Match
                        </span>
                      </div>

                      <div className="text-xs text-gray-600 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <div className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-gray-400" />
                          <span className="font-mono text-gray-800">{app.recipientEmail}</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-500">
                          <FileCheck className="w-3.5 h-3.5 text-blue-500" />
                          <span>Resume: {app.resumeFile}</span>
                        </div>
                      </div>

                      {/* Evidence citation */}
                      {app.sourceEvidence && (
                        <div className="bg-gray-50 p-2.5 rounded-lg border-l-2 border-blue-500 text-xs text-gray-600 italic">
                          "{app.sourceEvidence.slice(0, 140)}..."
                        </div>
                      )}

                      {/* Subject Preview */}
                      <div className="text-xs font-semibold text-gray-800">
                        Subject: <span className="font-normal text-gray-700">{app.subject}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      <button
                        id={`btn-review-app-${app.id}`}
                        onClick={() => handleOpenReview(app)}
                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition shadow-xs flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Review & Send</span>
                      </button>

                      <button
                        onClick={() => handleDeleteDraft(app.id)}
                        className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Delete application"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Drafts Tab */}
      {activeTab === 'drafts' && (
        <div className="space-y-4">
          {draftList.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-gray-200 space-y-3">
              <FileText className="w-10 h-10 text-gray-300 mx-auto" />
              <h3 className="text-base font-semibold text-gray-900">No in-progress drafts</h3>
              <p className="text-xs text-gray-500">All generated drafts are staged in "Ready to Send".</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {draftList.map((app) => (
                <div key={app.id} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-bold text-gray-900">{app.companyName}</div>
                      <div className="text-xs text-gray-500">{app.subject}</div>
                    </div>
                    <button
                      onClick={() => handleOpenReview(app)}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg"
                    >
                      Edit Draft
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sent History & Follow-ups Tab */}
      {activeTab === 'sent' && (
        <div className="space-y-4">
          {sentHistory.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-gray-200 space-y-3">
              <Clock className="w-10 h-10 text-gray-300 mx-auto" />
              <h3 className="text-base font-semibold text-gray-900">No sent applications yet</h3>
              <p className="text-xs text-gray-500">Applications you approve and send will appear here with delivery timestamps and follow-up tracking.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {sentHistory.map((item) => (
                <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{item.companyName}</span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                          SENT & DELIVERED
                        </span>
                        {item.followUpStatus === 'DONE' && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700">
                            Followed Up / Replied
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Sent on {new Date(item.sentAt).toLocaleString()} to <span className="font-mono text-gray-800">{item.recipientEmail}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.followUpStatus !== 'DONE' ? (
                        <button
                          onClick={() => handleUpdateFollowUp(item.id, 'DONE')}
                          className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg transition"
                        >
                          Mark Followed Up / Replied
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUpdateFollowUp(item.id, 'PENDING')}
                          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium rounded-lg transition"
                        >
                          Reopen Follow-up
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-700 space-y-1">
                    <div className="font-semibold text-gray-900">Subject: {item.subject}</div>
                    <div className="line-clamp-2 text-gray-600">{item.body}</div>
                  </div>

                  <div className="text-[11px] text-gray-400 flex items-center justify-between">
                    <span>Message ID: {item.providerMessageId}</span>
                    <span>Follow-up Scheduled: {new Date(item.followUpReminderDate || '').toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Candidate Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs max-w-3xl">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Candidate Profile & Resume</h2>
              <p className="text-xs text-gray-500">Configure your professional details, portfolio links, and resume attachment used in generated application emails.</p>
            </div>
            {profileSuccessMsg && (
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Saved!
              </span>
            )}
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={profileForm.name || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={profileForm.email || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-hidden"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Target Focus / Specialization</label>
              <input
                type="text"
                value={profileForm.targetFocus || ''}
                onChange={(e) => setProfileForm({ ...profileForm, targetFocus: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-hidden"
                placeholder="e.g. AI / ML Engineering, LLM Agent Architectures, Python Backend"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Portfolio URL</label>
                <input
                  type="url"
                  value={profileForm.portfolio || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, portfolio: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">LinkedIn Profile</label>
                <input
                  type="url"
                  value={profileForm.linkedin || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, linkedin: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">GitHub Profile</label>
                <input
                  type="url"
                  value={profileForm.github || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, github: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Attached Resume File Name</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={profileForm.resumeFileName || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, resumeFileName: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-hidden"
                  placeholder="e.g. Teja_Matta_Resume.pdf"
                  required
                />
                <span className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0">
                  <FileCheck className="w-4 h-4" /> Valid Resume
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition shadow-xs disabled:opacity-50"
              >
                {isSavingProfile ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Provider Config Tab */}
      {activeTab === 'provider' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs max-w-3xl">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Email Delivery & Safety Controls</h2>
              <p className="text-xs text-gray-500">Configure provider backend, strict sending rate limit safeguards, and duplicate cooldown policies.</p>
            </div>
            {configSuccessMsg && (
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Saved!
              </span>
            )}
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Email Provider Mode</label>
              <select
                value={configForm.provider || 'SIMULATED_TEST_PROVIDER'}
                onChange={(e) => setConfigForm({ ...configForm, provider: e.target.value as any })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-hidden"
              >
                <option value="SIMULATED_TEST_PROVIDER">Simulated Sandbox (Safe Local Deliveries & Logging)</option>
                <option value="GMAIL_OAUTH">Google Workspace / Gmail OAuth</option>
                <option value="SMTP">Custom SMTP Gateway</option>
                <option value="RESEND">Resend.com API</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Daily Sending Limit</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={configForm.dailySendLimit || 20}
                  onChange={(e) => setConfigForm({ ...configForm, dailySendLimit: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-hidden"
                />
                <span className="text-[11px] text-gray-500 mt-1 block">Maximum emails permitted per calendar day.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Duplicate Cooldown (Days)</label>
                <input
                  type="number"
                  min={7}
                  max={90}
                  value={configForm.openAppCooldownDays || 30}
                  onChange={(e) => setConfigForm({ ...configForm, openAppCooldownDays: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-hidden"
                />
                <span className="text-[11px] text-gray-500 mt-1 block">Blocks re-applying to the same company within cooldown period.</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Inter-Send Safety Delay (ms)</label>
              <input
                type="number"
                min={500}
                max={10000}
                step={500}
                value={configForm.safetyDelayMs || 1500}
                onChange={(e) => setConfigForm({ ...configForm, safetyDelayMs: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-hidden"
              />
              <span className="text-[11px] text-gray-500 mt-1 block">Delay between consecutive sends during batch dispatch.</span>
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <button
                type="submit"
                disabled={isSavingConfig}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition shadow-xs disabled:opacity-50"
              >
                {isSavingConfig ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Review & Dispatch Modal */}
      {editingApp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div
            id="review-application-modal"
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-gray-900">
                    Review Application for {editingApp.companyName}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700">
                    {editingApp.applicationType === 'OPEN_APPLICATION' ? 'Open Application' : editingApp.roleTitle}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Inspect and edit before human-approved dispatch
                </div>
              </div>

              <button
                onClick={() => setEditingApp(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Evidence Banner */}
              {editingApp.sourceEvidence && (
                <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5 text-blue-800">
                    <Info className="w-4 h-4 text-blue-600" />
                    Verified Discovery Evidence from Official Careers Page
                  </div>
                  <div className="italic text-gray-700">
                    "{editingApp.sourceEvidence}"
                  </div>
                  {editingApp.sourceUrl && (
                    <a
                      href={editingApp.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:underline mt-1"
                    >
                      <span>Open Source Page</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}

              {/* Recipient Email */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Recipient Email (Must be publicly verified)
                </label>
                <input
                  type="email"
                  value={editRecipient}
                  onChange={(e) => setEditRecipient(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:bg-white focus:outline-hidden"
                  required
                />
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-hidden font-medium"
                  required
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Email Content (Personalized & Human-Tone)
                </label>
                <textarea
                  rows={10}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs leading-relaxed font-sans focus:bg-white focus:outline-hidden"
                  required
                />
              </div>

              {/* Feedback messages */}
              {sendFeedback && (
                <div
                  className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                    sendFeedback.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {sendFeedback.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{sendFeedback.message}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg transition"
                >
                  Save Changes
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingApp(null)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 text-xs font-medium"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  id="btn-confirm-send-single"
                  onClick={handleSendSingle}
                  disabled={isSending}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition shadow-xs disabled:opacity-50"
                >
                  {isSending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <SendHorizontal className="w-3.5 h-3.5" />
                      <span>Approve & Send Email</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

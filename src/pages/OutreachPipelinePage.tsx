import React, { useState, useEffect, useCallback } from 'react';
import {
  SendHorizontal,
  Mail,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Play,
  RotateCw,
  Edit3,
  Trash2,
  ExternalLink,
  ShieldCheck,
  FileText,
  User,
  Settings,
  Filter,
  Search,
  Check,
  X,
  Calendar,
  Layers,
  ChevronRight,
  RefreshCw,
  Send,
  AlertCircle,
  Briefcase,
  GraduationCap,
  Inbox,
  Flame,
  FileCheck,
} from 'lucide-react';
import { api } from '../services/api';
import {
  OutreachRecord,
  OutreachStats,
  OutreachSettings,
  OutreachStatus,
  OutreachType,
  CandidateProfile,
  LocationScope,
} from '../types';

interface OutreachPipelinePageProps {
  selectedLocation?: LocationScope;
}

export const OutreachPipelinePage: React.FC<OutreachPipelinePageProps> = ({
  selectedLocation = 'BANGALORE',
}) => {
  const [records, setRecords] = useState<OutreachRecord[]>([]);
  const [stats, setStats] = useState<OutreachStats | null>(null);
  const [settings, setSettings] = useState<OutreachSettings | null>(null);
  const [candidate, setCandidate] = useState<CandidateProfile | null>(null);
  const [emailStatus, setEmailStatus] = useState<{
    connected: boolean;
    canSend: boolean;
    accountEmail: string;
    expectedEmail: string;
    isAuthConfigured: boolean;
    error?: string | null;
    scopes?: string[];
    sentToday: number;
    dailyLimit: number;
    remainingToday: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Draft for Review / Edit Modal
  const [selectedRecord, setSelectedRecord] = useState<OutreachRecord | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editRecipient, setEditRecipient] = useState('');

  // Settings Modal
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isTestEmailOpen, setIsTestEmailOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('tejamatta05@gmail.com');
  const [authConnecting, setAuthConnecting] = useState(false);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [recordsRes, statsRes, settingsRes, candidateRes, emailRes] = await Promise.all([
        api.getOutreachRecords({ location: selectedLocation }),
        api.getOutreachStats(selectedLocation),
        api.getOutreachSettings(),
        api.getCandidateProfile(),
        api.getEmailStatus(),
      ]);

      setRecords(recordsRes || []);
      setStats(statsRes || null);
      setSettings(settingsRes || null);
      setCandidate(candidateRes || null);
      setEmailStatus(emailRes || null);
    } catch (err: any) {
      console.error('Failed to load outreach pipeline data:', err);
      showToast('Failed to load outreach records', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedLocation]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Google OAuth 2.0 callback params from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthStatus = urlParams.get('oauth');
    const oauthMessage = urlParams.get('message');
    const oauthEmail = urlParams.get('email');

    if (oauthStatus === 'success') {
      showToast(`Gmail account (${oauthEmail || 'tejamatta05@gmail.com'}) successfully authenticated via Google OAuth 2.0!`, 'success');
      window.history.replaceState({}, document.title, window.location.pathname);
      loadData();
    } else if (oauthStatus === 'wrong_account') {
      showToast(`OAuth Rejected: Authenticated as ${oauthEmail || 'another account'}, but this pipeline requires tejamatta05@gmail.com.`, 'error');
      window.history.replaceState({}, document.title, window.location.pathname);
      loadData();
    } else if (oauthStatus === 'error') {
      showToast(`OAuth Error: ${oauthMessage || 'Authentication failed'}`, 'error');
      window.history.replaceState({}, document.title, window.location.pathname);
      loadData();
    }
  }, [loadData]);

  // Action: Connect Gmail via OAuth / GIS Popup
  const handleConnectGmail = async () => {
    try {
      setAuthConnecting(true);
      setActionLoading(true);
      
      const clientId = emailStatus?.clientId;

      // Ensure GIS script is ready
      if (!(window as any).google?.accounts?.oauth2) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.defer = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Google Identity Services library'));
          document.head.appendChild(script);
        }).catch(() => null);
      }

      if (clientId && (window as any).google?.accounts?.oauth2) {
        const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
          callback: async (tokenResponse: any) => {
            setAuthConnecting(false);
            setActionLoading(false);
            if (tokenResponse.error) {
              showToast(`Google Sign-In: ${tokenResponse.error_description || tokenResponse.error}`, 'error');
              return;
            }
            try {
              setActionLoading(true);
              const res = await api.submitGoogleAccessToken(tokenResponse.access_token, tokenResponse.expires_in);
              if (res.success) {
                showToast(`Gmail account (${res.email || 'tejamatta05@gmail.com'}) successfully authenticated!`, 'success');
                setIsConnectModalOpen(false);
                await loadData();
              } else {
                showToast(res.error || 'Failed to authenticate Google account', 'error');
              }
            } catch (err: any) {
              showToast(err?.message || 'Failed to submit access token', 'error');
            } finally {
              setActionLoading(false);
            }
          },
          error_callback: (err: any) => {
            setAuthConnecting(false);
            setActionLoading(false);
            showToast(err?.message || 'OAuth popup window closed or blocked', 'error');
          }
        });
        tokenClient.requestAccessToken({ prompt: 'consent' });
        return;
      }

      // Fallback to server route redirect
      const res = await api.getGoogleAuthUrl(window.location.pathname);
      if (res.authUrl) {
        window.location.href = res.authUrl;
      } else if (res.error) {
        showToast(res.error, 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to initiate Google OAuth', 'error');
    } finally {
      setAuthConnecting(false);
      setActionLoading(false);
    }
  };

  // Action: Disconnect Gmail
  const handleDisconnectGmail = async () => {
    try {
      setActionLoading(true);
      await api.disconnectGmail();
      showToast('Gmail account disconnected', 'info');
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to disconnect Gmail', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Test Outreach Pipeline (5 Drafts)
  const handleTestOutreachPipeline = async () => {
    try {
      setActionLoading(true);
      const res = await api.testOutreachPipeline(5);
      if (res.success) {
        showToast(`Generated ${res.createdCount} test outreach draft(s) for researched Bangalore startups!`, 'success');
        await loadData();
      } else {
        showToast('Failed to generate test drafts', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error running test outreach pipeline', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Auto-Draft All Eligible
  const handleAutoDraftAll = async () => {
    try {
      setActionLoading(true);
      const res = await api.autoDraftAllOutreach();
      showToast(`Processed ${res.eligible} eligible startups with verified public emails. Created ${res.draftsCreated} drafts!`, 'success');
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Error auto-drafting outreach', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Approve Draft
  const handleApprove = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const res = await api.approveOutreach(id);
      if (res.success) {
        showToast('Outreach draft approved for dispatch!', 'success');
        setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'APPROVED' } : r)));
        if (selectedRecord?.id === id) {
          setSelectedRecord((prev) => (prev ? { ...prev, status: 'APPROVED' } : null));
        }
      }
    } catch (err: any) {
      showToast(err?.message || 'Approval failed', 'error');
    }
  };

  // Action: Skip Draft
  const handleSkip = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const res = await api.skipOutreach(id, 'Skipped by user');
      if (res.success) {
        showToast('Draft moved to skipped', 'info');
        setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'SKIPPED' } : r)));
        if (selectedRecord?.id === id) {
          setSelectedRecord((prev) => (prev ? { ...prev, status: 'SKIPPED' } : null));
        }
      }
    } catch (err: any) {
      showToast(err?.message || 'Skip failed', 'error');
    }
  };

  // Action: Send Single Outreach
  const handleSendNow = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!emailStatus?.connected) {
      showToast('Gmail not connected. Please authenticate tejamatta05@gmail.com first.', 'error');
      setIsConnectModalOpen(true);
      return;
    }
    try {
      setActionLoading(true);
      const res = await api.sendOutreach(id);
      if (res.success) {
        showToast(res.message || 'Outreach email dispatched successfully!', 'success');
        await loadData();
        if (selectedRecord?.id === id) {
          setSelectedRecord(null);
        }
      } else {
        showToast(res.message || 'Dispatch failed', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to send outreach', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Batch Send Approved
  const handleBatchSendApproved = async () => {
    if (!emailStatus?.connected) {
      showToast('Gmail not connected. Please authenticate tejamatta05@gmail.com first.', 'error');
      setIsConnectModalOpen(true);
      return;
    }
    const approved = records.filter((r) => r.status === 'APPROVED');
    if (approved.length === 0) {
      showToast('No approved drafts ready to send. Approve drafts first.', 'info');
      return;
    }

    try {
      setActionLoading(true);
      const ids = approved.map((r) => r.id);
      const res = await api.sendBatchOutreach(ids);
      showToast(`Batch completed: ${res.sent} sent, ${res.failed} failed, ${res.skipped} skipped.`, res.sent > 0 ? 'success' : 'info');
      await loadData();
    } catch (err: any) {
      showToast(err?.message || 'Batch send failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Save Draft Edits
  const handleSaveModalEdits = async () => {
    if (!selectedRecord) return;
    try {
      setActionLoading(true);
      const updated = await api.updateOutreach(selectedRecord.id, {
        subject: editSubject,
        body: editBody,
        recipientEmail: editRecipient,
      });
      showToast('Draft changes saved successfully', 'success');
      setSelectedRecord(updated);
      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err: any) {
      showToast(err?.message || 'Failed to save edits', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Send from Modal with Edits
  const handleSendFromModal = async () => {
    if (!selectedRecord) return;
    if (!emailStatus?.connected) {
      showToast('Gmail not connected. Please authenticate tejamatta05@gmail.com first.', 'error');
      setIsConnectModalOpen(true);
      return;
    }
    try {
      setActionLoading(true);
      const res = await api.sendOutreach(selectedRecord.id, {
        subject: editSubject,
        body: editBody,
        recipientEmail: editRecipient,
      });
      if (res.success) {
        showToast(res.message, 'success');
        await loadData();
        setSelectedRecord(null);
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Send failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Send Test Email
  const handleSendTestEmail = async () => {
    if (!emailStatus?.connected) {
      showToast('Gmail not connected. Please authenticate tejamatta05@gmail.com first.', 'error');
      setIsConnectModalOpen(true);
      return;
    }
    try {
      setActionLoading(true);
      const res = await api.sendTestEmail(testEmailAddress);
      if (res.success) {
        showToast(res.message, 'success');
        setIsTestEmailOpen(false);
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Test email failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Edit Modal
  const openReviewModal = (record: OutreachRecord) => {
    setSelectedRecord(record);
    setEditSubject(record.subject);
    setEditBody(record.body);
    setEditRecipient(record.recipientEmail);
  };

  // Filtered List
  const filteredRecords = records.filter((r) => {
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'READY') {
        if (r.status !== 'DRAFT_READY' && r.status !== 'REVIEW_REQUIRED' && r.status !== 'APPROVED') return false;
      } else if (r.status !== statusFilter) {
        return false;
      }
    }

    if (typeFilter !== 'ALL' && r.outreachType !== typeFilter) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchComp = r.companyName.toLowerCase().includes(q);
      const matchSub = r.subject.toLowerCase().includes(q);
      const matchRole = r.roleTitle?.toLowerCase().includes(q);
      const matchEmail = r.recipientEmail.toLowerCase().includes(q);
      if (!matchComp && !matchSub && !matchRole && !matchEmail) return false;
    }

    return true;
  });

  const getStatusBadge = (status: OutreachStatus) => {
    switch (status) {
      case 'DRAFT_READY':
      case 'REVIEW_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Edit3 className="w-3 h-3" /> Draft Ready
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Approved
          </span>
        );
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <Clock className="w-3 h-3" /> Scheduled
          </span>
        );
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-700 text-white shadow-xs">
            <Check className="w-3 h-3" /> Sent
          </span>
        );
      case 'COOLDOWN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
            <ShieldCheck className="w-3 h-3" /> In Cooldown (30d)
          </span>
        );
      case 'SKIPPED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
            <X className="w-3 h-3" /> Skipped
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3 h-3" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  const getTypeBadge = (type: OutreachType) => {
    switch (type) {
      case 'JOB_APPLICATION':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <Briefcase className="w-3 h-3" /> Job Application
          </span>
        );
      case 'INTERNSHIP_APPLICATION':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
            <GraduationCap className="w-3 h-3" /> Internship App
          </span>
        );
      case 'OPEN_APPLICATION':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Inbox className="w-3 h-3" /> Open Talent Pool
          </span>
        );
      case 'AI_ML_CAREER_INQUIRY':
      case 'GENERAL_CAREER_INQUIRY':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Sparkles className="w-3 h-3 text-amber-600" /> AI/ML Career Inquiry
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-gray-50 text-gray-700">
            {type}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Banner */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : toastMessage.type === 'error'
              ? 'bg-rose-50 text-rose-900 border-rose-200'
              : 'bg-blue-50 text-blue-900 border-blue-200'
          }`}
        >
          {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          {toastMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600" />}
          {toastMessage.type === 'info' && <AlertCircle className="w-4 h-4 text-blue-600" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <SendHorizontal className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">My Outreach & Email Pipeline</h1>
                <p className="text-sm text-gray-500">
                  Automated cold email engine across 957+ researched Bangalore startups with verified public recruiting emails.
                </p>
              </div>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="btn-test-outreach-5"
              onClick={handleTestOutreachPipeline}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              title="Generate 5 test drafts for researched companies without sending"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Test Outreach (5 Drafts)</span>
            </button>

            <button
              id="btn-auto-draft-all"
              onClick={handleAutoDraftAll}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              title="Evaluate all researched companies with verified public emails"
            >
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Auto-Draft All Researched</span>
            </button>

            <button
              id="btn-batch-send-approved"
              onClick={handleBatchSendApproved}
              disabled={actionLoading || records.filter((r) => r.status === 'APPROVED').length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>
                Batch Send Approved ({records.filter((r) => r.status === 'APPROVED').length})
              </span>
            </button>

            <button
              id="btn-open-outreach-settings"
              onClick={() => setIsSettingsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4 text-gray-500" />
              <span>Settings</span>
            </button>

            <button
              id="btn-refresh-outreach"
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer"
              title="Refresh Records"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Candidate Profile & Safeguards Ribbon */}
        {candidate && (
          <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-4 text-gray-600">
              <span className="flex items-center gap-1.5 font-medium text-gray-900">
                <User className="w-4 h-4 text-emerald-600" />
                {candidate.name} ({candidate.targetFocus})
              </span>
              {candidate.resumeFileName ? (
                <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 font-medium">
                  <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Resume: <strong>{candidate.resumeFileName}</strong>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-300 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  Resume: <strong>Not Uploaded (Sending Blocked)</strong>
                </span>
              )}
              <a
                href={candidate.portfolio}
                target="_blank"
                rel="noreferrer"
                className="hover:text-emerald-600 underline flex items-center gap-1"
              >
                Portfolio <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href={candidate.linkedin}
                target="_blank"
                rel="noreferrer"
                className="hover:text-emerald-600 underline flex items-center gap-1"
              >
                LinkedIn <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href={candidate.github}
                target="_blank"
                rel="noreferrer"
                className="hover:text-emerald-600 underline flex items-center gap-1"
              >
                GitHub <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-gray-500">
                Automation Mode:{' '}
                <strong className="text-gray-900">
                  {settings?.automationMode === 'REVIEW_BEFORE_SEND'
                    ? 'Review Before Send (Default)'
                    : settings?.automationMode}
                </strong>
              </span>
              <span className="text-gray-500">
                Cooldown:{' '}
                <strong className="text-gray-900">{settings?.cooldownDays || 30} Days</strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Gmail Sender Account & OAuth Status Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                emailStatus?.connected
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-100 text-amber-700 border border-amber-200'
              }`}
            >
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-gray-900">Gmail Delivery Engine</h2>
                {emailStatus?.connected ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Authenticated ({emailStatus.accountEmail})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Gmail OAuth Required
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600">
                  Target Sender: <strong className="text-gray-900">tejamatta05@gmail.com</strong>
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {emailStatus?.connected
                  ? 'Real Gmail API integration active with Google OAuth 2.0 (gmail.send scope). Sent emails will originate directly from your Gmail inbox with your resume attached.'
                  : 'Emails will be sent via your personal Gmail account (tejamatta05@gmail.com). Authenticate securely using Google OAuth 2.0 without entering passwords.'}
              </p>
              {emailStatus?.error && (
                <div className="mt-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>{emailStatus.error}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center shrink-0">
            {emailStatus?.connected ? (
              <>
                <button
                  id="btn-send-test-email"
                  onClick={() => setIsTestEmailOpen(true)}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-semibold transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Send Test Email</span>
                </button>
                <button
                  id="btn-disconnect-gmail"
                  onClick={handleDisconnectGmail}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 text-xs font-medium transition cursor-pointer"
                >
                  <span>Disconnect</span>
                </button>
              </>
            ) : (
              <>
                <button
                  id="btn-connect-gmail-oauth"
                  onClick={handleConnectGmail}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-blue-200" />
                  <span>Connect Gmail (tejamatta05@gmail.com)</span>
                </button>
                <button
                  id="btn-send-test-email-unconnected"
                  onClick={() => setIsTestEmailOpen(true)}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-300 text-xs font-medium transition cursor-pointer"
                >
                  <span>Test Send</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <div className="text-xs text-gray-500 font-medium">Researched Startups</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{stats.companiesResearched}</div>
            <div className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> 100% Exact Evidence
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <div className="text-xs text-gray-500 font-medium">Verified Public Emails</div>
            <div className="text-2xl font-bold text-teal-700 mt-1">{stats.verifiedEmails}</div>
            <div className="text-xs text-gray-400 mt-1">Zero Guessed/Inferred</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <div className="text-xs text-gray-500 font-medium">Drafts Ready / Review</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">{stats.draftsReady}</div>
            <div className="text-xs text-amber-700 mt-1 flex items-center gap-1">
              <Edit3 className="w-3 h-3" /> Awaiting Approval
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <div className="text-xs text-gray-500 font-medium">Scheduled</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{stats.scheduled}</div>
            <div className="text-xs text-gray-400 mt-1">Jitter queued</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <div className="text-xs text-gray-500 font-medium">Sent Today / Limit</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">
              {stats.sentToday} / <span className="text-sm font-normal text-gray-400">{stats.dailyLimit}</span>
            </div>
            <div className="text-xs text-emerald-600 mt-1">{stats.dailyLimitRemaining} remaining today</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <div className="text-xs text-gray-500 font-medium">Total Outreach Sent</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{stats.totalSent}</div>
            <div className="text-xs text-gray-400 mt-1">{stats.inCooldown} in 30d cooldown</div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
            {[
              { id: 'ALL', label: 'All Records' },
              { id: 'READY', label: 'Ready & Review' },
              { id: 'APPROVED', label: 'Approved' },
              { id: 'SCHEDULED', label: 'Scheduled' },
              { id: 'SENT', label: 'Sent' },
              { id: 'COOLDOWN', label: 'Cooldown (30d)' },
              { id: 'SKIPPED', label: 'Skipped' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-gray-900 text-white font-semibold shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search company, subject, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Type Filter */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 text-xs">
          <span className="text-gray-400 font-medium flex items-center gap-1">
            <Filter className="w-3 h-3" /> Outreach Type:
          </span>
          {[
            { id: 'ALL', label: 'All Types' },
            { id: 'JOB_APPLICATION', label: 'Job Application' },
            { id: 'INTERNSHIP_APPLICATION', label: 'Internship' },
            { id: 'OPEN_APPLICATION', label: 'Open Application' },
            { id: 'AI_ML_CAREER_INQUIRY', label: 'AI/ML Career Inquiry (No Vacancy Required)' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTypeFilter(t.id)}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                typeFilter === t.id
                  ? 'bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Outreach Records Table / Cards */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-600" />
            <p className="text-sm font-medium">Loading outreach records...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">No Outreach Records Found</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
              Start by clicking <strong>"Test Outreach (5 Drafts)"</strong> or <strong>"Auto-Draft All Researched"</strong> to generate tailored cold outreach for Bangalore startups with verified public emails.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <button
                onClick={handleTestOutreachPipeline}
                disabled={actionLoading}
                className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Generate 5 Test Drafts
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase font-semibold tracking-wider">
                  <th className="py-3 px-4">Company & Target</th>
                  <th className="py-3 px-4">Outreach Type</th>
                  <th className="py-3 px-4">Verified Recipient Email</th>
                  <th className="py-3 px-4">Subject Line</th>
                  <th className="py-3 px-4">Match</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredRecords.map((record) => (
                  <tr
                    key={record.id}
                    onClick={() => openReviewModal(record)}
                    className="hover:bg-gray-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900 text-sm group-hover:text-emerald-700">
                        {record.companyName}
                      </div>
                      <div className="text-gray-500 text-xs mt-0.5 flex items-center gap-1">
                        <span className="truncate max-w-[200px]">{record.roleTitle || 'Career Inquiry'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {getTypeBadge(record.outreachType)}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-mono text-gray-900 font-medium">{record.recipientEmail}</div>
                      <div className="text-emerald-700 font-semibold text-[10px] flex items-center gap-1 mt-0.5">
                        <ShieldCheck className="w-3 h-3" /> VERIFIED PUBLIC (Exact Match)
                      </div>
                    </td>

                    <td className="py-3 px-4 max-w-[280px]">
                      <div className="text-gray-800 font-medium truncate">{record.subject}</div>
                      <div className="text-gray-400 text-[11px] truncate mt-0.5">
                        {record.body.slice(0, 70)}...
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-semibold text-xs border border-emerald-200">
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        {record.matchScore}%
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {getStatusBadge(record.status)}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openReviewModal(record)}
                          className="px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-xs transition-colors"
                          title="Review & Edit Draft"
                        >
                          Review
                        </button>

                        {(record.status === 'DRAFT_READY' || record.status === 'REVIEW_REQUIRED') && (
                          <button
                            onClick={(e) => handleApprove(record.id, e)}
                            className="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-medium text-xs transition-colors"
                            title="Approve Draft"
                          >
                            Approve
                          </button>
                        )}

                        {record.status === 'APPROVED' && (
                          <button
                            onClick={(e) => handleSendNow(record.id, e)}
                            disabled={actionLoading}
                            className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-xs"
                            title="Send Immediately"
                          >
                            Send Now
                          </button>
                        )}

                        {record.status !== 'SKIPPED' && record.status !== 'SENT' && (
                          <button
                            onClick={(e) => handleSkip(record.id, e)}
                            className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                            title="Skip this draft"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review & Edit Outreach Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Review Outreach: {selectedRecord.companyName}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {getTypeBadge(selectedRecord.outreachType)} • Status: {getStatusBadge(selectedRecord.status)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Recipient & Public Evidence Box */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Verified Public Contact (Exact Match)
                  </span>
                  <span className="text-[11px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded font-mono">
                    {selectedRecord.emailType || 'HIRING/CAREERS'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">To:</span>
                  <input
                    type="email"
                    value={editRecipient}
                    onChange={(e) => setEditRecipient(e.target.value)}
                    className="flex-1 px-2.5 py-1 font-mono text-xs border border-emerald-300 rounded bg-white focus:ring-1 focus:ring-emerald-500 focus:outline-none font-semibold text-gray-900"
                  />
                </div>
                {selectedRecord.sourceEvidence && (
                  <p className="text-[11px] text-emerald-800/80 italic">
                    Source Evidence: "{selectedRecord.sourceEvidence}"
                  </p>
                )}
              </div>

              {/* Subject Line */}
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Subject Line</label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium text-gray-900"
                />
              </div>

              {/* Email Body */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-gray-700 font-semibold">Email Body</label>
                  <span className="text-[11px] text-gray-400">
                    {editBody.split(/\s+/).filter(Boolean).length} words • {editBody.length} chars
                  </span>
                </div>
                <textarea
                  rows={12}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono leading-relaxed border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-gray-800"
                />
              </div>

              {/* Attached Assets & Candidate Portfolio Banner */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-gray-700">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold">Attached Resume:</span>
                  <span className="bg-white px-2 py-0.5 rounded border border-gray-300 font-medium">
                    {selectedRecord.resumeFile || candidate?.resumeFileName || 'Teja_Matta_Resume.pdf'}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 flex items-center gap-3">
                  <span>Portfolio: {candidate?.portfolio}</span>
                  <span>GitHub: {candidate?.github}</span>
                </div>
              </div>

              {/* Match Explanation */}
              {selectedRecord.matchReason && (
                <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>
                    <strong>Relevance Match:</strong> {selectedRecord.matchReason}
                  </span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveModalEdits}
                  disabled={actionLoading}
                  className="px-3.5 py-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold rounded-lg text-xs transition-colors"
                >
                  Save Changes
                </button>

                {selectedRecord.status !== 'APPROVED' && (
                  <button
                    onClick={() => handleApprove(selectedRecord.id)}
                    disabled={actionLoading}
                    className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 font-semibold rounded-lg text-xs transition-colors"
                  >
                    Approve Draft
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-medium rounded-lg text-xs transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={handleSendFromModal}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Immediately</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsModalOpen && settings && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-700" />
                <h3 className="text-base font-bold text-gray-900">Outreach Pipeline Settings</h3>
              </div>
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Automation Mode */}
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Automation Mode</label>
                <select
                  value={settings.automationMode}
                  onChange={(e) =>
                    setSettings({ ...settings, automationMode: e.target.value as any })
                  }
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="REVIEW_BEFORE_SEND">Review Before Send (Default - Highly Recommended)</option>
                  <option value="MANUAL">Manual Mode (Human Dispatches Each One)</option>
                  <option value="AUTO_SEND">Auto-Send Mode (Auto-Schedules Verified AI/ML Matches)</option>
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  In "Review Before Send", every draft is queued in Draft Ready status for one-click human approval.
                </p>
              </div>

              {/* Daily Limit */}
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Daily Send Limit (Safety Cap)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={settings.dailySendLimit}
                  onChange={(e) =>
                    setSettings({ ...settings, dailySendLimit: parseInt(e.target.value, 10) || 20 })
                  }
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Recommended: 20-30 emails/day to preserve high deliverability and inbox reputation.
                </p>
              </div>

              {/* Cooldown Days */}
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Cooldown Period (Days)</label>
                <input
                  type="number"
                  min={7}
                  max={180}
                  value={settings.cooldownDays}
                  onChange={(e) =>
                    setSettings({ ...settings, cooldownDays: parseInt(e.target.value, 10) || 30 })
                  }
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Prevents re-contacting the same company/inbox within this cooldown window.
                </p>
              </div>

              {/* Send Delay Jitter */}
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Batch Send Delay (Seconds)</label>
                <input
                  type="number"
                  min={15}
                  max={300}
                  value={settings.sendDelaySeconds}
                  onChange={(e) =>
                    setSettings({ ...settings, sendDelaySeconds: parseInt(e.target.value, 10) || 45 })
                  }
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-medium rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    await api.updateOutreachSettings(settings);
                    showToast('Outreach settings updated!', 'success');
                    setIsSettingsModalOpen(false);
                  } catch (err: any) {
                    showToast('Failed to save settings', 'error');
                  }
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Email Modal */}
      {isTestEmailOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-gray-900">Send Pipeline Test Email</h3>
              </div>
              <button
                onClick={() => setIsTestEmailOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-3 text-xs">
              <p className="text-gray-600">
                Dispatches a live verification email with candidate profile, resume attachment metadata, and active safeguards to confirm inbox readiness.
              </p>
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Recipient Test Email</label>
                <input
                  type="email"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setIsTestEmailOpen(false)}
                className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-medium rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSendTestEmail}
                disabled={actionLoading}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs shadow-xs"
              >
                Send Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gmail OAuth Connect Modal */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-gray-900">Connect Your Gmail Account</h3>
              </div>
              <button
                onClick={() => setIsConnectModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Gmail Connection Required to Send</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Before sending test emails or cold job applications, you must authorize your sender account (<strong>tejamatta05@gmail.com</strong>) using Google OAuth 2.0.
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-gray-600">
                <p className="font-medium text-gray-800">What happens when you connect?</p>
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>A secure Google sign-in popup will open.</li>
                  <li>Sign in with <strong>tejamatta05@gmail.com</strong>.</li>
                  <li>Grant permission to send emails on your behalf (<code className="bg-gray-100 px-1 py-0.5 rounded">gmail.send</code>).</li>
                  <li>No passwords are stored. All emails are dispatched through official Google APIs with your resume attached.</li>
                </ul>
              </div>

              <div className="pt-2">
                <button
                  id="btn-modal-connect-gmail"
                  onClick={handleConnectGmail}
                  disabled={authConnecting || actionLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {authConnecting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-blue-200" />
                  )}
                  <span>{authConnecting ? 'Opening Google Sign-In...' : 'Connect Gmail Account (tejamatta05@gmail.com)'}</span>
                </button>
              </div>
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setIsConnectModalOpen(false)}
                className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-medium rounded-lg text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

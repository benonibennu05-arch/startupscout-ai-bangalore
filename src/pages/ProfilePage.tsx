import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  FileText,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Save,
  Send,
  Sparkles,
  Briefcase,
  GraduationCap,
  Link as LinkIcon,
  FileCheck,
  History,
  ShieldCheck,
} from 'lucide-react';
import { CandidateProfile, ResumeFile } from '../types';
import { api } from '../services/api';

export const ProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [resumeStatus, setResumeStatus] = useState<{
    uploaded: boolean;
    hasResume: boolean;
    fileId: string | null;
    filename: string | null;
    originalName?: string;
    mimeType?: string | null;
    size: number;
    uploadedAt: string | null;
    updatedAt?: string | null;
    version?: number;
    extractedSkills?: string[];
    extractedProjects?: string[];
    extractedExperience?: string;
    history?: ResumeFile[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSavedToast, setProfileSavedToast] = useState(false);

  // Resume Upload State
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Test Email State
  const [testEmailRecipient, setTestEmailRecipient] = useState('tejamatta05@gmail.com');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{
    success: boolean;
    message: string;
    attachmentName?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProfileAndResume = async () => {
    setLoading(true);
    try {
      const [profileRes, resumeRes] = await Promise.all([
        api.getProfile(),
        api.getResumeStatus(),
      ]);

      if (profileRes && profileRes.profile) {
        setProfile(profileRes.profile);
        if (profileRes.profile.email) {
          setTestEmailRecipient(profileRes.profile.email);
        }
      } else {
        const fallback = await api.getCandidateProfile();
        setProfile(fallback);
      }
      setResumeStatus(resumeRes);
    } catch (err) {
      console.error('Failed to load profile/resume data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfileAndResume();
  }, []);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    try {
      const res = await api.updateProfile(profile);
      if (res.success && res.profile) {
        setProfile(res.profile);
        setProfileSavedToast(true);
        setTimeout(() => setProfileSavedToast(false), 3000);
      }
    } catch (err) {
      console.error('Error saving profile:', err);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleFileSelect = async (file?: File | null) => {
    if (!file) return;

    setUploadError(null);
    setUploadSuccess(null);

    // Validate extension
    const validExtensions = ['.pdf', '.doc', '.docx'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExtensions.includes(ext)) {
      setUploadError(`Invalid file format "${ext}". Please upload a PDF, DOC, or DOCX document.`);
      return;
    }

    // Validate size (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setUploadError(`File is too large (${sizeMb} MB). Maximum allowed size is 10 MB.`);
      return;
    }

    setUploadProgress(10);
    try {
      const res = await api.uploadResume(file, (percent) => {
        setUploadProgress(percent);
      });

      if (res.success) {
        setUploadSuccess(`Resume "${file.name}" uploaded and parsed successfully!`);
        setUploadProgress(100);
        setTimeout(() => setUploadProgress(null), 1500);
        await loadProfileAndResume();
      } else {
        setUploadError(res.message || 'Failed to upload resume.');
        setUploadProgress(null);
      }
    } catch (err: any) {
      setUploadError(err.message || 'Error occurred while uploading resume.');
      setUploadProgress(null);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteResume = async () => {
    if (!window.confirm('Are you sure you want to remove your resume? Outreach emails will be blocked until a new resume is uploaded.')) {
      return;
    }

    try {
      const res = await api.deleteResume();
      if (res.success) {
        setUploadSuccess('Resume removed. Please upload a new one to enable email sending.');
        setUploadError(null);
        await loadProfileAndResume();
      }
    } catch (err) {
      console.error('Failed to delete resume:', err);
    }
  };

  const handleSelectVersion = async (fileId: string) => {
    try {
      const res = await api.selectResumeVersion(fileId);
      if (res.success) {
        setUploadSuccess(`Switched to active resume version.`);
        await loadProfileAndResume();
      }
    } catch (err) {
      console.error('Failed to switch version:', err);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailRecipient) return;

    setSendingTestEmail(true);
    setTestEmailResult(null);
    try {
      const res = await api.sendTestResumeEmail(testEmailRecipient);
      setTestEmailResult(res);
    } catch (err: any) {
      setTestEmailResult({
        success: false,
        message: err?.message || 'Failed to send test email.',
      });
    } finally {
      setSendingTestEmail(false);
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return '0 KB';
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const formatRelativeTime = (isoString?: string | null) => {
    if (!isoString) return 'Never';
    try {
      const date = new Date(isoString);
      const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
      if (diffSec < 60) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)} mins ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  if (loading || !profile) {
    return (
      <div className="py-24 text-center text-xs text-gray-500 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
        <span className="font-semibold text-gray-700">Loading candidate profile and resume records...</span>
      </div>
    );
  }

  const hasActiveResume = Boolean(resumeStatus?.uploaded && resumeStatus?.filename);

  return (
    <div id="my-profile-page" className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
            <User className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800">
                Candidate
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Manage your personal credentials, education, portfolio links, and persistent resume attachments.
            </p>
          </div>
        </div>

        {hasActiveResume ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Resume Ready for Outreach</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>Upload Resume to Enable Emails</span>
          </div>
        )}
      </div>

      {profileSavedToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Personal information saved successfully!
        </div>
      )}

      {/* SECTION 1: PERSONAL INFORMATION & LINKS */}
      <form onSubmit={handleProfileUpdate} className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Personal Information
            </h2>
          </div>
          <button
            type="submit"
            disabled={savingProfile}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-xs"
          >
            {savingProfile ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Profile</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={profile.email || ''}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              placeholder="e.g. yourname@gmail.com"
              className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
              required
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-bold text-gray-700 block mb-1 flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-gray-500" />
              Education & Academic Background
            </label>
            <input
              type="text"
              value={profile.education || ''}
              onChange={(e) => setProfile({ ...profile, education: e.target.value })}
              placeholder="e.g. B.Tech in Computer Science & Engineering, RGUKT (Graduating 2027)"
              className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-bold text-gray-700 block mb-1 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-gray-500" />
              Target Focus & Professional Bio
            </label>
            <textarea
              rows={2}
              value={profile.bio || ''}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              placeholder="Brief summary of your technical interests and career aspirations..."
              className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white resize-none"
            />
          </div>
        </div>

        {/* Links Sub-Section */}
        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-center gap-1.5 mb-3">
            <LinkIcon className="w-3.5 h-3.5 text-gray-500" />
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Candidate Links & Portfolio
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-gray-600 block mb-1">
                Portfolio Website
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={profile.portfolio}
                  onChange={(e) => setProfile({ ...profile, portfolio: e.target.value })}
                  placeholder="https://yourportfolio.vercel.app/"
                  className="w-full text-xs pl-3 pr-7 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                {profile.portfolio && (
                  <a
                    href={profile.portfolio}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute right-2 top-2.5 text-gray-400 hover:text-blue-600"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-600 block mb-1">
                LinkedIn Profile
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={profile.linkedin}
                  onChange={(e) => setProfile({ ...profile, linkedin: e.target.value })}
                  placeholder="https://linkedin.com/in/username"
                  className="w-full text-xs pl-3 pr-7 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                {profile.linkedin && (
                  <a
                    href={profile.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute right-2 top-2.5 text-gray-400 hover:text-blue-600"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-600 block mb-1">
                GitHub Profile
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={profile.github}
                  onChange={(e) => setProfile({ ...profile, github: e.target.value })}
                  placeholder="https://github.com/username"
                  className="w-full text-xs pl-3 pr-7 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                {profile.github && (
                  <a
                    href={profile.github}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute right-2 top-2.5 text-gray-400 hover:text-blue-600"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* SECTION 2: RESUME UPLOAD & STORAGE */}
      <div id="resume-section" className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Resume Attachment
            </h2>
          </div>
          <span className="text-xs text-gray-500 font-medium">
            Supported formats: PDF, DOC, DOCX (Max 10 MB)
          </span>
        </div>

        {uploadError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">{uploadError}</div>
          </div>
        )}

        {uploadSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="flex-1">{uploadSuccess}</div>
          </div>
        )}

        {/* DRAG & DROP UPLOAD ZONE */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleFileSelect(e.dataTransfer.files[0]);
            }
          }}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
            isDragging
              ? 'border-blue-500 bg-blue-50/50 scale-[0.99]'
              : 'border-gray-300 hover:border-gray-400 bg-gray-50/50'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
              }
            }}
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            id="resume-file-input"
          />

          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <Upload className="w-6 h-6" />
          </div>

          <h3 className="text-sm font-bold text-gray-900 mb-1">
            Upload your latest resume
          </h3>
          <p className="text-xs text-gray-500 mb-4 max-w-sm mx-auto">
            Drag and drop your file here, or click the button below. Uploaded files are stored persistently on the server and attached to cold emails.
          </p>

          <button
            type="button"
            id="upload-resume-btn"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-2 shadow-xs transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Select Resume from Computer</span>
          </button>

          <div className="mt-3 text-[11px] text-gray-400">
            PDF, DOC, or DOCX up to 10 MB
          </div>

          {/* Upload Progress Bar */}
          {uploadProgress !== null && (
            <div className="mt-4 max-w-xs mx-auto space-y-1">
              <div className="flex justify-between text-[11px] font-semibold text-gray-600">
                <span>Uploading & Persisting File...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* CURRENT ACTIVE RESUME CARD */}
        {hasActiveResume ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-bold text-xs shrink-0">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Current Active Resume
                    </span>
                    {resumeStatus?.version && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                        v{resumeStatus.version}
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    {resumeStatus?.originalName || resumeStatus?.filename}
                  </h4>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    <span>Size: {formatFileSize(resumeStatus?.size)}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      Uploaded {formatRelativeTime(resumeStatus?.uploadedAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
                  <span>Replace</span>
                </button>

                <a
                  href={api.getResumeDownloadUrl(resumeStatus?.fileId || undefined)}
                  download={resumeStatus?.originalName || 'Resume.pdf'}
                  className="px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-gray-500" />
                  <span>Download</span>
                </a>

                <button
                  type="button"
                  onClick={handleDeleteResume}
                  className="px-3 py-1.5 bg-white hover:bg-rose-50 border border-gray-200 text-rose-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>

            {/* Extracted Details */}
            <div className="pt-4 border-t border-gray-200/70 space-y-3">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-bold text-gray-700">
                  Extracted Resume Details & AI Keywords
                </span>
              </div>

              {/* Extracted Skills */}
              {resumeStatus?.extractedSkills && resumeStatus.extractedSkills.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-gray-500 mb-1.5">
                    Recognized Skills & Frameworks:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {resumeStatus.extractedSkills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 bg-white border border-gray-200 text-gray-800 rounded-md text-[11px] font-medium shadow-2xs"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Extracted Projects */}
              {resumeStatus?.extractedProjects && resumeStatus.extractedProjects.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-gray-500 mb-1">
                    Featured Highlights:
                  </div>
                  <ul className="text-xs text-gray-600 list-disc list-inside space-y-0.5">
                    {resumeStatus.extractedProjects.map((proj, idx) => (
                      <li key={idx}>{proj}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-900 text-xs">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">No resume uploaded yet.</span> Please upload your resume above. The system will store the real binary file on the server and use it as an attachment whenever you send cold applications.
            </div>
          </div>
        )}

        {/* RESUME VERSION HISTORY */}
        {resumeStatus?.history && resumeStatus.history.length > 1 && (
          <div className="pt-4 border-t border-gray-100 space-y-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-gray-500" />
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                Resume Version History
              </h3>
            </div>

            <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden bg-white">
              {resumeStatus.history.map((ver, idx) => {
                const isCurrent = ver.fileId === resumeStatus.fileId || ver.isCurrent;
                return (
                  <div
                    key={ver.fileId || idx}
                    className={`p-3 flex items-center justify-between gap-3 text-xs ${
                      isCurrent ? 'bg-blue-50/40' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className={`w-4 h-4 ${isCurrent ? 'text-blue-600' : 'text-gray-400'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{ver.originalName || ver.filename}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-bold">
                            v{ver.version || resumeStatus.history!.length - idx}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {formatFileSize(ver.size)} • Uploaded {formatRelativeTime(ver.uploadedAt)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={api.getResumeDownloadUrl(ver.fileId)}
                        download={ver.originalName || 'Resume.pdf'}
                        className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded"
                        title="Download version"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => handleSelectVersion(ver.fileId)}
                          className="px-2.5 py-1 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 rounded text-[11px] font-semibold"
                        >
                          Use This Version
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION 3: TEST EMAIL WITH RESUME ATTACHMENT */}
        <div className="pt-4 border-t border-gray-100 space-y-3">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              Verify Real Resume Attachment via Test Email
            </h3>
          </div>
          <p className="text-xs text-gray-500">
            Send a sample test email to verify that your uploaded resume binary file is correctly attached and delivered.
          </p>

          <form onSubmit={handleSendTestEmail} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              type="email"
              value={testEmailRecipient}
              onChange={(e) => setTestEmailRecipient(e.target.value)}
              placeholder="Enter recipient email for test dispatch..."
              disabled={!hasActiveResume || sendingTestEmail}
              className="flex-1 text-xs px-3.5 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:bg-gray-100"
              required
            />
            <button
              type="submit"
              disabled={!hasActiveResume || sendingTestEmail}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-xs shrink-0"
            >
              {sendingTestEmail ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Send Test Email with Resume</span>
            </button>
          </form>

          {testEmailResult && (
            <div
              className={`p-3 rounded-lg text-xs font-medium flex items-start gap-2 ${
                testEmailResult.success
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}
            >
              {testEmailResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-bold">{testEmailResult.message}</div>
                {testEmailResult.attachmentName && (
                  <div className="text-[11px] mt-0.5 opacity-90">
                    Attached File: {testEmailResult.attachmentName}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

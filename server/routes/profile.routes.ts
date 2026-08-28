import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { store } from '../database/store.ts';
import { resumeService } from '../services/resume.service.ts';
import { logger } from '../utils/logger.ts';

const profileRouter = Router();

// Configure Multer storage to keep files temporarily in memory/disk buffer for verification
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.pdf', '.doc', '.docx'];
    if (!allowedExts.includes(ext)) {
      return cb(new Error(`INVALID_FILE_TYPE: Unsupported extension "${ext}". Please upload a PDF, DOC, or DOCX resume.`));
    }
    cb(null, true);
  },
});

// --- Candidate Profile Endpoints ---

profileRouter.get('/', (req, res) => {
  const profile = store.getCandidateProfile();
  res.json({
    success: true,
    profile,
  });
});

profileRouter.put('/', (req, res) => {
  try {
    const updates = req.body || {};
    const updated = store.updateCandidateProfile(updates);
    res.json({
      success: true,
      message: 'Profile updated successfully',
      profile: updated,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      message: err?.message || 'Failed to update profile',
    });
  }
});

// --- Resume Endpoints ---

/**
 * GET /api/profile/resume
 * Returns the status and metadata of the candidate's current resume
 */
profileRouter.get('/resume', (req, res) => {
  const current = resumeService.getCurrentResume();
  const profile = store.getCandidateProfile();

  if (!current || !profile.resumeFileName) {
    return res.json({
      uploaded: false,
      hasResume: false,
      filename: null,
      mimeType: null,
      size: 0,
      uploadedAt: null,
      updatedAt: null,
      fileId: null,
      history: profile.resumeHistory || [],
    });
  }

  res.json({
    uploaded: true,
    hasResume: true,
    fileId: current.fileId,
    filename: current.originalName || current.filename,
    originalName: current.originalName,
    mimeType: current.mimeType,
    size: current.size,
    storagePath: current.storagePath,
    uploadedAt: current.uploadedAt,
    updatedAt: profile.resumeUpdatedAt || current.uploadedAt,
    version: current.version,
    extractedSkills: profile.resumeSkills || current.extractedSkills || [],
    extractedProjects: profile.resumeProjects || current.extractedProjects || [],
    extractedExperience: profile.resumeExperience || current.extractedExperience || '',
    history: profile.resumeHistory || [current],
  });
});

/**
 * POST /api/profile/resume
 * Uploads a real binary resume (multipart/form-data)
 */
profileRouter.post('/resume', (req, res) => {
  // Handle multer upload with graceful error catching for file limits and format
  upload.single('resume')(req, res, async (err: any) => {
    if (err) {
      logger.warn(`Resume upload multer error: ${err.message}`);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          errorCode: 'FILE_TOO_LARGE',
          message: 'Resume must be smaller than 10 MB.',
        });
      }
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_FILE_TYPE',
        message: err.message || 'Invalid resume file.',
      });
    }

    // Try fallback field name 'file' if 'resume' was empty
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        errorCode: 'NO_FILE',
        message: 'No resume file received. Please select a PDF, DOC, or DOCX document.',
      });
    }

    try {
      const result = await resumeService.uploadResume(file);
      const profile = store.getCandidateProfile();

      res.json({
        success: true,
        message: 'Resume uploaded successfully',
        resume: {
          fileId: result.resume.fileId,
          filename: result.resume.originalName,
          originalName: result.resume.originalName,
          mimeType: result.resume.mimeType,
          size: result.resume.size,
          uploadedAt: result.resume.uploadedAt,
          version: result.resume.version,
          extractedSkills: result.resume.extractedSkills,
          extractedProjects: result.resume.extractedProjects,
        },
        profile,
      });
    } catch (uploadErr: any) {
      logger.error(`Resume persistence failed: ${uploadErr.message}`);
      res.status(500).json({
        success: false,
        errorCode: 'UPLOAD_FAILED',
        message: uploadErr.message || 'Failed to persist resume file.',
      });
    }
  });
});

/**
 * GET /api/profile/resume/download
 * Downloads the actual stored resume binary file
 */
profileRouter.get('/resume/download', (req, res) => {
  const fileId = req.query.fileId as string | undefined;
  const current = fileId ? resumeService.getResumeById(fileId) : resumeService.getCurrentResume();

  if (!current) {
    return res.status(404).json({
      success: false,
      message: 'No resume found in profile.',
    });
  }

  const filePath = resumeService.getResumeFilePath(current.fileId);
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      errorCode: 'STORAGE_FAILED',
      message: 'Resume binary file does not exist on disk. Please upload your resume again.',
    });
  }

  const downloadName = current.originalName || current.filename || 'Resume.pdf';
  res.setHeader('Content-Type', current.mimeType || 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"`);
  
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

/**
 * DELETE /api/profile/resume
 * Removes current resume and disables email sending until a new one is uploaded
 */
profileRouter.delete('/resume', (req, res) => {
  try {
    const result = resumeService.deleteResume();
    const profile = store.getCandidateProfile();
    res.json({
      success: true,
      message: result.message,
      profile,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to remove resume.',
    });
  }
});

/**
 * POST /api/profile/resume/select-version
 * Selects an earlier version as CURRENT
 */
profileRouter.post('/resume/select-version', (req, res) => {
  const { fileId } = req.body;
  if (!fileId) {
    return res.status(400).json({ success: false, message: 'fileId is required.' });
  }

  try {
    const result = resumeService.selectResumeVersion(fileId);
    const profile = store.getCandidateProfile();
    res.json({
      success: true,
      message: `Resume switched to version ${result.resume.version}`,
      resume: result.resume,
      profile,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/profile/resume/test-email
 * Sends a real test email with the actual uploaded binary resume attachment
 */
profileRouter.post('/resume/test-email', async (req, res) => {
  const { recipientEmail } = req.body;
  if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid recipient email address for testing.',
    });
  }

  try {
    const result = await resumeService.sendTestEmail(recipientEmail);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Test email dispatch failed.',
    });
  }
});

export { profileRouter };

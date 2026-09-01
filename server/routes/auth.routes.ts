import { Router } from 'express';
import crypto from 'crypto';
import { gmailService, EXPECTED_SENDER_EMAIL } from '../services/gmail.service.ts';
import { store } from '../database/store.ts';
import { logger } from '../utils/logger.ts';

export const authRouter = Router();

function getRedirectUri(req: any): string {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
  return `${protocol}://${host}/api/auth/google/callback`;
}

/**
 * Direct Access Token submission endpoint (supports Google Identity Services client-side popup)
 */
authRouter.post('/google/token', async (req, res) => {
  try {
    const { accessToken, expiresIn } = req.body;
    if (!accessToken) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    const result = await gmailService.saveClientAccessToken(accessToken, expiresIn);
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err: any) {
    logger.error(`[AuthRoutes] Direct token save failed: ${err?.message}`);
    res.status(500).json({ error: err?.message || 'Failed to authenticate token' });
  }
});

/**
 * Initiates Google OAuth 2.0 flow
 */
authRouter.get('/google', (req, res) => {
  try {
    if (!gmailService.isAuthConfigured()) {
      const isJson = req.query.json === 'true' || req.headers.accept?.includes('application/json');
      if (isJson) {
        return res.status(400).json({
          error: 'GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables are missing.',
          code: 'MISSING_GOOGLE_CREDENTIALS',
        });
      }
      return res.redirect('/settings?oauth=missing_credentials');
    }

    const state = crypto.randomBytes(16).toString('hex');
    const returnUrl = (req.query.returnUrl as string) || '/outreach';
    store.saveOAuthState(state, { redirectUrl: returnUrl });

    const redirectUri = getRedirectUri(req);
    const authUrl = gmailService.getAuthUrl(redirectUri, state);

    const isJson = req.query.json === 'true' || req.headers.accept?.includes('application/json');
    if (isJson) {
      return res.json({ authUrl, state, redirectUri });
    }

    res.redirect(authUrl);
  } catch (err: any) {
    logger.error(`[AuthRoutes] Failed to generate Google auth URL: ${err?.message}`);
    res.status(500).json({ error: err?.message || 'Failed to initialize Google OAuth' });
  }
});

/**
 * Google OAuth 2.0 redirect callback endpoint
 */
authRouter.get('/google/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    logger.warn(`[AuthRoutes] OAuth returned error: ${error} - ${error_description}`);
    return res.redirect(`/outreach?oauth=error&message=${encodeURIComponent(String(error_description || error))}`);
  }

  if (!code || typeof code !== 'string') {
    return res.redirect('/outreach?oauth=error&message=Missing+authorization+code');
  }

  // Validate state
  const stateValidation = store.consumeOAuthState(String(state || ''));
  const fallbackRedirect = stateValidation.redirectUrl || '/outreach';

  try {
    const redirectUri = getRedirectUri(req);
    const result = await gmailService.exchangeCode(code, redirectUri);

    if (result.success) {
      return res.redirect(`${fallbackRedirect}?oauth=success&account=${encodeURIComponent(result.email || EXPECTED_SENDER_EMAIL)}`);
    }

    if (result.errorCode === 'WRONG_GOOGLE_ACCOUNT') {
      return res.redirect(
        `${fallbackRedirect}?oauth=wrong_account&connected=${encodeURIComponent(result.email || '')}&expected=${encodeURIComponent(EXPECTED_SENDER_EMAIL)}`
      );
    }

    return res.redirect(`${fallbackRedirect}?oauth=error&message=${encodeURIComponent(result.error || 'Authentication failed')}`);
  } catch (err: any) {
    logger.error(`[AuthRoutes] Callback handling error: ${err?.message}`);
    return res.redirect(`${fallbackRedirect}?oauth=error&message=${encodeURIComponent(err?.message || 'OAuth callback failed')}`);
  }
});

/**
 * JSON Code Exchange Endpoint (for modal or in-page flows)
 */
authRouter.post('/google/exchange', async (req, res) => {
  try {
    const { code, redirectUri } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    const effectiveRedirectUri = redirectUri || getRedirectUri(req);
    const result = await gmailService.exchangeCode(code, effectiveRedirectUri);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Code exchange failed' });
  }
});

/**
 * Authentication and Google OAuth Status
 */
authRouter.get('/google/status', async (_req, res) => {
  try {
    const status = await gmailService.getAccount();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to check OAuth status' });
  }
});

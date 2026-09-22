import { Router } from 'express';
import crypto from 'crypto';
import { gmailService, EXPECTED_SENDER_EMAIL, getExpectedSenderEmail } from '../services/gmail.service.ts';
import { store } from '../database/store.ts';
import { logger } from '../utils/logger.ts';

export const authRouter = Router();

export function resolveRuntimeOrigin(req: any): string {
  // 1. Explicit query param (passed from browser window.location.origin)
  if (req.query?.origin && typeof req.query.origin === 'string' && req.query.origin.startsWith('http')) {
    return req.query.origin.replace(/\/+$/, '');
  }

  // 2. Referer or Origin headers sent by browser
  const originHeader = req.headers['origin'] || req.headers['referer'];
  if (originHeader && typeof originHeader === 'string' && originHeader.startsWith('http')) {
    try {
      const u = new URL(originHeader);
      return u.origin;
    } catch {
      // Fall through
    }
  }

  // 3. Reverse proxy forwarded headers
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    return `${protocol}://${host}`;
  }

  // 4. Fallback to process.env.GOOGLE_REDIRECT_URI origin if configured
  if (process.env.GOOGLE_REDIRECT_URI) {
    try {
      return new URL(process.env.GOOGLE_REDIRECT_URI).origin;
    } catch {
      // Fall through
    }
  }

  return `${protocol}://${host || 'localhost:3000'}`;
}

export function getRedirectUri(req: any): string {
  // If user explicitly configured GOOGLE_REDIRECT_URI in env, respect that exact URI
  if (process.env.GOOGLE_REDIRECT_URI && process.env.GOOGLE_REDIRECT_URI.startsWith('http')) {
    return process.env.GOOGLE_REDIRECT_URI.trim();
  }

  const origin = resolveRuntimeOrigin(req);
  return `${origin}/api/auth/google/callback`;
}

/**
 * Diagnostic endpoint for Google OAuth configuration and runtime browser origin
 * Available at both /google/diagnostics and /google/diagnostic
 */
const getOAuthDiagnosticsHandler = async (req: any, res: any) => {
  try {
    const origin = resolveRuntimeOrigin(req);
    const redirectUri = getRedirectUri(req);
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const hasSecret = Boolean(process.env.GOOGLE_CLIENT_SECRET);
    const clientIdConfigured = Boolean(clientId);
    const clientSecretConfigured = hasSecret;

    const tokens = store.getGoogleOAuthTokens();
    const settings = store.getOutreachSettings();

    let currentUser: string | null = null;
    let tokenStatus: 'VALID' | 'EXPIRED' | 'MISSING' = 'MISSING';
    let scopes: string[] = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];
    let lastRefreshTime: string | null = null;
    let gmailApiReachable = false;
    let lastError = settings.lastOAuthError || null;

    if (tokens && tokens.accessToken) {
      currentUser = tokens.email;
      lastRefreshTime = tokens.updatedAt || tokens.connectedAt || null;

      if (tokens.scope) {
        scopes = tokens.scope.split(' ');
      }

      if (tokens.expiryDate && Date.now() >= tokens.expiryDate && !tokens.refreshToken) {
        tokenStatus = 'EXPIRED';
        lastError = 'Access token expired; refresh needed.';
      } else {
        tokenStatus = 'VALID';
      }

      // Check if Gmail API is reachable
      if (tokenStatus === 'VALID' || tokens.refreshToken) {
        try {
          const testProfile = await gmailService.verifyGmailConnection();
          gmailApiReachable = testProfile.success;
          if (!testProfile.success && testProfile.error) {
            lastError = testProfile.error;
          }
        } catch {
          gmailApiReachable = false;
        }
      }
    }

    const host = req.headers['x-forwarded-host'] || req.get('host') || '';
    const environment =
      process.env.NODE_ENV === 'production'
        ? 'Production'
        : host.includes('run.app')
        ? 'Preview'
        : 'Development';

    res.json({
      runtimeOrigin: origin,
      resolvedRedirectUri: redirectUri,
      clientIdConfigured,
      clientSecretConfigured,
      expectedUser: getExpectedSenderEmail(),
      currentUser,
      tokenStatus,
      scopes,
      lastError,
      lastRefreshTime,
      gmailApiReachable,
      // Additional metadata for UI compatibility
      browserOrigin: origin,
      configuredClientId: clientId ? `${clientId.slice(0, 14)}...${clientId.slice(-20)}` : 'NOT_CONFIGURED',
      fullClientId: clientId || null,
      hasClientSecret: hasSecret,
      isConfigured: clientIdConfigured && clientSecretConfigured,
      configuredRedirectUri: redirectUri,
      expectedRedirectUri: redirectUri,
      expectedJavaScriptOrigin: origin,
      environment,
      authorizedSender: getExpectedSenderEmail(),
      connectedAccount: currentUser,
      status: tokenStatus === 'VALID' ? 'Connected' : tokenStatus === 'EXPIRED' ? 'Token Expired' : 'Disconnected',
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to generate OAuth diagnostics' });
  }
};

authRouter.get('/google/diagnostics', getOAuthDiagnosticsHandler);
authRouter.get('/google/diagnostic', getOAuthDiagnosticsHandler);

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
    const returnUrl = (req.query.returnUrl as string) || '/settings';
    const redirectUri = getRedirectUri(req);

    // Save state together with the exact redirectUri used
    store.saveOAuthState(state, { redirectUrl: returnUrl, redirectUri });

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
    return res.redirect(`/settings?oauth=error&message=${encodeURIComponent(String(error_description || error))}`);
  }

  if (!code || typeof code !== 'string') {
    return res.redirect('/settings?oauth=error&message=Missing+authorization+code');
  }

  // Validate state and extract saved redirectUri
  const stateValidation = store.consumeOAuthState(String(state || ''));
  const fallbackRedirect = stateValidation.redirectUrl || '/settings';
  const effectiveRedirectUri = stateValidation.redirectUri || getRedirectUri(req);

  try {
    logger.info(`[AuthRoutes] Exchanging OAuth code using redirectUri: ${effectiveRedirectUri}`);
    const result = await gmailService.exchangeCode(code, effectiveRedirectUri);

    if (result.success) {
      return res.redirect(
        `${fallbackRedirect}?oauth=success&account=${encodeURIComponent(result.email || '')}`
      );
    }

    return res.redirect(
      `${fallbackRedirect}?oauth=error&message=${encodeURIComponent(result.error || 'Authentication failed')}`
    );
  } catch (err: any) {
    logger.error(`[AuthRoutes] Callback handling error: ${err?.message}`);
    return res.redirect(
      `${fallbackRedirect}?oauth=error&message=${encodeURIComponent(err?.message || 'OAuth callback failed')}`
    );
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

/**
 * Disconnect Google OAuth Account
 */
authRouter.post('/google/disconnect', async (_req, res) => {
  try {
    await gmailService.disconnect();
    res.json({ success: true, message: 'Google account disconnected successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to disconnect Google account' });
  }
});

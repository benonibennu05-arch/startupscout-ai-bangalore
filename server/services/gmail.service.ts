import { store } from '../database/store.ts';
import { logger } from '../utils/logger.ts';
import { resumeService } from './resume.service.ts';
import {
  EmailProvider,
  SendEmailOptions,
  EmailSendResult,
  EmailAccountInfo,
  EmailAttachment,
} from './emailProvider.interface.ts';
import { GoogleOAuthTokenData } from '../types.ts';

export const EXPECTED_SENDER_EMAIL = 'tejamatta05@gmail.com';
export const EXPECTED_SENDER_NAME = 'Teja Matta';
export const REQUIRED_GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

export class GmailService implements EmailProvider {
  /**
   * Checks if Google OAuth credentials exist in server environment
   */
  public isAuthConfigured(): boolean {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    return Boolean(clientId && clientSecret);
  }

  public getClientId(): string | undefined {
    return process.env.GOOGLE_CLIENT_ID;
  }

  /**
   * Generates Google OAuth authorization URL
   */
  public getAuthUrl(redirectUri: string, state: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error('GOOGLE_CLIENT_ID environment variable is missing.');
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: REQUIRED_GMAIL_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchanges authorization code for OAuth tokens and validates identity
   */
  public async exchangeCode(code: string, redirectUri: string): Promise<{
    success: boolean;
    email?: string;
    error?: string;
    errorCode?: string;
    tokens?: GoogleOAuthTokenData;
  }> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return {
        success: false,
        error: 'Google OAuth credentials (GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET) are not configured.',
        errorCode: 'INVALID_CREDENTIALS',
      };
    }

    try {
      // 1. Exchange authorization code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok || !tokenData.access_token) {
        logger.error(`[GmailService] Token exchange failed: ${JSON.stringify(tokenData)}`);
        return {
          success: false,
          error: tokenData.error_description || tokenData.error || 'Failed to exchange authorization code for Google tokens.',
          errorCode: 'OAUTH_FAILED',
        };
      }

      // 2. Retrieve user identity using access token
      const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      const userinfo = await userinfoResponse.json();
      if (!userinfoResponse.ok || !userinfo.email) {
        return {
          success: false,
          error: 'Failed to retrieve authenticated Google account email.',
          errorCode: 'OAUTH_FAILED',
        };
      }

      const authenticatedEmail = userinfo.email.toLowerCase().trim();
      const now = new Date().toISOString();
      const expiryDate = tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : undefined;

      const tokenRecord: GoogleOAuthTokenData = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || store.getGoogleOAuthTokens()?.refreshToken,
        expiryDate,
        scope: tokenData.scope,
        tokenType: tokenData.token_type,
        idToken: tokenData.id_token,
        email: authenticatedEmail,
        name: userinfo.name || EXPECTED_SENDER_NAME,
        picture: userinfo.picture,
        connectedAt: now,
        updatedAt: now,
      };

      // 3. Strict Verification: Authenticated email must be tejamatta05@gmail.com
      if (authenticatedEmail !== EXPECTED_SENDER_EMAIL.toLowerCase()) {
        logger.warn(`[GmailService] WRONG_ACCOUNT connected: ${authenticatedEmail} (Expected: ${EXPECTED_SENDER_EMAIL})`);
        
        // Save token record with warning state but do NOT enable outreach sending
        store.saveGoogleOAuthTokens(tokenRecord);
        store.updateOutreachSettings({
          gmailConnected: false,
          gmailAccountEmail: authenticatedEmail,
          gmailAccessToken: null,
          lastOAuthError: `Wrong Gmail Account. Expected: ${EXPECTED_SENDER_EMAIL}, Connected: ${authenticatedEmail}`,
        });

        return {
          success: false,
          email: authenticatedEmail,
          error: `Wrong Gmail Account. Please connect: ${EXPECTED_SENDER_EMAIL} (You authorized: ${authenticatedEmail}).`,
          errorCode: 'WRONG_GOOGLE_ACCOUNT',
        };
      }

      // 4. Save validated tokens and update settings
      store.saveGoogleOAuthTokens(tokenRecord);
      store.updateOutreachSettings({
        gmailConnected: true,
        gmailAccountEmail: EXPECTED_SENDER_EMAIL,
        gmailAccessToken: tokenData.access_token,
        gmailRefreshToken: tokenRecord.refreshToken || null,
        gmailTokenExpiry: expiryDate || null,
        lastOAuthError: null,
      });

      store.addEvent({
        companyId: 'SYSTEM',
        companyName: 'Gmail OAuth',
        event: 'GMAIL_CONNECTED',
        message: `Successfully connected and verified Gmail account: ${EXPECTED_SENDER_EMAIL}.`,
        stage: 'SEND_APPLICATION',
        type: 'success',
      });

      logger.info(`[GmailService] Successfully connected Gmail account: ${EXPECTED_SENDER_EMAIL}`);

      return {
        success: true,
        email: EXPECTED_SENDER_EMAIL,
        tokens: tokenRecord,
      };
    } catch (err: any) {
      logger.error(`[GmailService] OAuth authorization error: ${err?.message}`);
      return {
        success: false,
        error: err?.message || 'Unexpected OAuth error occurred.',
        errorCode: 'OAUTH_FAILED',
      };
    }
  }

  /**
   * Validates and saves an access token obtained directly via client-side Google Identity Services
   */
  public async saveClientAccessToken(
    accessToken: string,
    expiresIn?: number
  ): Promise<{
    success: boolean;
    email?: string;
    error?: string;
    errorCode?: string;
    tokens?: GoogleOAuthTokenData;
  }> {
    try {
      const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const userinfo = await userinfoResponse.json();
      if (!userinfoResponse.ok || !userinfo.email) {
        return {
          success: false,
          error: 'Failed to verify Google access token with user profile.',
          errorCode: 'INVALID_TOKEN',
        };
      }

      const authenticatedEmail = userinfo.email.toLowerCase().trim();
      const now = new Date().toISOString();
      const expiryDate = expiresIn ? Date.now() + expiresIn * 1000 : Date.now() + 3600 * 1000;

      const tokenRecord: GoogleOAuthTokenData = {
        accessToken,
        expiryDate,
        email: authenticatedEmail,
        name: userinfo.name || EXPECTED_SENDER_NAME,
        picture: userinfo.picture,
        connectedAt: now,
        updatedAt: now,
      };

      if (authenticatedEmail !== EXPECTED_SENDER_EMAIL.toLowerCase()) {
        store.saveGoogleOAuthTokens(tokenRecord);
        store.updateOutreachSettings({
          gmailConnected: false,
          gmailAccountEmail: authenticatedEmail,
          gmailAccessToken: null,
          lastOAuthError: `Connected account ${authenticatedEmail} does not match required sender ${EXPECTED_SENDER_EMAIL}.`,
        });
        return {
          success: false,
          email: authenticatedEmail,
          error: `Authenticated as ${authenticatedEmail}, but this pipeline is restricted to ${EXPECTED_SENDER_EMAIL}.`,
          errorCode: 'WRONG_GOOGLE_ACCOUNT',
        };
      }

      store.saveGoogleOAuthTokens(tokenRecord);
      store.updateOutreachSettings({
        gmailConnected: true,
        gmailAccountEmail: EXPECTED_SENDER_EMAIL,
        gmailAccessToken: accessToken,
        gmailTokenExpiry: expiryDate,
        lastOAuthError: null,
      });

      store.addEvent({
        companyId: 'SYSTEM',
        companyName: 'Gmail OAuth',
        event: 'GMAIL_CONNECTED',
        message: `Successfully connected and verified Gmail account via Google Identity Services: ${EXPECTED_SENDER_EMAIL}.`,
        stage: 'SEND_APPLICATION',
        type: 'success',
      });

      logger.info(`[GmailService] Successfully authenticated via client token: ${EXPECTED_SENDER_EMAIL}`);

      return {
        success: true,
        email: EXPECTED_SENDER_EMAIL,
        tokens: tokenRecord,
      };
    } catch (err: any) {
      logger.error(`[GmailService] Client token validation error: ${err?.message}`);
      return {
        success: false,
        error: err?.message || 'Failed to authenticate Google token',
        errorCode: 'TOKEN_VALIDATION_FAILED',
      };
    }
  }

  /**
   * Refreshes the Google OAuth access token if expired
   */
  public async getValidAccessToken(): Promise<{
    token: string | null;
    error?: string;
    errorCode?: string;
  }> {
    const tokens = store.getGoogleOAuthTokens();
    if (!tokens || !tokens.accessToken) {
      return {
        token: null,
        error: 'Gmail Not Connected: Please connect your Gmail account before sending.',
        errorCode: 'GMAIL_NOT_CONNECTED',
      };
    }

    if (tokens.email.toLowerCase() !== EXPECTED_SENDER_EMAIL.toLowerCase()) {
      return {
        token: null,
        error: `Wrong Gmail Account: Expected ${EXPECTED_SENDER_EMAIL}, but connected to ${tokens.email}. Please disconnect and connect ${EXPECTED_SENDER_EMAIL}.`,
        errorCode: 'WRONG_GOOGLE_ACCOUNT',
      };
    }

    // Check if current access token is valid (with 60-second buffer)
    const isExpired = tokens.expiryDate && Date.now() >= tokens.expiryDate - 60000;
    if (!isExpired) {
      return { token: tokens.accessToken };
    }

    // Attempt token refresh
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = tokens.refreshToken;

    if (!clientId || !clientSecret || !refreshToken) {
      logger.warn('[GmailService] Access token expired and no refresh token available');
      store.updateOutreachSettings({
        gmailConnected: false,
        lastOAuthError: 'Session expired. Please reconnect your Gmail account.',
      });
      return {
        token: null,
        error: 'Gmail session expired. Please reconnect your Gmail account.',
        errorCode: 'TOKEN_REFRESH_FAILED',
      };
    }

    try {
      logger.info('[GmailService] Refreshing expired Gmail OAuth access token...');
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.access_token) {
        logger.error(`[GmailService] Failed to refresh token: ${JSON.stringify(data)}`);
        store.updateOutreachSettings({
          gmailConnected: false,
          lastOAuthError: data.error_description || 'Refresh token revoked or expired.',
        });
        return {
          token: null,
          error: 'Gmail authorization token refresh failed. Please reconnect your Gmail account.',
          errorCode: 'TOKEN_REFRESH_FAILED',
        };
      }

      const newExpiry = data.expires_in ? Date.now() + data.expires_in * 1000 : Date.now() + 3600 * 1000;
      const updatedTokens: GoogleOAuthTokenData = {
        ...tokens,
        accessToken: data.access_token,
        expiryDate: newExpiry,
        updatedAt: new Date().toISOString(),
      };

      store.saveGoogleOAuthTokens(updatedTokens);
      store.updateOutreachSettings({
        gmailConnected: true,
        gmailAccessToken: data.access_token,
        gmailTokenExpiry: newExpiry,
      });

      logger.info('[GmailService] Gmail OAuth access token refreshed successfully.');
      return { token: data.access_token };
    } catch (err: any) {
      logger.error(`[GmailService] Refresh token network error: ${err?.message}`);
      return {
        token: null,
        error: err?.message || 'Token refresh failed due to network error.',
        errorCode: 'TOKEN_REFRESH_FAILED',
      };
    }
  }

  /**
   * Builds an RFC 2822 MIME message string (plain text + HTML + attachments)
   */
  public buildMimeMessage(options: SendEmailOptions): string {
    const fromName = options.fromName || EXPECTED_SENDER_NAME;
    const fromEmail = options.fromEmail || EXPECTED_SENDER_EMAIL;
    const to = options.to.trim();
    const subject = options.subject.trim();
    const textBody = options.textBody.trim();
    const htmlBody = options.htmlBody || this.formatTextAsHtml(textBody);

    const mixedBoundary = `====_Mixed_Boundary_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_====`;
    const altBoundary = `====_Alt_Boundary_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_====`;

    const lines: string[] = [];
    lines.push(`From: =?UTF-8?B?${Buffer.from(fromName, 'utf-8').toString('base64')}?= <${fromEmail}>`);
    lines.push(`To: <${to}>`);
    if (options.replyTo) {
      lines.push(`Reply-To: <${options.replyTo}>`);
    }
    lines.push(`Subject: =?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`);
    lines.push('MIME-Version: 1.0');
    lines.push('X-Mailer: StartupScout AI Outreach Engine');

    if (options.attachment && options.attachment.content) {
      lines.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
      lines.push('');
      lines.push(`--${mixedBoundary}`);
      lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
      lines.push('');
      lines.push(`--${altBoundary}`);
      lines.push('Content-Type: text/plain; charset="UTF-8"');
      lines.push('Content-Transfer-Encoding: base64');
      lines.push('');
      lines.push(Buffer.from(textBody, 'utf-8').toString('base64'));
      lines.push('');
      lines.push(`--${altBoundary}`);
      lines.push('Content-Type: text/html; charset="UTF-8"');
      lines.push('Content-Transfer-Encoding: base64');
      lines.push('');
      lines.push(Buffer.from(htmlBody, 'utf-8').toString('base64'));
      lines.push('');
      lines.push(`--${altBoundary}--`);
      lines.push('');
      lines.push(`--${mixedBoundary}`);
      
      const safeFilename = options.attachment.filename.replace(/["\r\n]/g, '_');
      lines.push(`Content-Type: ${options.attachment.mimeType || 'application/pdf'}; name="${safeFilename}"`);
      lines.push(`Content-Disposition: attachment; filename="${safeFilename}"`);
      lines.push('Content-Transfer-Encoding: base64');
      lines.push('');
      // Wrap base64 attachment in 76-character chunks
      const base64Content = options.attachment.content.toString('base64');
      lines.push(base64Content);
      lines.push('');
      lines.push(`--${mixedBoundary}--`);
    } else {
      lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
      lines.push('');
      lines.push(`--${altBoundary}`);
      lines.push('Content-Type: text/plain; charset="UTF-8"');
      lines.push('Content-Transfer-Encoding: base64');
      lines.push('');
      lines.push(Buffer.from(textBody, 'utf-8').toString('base64'));
      lines.push('');
      lines.push(`--${altBoundary}`);
      lines.push('Content-Type: text/html; charset="UTF-8"');
      lines.push('Content-Transfer-Encoding: base64');
      lines.push('');
      lines.push(Buffer.from(htmlBody, 'utf-8').toString('base64'));
      lines.push('');
      lines.push(`--${altBoundary}--`);
    }

    return lines.join('\r\n');
  }

  /**
   * Helper to format plain text into clean, clickable HTML email
   */
  private formatTextAsHtml(plainText: string): string {
    const escaped = plainText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Auto-link URLs
    const linked = escaped.replace(
      /(https?:\/\/[^\s\n\r]+)/g,
      '<a href="$1" style="color: #2563eb; text-decoration: underline;" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    const paragraphs = linked.split(/\n\s*\n/).map((p) => `<p style="margin: 0 0 14px 0;">${p.replace(/\n/g, '<br>')}</p>`);

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Outreach Inquiry</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #1e293b; background-color: #ffffff; margin: 0; padding: 24px;">
  <div style="max-width: 650px; margin: 0 auto;">
    ${paragraphs.join('\n')}
  </div>
</body>
</html>`;
  }

  /**
   * Encodes RFC 2822 MIME raw content into URL-safe Base64 as required by Gmail API
   */
  private encodeBase64Url(mimeString: string): string {
    return Buffer.from(mimeString, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Sends a real email through Gmail API (users.messages.send)
   */
  public async sendEmail(options: SendEmailOptions): Promise<EmailSendResult> {
    const now = new Date().toISOString();

    // 1. Get valid access token
    const tokenResult = await this.getValidAccessToken();
    if (!tokenResult.token) {
      return {
        success: false,
        error: tokenResult.error || 'Gmail Not Connected',
        errorCode: tokenResult.errorCode || 'GMAIL_NOT_CONNECTED',
        timestamp: now,
        provider: 'gmail',
        recipientEmail: options.to,
        senderEmail: EXPECTED_SENDER_EMAIL,
      };
    }

    try {
      // 2. Build MIME message
      const mimeRaw = this.buildMimeMessage({
        ...options,
        fromEmail: EXPECTED_SENDER_EMAIL,
        fromName: EXPECTED_SENDER_NAME,
      });

      const base64UrlRaw = this.encodeBase64Url(mimeRaw);

      logger.info(`[GmailService] Calling Gmail API (users.messages.send) to: ${options.to}...`);

      // 3. Post to Gmail API
      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenResult.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: base64UrlRaw }),
      });

      const data = await response.json();

      if (!response.ok || !data.id) {
        const errorDetail = data.error?.message || JSON.stringify(data);
        const errorCode = data.error?.status === 'PERMISSION_DENIED' ? 'GMAIL_API_DISABLED' : 'GMAIL_SEND_FAILED';
        
        logger.error(`[GmailService] Gmail API send rejected: ${errorDetail}`);
        
        return {
          success: false,
          error: errorDetail,
          errorCode,
          timestamp: now,
          provider: 'gmail',
          recipientEmail: options.to,
          senderEmail: EXPECTED_SENDER_EMAIL,
        };
      }

      logger.info(`[GmailService] Gmail accepted message! ID: ${data.id}, Thread ID: ${data.threadId}`);

      return {
        success: true,
        messageId: data.id,
        threadId: data.threadId,
        timestamp: now,
        provider: 'gmail',
        recipientEmail: options.to,
        senderEmail: EXPECTED_SENDER_EMAIL,
      };
    } catch (err: any) {
      logger.error(`[GmailService] Network error calling Gmail API: ${err?.message}`);
      return {
        success: false,
        error: err?.message || 'Network error while calling Gmail API.',
        errorCode: 'GMAIL_SEND_FAILED',
        timestamp: now,
        provider: 'gmail',
        recipientEmail: options.to,
        senderEmail: EXPECTED_SENDER_EMAIL,
      };
    }
  }

  /**
   * Dispatches a real test email to verify Gmail API credentials
   */
  public async sendTestEmail(toEmail: string): Promise<EmailSendResult> {
    const cleanTo = toEmail.trim();
    const candidate = store.getCandidateProfile();

    const textBody = `Hello Teja,

This is a real test verification email from your StartupScout AI outreach engine.

✓ Authenticated Sender: ${EXPECTED_SENDER_EMAIL}
✓ Target Recipient: ${cleanTo}
✓ Active Resume: ${candidate.resumeFileName || 'Teja_Matta_Resume.pdf'}
✓ Portfolio: ${candidate.portfolio}
✓ LinkedIn: ${candidate.linkedin}
✓ GitHub: ${candidate.github}

If you received this message in your Gmail inbox, your Google OAuth connection and Gmail sending pipeline are fully operational.

Best regards,
StartupScout AI Engine`;

    const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #1e293b; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px; background: #ffffff;">
    <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">✓ Gmail Pipeline Verified</h2>
    <p style="color: #475569;">This is a real test verification email sent through the official Gmail API (<code>users.messages.send</code>).</p>
    
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 4px 0;"><strong>Authenticated Sender:</strong> ${EXPECTED_SENDER_EMAIL}</p>
      <p style="margin: 4px 0;"><strong>Recipient:</strong> ${cleanTo}</p>
      <p style="margin: 4px 0;"><strong>Candidate Name:</strong> ${candidate.name}</p>
      <p style="margin: 4px 0;"><strong>Active Resume:</strong> ${candidate.resumeFileName || 'Teja_Matta_Resume.pdf'}</p>
    </div>

    <p style="margin-bottom: 0; color: #64748b; font-size: 13px;">Sent via StartupScout AI backend OAuth engine.</p>
  </div>
</body>
</html>`;

    return this.sendEmail({
      to: cleanTo,
      subject: `[Test Verification] StartupScout AI Gmail Pipeline – ${candidate.name}`,
      textBody,
      htmlBody,
      fromName: EXPECTED_SENDER_NAME,
      fromEmail: EXPECTED_SENDER_EMAIL,
    });
  }

  /**
   * Tests and verifies live Gmail API connectivity
   */
  public async verifyGmailConnection(): Promise<{
    success: boolean;
    email?: string;
    messagesTotal?: number;
    threadsTotal?: number;
    historyId?: string;
    error?: string;
    errorCode?: string;
  }> {
    const tokenResult = await this.getValidAccessToken();
    if (!tokenResult.token) {
      return {
        success: false,
        error: tokenResult.error || 'Gmail Not Connected',
        errorCode: tokenResult.errorCode || 'GMAIL_NOT_CONNECTED',
      };
    }

    try {
      logger.info('[GmailService] Testing live Gmail API connectivity (users.getProfile)...');
      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${tokenResult.token}` },
      });

      const profile = await response.json();
      if (!response.ok || !profile.emailAddress) {
        logger.error(`[GmailService] Gmail API profile check failed: ${JSON.stringify(profile)}`);
        return {
          success: false,
          error: profile.error?.message || 'Failed to reach Gmail API with current credentials.',
          errorCode: 'GMAIL_API_ERROR',
        };
      }

      if (profile.emailAddress.toLowerCase() !== EXPECTED_SENDER_EMAIL.toLowerCase()) {
        return {
          success: false,
          email: profile.emailAddress,
          error: `Connected account ${profile.emailAddress} does not match required sender ${EXPECTED_SENDER_EMAIL}.`,
          errorCode: 'WRONG_GOOGLE_ACCOUNT',
        };
      }

      logger.info(`[GmailService] Gmail API connection verified! Account: ${profile.emailAddress}, Messages: ${profile.messagesTotal}`);

      return {
        success: true,
        email: profile.emailAddress,
        messagesTotal: profile.messagesTotal,
        threadsTotal: profile.threadsTotal,
        historyId: profile.historyId,
      };
    } catch (err: any) {
      logger.error(`[GmailService] Network error testing Gmail connection: ${err?.message}`);
      return {
        success: false,
        error: err?.message || 'Network error while contacting Gmail API.',
        errorCode: 'NETWORK_ERROR',
      };
    }
  }

  /**
   * Returns current account connection and readiness status
   */
  public async getAccount(): Promise<EmailAccountInfo> {
    const tokens = store.getGoogleOAuthTokens();
    const settings = store.getOutreachSettings();
    const googleAuthConfigured = this.isAuthConfigured();

    if (!tokens || !tokens.accessToken) {
      return {
        connected: false,
        email: null,
        provider: 'gmail',
        canSend: false,
        isExpectedAccount: false,
        expectedEmail: EXPECTED_SENDER_EMAIL,
        error: settings.lastOAuthError || null,
        googleAuthConfigured,
      };
    }

    const email = tokens.email.toLowerCase().trim();
    const isExpected = email === EXPECTED_SENDER_EMAIL.toLowerCase();

    return {
      connected: isExpected && settings.gmailConnected,
      email,
      provider: 'gmail',
      canSend: isExpected && settings.gmailConnected,
      isExpectedAccount: isExpected,
      expectedEmail: EXPECTED_SENDER_EMAIL,
      error: !isExpected
        ? `Wrong Gmail Account: Expected ${EXPECTED_SENDER_EMAIL}, but connected to ${email}. Please disconnect and connect ${EXPECTED_SENDER_EMAIL}.`
        : settings.lastOAuthError || null,
      googleAuthConfigured,
    };
  }

  /**
   * Synchronously checks if verified connection is ready
   */
  public isConnected(): boolean {
    const tokens = store.getGoogleOAuthTokens();
    const settings = store.getOutreachSettings();
    return Boolean(
      settings.gmailConnected &&
      tokens?.accessToken &&
      tokens?.email?.toLowerCase() === EXPECTED_SENDER_EMAIL.toLowerCase()
    );
  }

  /**
   * Disconnects Gmail account and clears stored tokens
   */
  public async disconnect(): Promise<void> {
    store.clearGoogleOAuthTokens();
    store.updateOutreachSettings({
      gmailConnected: false,
      gmailAccountEmail: null,
      gmailAccessToken: null,
      gmailRefreshToken: null,
      gmailTokenExpiry: null,
      lastOAuthError: null,
    });

    store.addEvent({
      companyId: 'SYSTEM',
      companyName: 'Gmail OAuth',
      event: 'GMAIL_DISCONNECTED',
      message: 'Disconnected Gmail account and cleared OAuth session.',
      stage: 'SEND_APPLICATION',
      type: 'info',
    });

    logger.info('[GmailService] Disconnected Gmail account');
  }
}

export const gmailService = new GmailService();

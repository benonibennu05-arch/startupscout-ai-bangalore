export interface EmailAttachment {
  filename: string;
  content: Buffer;
  mimeType: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  attachment?: EmailAttachment | null;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  threadId?: string;
  error?: string;
  errorCode?: string;
  timestamp: string;
  provider: 'gmail' | 'simulated';
  senderEmail?: string;
  recipientEmail?: string;
}

export interface EmailAccountInfo {
  connected: boolean;
  email: string | null;
  provider: 'gmail';
  canSend: boolean;
  isExpectedAccount: boolean;
  expectedEmail: string;
  error?: string | null;
  scopes?: string[];
  googleAuthConfigured?: boolean;
}

export interface EmailProvider {
  sendEmail(options: SendEmailOptions): Promise<EmailSendResult>;
  sendTestEmail(toEmail: string): Promise<EmailSendResult>;
  getAccount(): Promise<EmailAccountInfo>;
  isConnected(): boolean;
  disconnect(): Promise<void>;
}

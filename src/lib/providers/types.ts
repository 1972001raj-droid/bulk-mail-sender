// EmailProvider Adapter Contract according to 02_TRD_Technology_RnD.docx Section 6

export interface ConnectionResult {
  connected: boolean;
  providerAccountId: string;
  email: string;
  displayName: string;
  scopes: string[];
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface OutboundMessage {
  to: string;
  toName?: string;
  from: string;
  fromName?: string;
  replyTo?: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  headers?: Record<string, string>;
  trackingTokens?: {
    messageId: string;
    openTrackingUrl?: string;
    clickTrackingPrefix?: string;
    unsubscribeUrl?: string;
  };
  attachments?: Array<{
    filename: string;
    contentType: string;
    content: string; // Base64 or URL
  }>;
}

export interface ProviderSendResult {
  success: boolean;
  providerMessageId: string;
  threadId?: string;
  internetMessageId?: string;
  providerStatus: "ACCEPTED" | "SENT" | "REJECTED" | "THROTTLED";
  rawResponse?: any;
  error?: string;
  isRetryable?: boolean;
}

export interface ProviderMessage {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  subject: string;
  snippet?: string;
  internalDate: number;
}

export interface ThreadPage {
  threads: Array<{
    id: string;
    historyId?: string;
    messagesCount: number;
    snippet: string;
  }>;
  nextPageToken?: string;
}

export interface WatchRegistration {
  active: boolean;
  resourceId?: string;
  expiration?: number;
}

export interface EmailProvider {
  readonly providerName: "gmail" | "microsoft" | "zoho" | "sandbox" | "smtp" | "resend";
  connect(): Promise<ConnectionResult>;
  refreshToken(): Promise<void>;
  send(message: OutboundMessage): Promise<ProviderSendResult>;
  getMessage(id: string): Promise<ProviderMessage>;
  listThreads(cursor?: string): Promise<ThreadPage>;
  watchEvents(): Promise<WatchRegistration>;
  disconnect(): Promise<void>;
}

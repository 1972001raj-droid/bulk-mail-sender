import { Resend } from "resend";
import {
  EmailProvider,
  ConnectionResult,
  OutboundMessage,
  ProviderSendResult,
  ProviderMessage,
  ThreadPage,
  WatchRegistration
} from "./types";

export interface ResendAdapterConfig {
  apiKey: string;
  senderEmail: string;
  displayName?: string;
}

/**
 * Resend Provider Adapter (https://resend.com)
 * The simplest and most developer-friendly way to send emails.
 * Uses the official Resend SDK.
 */
export class ResendProviderAdapter implements EmailProvider {
  readonly providerName = "resend" as const;
  private resend: Resend;
  private config: ResendAdapterConfig;

  constructor(config: ResendAdapterConfig) {
    this.config = config;
    this.resend = new Resend(config.apiKey);
  }

  /**
   * Verifies the Resend API key by querying the API.
   */
  async connect(): Promise<ConnectionResult> {
    try {
      const result = await this.resend.apiKeys.list();
      if (result.error) {
        throw new Error(result.error.message || "Invalid Resend API key");
      }

      return {
        connected: true,
        providerAccountId: this.config.senderEmail,
        email: this.config.senderEmail,
        displayName: this.config.displayName || this.config.senderEmail.split("@")[0],
        scopes: ["emails:send"]
      };
    } catch (err: any) {
      throw new Error(`Resend verification failed: ${err.message || "Invalid API key"}`);
    }
  }

  async refreshToken(): Promise<void> {
    // API keys are static and do not require refresh
  }

  /**
   * Sends an email via the Resend API.
   */
  async send(message: OutboundMessage): Promise<ProviderSendResult> {
    try {
      const fromEmail = this.config.senderEmail || message.from;
      const fromFormatted = message.fromName
        ? `${message.fromName} <${fromEmail}>`
        : fromEmail;

      const toFormatted = message.toName
        ? `${message.toName} <${message.to}>`
        : message.to;

      const { data, error } = await this.resend.emails.send({
        from: fromFormatted,
        to: [toFormatted],
        replyTo: message.replyTo || undefined,
        subject: message.subject,
        html: message.htmlBody,
        text: message.textBody || undefined,
        headers: {
          "X-Entity-Ref-ID": `${Date.now()}`,
          ...(message.headers || {})
        }
      });

      if (error) {
        return {
          success: false,
          providerMessageId: "",
          providerStatus: "REJECTED",
          error: error.message || "Resend API rejected the email request",
          isRetryable: false
        };
      }

      const messageId = data?.id || `resend_${Date.now()}`;

      return {
        success: true,
        providerMessageId: messageId,
        threadId: `thd_${messageId}`,
        providerStatus: "SENT",
        rawResponse: data
      };
    } catch (err: any) {
      return {
        success: false,
        providerMessageId: "",
        providerStatus: "REJECTED",
        error: err.message || "Resend email sending failed",
        isRetryable: false
      };
    }
  }

  async getMessage(id: string): Promise<ProviderMessage> {
    return {
      id,
      threadId: `thd_${id}`,
      from: this.config.senderEmail,
      to: [],
      subject: "",
      snippet: "",
      internalDate: Date.now()
    };
  }

  async listThreads(): Promise<ThreadPage> {
    return { threads: [] };
  }

  async watchEvents(): Promise<WatchRegistration> {
    return { active: false };
  }

  async disconnect(): Promise<void> {
    // No persistent connection to close
  }
}

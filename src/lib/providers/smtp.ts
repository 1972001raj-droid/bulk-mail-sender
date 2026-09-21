import nodemailer, { Transporter } from "nodemailer";
import {
  EmailProvider,
  ConnectionResult,
  OutboundMessage,
  ProviderSendResult,
  ProviderMessage,
  ThreadPage,
  WatchRegistration
} from "./types";

export interface SmtpConfig {
  host: string;
  port: number;
  secure?: boolean;
  user: string;
  pass: string;
  email?: string;
  displayName?: string;
}

/**
 * Real SMTP Provider Adapter using Nodemailer.
 * Enables sending through Gmail (App Password), Outlook 365, Amazon SES, SendGrid,
 * Brevo, Mailgun, or any custom corporate SMTP server.
 */
export class SmtpProviderAdapter implements EmailProvider {
  readonly providerName = "smtp" as const;
  private config: SmtpConfig;
  private transporter: Transporter;

  constructor(config: SmtpConfig) {
    this.config = config;
    const isSecure = config.secure ?? (Number(config.port) === 465);

    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: Number(config.port) || 587,
      secure: isSecure,
      auth: {
        user: config.user,
        pass: config.pass
      },
      tls: {
        // Rejecting unauthorized certificates can block self-hosted or corporate SMTP servers
        rejectUnauthorized: false
      }
    });
  }

  /**
   * Verifies the SMTP credentials and server connection in real time.
   */
  async connect(): Promise<ConnectionResult> {
    try {
      await this.transporter.verify();
      const accountEmail = this.config.email || this.config.user;
      return {
        connected: true,
        providerAccountId: accountEmail,
        email: accountEmail,
        displayName: this.config.displayName || accountEmail.split("@")[0],
        scopes: ["smtp.send"]
      };
    } catch (err: any) {
      throw new Error(`SMTP connection failed: ${err.message || "Invalid credentials or host unreachable"}`);
    }
  }

  async refreshToken(): Promise<void> {
    // SMTP credentials don't require token refresh
  }

  /**
   * Dispatches a real email through the configured SMTP server.
   */
  async send(message: OutboundMessage): Promise<ProviderSendResult> {
    try {
      const fromEmail = this.config.email || this.config.user || message.from;
      const fromHeader = message.fromName
        ? `"${message.fromName}" <${fromEmail}>`
        : fromEmail;

      const toHeader = message.toName
        ? `"${message.toName}" <${message.to}>`
        : message.to;

      const info = await this.transporter.sendMail({
        from: fromHeader,
        to: toHeader,
        replyTo: message.replyTo || undefined,
        subject: message.subject,
        html: message.htmlBody,
        text: message.textBody || undefined,
        headers: {
          "X-Mailer": "AeroSend Outreach Engine",
          "X-Entity-Ref-ID": `${Date.now()}`
        }
      });

      const messageId = info.messageId || `smtp_${Date.now()}`;

      return {
        success: true,
        providerMessageId: messageId,
        threadId: `thd_${messageId}`,
        providerStatus: "SENT",
        rawResponse: {
          messageId: info.messageId,
          response: info.response,
          accepted: info.accepted,
          rejected: info.rejected
        }
      };
    } catch (err: any) {
      return {
        success: false,
        providerMessageId: "",
        providerStatus: "REJECTED",
        error: err.message || "SMTP transmission failed",
        isRetryable: false
      };
    }
  }

  async getMessage(id: string): Promise<ProviderMessage> {
    return {
      id,
      threadId: `thd_${id}`,
      from: this.config.email || this.config.user,
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
    try {
      this.transporter.close();
    } catch {
      // ignore
    }
  }
}

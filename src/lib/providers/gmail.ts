import { EmailProvider, ConnectionResult, OutboundMessage, ProviderSendResult, ProviderMessage, ThreadPage, WatchRegistration } from "./types";

export interface GmailAdapterConfig {
  accessToken: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  email: string;
}

export class GmailProviderAdapter implements EmailProvider {
  readonly providerName = "gmail" as const;
  private config: GmailAdapterConfig;

  constructor(config: GmailAdapterConfig) {
    this.config = config;
  }

  async connect(): Promise<ConnectionResult> {
    return {
      connected: true,
      providerAccountId: this.config.email,
      email: this.config.email,
      displayName: this.config.email.split("@")[0],
      scopes: ["https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.readonly"]
    };
  }

  async refreshToken(): Promise<void> {
    if (!this.config.refreshToken || !this.config.clientId || !this.config.clientSecret) {
      throw new Error("Missing client credentials for Google OAuth token refresh");
    }

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.config.refreshToken,
        grant_type: "refresh_token"
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gmail token refresh failed: ${errText}`);
    }

    const data = await res.json();
    this.config.accessToken = data.access_token;
  }

  /**
   * Encodes standard RFC 2822 email to Base64URL required by Gmail API
   */
  private createRfc2822Raw(message: OutboundMessage): string {
    const headerLines = Object.entries(message.headers || {})
      .filter(([name, value]) => /^[A-Za-z0-9-]+$/.test(name) && !/[\r\n]/.test(value))
      .map(([name, value]) => `${name}: ${value}`);
    const lines = [
      `To: ${message.toName ? `"${message.toName}" <${message.to}>` : message.to}`,
      `From: ${message.fromName ? `"${message.fromName}" <${message.from}>` : message.from}`,
      message.replyTo ? `Reply-To: ${message.replyTo}` : "",
      `Subject: =?UTF-8?B?${Buffer.from(message.subject, "utf-8").toString("base64")}?=`,
      ...headerLines,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: 7bit",
      "",
      message.htmlBody
    ].filter(Boolean);

    const emailString = lines.join("\r\n");
    return Buffer.from(emailString)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  async send(message: OutboundMessage): Promise<ProviderSendResult> {
    try {
      const raw = this.createRfc2822Raw(message);
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ raw })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const status = res.status;
        const isQuota = status === 429 || errorData?.error?.message?.includes("Quota exceeded");
        const isAuth = status === 401;

        if (isAuth && this.config.refreshToken) {
          // Attempt automatic token refresh
          await this.refreshToken();
          return this.send(message);
        }

        return {
          success: false,
          providerMessageId: "",
          providerStatus: isQuota ? "THROTTLED" : "REJECTED",
          error: errorData?.error?.message || `Gmail API error ${status}`,
          isRetryable: isQuota || status >= 500
        };
      }

      const data = await res.json();
      return {
        success: true,
        providerMessageId: data.id,
        threadId: data.threadId,
        providerStatus: "SENT",
        rawResponse: data
      };
    } catch (err: any) {
      return {
        success: false,
        providerMessageId: "",
        providerStatus: "REJECTED",
        error: err.message,
        isRetryable: true
      };
    }
  }

  async getMessage(id: string): Promise<ProviderMessage> {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata`, {
      headers: { Authorization: `Bearer ${this.config.accessToken}` }
    });
    if (!res.ok) throw new Error(`Gmail getMessage failed: ${res.statusText}`);
    const data = await res.json();
    return {
      id: data.id,
      threadId: data.threadId,
      from: data.payload?.headers?.find((h: any) => h.name === "From")?.value || "",
      to: [data.payload?.headers?.find((h: any) => h.name === "To")?.value || ""],
      subject: data.payload?.headers?.find((h: any) => h.name === "Subject")?.value || "",
      snippet: data.snippet,
      internalDate: parseInt(data.internalDate, 10)
    };
  }

  async listThreads(cursor?: string): Promise<ThreadPage> {
    const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/threads");
    if (cursor) url.searchParams.set("pageToken", cursor);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.config.accessToken}` }
    });
    if (!res.ok) throw new Error(`Gmail listThreads failed: ${res.statusText}`);
    const data = await res.json();
    return {
      threads: (data.threads || []).map((t: any) => ({
        id: t.id,
        historyId: t.historyId,
        messagesCount: t.messages?.length || 1,
        snippet: t.snippet || ""
      })),
      nextPageToken: data.nextPageToken
    };
  }

  async watchEvents(): Promise<WatchRegistration> {
    return { active: false };
  }

  async disconnect(): Promise<void> {
    // Revoke token if needed
  }
}

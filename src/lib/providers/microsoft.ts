import { EmailProvider, ConnectionResult, OutboundMessage, ProviderSendResult, ProviderMessage, ThreadPage, WatchRegistration } from "./types";

export interface MicrosoftAdapterConfig {
  accessToken: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  email: string;
}

export class MicrosoftGraphProviderAdapter implements EmailProvider {
  readonly providerName = "microsoft" as const;
  private config: MicrosoftAdapterConfig;

  constructor(config: MicrosoftAdapterConfig) {
    this.config = config;
  }

  async connect(): Promise<ConnectionResult> {
    return {
      connected: true,
      providerAccountId: this.config.email,
      email: this.config.email,
      displayName: this.config.email.split("@")[0],
      scopes: ["Mail.Send", "Mail.Read", "offline_access"]
    };
  }

  async refreshToken(): Promise<void> {
    if (!this.config.refreshToken || !this.config.clientId || !this.config.clientSecret) {
      throw new Error("Missing credentials for Microsoft OAuth token refresh");
    }

    const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
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
      const err = await res.text();
      throw new Error(`Microsoft token refresh failed: ${err}`);
    }

    const data = await res.json();
    this.config.accessToken = data.access_token;
  }

  async send(message: OutboundMessage): Promise<ProviderSendResult> {
    try {
      const payload = {
        message: {
          subject: message.subject,
          body: {
            contentType: "HTML",
            content: message.htmlBody
          },
          toRecipients: [
            {
              emailAddress: {
                address: message.to,
                name: message.toName || message.to
              }
            }
          ]
        },
        saveToSentItems: true
      };

      // Microsoft Graph sendMail endpoint
      const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      // Microsoft Graph sendMail returns 202 Accepted on success
      if (res.status === 202 || res.status === 200) {
        const clientRequestId = res.headers.get("request-id") || `ms_msg_${Date.now()}`;
        return {
          success: true,
          providerMessageId: clientRequestId,
          providerStatus: "ACCEPTED",
          rawResponse: { status: res.status, requestId: clientRequestId }
        };
      }

      const errorData = await res.json().catch(() => ({}));
      const isThrottled = res.status === 429 || res.status === 503;

      if (res.status === 401 && this.config.refreshToken) {
        await this.refreshToken();
        return this.send(message);
      }

      return {
        success: false,
        providerMessageId: "",
        providerStatus: isThrottled ? "THROTTLED" : "REJECTED",
        error: errorData?.error?.message || `Microsoft Graph error ${res.status}`,
        isRetryable: isThrottled || res.status >= 500
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
    const res = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${id}`, {
      headers: { Authorization: `Bearer ${this.config.accessToken}` }
    });
    if (!res.ok) throw new Error(`Microsoft getMessage failed: ${res.statusText}`);
    const data = await res.json();
    return {
      id: data.id,
      threadId: data.conversationId,
      from: data.from?.emailAddress?.address || "",
      to: (data.toRecipients || []).map((r: any) => r.emailAddress?.address),
      subject: data.subject || "",
      snippet: data.bodyPreview || "",
      internalDate: new Date(data.createdDateTime).getTime()
    };
  }

  async listThreads(cursor?: string): Promise<ThreadPage> {
    const res = await fetch("https://graph.microsoft.com/v1.0/me/messages?$top=20", {
      headers: { Authorization: `Bearer ${this.config.accessToken}` }
    });
    if (!res.ok) throw new Error(`Microsoft listThreads failed: ${res.statusText}`);
    const data = await res.json();
    return {
      threads: (data.value || []).map((m: any) => ({
        id: m.conversationId,
        messagesCount: 1,
        snippet: m.bodyPreview || ""
      }))
    };
  }

  async watchEvents(): Promise<WatchRegistration> {
    return { active: false };
  }

  async disconnect(): Promise<void> {
    return;
  }
}

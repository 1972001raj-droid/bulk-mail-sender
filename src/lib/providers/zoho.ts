import { EmailProvider, ConnectionResult, OutboundMessage, ProviderSendResult, ProviderMessage, ThreadPage, WatchRegistration } from "./types";

export interface ZohoAdapterConfig {
  accessToken: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  accountId: string;
  email: string;
}

export class ZohoProviderAdapter implements EmailProvider {
  readonly providerName = "zoho" as const;
  private config: ZohoAdapterConfig;

  constructor(config: ZohoAdapterConfig) {
    this.config = config;
  }

  async connect(): Promise<ConnectionResult> {
    return {
      connected: true,
      providerAccountId: this.config.accountId || this.config.email,
      email: this.config.email,
      displayName: this.config.email.split("@")[0],
      scopes: ["ZohoMail.messages.ALL", "ZohoMail.accounts.READ"]
    };
  }

  async refreshToken(): Promise<void> {
    if (!this.config.refreshToken || !this.config.clientId || !this.config.clientSecret) {
      throw new Error("Missing credentials for Zoho token refresh");
    }

    const res = await fetch("https://accounts.zoho.com/oauth/v2/token", {
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
      throw new Error(`Zoho token refresh failed: ${err}`);
    }

    const data = await res.json();
    this.config.accessToken = data.access_token;
  }

  async send(message: OutboundMessage): Promise<ProviderSendResult> {
    try {
      const payload = {
        fromAddress: this.config.email,
        toAddress: message.to,
        subject: message.subject,
        content: message.htmlBody,
        mailFormat: "html"
      };

      const accountId = this.config.accountId || "me";
      const res = await fetch(`https://mail.zoho.com/api/accounts/${accountId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Zoho-oauthtoken ${this.config.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const status = res.status;
        const isThrottled = status === 429;

        if (status === 401 && this.config.refreshToken) {
          await this.refreshToken();
          return this.send(message);
        }

        return {
          success: false,
          providerMessageId: "",
          providerStatus: isThrottled ? "THROTTLED" : "REJECTED",
          error: errorData?.data?.description || `Zoho error ${status}`,
          isRetryable: isThrottled || status >= 500
        };
      }

      const data = await res.json();
      const msgId = data.data?.messageId || `zoho_msg_${Date.now()}`;
      return {
        success: true,
        providerMessageId: msgId,
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
    return {
      id,
      threadId: `thd_${id}`,
      from: this.config.email,
      to: [],
      subject: "Zoho Message",
      internalDate: Date.now()
    };
  }

  async listThreads(cursor?: string): Promise<ThreadPage> {
    return { threads: [] };
  }

  async watchEvents(): Promise<WatchRegistration> {
    return { active: false };
  }

  async disconnect(): Promise<void> {
    return;
  }
}

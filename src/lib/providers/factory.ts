import { EmailProvider } from "./types";
import { SandboxProviderAdapter } from "./sandbox";
import { SmtpProviderAdapter, SmtpConfig } from "./smtp";
import { ResendProviderAdapter } from "./resend";
import { GmailProviderAdapter, GmailAdapterConfig } from "./gmail";
import { MicrosoftGraphProviderAdapter, MicrosoftAdapterConfig } from "./microsoft";
import { ZohoProviderAdapter, ZohoAdapterConfig } from "./zoho";

export interface ProviderAccountRecord {
  provider: string;
  senderEmail: string;
  displayName?: string;
  tokenRef?: string | null;
  config?: any;
}

export class ProviderFactory {
  static getProvider(account: ProviderAccountRecord): EmailProvider {
    const prov = (account.provider || "sandbox").toLowerCase();

    // 1. Check if tokenRef contains JSON configuration (Resend or SMTP)
    if (account.tokenRef) {
      try {
        const parsed = JSON.parse(account.tokenRef);

        // Resend API configuration
        if (prov === "resend" || parsed.apiKey) {
          return new ResendProviderAdapter({
            apiKey: parsed.apiKey || process.env.RESEND_API_KEY || "",
            senderEmail: account.senderEmail,
            displayName: account.displayName || parsed.displayName
          });
        }

        // SMTP configuration
        if (parsed.host && parsed.user && parsed.pass) {
          const smtpConfig: SmtpConfig = {
            host: parsed.host,
            port: Number(parsed.port) || 587,
            secure: parsed.secure === true || Number(parsed.port) === 465,
            user: parsed.user,
            pass: parsed.pass,
            email: account.senderEmail || parsed.user,
            displayName: account.displayName || parsed.displayName
          };
          return new SmtpProviderAdapter(smtpConfig);
        }
      } catch {
        // Not a JSON string; continue to other checks
      }
    }

    // 2. Direct Resend provider type
    if (prov === "resend") {
      const apiKey = account.config?.apiKey || account.tokenRef || process.env.RESEND_API_KEY || "";
      return new ResendProviderAdapter({
        apiKey,
        senderEmail: account.senderEmail,
        displayName: account.displayName
      });
    }

    // 3. Direct SMTP provider type
    if (prov === "smtp" || prov === "custom") {
      const cfg = account.config || {};
      return new SmtpProviderAdapter({
        host: cfg.host || "localhost",
        port: Number(cfg.port) || 587,
        secure: cfg.secure ?? false,
        user: cfg.user || account.senderEmail,
        pass: cfg.pass || "",
        email: account.senderEmail,
        displayName: account.displayName
      });
    }

    switch (prov) {
      case "gmail": {
        if (!account.tokenRef && !account.config?.accessToken) {
          return new SandboxProviderAdapter(account.senderEmail, account.displayName);
        }
        const cfg: GmailAdapterConfig = {
          accessToken: account.config?.accessToken || account.tokenRef || "",
          refreshToken: account.config?.refreshToken,
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          email: account.senderEmail
        };
        return new GmailProviderAdapter(cfg);
      }
      case "microsoft":
      case "outlook": {
        if (!account.tokenRef && !account.config?.accessToken) {
          return new SandboxProviderAdapter(account.senderEmail, account.displayName);
        }
        const cfg: MicrosoftAdapterConfig = {
          accessToken: account.config?.accessToken || account.tokenRef || "",
          refreshToken: account.config?.refreshToken,
          clientId: process.env.MICROSOFT_CLIENT_ID,
          clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
          email: account.senderEmail
        };
        return new MicrosoftGraphProviderAdapter(cfg);
      }
      case "zoho": {
        if (!account.tokenRef && !account.config?.accessToken) {
          return new SandboxProviderAdapter(account.senderEmail, account.displayName);
        }
        const cfg: ZohoAdapterConfig = {
          accessToken: account.config?.accessToken || account.tokenRef || "",
          refreshToken: account.config?.refreshToken,
          clientId: process.env.ZOHO_CLIENT_ID,
          clientSecret: process.env.ZOHO_CLIENT_SECRET,
          accountId: account.config?.accountId || "me",
          email: account.senderEmail
        };
        return new ZohoProviderAdapter(cfg);
      }
      case "sandbox":
      default:
        return new SandboxProviderAdapter(account.senderEmail, account.displayName || "Demo Sender");
    }
  }
}

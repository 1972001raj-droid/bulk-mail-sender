import { EmailProvider, ConnectionResult, OutboundMessage, ProviderSendResult, ProviderMessage, ThreadPage, WatchRegistration } from "./types";

/**
 * High-fidelity Sandbox Provider Adapter for realistic demonstration and testing.
 * Simulates provider latency, quota tracking, bounce simulation, and thread lookup.
 */
export class SandboxProviderAdapter implements EmailProvider {
  readonly providerName = "sandbox" as const;
  private email: string;
  private displayName: string;

  constructor(email: string = "demo.sender@aerosend.dev", displayName: string = "Demo Sender") {
    this.email = email;
    this.displayName = displayName;
  }

  async connect(): Promise<ConnectionResult> {
    // Simulate OAuth hand-shake
    await new Promise((resolve) => setTimeout(resolve, 300));
    return {
      connected: true,
      providerAccountId: `sbx_${Date.now()}`,
      email: this.email,
      displayName: this.displayName,
      scopes: ["https://mail.google.com/", "offline_access"],
      expiresAt: new Date(Date.now() + 3600 * 1000 * 24 * 30),
      metadata: { sandboxMode: true, simulatedQuota: 2000 }
    };
  }

  async refreshToken(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  async send(message: OutboundMessage): Promise<ProviderSendResult> {
    // Simulate real provider network delay (50ms - 200ms)
    await new Promise((resolve) => setTimeout(resolve, 80));

    // Simulate intentional bounce condition for test addresses like bounce@...
    if (message.to.includes("bounce")) {
      return {
        success: false,
        providerMessageId: `sbx_fail_${Date.now()}`,
        providerStatus: "REJECTED",
        error: "550 5.1.1 The email account that you tried to reach does not exist.",
        isRetryable: false
      };
    }

    const providerMessageId = `sbx_msg_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;
    const threadId = `sbx_thd_${Math.random().toString(36).substring(2, 9)}`;

    return {
      success: true,
      providerMessageId,
      threadId,
      providerStatus: "SENT",
      rawResponse: {
        id: providerMessageId,
        threadId,
        labelIds: ["SENT"],
        simulatedAt: new Date().toISOString()
      }
    };
  }

  async getMessage(id: string): Promise<ProviderMessage> {
    return {
      id,
      threadId: `thd_${id}`,
      from: this.email,
      to: ["recipient@example.com"],
      subject: "Simulated Subject",
      snippet: "This is a simulated message snippet for verification.",
      internalDate: Date.now()
    };
  }

  async listThreads(cursor?: string): Promise<ThreadPage> {
    return {
      threads: [
        {
          id: `thd_demo_1`,
          historyId: "12345",
          messagesCount: 2,
          snippet: "Thanks for reaching out! Let's schedule a call."
        }
      ]
    };
  }

  async watchEvents(): Promise<WatchRegistration> {
    return {
      active: true,
      resourceId: `watch_sbx_${Date.now()}`,
      expiration: Date.now() + 7 * 24 * 3600 * 1000
    };
  }

  async disconnect(): Promise<void> {
    return;
  }
}

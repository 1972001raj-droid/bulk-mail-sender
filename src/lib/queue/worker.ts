/**
 * Rapid Email Queue Worker
 * Independent queue consumer adhering to RateController limits, error classification,
 * exponential retry backoff, and idempotent sending via existing delivery services.
 */

import { prisma } from "../db";
import { ProviderFactory } from "../providers/factory";
import { renderPersonalizedText, injectTracking } from "../email/personalization";
import { createInternetMessageId, createTrackingUrls, extractTrackableUrls } from "../email/tracking";
import { RateController } from "./rate-limiter";
import { ErrorClassifier } from "./error-classifier";
import { QueueConfig, WorkerStatus, WorkerTelemetry } from "./types";
import crypto from "crypto";

export interface WorkerOptions {
  workerId: string;
  name: string;
  campaignId: string;
  config: QueueConfig;
  rateController: RateController;
  claimJobFn: (workerId: string) => Promise<any | null>;
  onJobCompleted?: (jobId: string, success: boolean) => void;
}

export class QueueWorker {
  public readonly id: string;
  public readonly name: string;
  public readonly campaignId: string;

  private status: WorkerStatus = "STARTING";
  private config: QueueConfig;
  private rateController: RateController;
  private claimJobFn: (workerId: string) => Promise<any | null>;
  private onJobCompleted?: (jobId: string, success: boolean) => void;

  private shouldStop: boolean = false;
  private isPaused: boolean = false;
  private currentJobId: string | null = null;

  // Telemetry metrics
  private jobsProcessed: number = 0;
  private jobsSucceeded: number = 0;
  private jobsFailed: number = 0;
  private recentSendTimestamps: number[] = [];
  private lastActiveAt: number = Date.now();

  // Cached campaign metadata to avoid re-querying static campaign details per recipient
  private cachedCampaignData: any = null;

  constructor(options: WorkerOptions) {
    this.id = options.workerId;
    this.name = options.name;
    this.campaignId = options.campaignId;
    this.config = options.config;
    this.rateController = options.rateController;
    this.claimJobFn = options.claimJobFn;
    this.onJobCompleted = options.onJobCompleted;
  }

  public updateConfig(newConfig: Partial<QueueConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  public pause(): void {
    this.isPaused = true;
    this.status = "PAUSED";
  }

  public resume(): void {
    this.isPaused = false;
    this.status = "ACTIVE";
  }

  public stop(): void {
    this.shouldStop = true;
    this.status = "STOPPED";
  }

  public getTelemetry(): WorkerTelemetry {
    // Sliding window of sends over the last 1000ms
    const now = Date.now();
    const cutoff = now - 1000;
    while (this.recentSendTimestamps.length > 0 && this.recentSendTimestamps[0] < cutoff) {
      this.recentSendTimestamps.shift();
    }

    return {
      id: this.id,
      name: this.name,
      status: this.status,
      currentRate: this.recentSendTimestamps.length,
      jobsProcessed: this.jobsProcessed,
      jobsSucceeded: this.jobsSucceeded,
      jobsFailed: this.jobsFailed,
      lastActiveAt: new Date(this.lastActiveAt).toISOString(),
      currentJobId: this.currentJobId,
    };
  }

  /**
   * Main worker loop. Runs continuously until stopped.
   */
  public async start(): Promise<void> {
    this.status = "ACTIVE";
    this.shouldStop = false;
    this.isPaused = false;

    while (!this.shouldStop) {
      if (this.isPaused) {
        this.status = "PAUSED";
        await new Promise((res) => setTimeout(res, 300));
        continue;
      }

      this.lastActiveAt = Date.now();

      try {
        // 1. Claim next available job from the queue coordinator
        const job = await this.claimJobFn(this.id);

        if (!job) {
          // No jobs currently available or waiting for retry delay
          this.status = "IDLE";
          this.currentJobId = null;
          await new Promise((res) => setTimeout(res, 250));
          continue;
        }

        this.status = "ACTIVE";
        this.currentJobId = job.id;

        // 2. Process claimed job
        await this.processJob(job);
      } catch (err: any) {
        console.error(`[Worker ${this.id}] Unexpected error in worker loop:`, err);
        this.status = "ERROR";
        await new Promise((res) => setTimeout(res, 500));
      } finally {
        this.currentJobId = null;
      }
    }

    this.status = "STOPPED";
  }

  /**
   * Processes a single claimed email job safely.
   */
  private async processJob(job: any): Promise<void> {
    const startTime = Date.now();

    // 1. Wait for central rate clearance (enforcing MIN(global, worker, domain, account))
    const cleared = await this.rateController.acquireClearance({
      domain: job.recipientDomain,
      accountId: job.senderAccountId,
      timeoutMs: 8000,
    });

    if (!cleared) {
      // Re-release job back to QUEUED if rate limit couldn't be acquired in timeout
      await prisma.emailQueueJob.update({
        where: { id: job.id },
        data: {
          status: "QUEUED",
          lockedAt: null,
          lockedBy: null,
        },
      });
      return;
    }

    // 2. Ensure campaign metadata is available
    if (!this.cachedCampaignData) {
      this.cachedCampaignData = await prisma.campaign.findUnique({
        where: { id: this.campaignId },
        include: {
          sender: { include: { providerAccounts: true } },
          sequence: { include: { steps: { orderBy: { stepNo: "asc" } } } },
        },
      });
    }

    const campaign = this.cachedCampaignData;
    if (!campaign || !campaign.sender) {
      await this.markJobPermanentFailure(
        job.id,
        "CONFIG_ERROR",
        "Sender or campaign configuration missing",
        job.campaignRecipientId
      );
      return;
    }

    // Check if campaign was cancelled or paused while job was waiting
    const currentCampaignState = await prisma.campaign.findUnique({
      where: { id: this.campaignId },
      select: { status: true },
    });

    if (currentCampaignState?.status === "CANCELLED") {
      await prisma.emailQueueJob.update({
        where: { id: job.id },
        data: { status: "CANCELLED", lockedAt: null, lockedBy: null },
      });
      return;
    }

    const recipient = job.campaignRecipient;
    if (!recipient) {
      await this.markJobPermanentFailure(
        job.id,
        "RECIPIENT_MISSING",
        "Recipient record not found",
        job.campaignRecipientId
      );
      return;
    }

    const suppressed = await prisma.suppression.findFirst({
      where: {
        organizationId: campaign.organizationId,
        email: job.recipientEmail.trim().toLowerCase(),
      },
      select: { id: true },
    });
    if (suppressed || recipient.contact?.status === "UNSUBSCRIBED") {
      await prisma.$transaction([
        prisma.emailQueueJob.update({
          where: { id: job.id },
          data: { status: "CANCELLED", lockedAt: null, lockedBy: null, errorCode: "SUPPRESSED" },
        }),
        prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: "UNSUBSCRIBED", lastError: "Suppressed before send" },
        }),
        prisma.sequenceEnrollment.updateMany({
          where: { campaignRecipientId: recipient.id, status: "ACTIVE" },
          data: { status: "STOPPED", stopReason: "UNSUBSCRIBED" },
        }),
      ]);
      return;
    }

    // 3. Idempotency Check
    const idempotencyKey = crypto
      .createHash("sha256")
      .update(`${this.campaignId}:${recipient.id}:1`)
      .digest("hex");

    const existingMessage = await prisma.emailMessage.findUnique({
      where: { idempotencyKey },
    });

    if (existingMessage && (existingMessage.status === "SENT" || existingMessage.status === "ACCEPTED")) {
      // Already sent! Mark job SENT immediately to avoid duplicate send
      await this.markJobSuccess(job.id, existingMessage.providerMessageId || "IDEMPOTENT_ALREADY_SENT", recipient.id, existingMessage.id);
      return;
    }

    // 4. Resolve personalization & template
    const sender = campaign.sender;
    const contact = recipient.contact || {};
    const contactData = {
      email: job.recipientEmail,
      firstName: contact.firstName,
      lastName: contact.lastName,
      company: contact.company,
      title: contact.title,
      customFields: contact.customFieldsJson ? JSON.parse(contact.customFieldsJson) : {},
    };

    const personalizedSubject = renderPersonalizedText(campaign.subject || "Important update", contactData);
    const personalizedBody = renderPersonalizedText(campaign.htmlBody || "", contactData);

    // 5. Create or reuse EmailMessage
    const emailMsg = existingMessage || (await prisma.emailMessage.create({
      data: {
        campaignRecipientId: recipient.id,
        provider: job.provider || "sandbox",
        subject: personalizedSubject,
        status: "QUEUED",
        idempotencyKey,
      },
    }));
    const internetMessageId = emailMsg.internetMessageId || createInternetMessageId(sender.email, emailMsg.id);
    if (!emailMsg.internetMessageId) {
      await prisma.emailMessage.update({ where: { id: emailMsg.id }, data: { internetMessageId } });
    }

    // 6. Tracking injection
    const settings = campaign.settingsJson ? JSON.parse(campaign.settingsJson) : {};
    const trackOpens = settings.tracking?.opens !== false;
    const trackClicks = settings.tracking?.clicks !== false;
    const trackingUrls = await createTrackingUrls({
      emailMessageId: emailMsg.id,
      campaignRecipientId: recipient.id,
      trackOpens,
      destinations: trackClicks ? extractTrackableUrls(personalizedBody) : [],
    });

    const finalHtmlBody = injectTracking(personalizedBody, {
      openTrackingUrl: trackingUrls.openTrackingUrl,
      trackOpens,
      trackClicks,
      unsubscribeUrl: trackingUrls.unsubscribeUrl,
      clickTrackingUrls: trackingUrls.clickTrackingUrls,
    });

    // 7. Resolve provider adapter via existing ProviderFactory
    const activeProviderAccount = sender.providerAccounts?.[0];
    const provider = ProviderFactory.getProvider({
      provider: activeProviderAccount?.provider || "sandbox",
      senderEmail: sender.email,
      displayName: sender.displayName,
      tokenRef: activeProviderAccount?.tokenRef,
    });

    // 8. Execute Provider Send
    try {
      const sendResult = await provider.send({
        to: job.recipientEmail,
        toName: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
        from: sender.email,
        fromName: sender.displayName,
        subject: personalizedSubject,
        htmlBody: finalHtmlBody,
        headers: {
          "List-Unsubscribe": `<${trackingUrls.unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          "Message-ID": internetMessageId,
        },
      });

      if (sendResult.success) {
        await this.markJobSuccess(
          job.id,
          sendResult.providerMessageId,
          recipient.id,
          emailMsg.id,
          sendResult.rawResponse,
          { threadId: sendResult.threadId, internetMessageId: sendResult.internetMessageId || internetMessageId }
        );

        // Sequence enrollment if configured
        if (campaign.sequenceId && campaign.sequence?.steps?.length) {
          const firstStep = campaign.sequence.steps[0];
          const nextRun = new Date(Date.now() + (firstStep.delaySeconds || 86400) * 1000);
          await prisma.sequenceEnrollment.upsert({
            where: { campaignRecipientId: recipient.id },
            create: {
              sequenceId: campaign.sequenceId,
              campaignRecipientId: recipient.id,
              currentStep: 0,
              status: "ACTIVE",
              nextRunAt: nextRun,
            },
            update: {
              status: "ACTIVE",
              nextRunAt: nextRun,
            },
          });
        }
      } else {
        // Send rejected / failed - classify error
        await this.handleJobFailure(job, emailMsg.id, sendResult.error || "Provider rejected send");
      }
    } catch (err: any) {
      await this.handleJobFailure(job, emailMsg.id, err);
    }
  }

  /**
   * Records successful send across queue, recipient, and message tables.
   */
  private async markJobSuccess(
    jobId: string,
    providerMessageId: string,
    recipientId: string,
    emailMessageId: string,
    rawResponse?: any,
    correlation?: { threadId?: string; internetMessageId?: string }
  ): Promise<void> {
    const now = new Date();

    const ops: any[] = [
      prisma.emailQueueJob.update({
        where: { id: jobId },
        data: {
          status: "SENT",
          providerMessageId,
          threadId: correlation?.threadId,
          internetMessageId: correlation?.internetMessageId,
          sentAt: now,
          lockedAt: null,
          lockedBy: null,
          errorMessage: null,
          errorCode: null,
        },
      }),
      prisma.emailMessage.update({
        where: { id: emailMessageId },
        data: {
          status: "SENT",
          providerMessageId,
          sentAt: now,
        },
      }),
      prisma.campaignRecipient.update({
        where: { id: recipientId },
        data: {
          status: "SENT",
          providerMessageId,
          lastError: null,
        },
      }),
      prisma.emailEvent.create({
        data: {
          emailMessageId,
          eventType: "MESSAGE_SENT",
          metadataJson: JSON.stringify(rawResponse || {}),
        },
      }),
    ];

    if (this.cachedCampaignData?.senderId) {
      ops.push(
        prisma.sender.update({
          where: { id: this.cachedCampaignData.senderId },
          data: { sentToday: { increment: 1 } },
        })
      );
    }

    await prisma.$transaction(ops);

    this.jobsProcessed++;
    this.jobsSucceeded++;
    this.recentSendTimestamps.push(Date.now());
    if (this.onJobCompleted) {
      this.onJobCompleted(jobId, true);
    }
  }

  /**
   * Handles send failure: classifies error, computes backoff, and sets RETRYING or FAILED.
   */
  private async handleJobFailure(job: any, emailMessageId: string, error: any): Promise<void> {
    const classified = ErrorClassifier.classify(error);
    const attemptCount = (job.attemptCount || 1);
    const maxAttempts = job.maxAttempts || this.config.maxRetries || 5;

    this.jobsProcessed++;

    if (classified.isRetryable && attemptCount < maxAttempts) {
      // Temporary error: retry with exponential backoff & jitter
      const delayMs = ErrorClassifier.calculateRetryDelayMs(
        attemptCount,
        this.config.initialRetryDelaySeconds,
        this.config.retryBackoffMultiplier,
        this.config.maxRetryDelaySeconds
      );
      const nextRetryAt = new Date(Date.now() + delayMs);

      await prisma.$transaction([
        prisma.emailQueueJob.update({
          where: { id: job.id },
          data: {
            status: "RETRYING",
            lockedAt: null,
            lockedBy: null,
            lastAttemptAt: new Date(),
            nextRetryAt,
            availableAt: nextRetryAt,
            errorCode: classified.code,
            errorMessage: classified.message,
            errorClassification: "TEMPORARY",
          },
        }),
        prisma.emailEvent.create({
          data: {
            emailMessageId,
            eventType: "MESSAGE_RETRY_SCHEDULED",
            metadataJson: JSON.stringify({
              attempt: attemptCount,
              nextRetryAt: nextRetryAt.toISOString(),
              delayMs,
              error: classified.message,
            }),
          },
        }),
      ]);

      if (this.onJobCompleted) {
        this.onJobCompleted(job.id, false);
      }
    } else {
      // Permanent failure or max attempts exhausted
      await this.markJobPermanentFailure(
        job.id,
        classified.code || "FATAL_ERROR",
        classified.message,
        job.campaignRecipientId,
        emailMessageId
      );
    }
  }

  /**
   * Marks a job permanently failed.
   */
  private async markJobPermanentFailure(
    jobId: string,
    code: string,
    message: string,
    recipientId?: string,
    emailMessageId?: string
  ): Promise<void> {
    this.jobsFailed++;
    const now = new Date();

    const ops: any[] = [
      prisma.emailQueueJob.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          lockedAt: null,
          lockedBy: null,
          failedAt: now,
          errorCode: code,
          errorMessage: message,
          errorClassification: "PERMANENT",
        },
      }),
    ];

    if (recipientId) {
      ops.push(
        prisma.campaignRecipient.update({
          where: { id: recipientId },
          data: {
            status: "FAILED",
            lastError: message,
          },
        })
      );
    }

    if (emailMessageId) {
      ops.push(
        prisma.emailMessage.update({
          where: { id: emailMessageId },
          data: { status: "FAILED" },
        }),
        prisma.emailEvent.create({
          data: {
            emailMessageId,
            eventType: "MESSAGE_FAILED",
            metadataJson: JSON.stringify({ errorCode: code, errorMessage: message }),
          },
        })
      );
    }

    await prisma.$transaction(ops);

    if (this.onJobCompleted) {
      this.onJobCompleted(jobId, false);
    }
  }
}

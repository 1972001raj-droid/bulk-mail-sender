/**
 * Rapid Email Queue Engine
 * High-throughput, configurable, observable, and crash-resilient queue orchestrator.
 * Designed to process campaigns up to 100,000+ recipients with batch streaming,
 * dynamic scaling, central rate enforcement, and stale job recovery.
 */

import { prisma } from "../db";
import { QueueWorker } from "./worker";
import { RateController, getRateController, removeRateController } from "./rate-limiter";
import {
  DEFAULT_QUEUE_CONFIG,
  QueueConfig,
  QueueStatusMetrics,
  WorkerTelemetry,
} from "./types";

export class RapidQueueEngine {
  private static instance: RapidQueueEngine;

  // Active in-memory worker pools per campaign
  private workerPools: Map<string, QueueWorker[]> = new Map();
  // Recovery intervals per campaign or global
  private staleRecoveryInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Start periodic stale job recovery every 30 seconds
    this.staleRecoveryInterval = setInterval(() => {
      this.recoverStaleJobs().catch((err) => {
        console.error("[RapidQueue] Background stale recovery error:", err);
      });
    }, 30000);
    if (this.staleRecoveryInterval && typeof this.staleRecoveryInterval.unref === "function") {
      this.staleRecoveryInterval.unref();
    }
  }

  public destroy(): void {
    if (this.staleRecoveryInterval) {
      clearInterval(this.staleRecoveryInterval);
      this.staleRecoveryInterval = null;
    }
    for (const campaignId of Array.from(this.workerPools.keys())) {
      this.stopWorkerPool(campaignId);
    }
  }

  public static getInstance(): RapidQueueEngine {
    if (!RapidQueueEngine.instance) {
      RapidQueueEngine.instance = new RapidQueueEngine();
    }
    return RapidQueueEngine.instance;
  }

  /**
   * Resolves or initializes configuration for a campaign.
   */
  public async getOrInitConfig(campaignId: string, overrides?: Partial<QueueConfig>): Promise<QueueConfig> {
    const existing = await prisma.campaignQueueConfig.findUnique({
      where: { campaignId },
    });

    if (existing) {
      let parsedDomains = DEFAULT_QUEUE_CONFIG.domainRateLimits;
      let storedAdvanced: Partial<QueueConfig> = {};

      if (existing.domainRateLimitsJson) {
        try {
          const parsed = JSON.parse(existing.domainRateLimitsJson);
          if (parsed && typeof parsed === "object") {
            if (parsed.domainLimits) {
              parsedDomains = parsed.domainLimits;
              storedAdvanced = {
                dailySendingLimit: parsed.dailySendingLimit ?? null,
                hourlySendingLimit: parsed.hourlySendingLimit ?? null,
                perAccountRateLimit: parsed.perAccountRateLimit ?? null,
                campaignStartTime: parsed.campaignStartTime ?? null,
                campaignEndTime: parsed.campaignEndTime ?? null,
              };
            } else {
              parsedDomains = parsed;
            }
          }
        } catch {
          // ignore parsing error
        }
      }

      const merged: QueueConfig = {
        workerCount: overrides?.workerCount ?? existing.workerCount,
        emailsPerWorkerPerSecond: overrides?.emailsPerWorkerPerSecond ?? existing.emailsPerWorkerPerSecond,
        globalRateLimit: overrides?.globalRateLimit ?? existing.globalRateLimit,
        maxConcurrentJobs: overrides?.maxConcurrentJobs ?? existing.maxConcurrentJobs,
        batchSize: overrides?.batchSize ?? existing.batchSize,
        maxRetries: overrides?.maxRetries ?? existing.maxRetries,
        initialRetryDelaySeconds: overrides?.initialRetryDelaySeconds ?? existing.initialRetryDelaySeconds,
        retryBackoffMultiplier: overrides?.retryBackoffMultiplier ?? existing.retryBackoffMultiplier,
        maxRetryDelaySeconds: overrides?.maxRetryDelaySeconds ?? existing.maxRetryDelaySeconds,
        dailySendingLimit: overrides?.dailySendingLimit ?? storedAdvanced.dailySendingLimit ?? null,
        hourlySendingLimit: overrides?.hourlySendingLimit ?? storedAdvanced.hourlySendingLimit ?? null,
        perAccountRateLimit: overrides?.perAccountRateLimit ?? storedAdvanced.perAccountRateLimit ?? null,
        campaignStartTime: overrides?.campaignStartTime ?? storedAdvanced.campaignStartTime ?? null,
        campaignEndTime: overrides?.campaignEndTime ?? storedAdvanced.campaignEndTime ?? null,
        perDomainThrottlingEnabled: overrides?.perDomainThrottlingEnabled ?? existing.perDomainThrottlingEnabled,
        domainRateLimits: overrides?.domainRateLimits ?? parsedDomains,
        staleLockTimeoutSeconds: overrides?.staleLockTimeoutSeconds ?? existing.staleLockTimeoutSeconds,
        queuePriority: (overrides?.queuePriority ?? existing.queuePriority) as any,
      };

      if (overrides) {
        const serializedJson = JSON.stringify({
          domainLimits: merged.domainRateLimits,
          dailySendingLimit: merged.dailySendingLimit,
          hourlySendingLimit: merged.hourlySendingLimit,
          perAccountRateLimit: merged.perAccountRateLimit,
          campaignStartTime: merged.campaignStartTime,
          campaignEndTime: merged.campaignEndTime,
        });

        await prisma.campaignQueueConfig.update({
          where: { campaignId },
          data: {
            workerCount: merged.workerCount,
            emailsPerWorkerPerSecond: merged.emailsPerWorkerPerSecond,
            globalRateLimit: merged.globalRateLimit,
            maxConcurrentJobs: merged.maxConcurrentJobs,
            batchSize: merged.batchSize,
            maxRetries: merged.maxRetries,
            initialRetryDelaySeconds: merged.initialRetryDelaySeconds,
            retryBackoffMultiplier: merged.retryBackoffMultiplier,
            maxRetryDelaySeconds: merged.maxRetryDelaySeconds,
            perDomainThrottlingEnabled: merged.perDomainThrottlingEnabled,
            domainRateLimitsJson: serializedJson,
            staleLockTimeoutSeconds: merged.staleLockTimeoutSeconds,
            queuePriority: merged.queuePriority,
          },
        });
      }
      return merged;
    }

    // Create default config
    const merged = { ...DEFAULT_QUEUE_CONFIG, ...overrides };
    const serializedJson = JSON.stringify({
      domainLimits: merged.domainRateLimits,
      dailySendingLimit: merged.dailySendingLimit,
      hourlySendingLimit: merged.hourlySendingLimit,
      perAccountRateLimit: merged.perAccountRateLimit,
      campaignStartTime: merged.campaignStartTime,
      campaignEndTime: merged.campaignEndTime,
    });

    await prisma.campaignQueueConfig.create({
      data: {
        campaignId,
        workerCount: merged.workerCount,
        emailsPerWorkerPerSecond: merged.emailsPerWorkerPerSecond,
        globalRateLimit: merged.globalRateLimit,
        maxConcurrentJobs: merged.maxConcurrentJobs,
        batchSize: merged.batchSize,
        maxRetries: merged.maxRetries,
        initialRetryDelaySeconds: merged.initialRetryDelaySeconds,
        retryBackoffMultiplier: merged.retryBackoffMultiplier,
        maxRetryDelaySeconds: merged.maxRetryDelaySeconds,
        perDomainThrottlingEnabled: merged.perDomainThrottlingEnabled,
        domainRateLimitsJson: serializedJson,
        staleLockTimeoutSeconds: merged.staleLockTimeoutSeconds,
        queuePriority: merged.queuePriority,
      },
    });

    return merged;
  }

  /**
   * Enqueues a campaign with batch streaming.
   * Handles large campaigns (100,000+ recipients) efficiently in chunks without loading all into memory.
   */
  public async enqueueCampaign(campaignId: string, customConfig?: Partial<QueueConfig>): Promise<void> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { sender: true },
    });

    if (!campaign) throw new Error("Campaign not found");
    if (!campaign.senderId) throw new Error("Sender mailbox is required to launch campaign");

    // 1. Resolve configuration
    const config = await this.getOrInitConfig(campaignId, customConfig);

    // 2. Mark Campaign as RUNNING
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "RUNNING" },
    });

    // 3. Batch populate email_queue_jobs from campaign recipients
    // Check if jobs are already populated
    const existingJobCount = await prisma.emailQueueJob.count({
      where: { campaignId },
    });

    if (existingJobCount === 0) {
      // Chunked stream insertion: 500 recipients per chunk
      const chunkSize = config.batchSize || 500;
      let cursor: string | undefined = undefined;

      while (true) {
        const recipients: any[] = await prisma.campaignRecipient.findMany({
          where: { campaignId },
          take: chunkSize,
          skip: cursor ? 1 : 0,
          cursor: cursor ? { id: cursor } : undefined,
          orderBy: { id: "asc" },
          select: {
            id: true,
            contactId: true,
            emailSnapshot: true,
            contact: {
              select: {
                verificationStatus: true,
              },
            },
          },
        });

        if (recipients.length === 0) break;
        cursor = recipients[recipients.length - 1].id;

        // Verification integration: separate invalid recipients from eligible recipients
        type ChunkRecipient = {
          id: string;
          contactId: string;
          emailSnapshot: string;
          contact?: {
            verificationStatus?: string | null;
          } | null;
        };

        const eligibleRecipients: ChunkRecipient[] = [];
        const invalidRecipients: ChunkRecipient[] = [];

        for (const r of (recipients as ChunkRecipient[])) {
          if (r.contact?.verificationStatus === "INVALID") {
            invalidRecipients.push(r);
          } else {
            eligibleRecipients.push(r);
          }
        }

        // Mark disqualified recipients as FAILED upfront to save SMTP quota
        if (invalidRecipients.length > 0) {
          await prisma.campaignRecipient.updateMany({
            where: { id: { in: invalidRecipients.map((r) => r.id) } },
            data: {
              status: "FAILED",
              lastError: "Email verification status is INVALID: skipped to protect sender reputation",
            },
          });
        }

        if (eligibleRecipients.length > 0) {
          const jobRecords = eligibleRecipients.map((r) => {
            const domain = r.emailSnapshot.split("@")[1]?.toLowerCase() || "unknown";
            return {
              campaignId,
              campaignRecipientId: r.id,
              contactId: r.contactId,
              senderAccountId: campaign.senderId,
              recipientEmail: r.emailSnapshot,
              recipientDomain: domain,
              status: "QUEUED",
              priority: config.queuePriority,
              maxAttempts: config.maxRetries,
              provider: campaign.sender?.email || "sandbox",
            };
          });

          // Atomic createMany
          await prisma.emailQueueJob.createMany({
            data: jobRecords,
          });

          // Mark recipients as QUEUED
          await prisma.campaignRecipient.updateMany({
            where: { id: { in: eligibleRecipients.map((r) => r.id) } },
            data: { status: "QUEUED" },
          });
        }
      }
    } else {
      // If resuming or restarting an existing campaign, re-queue any PENDING recipients
      await prisma.emailQueueJob.updateMany({
        where: { campaignId, status: "PENDING" },
        data: { status: "QUEUED" },
      });
    }

    // 4. Audit Log
    await prisma.auditLog.create({
      data: {
        organizationId: campaign.organizationId,
        action: "RAPID_QUEUE_STARTED",
        entityType: "campaign",
        entityId: campaign.id,
        metadataJson: JSON.stringify({
          workerCount: config.workerCount,
          globalRateLimit: config.globalRateLimit,
        }),
      }
    });

    // 5. Spawn and start worker pool
    await this.startWorkerPool(campaignId, config);
  }

  /**
   * Spawns worker pool for a campaign.
   */
  private async startWorkerPool(campaignId: string, config: QueueConfig): Promise<void> {
    // If pool is already running, do not re-create
    const existingPool = this.workerPools.get(campaignId);
    if (existingPool && existingPool.length > 0) {
      existingPool.forEach((w) => w.resume());
      return;
    }

    const rateController = getRateController(campaignId, config);
    const workers: QueueWorker[] = [];

    for (let i = 1; i <= config.workerCount; i++) {
      const worker = new QueueWorker({
        workerId: `worker-${i}`,
        name: `Worker ${i}`,
        campaignId,
        config,
        rateController,
        claimJobFn: (workerId: string) => this.claimNextJob(campaignId, workerId, config),
        onJobCompleted: (jobId: string, success: boolean) => {
          this.checkCampaignCompletion(campaignId).catch(console.error);
        },
      });

      workers.push(worker);
      // Run worker asynchronously in background
      worker.start().catch((err) => {
        console.error(`[Worker ${worker.id}] Failed:`, err);
      });
    }

    this.workerPools.set(campaignId, workers);
  }

  /**
   * Atomically claims the next available job for a worker.
   * Scans strict priority tiers (HIGH -> NORMAL -> LOW) and availableAt dates.
   */
  public async claimNextJob(campaignId: string, workerId: string, config: QueueConfig): Promise<any | null> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { status: true },
    });

    if (!campaign || campaign.status !== "RUNNING") {
      return null;
    }

    const now = new Date();
    const staleCutoff = new Date(Date.now() - (config.staleLockTimeoutSeconds * 1000));

    // 1. Find candidate job strictly adhering to priority hierarchy: HIGH -> NORMAL -> LOW
    const priorityTiers = ["HIGH", "NORMAL", "LOW"];
    let candidate: { id: string } | null = null;

    for (const priorityLevel of priorityTiers) {
      candidate = await prisma.emailQueueJob.findFirst({
        where: {
          campaignId,
          priority: priorityLevel,
          status: { in: ["QUEUED", "RETRYING"] },
          availableAt: { lte: now },
          OR: [
            { lockedAt: null },
            { lockedAt: { lt: staleCutoff } },
          ],
        },
        orderBy: [
          { availableAt: "asc" },
          { createdAt: "asc" },
        ],
        select: { id: true },
      });

      if (candidate) break;
    }

    if (!candidate) {
      return null;
    }

    // 2. Atomic lock claim using updateMany to prevent concurrency race conditions
    const updateResult = await prisma.emailQueueJob.updateMany({
      where: {
        id: candidate.id,
        status: { in: ["QUEUED", "RETRYING"] },
        availableAt: { lte: now },
        OR: [
          { lockedAt: null },
          { lockedAt: { lt: staleCutoff } },
        ],
      },
      data: {
        status: "PROCESSING",
        lockedAt: now,
        lockedBy: workerId,
        attemptCount: { increment: 1 },
      },
    });

    if (updateResult.count === 0) {
      // Race condition lost to another worker; return null to let worker poll again
      return null;
    }

    // 3. Retrieve claimed job with required relations
    return await prisma.emailQueueJob.findUnique({
      where: { id: candidate.id },
      include: {
        campaignRecipient: {
          include: { contact: true },
        },
      },
    });
  }

  /**
   * Checks if campaign is complete and transitions status.
   */
  private async checkCampaignCompletion(campaignId: string): Promise<void> {
    const remaining = await prisma.emailQueueJob.count({
      where: {
        campaignId,
        status: { in: ["PENDING", "QUEUED", "PROCESSING", "RETRYING"] },
      },
    });

    if (remaining === 0) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "COMPLETED" },
      });

      // Stop workers gracefully
      this.stopWorkerPool(campaignId);
    }
  }

  /**
   * Pauses the campaign and all active workers.
   */
  public async pauseCampaign(campaignId: string): Promise<void> {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "PAUSED" },
    });

    const pool = this.workerPools.get(campaignId);
    if (pool) {
      pool.forEach((w) => w.pause());
    }
  }

  /**
   * Resumes a paused campaign.
   */
  public async resumeCampaign(campaignId: string): Promise<void> {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "RUNNING" },
    });

    const pool = this.workerPools.get(campaignId);
    if (pool && pool.length > 0) {
      pool.forEach((w) => w.resume());
    } else {
      // Re-spawn workers if process restarted while paused
      const config = await this.getOrInitConfig(campaignId);
      await this.startWorkerPool(campaignId, config);
    }
  }

  /**
   * Cancels a campaign and marks all queued/pending/retrying jobs as CANCELLED.
   */
  public async cancelCampaign(campaignId: string): Promise<void> {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "CANCELLED" },
    });

    // Stop workers
    this.stopWorkerPool(campaignId);

    // Cancel pending and retrying jobs
    await prisma.emailQueueJob.updateMany({
      where: {
        campaignId,
        status: { in: ["PENDING", "QUEUED", "RETRYING"] },
      },
      data: {
        status: "CANCELLED",
        lockedAt: null,
        lockedBy: null,
      },
    });

    await prisma.campaignRecipient.updateMany({
      where: {
        campaignId,
        status: { in: ["PENDING", "QUEUED"] },
      },
      data: { status: "CANCELLED" },
    });
  }

  /**
   * Stops and dismantles the worker pool for a campaign.
   */
  public stopWorkerPool(campaignId: string): void {
    const pool = this.workerPools.get(campaignId);
    if (pool) {
      pool.forEach((w) => w.stop());
      this.workerPools.delete(campaignId);
    }
    removeRateController(campaignId);
  }

  /**
   * Dynamically updates queue configuration and scales workers up or down on the fly.
   */
  public async updateConfig(campaignId: string, newConfig: Partial<QueueConfig>): Promise<QueueConfig> {
    const updated = await this.getOrInitConfig(campaignId, newConfig);

    // 1. Update Central Rate Controller
    const rateController = getRateController(campaignId);
    if (rateController) {
      rateController.updateConfig(updated);
    }

    // 2. Dynamically scale worker pool
    const pool = this.workerPools.get(campaignId) || [];

    if (pool.length < updated.workerCount) {
      // Scale UP: spawn additional workers
      const toAdd = updated.workerCount - pool.length;
      const startIdx = pool.length + 1;
      for (let i = 0; i < toAdd; i++) {
        const workerId = `worker-${startIdx + i}`;
        const newWorker = new QueueWorker({
          workerId,
          name: `Worker ${startIdx + i}`,
          campaignId,
          config: updated,
          rateController: rateController || getRateController(campaignId, updated),
          claimJobFn: (wid: string) => this.claimNextJob(campaignId, wid, updated),
          onJobCompleted: () => this.checkCampaignCompletion(campaignId),
        });
        pool.push(newWorker);
        newWorker.start().catch(console.error);
      }
    } else if (pool.length > updated.workerCount) {
      // Scale DOWN: stop excess workers gracefully
      const excess = pool.length - updated.workerCount;
      for (let i = 0; i < excess; i++) {
        const worker = pool.pop();
        if (worker) worker.stop();
      }
    }

    // Update config on remaining workers
    pool.forEach((w) => w.updateConfig(updated));
    this.workerPools.set(campaignId, pool);

    return updated;
  }

  /**
   * Stale Job Recovery:
   * Finds jobs locked by workers that crashed or took longer than staleLockTimeoutSeconds,
   * releasing them back to QUEUED or RETRYING.
   */
  public async recoverStaleJobs(campaignId?: string): Promise<number> {
    const defaultTimeoutSec = 60;
    const staleCutoff = new Date(Date.now() - defaultTimeoutSec * 1000);

    const staleResult = await prisma.emailQueueJob.updateMany({
      where: {
        ...(campaignId ? { campaignId } : {}),
        status: "PROCESSING",
        lockedAt: { lt: staleCutoff },
      },
      data: {
        status: "QUEUED",
        lockedAt: null,
        lockedBy: null,
      },
    });

    if (staleResult.count > 0) {
      console.log(`[RapidQueue] Recovered ${staleResult.count} stale jobs.`);
    }

    return staleResult.count;
  }

  /**
   * Retrieves comprehensive live telemetry, metrics, and worker status.
   */
  public async getStatus(campaignId: string): Promise<QueueStatusMetrics> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, name: true, status: true },
    });

    if (!campaign) throw new Error("Campaign not found");

    const config = await this.getOrInitConfig(campaignId);
    const rateController = getRateController(campaignId, config);

    // Aggregate job counts by status
    const groupCounts = await prisma.emailQueueJob.groupBy({
      by: ["status"],
      where: { campaignId },
      _count: { status: true },
    });

    const counts: Record<string, number> = {
      PENDING: 0,
      QUEUED: 0,
      PROCESSING: 0,
      SENT: 0,
      RETRYING: 0,
      FAILED: 0,
      CANCELLED: 0,
    };

    groupCounts.forEach((g) => {
      counts[g.status] = g._count.status;
    });

    const total = Object.values(counts).reduce((acc, c) => acc + c, 0);
    const queueRemaining = counts.QUEUED + counts.PROCESSING + counts.RETRYING;

    // Worker telemetry
    const pool = this.workerPools.get(campaignId) || [];
    const workerStats: WorkerTelemetry[] = pool.map((w) => w.getTelemetry());

    const activeWorkers = workerStats.filter((w) => w.status === "ACTIVE").length;

    // Rates calculation
    const rates = rateController.getRates();
    const currentRate = rates.currentRate;
    const effectiveRate = rates.effectiveRate;
    const targetRate = rates.workerCapacity;

    // Dynamic ETA calculation
    let estimatedCompletionSeconds: number | null = null;
    let estimatedCompletionTime: string | null = null;

    if (queueRemaining > 0 && currentRate > 0) {
      estimatedCompletionSeconds = Math.ceil(queueRemaining / currentRate);
      estimatedCompletionTime = new Date(Date.now() + estimatedCompletionSeconds * 1000).toISOString();
    }

    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      status: campaign.status as any,
      total,
      queued: counts.QUEUED,
      processing: counts.PROCESSING,
      sent: counts.SENT,
      retrying: counts.RETRYING,
      failed: counts.FAILED,
      cancelled: counts.CANCELLED,
      activeWorkers,
      totalWorkers: pool.length || config.workerCount,
      targetRate,
      globalLimit: config.globalRateLimit,
      effectiveRate,
      currentRate,
      queueRemaining,
      estimatedCompletionSeconds,
      estimatedCompletionTime,
      workers: workerStats,
      config,
    };
  }
}

export const rapidQueueEngine = RapidQueueEngine.getInstance();

/**
 * Central Rate Controller
 * Enforces: effective_rate = MIN(global_rate_limit, worker_capacity, smtp_account_limit, domain_limit)
 * Supports dynamic configuration updates without requiring application restart.
 */

import { QueueConfig } from "./types";

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  capacity: number;
  fillRatePerSec: number;
}

export class RateController {
  private campaignId: string;
  private config: QueueConfig;
  private globalBucket: TokenBucket;
  private domainBuckets: Map<string, TokenBucket> = new Map();
  private accountBuckets: Map<string, TokenBucket> = new Map();

  // Sliding window counters for metrics
  private sendTimestamps: number[] = [];
  private domainSendCounts: Map<string, number> = new Map();

  // Daily and Hourly tracking
  private dailySentCount: number = 0;
  private dailyWindowStart: number = Date.now();
  private hourlySentCount: number = 0;
  private hourlyWindowStart: number = Date.now();

  constructor(campaignId: string, config: QueueConfig) {
    this.campaignId = campaignId;
    this.config = { ...config };

    const effectiveGlobalRate = Math.min(
      this.config.globalRateLimit,
      this.config.workerCount * this.config.emailsPerWorkerPerSecond
    );

    this.globalBucket = {
      tokens: effectiveGlobalRate,
      lastRefill: Date.now(),
      capacity: effectiveGlobalRate,
      fillRatePerSec: effectiveGlobalRate,
    };

    this.initDomainBuckets();
  }

  private initDomainBuckets() {
    if (this.config.perDomainThrottlingEnabled && this.config.domainRateLimits) {
      for (const [domain, rate] of Object.entries(this.config.domainRateLimits)) {
        const cleanDomain = domain.toLowerCase().trim();
        this.domainBuckets.set(cleanDomain, {
          tokens: rate,
          lastRefill: Date.now(),
          capacity: rate,
          fillRatePerSec: rate,
        });
      }
    }
  }

  /**
   * Refills a token bucket based on elapsed time.
   */
  private refillBucket(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    if (elapsedSeconds > 0) {
      bucket.tokens = Math.min(
        bucket.capacity,
        bucket.tokens + elapsedSeconds * bucket.fillRatePerSec
      );
      bucket.lastRefill = now;
    }
  }

  /**
   * Dynamically updates limits without restart.
   */
  public updateConfig(newConfig: Partial<QueueConfig>): void {
    this.config = { ...this.config, ...newConfig };
    const effectiveGlobalRate = Math.min(
      this.config.globalRateLimit,
      this.config.workerCount * this.config.emailsPerWorkerPerSecond
    );

    this.globalBucket.capacity = effectiveGlobalRate;
    this.globalBucket.fillRatePerSec = effectiveGlobalRate;
    this.globalBucket.tokens = Math.min(this.globalBucket.tokens, effectiveGlobalRate);

    // Update domains
    if (this.config.perDomainThrottlingEnabled && this.config.domainRateLimits) {
      for (const [domain, rate] of Object.entries(this.config.domainRateLimits)) {
        const cleanDomain = domain.toLowerCase().trim();
        const existing = this.domainBuckets.get(cleanDomain);
        if (existing) {
          existing.capacity = rate;
          existing.fillRatePerSec = rate;
          existing.tokens = Math.min(existing.tokens, rate);
        } else {
          this.domainBuckets.set(cleanDomain, {
            tokens: rate,
            lastRefill: Date.now(),
            capacity: rate,
            fillRatePerSec: rate,
          });
        }
      }
    }
  }

  /**
   * Registers custom per-account rate limit if provider specifies one.
   */
  public registerAccountRateLimit(accountId: string, ratePerSec: number): void {
    if (!this.accountBuckets.has(accountId)) {
      this.accountBuckets.set(accountId, {
        tokens: ratePerSec,
        lastRefill: Date.now(),
        capacity: ratePerSec,
        fillRatePerSec: ratePerSec,
      });
    } else {
      const b = this.accountBuckets.get(accountId)!;
      b.capacity = ratePerSec;
      b.fillRatePerSec = ratePerSec;
    }
  }

  /**
   * Checks and refreshes rolling hourly and daily sending windows.
   */
  private checkQuotaWindows(now: number): { dailyOk: boolean; hourlyOk: boolean } {
    // 24 hour rolling window for daily limit
    if (now - this.dailyWindowStart >= 24 * 3600 * 1000) {
      this.dailySentCount = 0;
      this.dailyWindowStart = now;
    }

    // 1 hour rolling window for hourly limit
    if (now - this.hourlyWindowStart >= 3600 * 1000) {
      this.hourlySentCount = 0;
      this.hourlyWindowStart = now;
    }

    const dailyOk = !this.config.dailySendingLimit || this.dailySentCount < this.config.dailySendingLimit;
    const hourlyOk = !this.config.hourlySendingLimit || this.hourlySentCount < this.config.hourlySendingLimit;

    return { dailyOk, hourlyOk };
  }

  /**
   * Attempts to acquire send clearance adhering to:
   * MIN(global_rate_limit, worker_capacity, smtp_account_limit, domain_limit)
   * plus daily, hourly, and campaign schedule window restrictions.
   * If tokens are not immediately available, it asynchronously waits up to timeoutMs.
   */
  public async acquireClearance(options: {
    domain?: string | null;
    accountId?: string | null;
    timeoutMs?: number;
  } = {}): Promise<boolean> {
    const timeoutMs = options.timeoutMs ?? 5000;
    const startTime = Date.now();
    const cleanDomain = options.domain ? options.domain.toLowerCase().trim() : null;

    while (Date.now() - startTime < timeoutMs) {
      const now = Date.now();

      // 1. Check campaign schedule time window
      if (this.config.campaignStartTime) {
        const startTimestamp = new Date(this.config.campaignStartTime).getTime();
        if (!isNaN(startTimestamp) && now < startTimestamp) {
          const waitTime = Math.min(startTimestamp - now, 250);
          await new Promise((res) => setTimeout(res, waitTime));
          continue;
        }
      }

      if (this.config.campaignEndTime) {
        const endTimestamp = new Date(this.config.campaignEndTime).getTime();
        if (!isNaN(endTimestamp) && now > endTimestamp) {
          return false; // Campaign schedule window has elapsed
        }
      }

      // 2. Check daily and hourly quotas
      const { dailyOk, hourlyOk } = this.checkQuotaWindows(now);
      if (!dailyOk || !hourlyOk) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      this.refillBucket(this.globalBucket);

      // Check domain bucket
      let domainBucket: TokenBucket | undefined;
      if (cleanDomain && this.config.perDomainThrottlingEnabled) {
        domainBucket = this.domainBuckets.get(cleanDomain);
        if (domainBucket) {
          this.refillBucket(domainBucket);
        }
      }

      // Check account bucket
      let accountBucket: TokenBucket | undefined;
      if (options.accountId) {
        if (!this.accountBuckets.has(options.accountId) && this.config.perAccountRateLimit) {
          this.registerAccountRateLimit(options.accountId, this.config.perAccountRateLimit);
        }
        accountBucket = this.accountBuckets.get(options.accountId);
        if (accountBucket) {
          this.refillBucket(accountBucket);
        }
      }

      // Determine if all limits have >= 1 token
      const hasGlobal = this.globalBucket.tokens >= 1;
      const hasDomain = !domainBucket || domainBucket.tokens >= 1;
      const hasAccount = !accountBucket || accountBucket.tokens >= 1;

      if (hasGlobal && hasDomain && hasAccount) {
        // Deduct tokens atomically
        this.globalBucket.tokens -= 1;
        if (domainBucket) domainBucket.tokens -= 1;
        if (accountBucket) accountBucket.tokens -= 1;

        // Record metrics
        this.sendTimestamps.push(now);
        this.dailySentCount++;
        this.hourlySentCount++;

        if (cleanDomain) {
          this.domainSendCounts.set(
            cleanDomain,
            (this.domainSendCounts.get(cleanDomain) || 0) + 1
          );
        }
        return true;
      }

      // Calculate shortest wait time needed before next token is available
      const globalWaitMs = Math.max(0, ((1 - this.globalBucket.tokens) / this.globalBucket.fillRatePerSec) * 1000);
      let waitMs = globalWaitMs;

      if (domainBucket && domainBucket.tokens < 1) {
        const domainWaitMs = Math.max(0, ((1 - domainBucket.tokens) / domainBucket.fillRatePerSec) * 1000);
        waitMs = Math.max(waitMs, domainWaitMs);
      }

      if (accountBucket && accountBucket.tokens < 1) {
        const accountWaitMs = Math.max(0, ((1 - accountBucket.tokens) / accountBucket.fillRatePerSec) * 1000);
        waitMs = Math.max(waitMs, accountWaitMs);
      }

      // Cap sleep between 5ms and 100ms for responsiveness
      const sleepDuration = Math.min(Math.max(5, Math.ceil(waitMs)), 100);
      await new Promise((resolve) => setTimeout(resolve, sleepDuration));
    }

    return false; // Timed out waiting for rate clearance
  }

  /**
   * Computes current actual throughput (emails/second in the trailing 1000ms window).
   */
  public getCurrentRate(): number {
    const cutoff = Date.now() - 1000;
    // Prune old timestamps
    while (this.sendTimestamps.length > 0 && this.sendTimestamps[0] < cutoff) {
      this.sendTimestamps.shift();
    }
    return this.sendTimestamps.length;
  }

  /**
   * Computes target and effective rates based on configuration.
   */
  public getRates() {
    const workerCapacity = this.config.workerCount * this.config.emailsPerWorkerPerSecond;
    const globalLimit = this.config.globalRateLimit;
    const accountLimit = this.config.perAccountRateLimit ?? Infinity;
    const effectiveRate = Math.min(workerCapacity, globalLimit, accountLimit);
    return {
      workerCapacity,
      globalLimit,
      accountLimit: this.config.perAccountRateLimit,
      effectiveRate,
      currentRate: this.getCurrentRate(),
      dailySentCount: this.dailySentCount,
      dailyLimit: this.config.dailySendingLimit,
      hourlySentCount: this.hourlySentCount,
      hourlyLimit: this.config.hourlySendingLimit,
    };
  }

  public getDomainStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [domain, count] of this.domainSendCounts.entries()) {
      stats[domain] = count;
    }
    return stats;
  }
}

// Global registry of rate controllers per campaign
const controllerRegistry = new Map<string, RateController>();

export function getRateController(campaignId: string, config?: QueueConfig): RateController {
  let controller = controllerRegistry.get(campaignId);
  if (!controller && config) {
    controller = new RateController(campaignId, config);
    controllerRegistry.set(campaignId, controller);
  }
  return controller!;
}

export function removeRateController(campaignId: string): void {
  controllerRegistry.delete(campaignId);
}

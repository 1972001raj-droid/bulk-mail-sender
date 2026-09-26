/**
 * Rapid Email Queue Types & Configurations
 * Supports high-throughput, configurable, observable, and failure-safe email delivery.
 */

export type QueueJobStatus =
  | "PENDING"
  | "QUEUED"
  | "PROCESSING"
  | "SENT"
  | "RETRYING"
  | "FAILED"
  | "CANCELLED";

export type QueueJobPriority = "HIGH" | "NORMAL" | "LOW";

export type WorkerStatus =
  | "STARTING"
  | "ACTIVE"
  | "IDLE"
  | "PAUSED"
  | "ERROR"
  | "STOPPED";

export interface QueueConfig {
  workerCount: number;
  emailsPerWorkerPerSecond: number;
  globalRateLimit: number;
  maxConcurrentJobs: number;
  batchSize: number;
  maxRetries: number;
  initialRetryDelaySeconds: number;
  retryBackoffMultiplier: number;
  maxRetryDelaySeconds: number;
  dailySendingLimit: number | null;
  hourlySendingLimit: number | null;
  perAccountRateLimit: number | null;
  campaignStartTime: string | null;
  campaignEndTime: string | null;
  perDomainThrottlingEnabled: boolean;
  domainRateLimits: Record<string, number>;
  staleLockTimeoutSeconds: number;
  queuePriority: QueueJobPriority;
}

export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  workerCount: 4,
  emailsPerWorkerPerSecond: 20,
  globalRateLimit: 80,
  maxConcurrentJobs: 20,
  batchSize: 500,
  maxRetries: 5,
  initialRetryDelaySeconds: 30,
  retryBackoffMultiplier: 2.0,
  maxRetryDelaySeconds: 900,
  dailySendingLimit: null,
  hourlySendingLimit: null,
  perAccountRateLimit: null,
  campaignStartTime: null,
  campaignEndTime: null,
  perDomainThrottlingEnabled: true,
  domainRateLimits: {
    "gmail.com": 15,
    "googlemail.com": 15,
    "yahoo.com": 10,
    "outlook.com": 12,
    "hotmail.com": 12,
    "icloud.com": 8
  },
  staleLockTimeoutSeconds: 60,
  queuePriority: "NORMAL"
};

export interface WorkerTelemetry {
  id: string;
  name: string;
  status: WorkerStatus;
  currentRate: number; // sent/sec over sliding window
  jobsProcessed: number;
  jobsSucceeded: number;
  jobsFailed: number;
  lastActiveAt: string;
  currentJobId?: string | null;
}

export interface QueueStatusMetrics {
  campaignId: string;
  campaignName: string;
  status: "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED";
  total: number;
  queued: number;
  processing: number;
  sent: number;
  retrying: number;
  failed: number;
  cancelled: number;
  activeWorkers: number;
  totalWorkers: number;
  targetRate: number; // workerCount * emailsPerWorkerPerSecond
  globalLimit: number;
  effectiveRate: number; // MIN(targetRate, globalLimit)
  currentRate: number; // Actual aggregate throughput in last second
  queueRemaining: number;
  estimatedCompletionSeconds: number | null;
  estimatedCompletionTime: string | null;
  workers: WorkerTelemetry[];
  config: QueueConfig;
}

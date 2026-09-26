/**
 * Error Classifier & Retry Backoff Calculator
 * Distinguishes temporary (retryable) errors from permanent (fatal) errors.
 * Calculates exponential backoff with jitter.
 */

export type ErrorClassification = "TEMPORARY" | "PERMANENT" | "UNKNOWN";

export interface ClassifiedError {
  classification: ErrorClassification;
  isRetryable: boolean;
  code?: string;
  message: string;
}

export class ErrorClassifier {
  /**
   * Classifies an SMTP or API error into TEMPORARY or PERMANENT.
   */
  static classify(error: any): ClassifiedError {
    const rawMsg = (typeof error === "string" ? error : error?.message || error?.error || "").toString();
    const cleanMsg = rawMsg.toLowerCase();
    const errorCode = error?.code || error?.responseCode || error?.statusCode || "";

    // 1. Temporary Network & Connection Failures
    const temporaryNetworkPatterns = [
      "etimedout",
      "econnreset",
      "econnrefused",
      "enotfound",
      "eai_again",
      "socket hang up",
      "network error",
      "timeout",
      "timed out",
      "connection reset",
      "connection closed",
      "temporary failure",
      "dns failure",
      "dns lookup failed",
    ];

    if (temporaryNetworkPatterns.some((pattern) => cleanMsg.includes(pattern))) {
      return {
        classification: "TEMPORARY",
        isRetryable: true,
        code: errorCode || "NETWORK_TEMPORARY",
        message: rawMsg || "Network or connection timeout",
      };
    }

    // 2. HTTP / SMTP Rate Limiting (429 or Throttling)
    if (
      cleanMsg.includes("rate limit") ||
      cleanMsg.includes("too many requests") ||
      cleanMsg.includes("throttled") ||
      cleanMsg.includes("quota exceeded") ||
      cleanMsg.includes("429")
    ) {
      return {
        classification: "TEMPORARY",
        isRetryable: true,
        code: "RATE_LIMITED",
        message: rawMsg || "Provider rate limit or quota throttle",
      };
    }

    // 3. SMTP 4xx Responses (Temporary SMTP failures)
    // 421 (service not available, closing transmission channel)
    // 450 (requested mail action not taken: mailbox unavailable)
    // 451 (requested action aborted: local error in processing)
    // 452 (requested action not taken: insufficient system storage)
    const smtp4xxRegex = /\b4[0-9]{2}\b/;
    if (
      smtp4xxRegex.test(cleanMsg) ||
      cleanMsg.includes("try again later") ||
      cleanMsg.includes("greylisted") ||
      cleanMsg.includes("temporarily deferred")
    ) {
      return {
        classification: "TEMPORARY",
        isRetryable: true,
        code: "SMTP_4XX_TEMPORARY",
        message: rawMsg,
      };
    }

    // 4. Permanent Errors
    // 5xx SMTP responses (550 Mailbox not found, 551 User not local, 552 Storage exceeded, 553 Mailbox syntax, 554 Transaction failed)
    // 535 Authentication credentials invalid
    const permanentPatterns = [
      "550",
      "551",
      "552",
      "553",
      "554",
      "535",
      "user unknown",
      "mailbox unavailable",
      "no such user",
      "does not exist",
      "recipient rejected",
      "address rejected",
      "invalid address",
      "invalid recipient",
      "authentication failed",
      "invalid credentials",
      "blocked",
      "blacklisted",
      "spamhaus",
      "permanently failed",
    ];

    if (permanentPatterns.some((pattern) => cleanMsg.includes(pattern))) {
      return {
        classification: "PERMANENT",
        isRetryable: false,
        code: "SMTP_5XX_PERMANENT",
        message: rawMsg,
      };
    }

    // 5. Explicit flag on provider result if available
    if (error?.isRetryable === true) {
      return {
        classification: "TEMPORARY",
        isRetryable: true,
        code: errorCode || "PROVIDER_RETRYABLE",
        message: rawMsg,
      };
    }

    if (error?.isRetryable === false) {
      return {
        classification: "PERMANENT",
        isRetryable: false,
        code: errorCode || "PROVIDER_FATAL",
        message: rawMsg,
      };
    }

    // Default unknown errors to TEMPORARY on first attempt to be resilient against transient blips
    return {
      classification: "TEMPORARY",
      isRetryable: true,
      code: errorCode || "UNKNOWN_TRANSIENT",
      message: rawMsg || "Unknown error encountered during transmission",
    };
  }

  /**
   * Calculates next retry delay in milliseconds with exponential backoff and jitter.
   * delay = MIN(maxDelay, initialDelay * (multiplier ^ (attempt - 1))) + jitter
   */
  static calculateRetryDelayMs(
    attemptCount: number,
    initialDelaySeconds: number = 30,
    backoffMultiplier: number = 2.0,
    maxDelaySeconds: number = 900
  ): number {
    const exponent = Math.max(0, attemptCount - 1);
    const rawDelaySec = initialDelaySeconds * Math.pow(backoffMultiplier, exponent);
    const cappedDelaySec = Math.min(maxDelaySeconds, rawDelaySec);

    // Jitter: +/- 15% random variation to avoid synchronous retries from parallel workers
    const jitterSec = cappedDelaySec * (0.85 + Math.random() * 0.3);
    return Math.round(jitterSec * 1000);
  }
}

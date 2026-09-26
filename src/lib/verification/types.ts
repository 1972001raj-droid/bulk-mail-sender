/**
 * Email Verification Type Definitions
 * Modeled after check-if-email-exists classification architecture
 */

export type VerificationStatus = "SAFE" | "RISKY" | "INVALID" | "UNKNOWN";

export type VerificationReason =
  // SAFE
  | "SMTP_ACCEPTED"
  | "VERIFIED_DELIVERABLE"
  // RISKY
  | "CATCH_ALL"
  | "DISPOSABLE_EMAIL"
  | "ROLE_ACCOUNT"
  | "MAILBOX_FULL"
  | "OTHER_RISK"
  // INVALID
  | "INVALID_SYNTAX"
  | "DOMAIN_NOT_FOUND"
  | "NO_MX"
  | "MAILBOX_NOT_FOUND"
  | "ACCOUNT_DISABLED"
  // UNKNOWN
  | "SMTP_TIMEOUT"
  | "TEMPORARY_SMTP_ERROR"
  | "GREYLISTED"
  | "PROVIDER_BLOCKED"
  | "VERIFICATION_UNCERTAIN";

export interface MxRecord {
  exchange: string;
  priority: number;
}

export interface SyntaxCheckResult {
  isValid: boolean;
  normalizedEmail: string;
  localPart: string;
  domain: string;
  error?: string;
}

export interface DnsCheckResult {
  hasMx: boolean;
  domainExists: boolean;
  mxRecords: MxRecord[];
  provider?: string;
  error?: string;
  isTemporaryFailure?: boolean;
}

export interface SmtpCheckResult {
  canConnect: boolean;
  isDeliverable: boolean;
  isCatchAll: boolean;
  hasFullInbox: boolean;
  isDisabled: boolean;
  isBlocked: boolean;
  isGreylisted: boolean;
  isTimeout: boolean;
  isNetworkRestricted?: boolean;
  responseCode?: number;
  responseMessage?: string;
  error?: string;
}

export interface MiscCheckResult {
  isDisposable: boolean;
  isRoleAccount: boolean;
}

export interface VerificationResult {
  email: string;
  status: VerificationStatus;
  reason: VerificationReason;
  message: string;
  syntax: SyntaxCheckResult;
  dns?: DnsCheckResult;
  smtp?: SmtpCheckResult;
  misc?: MiscCheckResult;
  durationMs: number;
  checkedAt: string;
  cached?: boolean;
}

export type ImportPolicy = "SAFE" | "SAFE_RISKY" | "SAFE_RISKY_UNKNOWN" | "ALL";

export interface VerificationJobProgress {
  jobId: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  total: number;
  processed: number;
  safeCount: number;
  riskyCount: number;
  invalidCount: number;
  unknownCount: number;
  percent: number;
  error?: string;
}

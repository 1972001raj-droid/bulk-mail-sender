import { SyntaxCheckResult } from "./types";

/**
 * Standard RFC 5322 compliant regex with sanity boundary checks.
 */
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Normalizes an email address according to standard specifications:
 * - Trims whitespace
 * - Converts to lowercase
 * - Strips trailing/leading control characters
 */
export function normalizeEmail(rawEmail: string): string {
  if (!rawEmail) return "";
  return rawEmail
    .trim()
    .toLowerCase()
    .normalize("NFC");
}

/**
 * Validates email syntax strictly before any DNS or network calls.
 * Returns false early on syntax violations to avoid expensive operations.
 */
export function validateEmailSyntax(rawEmail: string): SyntaxCheckResult {
  const normalized = normalizeEmail(rawEmail);

  if (!normalized) {
    return {
      isValid: false,
      normalizedEmail: "",
      localPart: "",
      domain: "",
      error: "Email is empty"
    };
  }

  // Length constraints per RFC 5321
  if (normalized.length > 254) {
    return {
      isValid: false,
      normalizedEmail: normalized,
      localPart: "",
      domain: "",
      error: "Email exceeds maximum length of 254 characters"
    };
  }

  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === normalized.length - 1) {
    return {
      isValid: false,
      normalizedEmail: normalized,
      localPart: "",
      domain: "",
      error: "Email must contain an '@' separating local part and domain"
    };
  }

  const localPart = normalized.substring(0, atIndex);
  const domain = normalized.substring(atIndex + 1);

  if (localPart.length > 64) {
    return {
      isValid: false,
      normalizedEmail: normalized,
      localPart,
      domain,
      error: "Local part exceeds maximum length of 64 characters"
    };
  }

  if (domain.length > 255) {
    return {
      isValid: false,
      normalizedEmail: normalized,
      localPart,
      domain,
      error: "Domain exceeds maximum length of 255 characters"
    };
  }

  // Check for consecutive dots
  if (localPart.includes("..") || domain.includes("..")) {
    return {
      isValid: false,
      normalizedEmail: normalized,
      localPart,
      domain,
      error: "Consecutive dots are not allowed in email address"
    };
  }

  // Local part cannot start or end with a dot
  if (localPart.startsWith(".") || localPart.endsWith(".")) {
    return {
      isValid: false,
      normalizedEmail: normalized,
      localPart,
      domain,
      error: "Local part cannot start or end with a dot"
    };
  }

  // Domain cannot start or end with a dot or hyphen
  if (domain.startsWith(".") || domain.endsWith(".") || domain.startsWith("-") || domain.endsWith("-")) {
    return {
      isValid: false,
      normalizedEmail: normalized,
      localPart,
      domain,
      error: "Domain format is invalid"
    };
  }

  // Must have a valid domain label with at least one dot and a TLD >= 2 chars
  const domainParts = domain.split(".");
  if (domainParts.length < 2 || domainParts.some((p) => p.length === 0)) {
    return {
      isValid: false,
      normalizedEmail: normalized,
      localPart,
      domain,
      error: "Domain must contain a valid TLD"
    };
  }

  const tld = domainParts[domainParts.length - 1];
  if (tld.length < 2 || /[^a-z0-9]/.test(tld)) {
    return {
      isValid: false,
      normalizedEmail: normalized,
      localPart,
      domain,
      error: "Top-level domain (TLD) is invalid"
    };
  }

  if (!EMAIL_REGEX.test(normalized)) {
    return {
      isValid: false,
      normalizedEmail: normalized,
      localPart,
      domain,
      error: "Email contains invalid characters or does not meet RFC specification"
    };
  }

  return {
    isValid: true,
    normalizedEmail: normalized,
    localPart,
    domain
  };
}

import fs from "fs";
import path from "path";
import dns from "dns";
import { DnsCheckResult, MxRecord } from "./types";
import { prisma } from "../db";

interface RulesConfig {
  by_domain?: Record<string, { rules: string[] }>;
  by_mx?: Record<string, { rules: string[] }>;
  by_mx_suffix?: Record<string, { rules: string[] }>;
}

let loadedRules: RulesConfig | null = null;
try {
  const rulesPath = path.join(process.cwd(), "check-if-email-exists-master", "core", "src", "rules.json");
  if (fs.existsSync(rulesPath)) {
    loadedRules = JSON.parse(fs.readFileSync(rulesPath, "utf-8"));
  }
} catch {
  // Gracefully fallback
}

// In-memory cache for ultra-fast lookups during a single job execution
const memoryDnsCache = new Map<string, { result: DnsCheckResult; expiresAt: number }>();

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Detects mail service provider based on MX host name.
 * Modeled after check-if-email-exists/core/src/mx/mod.rs
 */
export function detectProvider(mxHost: string): string {
  const host = mxHost.toLowerCase();
  if (host.includes(".google.com") || host.includes(".googlemail.com")) {
    return "Google Workspace / Gmail";
  }
  if (host.includes(".olc.protection.outlook.com")) {
    return "Microsoft Hotmail/Outlook (B2C)";
  }
  if (host.includes(".mail.protection.outlook.com") || host.includes(".protection.outlook.com")) {
    return "Microsoft 365 / Outlook (B2B)";
  }
  if (host.includes(".yahoodns.net")) {
    return "Yahoo Mail";
  }
  if (host.includes(".mimecast.com")) {
    return "Mimecast";
  }
  if (host.includes(".pphosted.com") || host.includes("ppe-hosted.com")) {
    return "Proofpoint";
  }
  if (host.includes("zoho.")) {
    return "Zoho Mail";
  }
  if (host.includes("icloud.com") || host.includes("apple.com")) {
    return "Apple iCloud";
  }
  return "Standard Mail Exchange";
}

/**
 * Checks whether catch-all probe should be skipped for high-volume consumer webmail providers
 * that never support domain-level catch-all (per check-if-email-exists rules.json).
 */
export function shouldSkipCatchAll(domain: string, mxHost: string): boolean {
  const d = domain.toLowerCase().trim();
  const m = mxHost.toLowerCase().trim();

  // Check from loaded rules.json (by_domain, by_mx, by_mx_suffix)
  if (loadedRules?.by_domain?.[d]?.rules?.includes("SkipCatchAll")) {
    return true;
  }
  if (
    loadedRules?.by_mx?.[m]?.rules?.includes("SkipCatchAll") ||
    loadedRules?.by_mx?.[`${m}.`]?.rules?.includes("SkipCatchAll")
  ) {
    return true;
  }
  if (loadedRules?.by_mx_suffix) {
    for (const [suffix, ruleObj] of Object.entries(loadedRules.by_mx_suffix)) {
      const cleanSuffix = suffix.replace(/^\./, "").replace(/\.$/, "");
      if (m.includes(cleanSuffix) && ruleObj.rules?.includes("SkipCatchAll")) {
        return true;
      }
    }
  }

  if (
    d === "gmail.com" ||
    d === "googlemail.com" ||
    d === "hotmail.com" ||
    d === "hotmail.fr" ||
    d === "hotmail.nl" ||
    d === "outlook.com" ||
    d === "live.com" ||
    d === "msn.com" ||
    d === "yahoo.com" ||
    d === "yahoo.fr" ||
    d === "ymail.com" ||
    d === "aol.com" ||
    d === "icloud.com"
  ) {
    return true;
  }
  if (m.includes(".google.com") && (d === "gmail.com" || d === "googlemail.com")) {
    return true;
  }
  return false;
}

/**
 * Returns custom SMTP timeout defined in rules.json (e.g. SmtpTimeout45s)
 */
export function getCustomSmtpTimeout(mxHost: string): number | null {
  const m = mxHost.toLowerCase().trim();
  if (
    loadedRules?.by_mx?.[m]?.rules?.includes("SmtpTimeout45s") ||
    loadedRules?.by_mx?.[`${m}.`]?.rules?.includes("SmtpTimeout45s")
  ) {
    return 45000;
  }
  if (loadedRules?.by_mx_suffix) {
    for (const [suffix, ruleObj] of Object.entries(loadedRules.by_mx_suffix)) {
      const cleanSuffix = suffix.replace(/^\./, "").replace(/\.$/, "");
      if (m.includes(cleanSuffix) && ruleObj.rules?.includes("SmtpTimeout45s")) {
        return 45000;
      }
    }
  }
  return null;
}

/**
 * Resolves MX records for a domain with multi-tier caching (memory + DB).
 */
export async function resolveMxRecords(domain: string): Promise<DnsCheckResult> {
  const cleanDomain = domain.toLowerCase().trim();
  const now = Date.now();

  // 1. Check in-memory cache
  const cachedMem = memoryDnsCache.get(cleanDomain);
  if (cachedMem && cachedMem.expiresAt > now) {
    return cachedMem.result;
  }

  // 2. Check Database Domain Cache
  try {
    const cachedDb = await prisma.emailDomainCache.findUnique({
      where: { domain: cleanDomain }
    });

    if (cachedDb && cachedDb.expiresAt.getTime() > now) {
      const records: MxRecord[] = JSON.parse(cachedDb.mxRecordsJson || "[]");
      const hasMx = cachedDb.hasMx && records.length > 0;
      const result: DnsCheckResult = {
        domainExists: hasMx,
        hasMx,
        mxRecords: records,
        provider: records.length > 0 ? detectProvider(records[0].exchange) : undefined,
        error: !hasMx ? "Domain does not exist or has no MX records" : undefined
      };
      memoryDnsCache.set(cleanDomain, { result, expiresAt: cachedDb.expiresAt.getTime() });
      return result;
    }
  } catch (e) {
    // If DB cache check fails, continue with live resolution
  }

  // 3. Perform DNS resolution
  try {
    const mxList = await dns.promises.resolveMx(cleanDomain);

    if (!mxList || mxList.length === 0) {
      // Check if domain at least has an A/AAAA record
      let domainExists = false;
      try {
        const aRecords = await dns.promises.resolve4(cleanDomain);
        domainExists = Array.isArray(aRecords) && aRecords.length > 0;
      } catch {
        domainExists = false;
      }

      const result: DnsCheckResult = {
        domainExists,
        hasMx: false,
        mxRecords: [],
        error: domainExists ? "Domain exists but has no MX records" : "Domain does not exist"
      };

      await cacheDomainResult(cleanDomain, result);
      return result;
    }

    // Sort by priority ascending (lowest number = highest priority)
    const sortedRecords: MxRecord[] = mxList
      .sort((a, b) => a.priority - b.priority)
      .map((r) => ({
        exchange: r.exchange.replace(/\.$/, ""), // normalize trailing dot
        priority: r.priority
      }));

    const result: DnsCheckResult = {
      domainExists: true,
      hasMx: sortedRecords.length > 0,
      mxRecords: sortedRecords,
      provider: sortedRecords.length > 0 ? detectProvider(sortedRecords[0].exchange) : undefined
    };

    await cacheDomainResult(cleanDomain, result);
    return result;
  } catch (err: any) {
    // Distinguish ENOTFOUND/NXDOMAIN/EBADNAME (domain doesn't exist) from ENODATA (domain exists but no MX)
    // and temporary server failures (ESERVFAIL/ETIMEDOUT/EREFUSED)
    const isTemporary =
      err.code === "ESERVFAIL" ||
      err.code === "ETIMEDOUT" ||
      err.code === "EREFUSED" ||
      err.code === "EAI_AGAIN" ||
      err.code === "EBUSY";

    const isNotFound =
      !isTemporary &&
      (err.code === "ENOTFOUND" ||
        err.code === "NXDOMAIN" ||
        err.code === "EBADNAME" ||
        (err.message && err.message.toLowerCase().includes("notfound")));
    const isNoMx = err.code === "ENODATA";

    const result: DnsCheckResult = {
      domainExists: !isNotFound && !isTemporary,
      hasMx: false,
      mxRecords: [],
      isTemporaryFailure: isTemporary,
      error: isTemporary
        ? `DNS server temporary failure (${err.code || err.message})`
        : isNotFound
        ? "Domain does not exist (NXDOMAIN)"
        : isNoMx
        ? "Domain has no MX records"
        : `DNS lookup failed: ${err.message || err.code}`
    };

    if (isNotFound || isNoMx) {
      await cacheDomainResult(cleanDomain, result);
    }

    return result;
  }
}

async function cacheDomainResult(domain: string, result: DnsCheckResult): Promise<void> {
  const expiresAt = new Date(Date.now() + (result.domainExists ? CACHE_TTL_MS : 5 * 60 * 1000));
  memoryDnsCache.set(domain, { result, expiresAt: expiresAt.getTime() });

  // Only persist real existing domains with MX records to database cache
  if (!result.domainExists || !result.hasMx) return;

  try {
    await prisma.emailDomainCache.upsert({
      where: { domain },
      create: {
        domain,
        mxRecordsJson: JSON.stringify(result.mxRecords),
        hasMx: result.hasMx,
        isCatchAll: false,
        expiresAt
      },
      update: {
        mxRecordsJson: JSON.stringify(result.mxRecords),
        hasMx: result.hasMx,
        expiresAt
      }
    });
  } catch (e) {
    // Non-fatal if DB cache write fails
  }
}

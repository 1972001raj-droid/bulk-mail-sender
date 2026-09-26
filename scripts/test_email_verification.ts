import { PrismaClient } from "@prisma/client";
import { normalizeEmail, validateEmailSyntax } from "../src/lib/verification/syntax";
import { resolveMxRecords, detectProvider, shouldSkipCatchAll } from "../src/lib/verification/dns";
import { isDisposableDomain } from "../src/lib/verification/disposable";
import { isRoleAccount } from "../src/lib/verification/roles";
import {
  isInvalidMailboxResponse,
  isFullInboxResponse,
  isDisabledAccountResponse,
  isBlockedOrBlacklistedResponse,
  isGreylistedOrTemporaryResponse
} from "../src/lib/verification/smtp";
import { verifyEmailAddress } from "../src/lib/verification/verifier";
import { VerificationJobEngine } from "../src/lib/verification/job-engine";

const prisma = new PrismaClient();

async function runVerificationTests() {
  console.log("====================================================");
  console.log("🧪 AEROSEND EMAIL VERIFICATION ENGINE TEST SUITE");
  console.log("====================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string) {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}`);
      failed++;
    }
  }

  // ==========================================
  // SUITE 1: Syntax Validation & Normalization
  // ==========================================
  console.log("\n--- SUITE 1: Syntax Validation & Normalization ---");

  // Normalization
  assert(normalizeEmail("  John.Doe@Example.COM  ") === "john.doe@example.com", "Normalizes whitespace and casing");

  // Valid emails
  const valid1 = validateEmailSyntax("alex.vance@aerosend.dev");
  assert(valid1.isValid && valid1.domain === "aerosend.dev" && valid1.localPart === "alex.vance", "Valid standard email");

  const valid2 = validateEmailSyntax("user+tag123@sub.domain.co.uk");
  assert(valid2.isValid && valid2.domain === "sub.domain.co.uk", "Valid subdomain and plus-tag email");

  // Invalid emails
  const invalid1 = validateEmailSyntax("plainaddress");
  assert(!invalid1.isValid, "Rejects email without @");

  const invalid2 = validateEmailSyntax("@missinglocal.com");
  assert(!invalid2.isValid, "Rejects email without local part");

  const invalid3 = validateEmailSyntax("user@.nodomain.com");
  assert(!invalid3.isValid, "Rejects domain starting with dot");

  const invalid4 = validateEmailSyntax("user..name@example.com");
  assert(!invalid4.isValid, "Rejects consecutive dots in local part");

  const invalid5 = validateEmailSyntax("user@domain..com");
  assert(!invalid5.isValid, "Rejects consecutive dots in domain");

  const invalid6 = validateEmailSyntax("user@com");
  assert(!invalid6.isValid, "Rejects domain without dot/TLD");

  // ==========================================
  // SUITE 2: Disposable & Role-Based Checks
  // ==========================================
  console.log("\n--- SUITE 2: Disposable & Role-Based Accounts ---");

  assert(isDisposableDomain("mailinator.com") === true, "Detects mailinator.com as disposable");
  assert(isDisposableDomain("temp-mail.org") === true, "Detects temp-mail.org as disposable");
  assert(isDisposableDomain("sub.trashmail.com") === true, "Detects disposable subdomain");
  assert(isDisposableDomain("gmail.com") === false, "Identifies gmail.com as non-disposable");

  assert(isRoleAccount("support") === true, "Identifies 'support' as role account");
  assert(isRoleAccount("admin") === true, "Identifies 'admin' as role account");
  assert(isRoleAccount("billing-dept") === true, "Identifies 'billing-dept' as role account");
  assert(isRoleAccount("sales.team") === true, "Identifies 'sales.team' as role account");
  assert(isRoleAccount("alex.vance") === false, "Identifies personal mailbox as non-role");

  // ==========================================
  // SUITE 3: DNS & MX Records Resolution
  // ==========================================
  console.log("\n--- SUITE 3: DNS / MX Resolution & Provider Detection ---");

  // Provider detection
  assert(detectProvider("aspmx.l.google.com") === "Google Workspace / Gmail", "Detects Google MX host");
  assert(detectProvider("mail.protection.outlook.com") === "Microsoft 365 / Outlook (B2B)", "Detects Microsoft 365 B2B host");
  assert(detectProvider("mta7.am0.yahoodns.net") === "Yahoo Mail", "Detects Yahoo MX host");

  // Catch-all skip rule
  assert(shouldSkipCatchAll("gmail.com", "aspmx.l.google.com") === true, "Skips catch-all probe for gmail.com");
  assert(shouldSkipCatchAll("yahoo.com", "mta.yahoodns.net") === true, "Skips catch-all probe for yahoo.com");
  assert(shouldSkipCatchAll("acmecorp.io", "mail.acmecorp.io") === false, "Allows catch-all probe for standard business domain");

  // Live MX lookup on known public domains
  const googleDns = await resolveMxRecords("google.com");
  assert(googleDns.hasMx && googleDns.mxRecords.length > 0, "Resolves real MX records for google.com");
  assert(googleDns.provider?.includes("Google") === true, "Identifies Google provider from MX lookup");

  // Non-existent domain
  const nonExistentDns = await resolveMxRecords("this-domain-definitely-does-not-exist-987123654.invalid");
  assert(!nonExistentDns.domainExists, "Identifies non-existent domain as NXDOMAIN");

  // ==========================================
  // SUITE 4: SMTP Parser Heuristics (check-if-email-exists patterns)
  // ==========================================
  console.log("\n--- SUITE 4: SMTP Error Parser Heuristics ---");

  assert(
    isInvalidMailboxResponse("550 5.1.1 <foo@bar.com>: Recipient address rejected: User unknown in virtual mailbox table", "foo@bar.com") === true,
    "Identifies 550 User Unknown as invalid mailbox"
  );
  assert(
    isInvalidMailboxResponse("550 No such user here", "test@domain.com") === true,
    "Identifies 'No such user here' as invalid mailbox"
  );
  assert(
    isInvalidMailboxResponse("554 delivery error: This user doesn't have an account", "user@test.com") === true,
    "Identifies 'doesn't have an account' as invalid mailbox"
  );
  assert(
    isInvalidMailboxResponse("550 5.1.1 Mailbox not found", "user@test.com") === true,
    "Identifies 'Mailbox not found' as invalid mailbox"
  );

  assert(
    isFullInboxResponse("452 4.2.2 The recipient's inbox is out of storage space") === true,
    "Identifies full inbox / quota exceeded response"
  );

  assert(
    isDisabledAccountResponse("554 The email account that you tried to reach is disabled") === true,
    "Identifies disabled/discontinued account"
  );

  assert(
    isBlockedOrBlacklistedResponse("550 5.7.1 Service unavailable; Client host [x.x.x.x] is blocked using Spamhaus") === true,
    "Identifies Spamhaus / RBL IP blacklist"
  );

  assert(
    isGreylistedOrTemporaryResponse("451 4.7.1 Greylisting in action, please come back later", 451) === true,
    "Identifies greylisting temporary deferral"
  );

  // ==========================================
  // SUITE 5: Verifier Pipeline & Classification
  // ==========================================
  console.log("\n--- SUITE 5: Full Verifier Pipeline & Classification ---");

  // Syntax invalid email
  const vSyntax = await verifyEmailAddress("invalid-no-at-sign");
  assert(vSyntax.status === "INVALID" && vSyntax.reason === "INVALID_SYNTAX", "Classifies bad syntax as INVALID (INVALID_SYNTAX)");

  // Non-existent domain
  const vDomain = await verifyEmailAddress("someone@non-existent-random-domain-1234567.org");
  assert(vDomain.status === "INVALID" && vDomain.reason === "DOMAIN_NOT_FOUND", "Classifies non-existent domain as INVALID (DOMAIN_NOT_FOUND)");

  // Disposable domain with valid syntax
  const vDisposable = await verifyEmailAddress("testuser@mailinator.com");
  assert(
    vDisposable.status === "RISKY" || vDisposable.status === "UNKNOWN",
    "Classifies disposable email as RISKY or UNKNOWN (never SAFE)"
  );

  // Role account on real domain
  const vRole = await verifyEmailAddress("support@google.com");
  assert(
    vRole.status === "RISKY" || vRole.status === "UNKNOWN",
    "Classifies role account as RISKY or UNKNOWN (never false SAFE)"
  );

  // ==========================================
  // SUITE 6: Database Persistence & Cache
  // ==========================================
  console.log("\n--- SUITE 6: Database Contact Verification Caching ---");

  const org = await prisma.organization.findFirst();
  if (!org) throw new Error("Organization not found in test db");

  const testEmail = `cached_contact_${Date.now()}@aerosend.dev`;
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  // Create a contact with existing SAFE verification status
  await prisma.contact.create({
    data: {
      organizationId: org.id,
      email: testEmail,
      status: "ACTIVE",
      verificationStatus: "SAFE",
      verificationReason: "SMTP_ACCEPTED",
      verificationCheckedAt: new Date(),
      verificationExpiresAt: expiresAt,
      verificationMetadata: JSON.stringify({ cachedTest: true })
    }
  });

  // Verify email with organizationId provided (should hit cache)
  const cachedCheck = await verifyEmailAddress(testEmail, org.id);
  assert(cachedCheck.cached === true, "Successfully retrieved result from contact database cache");
  assert(cachedCheck.status === "SAFE", "Cached contact preserves SAFE status");

  // ==========================================
  // SUITE 7: Bulk Asynchronous Verification Job Engine
  // ==========================================
  console.log("\n--- SUITE 7: Bulk Asynchronous Verification Job & Deduplication ---");

  const sampleCsvRows = [
    { email: "john@example.com", name: "John", company: "Acme" },
    { email: "john@example.com", name: "John Duplicate", company: "Acme" }, // duplicate
    { email: "invalid-syntax@", name: "Bad", company: "Test" },
    { email: "admin@mailinator.com", name: "Disposable Role", company: "Throwaway" }
  ];

  const mappings = { email: "email", firstName: "name", company: "company" };

  const job = await prisma.emailVerificationJob.create({
    data: {
      organizationId: org.id,
      status: "PENDING",
      total: sampleCsvRows.length,
      mappingsJson: JSON.stringify(mappings)
    }
  });

  // Start job
  await VerificationJobEngine.startJob(job.id, org.id, sampleCsvRows, mappings, undefined, "Verified Audience List");

  // Wait for background job to finish
  let progress = await VerificationJobEngine.getJobProgress(job.id, org.id);
  let waitCount = 0;
  while (progress?.status === "PROCESSING" && waitCount < 30) {
    await new Promise((r) => setTimeout(r, 500));
    progress = await VerificationJobEngine.getJobProgress(job.id, org.id);
    waitCount++;
  }

  assert(progress?.status === "COMPLETED", "VerificationJobEngine completes asynchronous bulk job");
  assert(progress?.total === 3, "Deduplication reduces 4 input rows with duplicate email to 3 unique checks");
  assert(progress?.processed === 3, "All unique emails in batch processed");

  // Verify records were saved
  const savedRecords = await prisma.emailVerificationRecord.findMany({
    where: { jobId: job.id }
  });
  assert(savedRecords.length === 4, "All original 4 rows preserved in verification records for audit/export");

  // Test Commit with Policy
  const commitResult = await VerificationJobEngine.commitImport(
    job.id,
    org.id,
    "ALL",
    undefined,
    `Committed Test List ${Date.now()}`
  );

  assert(commitResult.importedCount > 0, "VerificationJobEngine.commitImport successfully adds contacts to database");
  assert(commitResult.listId !== undefined, "VerificationJobEngine.commitImport links contacts to target audience list");

  // Check committed contact verification fields
  const importedContact = await prisma.contact.findFirst({
    where: { organizationId: org.id, email: "invalid-syntax@" }
  });
  assert(importedContact !== null, "Imported contact exists in database");
  assert(importedContact?.verificationStatus === "INVALID", "Imported contact stores verificationStatus");
  assert(importedContact?.verificationReason === "INVALID_SYNTAX", "Imported contact stores verificationReason");
  assert(importedContact?.verificationCheckedAt !== null, "Imported contact stores verificationCheckedAt");

  console.log("\n====================================================");
  console.log(`🏁 TESTS FINISHED: ${passed} PASSED, ${failed} FAILED`);
  console.log("====================================================\n");

  if (failed > 0) process.exit(1);
}

runVerificationTests()
  .catch((e) => {
    console.error("Test execution error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

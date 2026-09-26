import { PrismaClient } from "@prisma/client";
import { isRoleAccount } from "../src/lib/verification/roles";
import { isDisposableDomain } from "../src/lib/verification/disposable";
import { verifyEmailAddress } from "../src/lib/verification/verifier";
import { VerificationJobEngine } from "../src/lib/verification/job-engine";

const prisma = new PrismaClient();

async function runRiskyTestSuite() {
  console.log("================================================================================");
  console.log("⚠️  TESTING 'RISKY' EMAIL CLASSIFICATION & WORKFLOW");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, title: string, details?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${title}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${title}${details ? ` -> ${details}` : ""}`);
      failed++;
    }
  }

  // 1. Test Role Account Detection
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("1. Role-Based Account Detection (Generic / Shared Mailboxes)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const rolePrefixesToTest = [
    "support",
    "admin",
    "billing",
    "sales",
    "info",
    "contact",
    "help",
    "marketing",
    "office",
    "team",
    "careers",
    "hr",
    "media",
    "press",
    "inquiries"
  ];

  for (const prefix of rolePrefixesToTest) {
    assert(isRoleAccount(prefix) === true, `Detects '${prefix}' as role account`);
  }

  // Sub-addressing / plus tags & compound roles
  assert(isRoleAccount("support+urgent") === true, "Detects 'support+urgent' as role account (plus-tag)");
  assert(isRoleAccount("admin_help") === true, "Detects 'admin_help' as role account (underscore)");
  assert(isRoleAccount("sales.team") === true, "Detects 'sales.team' as role account (dot)");
  assert(isRoleAccount("billing-dept") === true, "Detects 'billing-dept' as role account (hyphen)");

  // Personal names should NOT be role accounts
  assert(isRoleAccount("alex.miller") === false, "'alex.miller' is NOT a role account");
  assert(isRoleAccount("rajesh.kumar") === false, "'rajesh.kumar' is NOT a role account");
  assert(isRoleAccount("1972001raj") === false, "'1972001raj' is NOT a role account");

  // 2. Test Disposable Domain Detection
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("2. Disposable / Burner Email Detection");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const disposableDomainsToTest = [
    "mailinator.com",
    "tempmail.com",
    "guerrillamail.com",
    "10minutemail.com",
    "trashmail.com",
    "yopmail.com",
    "sharklasers.com",
    "dispostable.com"
  ];

  for (const domain of disposableDomainsToTest) {
    assert(isDisposableDomain(domain) === true, `Detects '${domain}' as disposable domain`);
  }

  // Standard domains should NOT be disposable
  assert(isDisposableDomain("gmail.com") === false, "'gmail.com' is NOT disposable");
  assert(isDisposableDomain("iattechnologies.com") === false, "'iattechnologies.com' is NOT disposable");
  assert(isDisposableDomain("outlook.com") === false, "'outlook.com' is NOT disposable");

  // 3. Live verifyEmailAddress classification for RISKY emails
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("3. Live Verification Classification for RISKY Emails");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Test live role email on real domain
  const resRole = await verifyEmailAddress("support@google.com", undefined, true);
  assert(
    resRole.status === "RISKY" && resRole.reason === "ROLE_ACCOUNT",
    "Live check 'support@google.com' => RISKY (ROLE_ACCOUNT)",
    `Got status: ${resRole.status}, reason: ${resRole.reason}`
  );

  const resAdmin = await verifyEmailAddress("admin@google.com", undefined, true);
  assert(
    resAdmin.status === "RISKY" && resAdmin.reason === "ROLE_ACCOUNT",
    "Live check 'admin@google.com' => RISKY (ROLE_ACCOUNT)",
    `Got status: ${resAdmin.status}, reason: ${resAdmin.reason}`
  );

  const resBilling = await verifyEmailAddress("billing@google.com", undefined, true);
  assert(
    resBilling.status === "RISKY" && resBilling.reason === "ROLE_ACCOUNT",
    "Live check 'billing@google.com' => RISKY (ROLE_ACCOUNT)",
    `Got status: ${resBilling.status}, reason: ${resBilling.reason}`
  );

  // Test live disposable email on real domain
  const resDisposable = await verifyEmailAddress("random_user_99182@mailinator.com", undefined, true);
  assert(
    resDisposable.status === "RISKY" && resDisposable.reason === "DISPOSABLE_EMAIL",
    "Live check 'random_user_99182@mailinator.com' => RISKY (DISPOSABLE_EMAIL)",
    `Got status: ${resDisposable.status}, reason: ${resDisposable.reason}`
  );

  // 4. CSV Import Job with a mix of SAFE, RISKY, and INVALID
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("4. CSV Import Verification Job: Live RISKY Counter Verification");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  let org = await prisma.organization.findFirst();
  if (!org) {
    org = await prisma.organization.create({
      data: { name: "Test Org", slug: `test-org-${Date.now()}` }
    });
  }

  const csvWithRisky = [
    { email: "alex.miller.9812@gmail.com", name: "Alex (Safe)" },
    { email: "support@google.com", name: "Support Team (Risky - Role)" },
    { email: "sales@google.com", name: "Sales Team (Risky - Role)" },
    { email: "burner12345@mailinator.com", name: "Disposable (Risky - Disposable)" },
    { email: "fake@definitely-nonexistent-domain-876123.org", name: "Bad Domain (Invalid)" }
  ];

  const mappings = { email: "email", firstName: "name" };

  const job = await prisma.emailVerificationJob.create({
    data: {
      organizationId: org.id,
      status: "PENDING",
      total: csvWithRisky.length,
      targetListName: "Risky Test Audience List",
      mappingsJson: JSON.stringify(mappings)
    }
  });

  await VerificationJobEngine.startJob(
    job.id,
    org.id,
    csvWithRisky,
    mappings,
    undefined,
    "Risky Test Audience List"
  );

  let progress = await VerificationJobEngine.getJobProgress(job.id, org.id);
  let attempts = 0;
  while (progress?.status === "PROCESSING" && attempts < 30) {
    await new Promise((r) => setTimeout(r, 400));
    progress = await VerificationJobEngine.getJobProgress(job.id, org.id);
    attempts++;
  }

  assert(progress?.status === "COMPLETED", "CSV verification job completed");
  assert(progress?.total === 5, "Total unique emails: 5");
  assert(progress?.processed === 5, "Processed unique emails: 5");
  assert(progress?.safeCount === 1, `SAFE count: ${progress?.safeCount} (expected 1: alex.miller.9812@gmail.com)`);
  assert(progress?.riskyCount === 3, `RISKY count: ${progress?.riskyCount} (expected 3: 2 role + 1 disposable)`);
  assert(progress?.invalidCount === 1, `INVALID count: ${progress?.invalidCount} (expected 1: non-existent domain)`);

  console.log(`\n  📊 VERIFIED COUNTS MATCH EXPECTATIONS:`);
  console.log(`     🟢 SAFE:    ${progress?.safeCount}`);
  console.log(`     🟡 RISKY:   ${progress?.riskyCount} (Detected accurately!)`);
  console.log(`     🔴 INVALID: ${progress?.invalidCount}`);
  console.log(`     ⚪ UNKNOWN: ${progress?.unknownCount}`);

  // Test that commitImport allows user to include or exclude RISKY:
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("5. Commit Policies for RISKY Emails");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Policy A: SAFE only -> imports only 1 contact
  const commitSafeOnly = await VerificationJobEngine.commitImport(
    job.id,
    org.id,
    "SAFE",
    undefined,
    `Safe Only List ${Date.now()}`
  );
  assert(commitSafeOnly.importedCount === 1, "SAFE policy imports ONLY safe emails (1)");
  assert(commitSafeOnly.skippedCount === 4, "SAFE policy skips all risky and invalid emails (4)");

  // Policy B: SAFE + RISKY -> imports 4 contacts (1 safe + 3 risky)
  const commitSafeRisky = await VerificationJobEngine.commitImport(
    job.id,
    org.id,
    "SAFE_RISKY",
    undefined,
    `Safe and Risky List ${Date.now()}`
  );
  assert(commitSafeRisky.importedCount === 4, "SAFE_RISKY policy imports both safe and risky emails (4)");
  assert(commitSafeRisky.skippedCount === 1, "SAFE_RISKY policy skips invalid emails (1)");

  // Clean up test data
  if (commitSafeOnly.listId) {
    await prisma.contactListMember.deleteMany({ where: { listId: commitSafeOnly.listId } });
    await prisma.contactList.delete({ where: { id: commitSafeOnly.listId } });
  }
  if (commitSafeRisky.listId) {
    await prisma.contactListMember.deleteMany({ where: { listId: commitSafeRisky.listId } });
    await prisma.contactList.delete({ where: { id: commitSafeRisky.listId } });
  }
  await prisma.emailVerificationRecord.deleteMany({ where: { jobId: job.id } });
  await prisma.emailVerificationJob.delete({ where: { id: job.id } });
  await prisma.contact.deleteMany({
    where: {
      organizationId: org.id,
      email: {
        in: [
          "alex.miller.9812@gmail.com",
          "support@google.com",
          "sales@google.com",
          "burner12345@mailinator.com",
          "fake@definitely-nonexistent-domain-876123.org"
        ]
      }
    }
  });

  console.log("\n================================================================================");
  console.log(`🏁 RISKY TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================\n");

  if (failed > 0) process.exit(1);
}

runRiskyTestSuite()
  .catch((err) => {
    console.error("FATAL ERROR:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

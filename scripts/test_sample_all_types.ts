import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { VerificationJobEngine } from "../src/lib/verification/job-engine";

const prisma = new PrismaClient();

async function main() {
  console.log("================================================================================");
  console.log("🧪 TESTING SAMPLE CSV WITH ALL 4 CATEGORIES (SAFE, RISKY, INVALID, UNKNOWN)");
  console.log("================================================================================\n");

  const csvPath = path.join(process.cwd(), "sample_all_verification_types.csv");
  const rawContent = fs.readFileSync(csvPath, "utf-8");
  const lines = rawContent.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim());

  const rows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: any = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });
    rows.push(row);
  }

  console.log(`Loaded ${rows.length} contacts from sample_all_verification_types.csv:\n`);
  rows.forEach((r, i) => console.log(`  ${i + 1}. ${r.Email} (${r["First Name"]} ${r["Last Name"]}, ${r.Company})`));

  let org = await prisma.organization.findFirst();
  if (!org) {
    org = await prisma.organization.create({
      data: { name: "Test Org", slug: `test-org-${Date.now()}` }
    });
  }

  const mappings = {
    email: "Email",
    firstName: "First Name",
    lastName: "Last Name",
    company: "Company",
    title: "Title",
    phone: "Phone",
    city: "City"
  };

  const listName = `All Categories Test List ${Date.now()}`;

  // Create verification job
  const job = await prisma.emailVerificationJob.create({
    data: {
      organizationId: org.id,
      status: "PENDING",
      total: rows.length,
      targetListName: listName,
      mappingsJson: JSON.stringify(mappings)
    }
  });

  console.log(`\nStarting VerificationJob ${job.id}...`);
  await VerificationJobEngine.startJob(
    job.id,
    org.id,
    rows,
    mappings,
    undefined,
    listName
  );

  // Poll progress until completion
  let progress = await VerificationJobEngine.getJobProgress(job.id, org.id);
  let pollAttempts = 0;
  while (progress?.status === "PROCESSING" && pollAttempts < 60) {
    await new Promise((r) => setTimeout(r, 500));
    progress = await VerificationJobEngine.getJobProgress(job.id, org.id);
    pollAttempts++;
    if (pollAttempts % 4 === 0) {
      console.log(`  ... [Progress ${progress?.percent}%] ${progress?.processed} / ${progress?.total} verified`);
    }
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 JOB PROGRESS & TAB COUNTERS:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  🟢 SAFE:    ${progress?.safeCount}`);
  console.log(`  🟡 RISKY:   ${progress?.riskyCount}`);
  console.log(`  🔴 INVALID: ${progress?.invalidCount}`);
  console.log(`  ⚪ UNKNOWN: ${progress?.unknownCount}`);
  console.log(`  TOTAL:      ${progress?.total}`);

  // Fetch individual records to inspect category mappings
  const records = await prisma.emailVerificationRecord.findMany({
    where: { jobId: job.id }
  });

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 CATEGORIZED RECORDS (Matching UI Filter Tabs):");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const safeRecords = records.filter((r) => r.status === "SAFE");
  const riskyRecords = records.filter((r) => r.status === "RISKY");
  const invalidRecords = records.filter((r) => r.status === "INVALID");
  const unknownRecords = records.filter((r) => r.status === "UNKNOWN");

  console.log("\n[Tab: SAFE]");
  safeRecords.forEach((r) => console.log(`  ✅ ${r.email} => ${r.status} (${r.reason})`));

  console.log("\n[Tab: RISKY]");
  riskyRecords.forEach((r) => console.log(`  ⚠️  ${r.email} => ${r.status} (${r.reason})`));

  console.log("\n[Tab: INVALID]");
  invalidRecords.forEach((r) => console.log(`  ❌ ${r.email} => ${r.status} (${r.reason})`));

  console.log("\n[Tab: UNKNOWN]");
  unknownRecords.forEach((r) => console.log(`  ❓ ${r.email} => ${r.status} (${r.reason})`));

  // Assertions
  let passed = 0;
  let failed = 0;
  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`\n  ✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`\n  ❌ [FAIL] ${msg}`);
      failed++;
    }
  }

  assert(safeRecords.length >= 2, `SAFE tab has at least 2 records (actual: ${safeRecords.length})`);
  assert(riskyRecords.length >= 2, `RISKY tab has at least 2 records (actual: ${riskyRecords.length})`);
  assert(invalidRecords.length >= 2, `INVALID tab has at least 2 records (actual: ${invalidRecords.length})`);
  assert(unknownRecords.length >= 2, `UNKNOWN tab has at least 2 records (actual: ${unknownRecords.length})`);

  // Test commit with SAFE_RISKY_UNKNOWN
  const commit = await VerificationJobEngine.commitImport(
    job.id,
    org.id,
    "SAFE_RISKY_UNKNOWN",
    undefined,
    listName
  );

  assert(commit.importedCount === 6, `Imported exactly 6 non-invalid contacts (Safe: 2, Risky: 2, Unknown: 2)`);
  assert(commit.skippedCount === 2, `Skipped exactly 2 invalid contacts`);

  // Clean up test data
  if (commit.listId) {
    await prisma.contactListMember.deleteMany({ where: { listId: commit.listId } });
    await prisma.contactList.delete({ where: { id: commit.listId } });
  }
  await prisma.emailVerificationRecord.deleteMany({ where: { jobId: job.id } });
  await prisma.emailVerificationJob.delete({ where: { id: job.id } });
  await prisma.contact.deleteMany({
    where: {
      organizationId: org.id,
      email: {
        in: rows.map((r) => r.Email.toLowerCase().trim())
      }
    }
  });

  console.log("\n================================================================================");
  console.log(`🏁 TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================\n");

  if (failed > 0) process.exit(1);
}

main()
  .catch((err) => {
    console.error("FATAL ERROR:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

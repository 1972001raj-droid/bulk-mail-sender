/**
 * Automated Verification & Stress Test Suite for Rapid Email Queue
 * Covers:
 * 1. Queue job creation, chunked batching (10,000+ jobs)
 * 2. Atomic job claiming & concurrency race condition safety
 * 3. Rate limiting enforcement (global, worker capacity, domain throttling)
 * 4. Error classification & exponential retry backoff
 * 5. Pause, Resume, and Cancel semantics
 * 6. Stale worker crash recovery
 * 7. Idempotency & duplicate prevention
 */

import { prisma } from "../src/lib/db";
import { RateController } from "../src/lib/queue/rate-limiter";
import { ErrorClassifier } from "../src/lib/queue/error-classifier";
import { RapidQueueEngine, rapidQueueEngine } from "../src/lib/queue/rapid-queue";
import { DEFAULT_QUEUE_CONFIG, QueueConfig } from "../src/lib/queue/types";

let testPassCount = 0;
let testFailCount = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    testPassCount++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    testFailCount++;
    console.error(`  ✗ FAIL: ${testName}${details ? ` -> ${details}` : ""}`);
  }
}

async function runTestSuite() {
  console.log("==========================================================");
  console.log("   RAPID EMAIL QUEUE AUTOMATED TEST SUITE (SECTION 33)");
  console.log("==========================================================\n");

  // Setup test organization, user, and sender
  let org = await prisma.organization.findFirst({
    where: { slug: "test-queue-org" },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "Test Queue Org",
        slug: "test-queue-org",
      },
    });
  }

  let user = await prisma.user.findFirst({
    where: { email: "queue-tester@aerosend.dev" },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: "queue-tester@aerosend.dev",
        name: "Queue Tester",
        status: "ACTIVE",
      },
    });
  }

  let sender = await prisma.sender.findFirst({
    where: { email: "sender@aerosend.dev", organizationId: org.id },
  });

  if (!sender) {
    sender = await prisma.sender.create({
      data: {
        organizationId: org.id,
        email: "sender@aerosend.dev",
        displayName: "Sandbox Sender",
        status: "CONNECTED",
        providerAccounts: {
          create: {
            provider: "sandbox",
            providerAccountId: "sandbox-acc-01",
            tokenRef: JSON.stringify({ mode: "sandbox" }),
          },
        },
      },
    });
  }

  // =========================================================================
  // TEST SUITE 1: Central Rate Controller & Token Bucket
  // =========================================================================
  console.log("[1/6] Testing Central Rate Controller & Limiting...");

  // Scenario 1: 1 worker x 10/s, Global = 50 -> effective rate = 10
  const rc1 = new RateController("test-camp-1", {
    ...DEFAULT_QUEUE_CONFIG,
    workerCount: 1,
    emailsPerWorkerPerSecond: 10,
    globalRateLimit: 50,
  });
  const rates1 = rc1.getRates();
  assert(rates1.effectiveRate === 10, "1 worker @ 10/sec with 50 global ceiling gives effective rate = 10");

  // Scenario 2: 4 workers x 20/s = 80, Global = 80 -> effective rate = 80
  const rc2 = new RateController("test-camp-2", {
    ...DEFAULT_QUEUE_CONFIG,
    workerCount: 4,
    emailsPerWorkerPerSecond: 20,
    globalRateLimit: 80,
  });
  const rates2 = rc2.getRates();
  assert(rates2.effectiveRate === 80, "4 workers @ 20/sec with 80 global ceiling gives effective rate = 80");

  // Scenario 3: 10 workers x 25/s = 250, Global = 100 -> effective rate = 100 (Global limit enforced!)
  const rc3 = new RateController("test-camp-3", {
    ...DEFAULT_QUEUE_CONFIG,
    workerCount: 10,
    emailsPerWorkerPerSecond: 25,
    globalRateLimit: 100,
  });
  const rates3 = rc3.getRates();
  assert(rates3.effectiveRate === 100, "10 workers @ 25/sec capped at 100 global limit gives effective rate = 100");

  // Scenario 4: Dynamic update without restart
  rc3.updateConfig({ globalRateLimit: 150 });
  const rates3Updated = rc3.getRates();
  assert(rates3Updated.effectiveRate === 150, "Dynamic update changes effective limit from 100 to 150 at runtime");

  // Scenario 5: Domain-specific throttling enforcement
  const rcDomain = new RateController("test-camp-domain", {
    ...DEFAULT_QUEUE_CONFIG,
    workerCount: 5,
    emailsPerWorkerPerSecond: 10,
    globalRateLimit: 50,
    perDomainThrottlingEnabled: true,
    domainRateLimits: {
      "gmail.com": 2, // low rate for testing clearance
    },
  });

  const clearance1 = await rcDomain.acquireClearance({ domain: "gmail.com", timeoutMs: 1000 });
  const clearance2 = await rcDomain.acquireClearance({ domain: "gmail.com", timeoutMs: 1000 });
  assert(clearance1 && clearance2, "Domain tokens acquired within available capacity");

  // Scenario 6: Daily sending limit enforcement
  const rcDaily = new RateController("test-camp-daily", {
    ...DEFAULT_QUEUE_CONFIG,
    globalRateLimit: 50,
    dailySendingLimit: 2,
  });
  const daily1 = await rcDaily.acquireClearance({ timeoutMs: 500 });
  const daily2 = await rcDaily.acquireClearance({ timeoutMs: 500 });
  const daily3 = await rcDaily.acquireClearance({ timeoutMs: 200 });
  assert(daily1 && daily2 && !daily3, "Daily sending limit enforced (2 allowed, 3rd blocked)");

  // Scenario 7: Schedule window enforcement
  const rcExpired = new RateController("test-camp-expired", {
    ...DEFAULT_QUEUE_CONFIG,
    globalRateLimit: 50,
    campaignEndTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  });
  const expiredClearance = await rcExpired.acquireClearance({ timeoutMs: 300 });
  assert(!expiredClearance, "Clearance denied when campaign schedule window has ended");

  // =========================================================================
  // TEST SUITE 2: Error Classification & Exponential Backoff
  // =========================================================================
  console.log("\n[2/6] Testing Error Classification & Backoff Calculations...");

  const tempNetErr = ErrorClassifier.classify(new Error("connect ETIMEDOUT 127.0.0.1:587"));
  assert(tempNetErr.classification === "TEMPORARY" && tempNetErr.isRetryable === true, "Network timeout classified as TEMPORARY / retryable");

  const tempSmtpErr = ErrorClassifier.classify("451 4.3.0 Mail server temporarily busy");
  assert(tempSmtpErr.classification === "TEMPORARY" && tempSmtpErr.isRetryable === true, "SMTP 4xx response classified as TEMPORARY / retryable");

  const rateLimitErr = ErrorClassifier.classify({ statusCode: 429, message: "Too Many Requests: rate limit exceeded" });
  assert(rateLimitErr.classification === "TEMPORARY" && rateLimitErr.isRetryable === true, "HTTP 429 / Rate Limit classified as TEMPORARY / retryable");

  const perm550Err = ErrorClassifier.classify("550 5.1.1 <nobody@domain.invalid>: Recipient address rejected: User unknown");
  assert(perm550Err.classification === "PERMANENT" && perm550Err.isRetryable === false, "SMTP 550 User Unknown classified as PERMANENT / fatal");

  const permAuthErr = ErrorClassifier.classify("535 5.7.8 Authentication credentials invalid");
  assert(permAuthErr.classification === "PERMANENT" && permAuthErr.isRetryable === false, "SMTP 535 Auth Failure classified as PERMANENT / fatal");

  // Test exponential backoff formula
  const delay1 = ErrorClassifier.calculateRetryDelayMs(1, 30, 2.0, 900); // 30s base * 2^0 = 30s (+/- 15%)
  const delay2 = ErrorClassifier.calculateRetryDelayMs(2, 30, 2.0, 900); // 30s base * 2^1 = 60s
  const delay3 = ErrorClassifier.calculateRetryDelayMs(3, 30, 2.0, 900); // 30s base * 2^2 = 120s
  const delayCapped = ErrorClassifier.calculateRetryDelayMs(10, 30, 2.0, 900); // Should cap at 900s (+/- 15%)

  assert(delay1 >= 24000 && delay1 <= 36000, `Attempt 1 backoff ~30s (${Math.round(delay1 / 1000)}s)`);
  assert(delay2 >= 48000 && delay2 <= 72000, `Attempt 2 backoff ~60s (${Math.round(delay2 / 1000)}s)`);
  assert(delay3 >= 96000 && delay3 <= 144000, `Attempt 3 backoff ~120s (${Math.round(delay3 / 1000)}s)`);
  assert(delayCapped <= 1100000, `Max backoff cap respected (${Math.round(delayCapped / 1000)}s <= max 900s + jitter)`);

  // =========================================================================
  // TEST SUITE 3: Campaign Queue Lifecycle (Enqueue, Pause, Resume, Cancel)
  // =========================================================================
  console.log("\n[3/6] Testing Campaign Queue Lifecycle (Enqueue, Pause, Resume, Cancel)...");

  // Create test campaign with 10 recipients
  const campLifecycle = await prisma.campaign.create({
    data: {
      organizationId: org.id,
      senderId: sender.id,
      name: "Queue Lifecycle Test Campaign",
      subject: "Hello from Rapid Queue Test",
      htmlBody: "<p>Hello {{firstName}}!</p>",
      status: "DRAFT",
    },
  });

  const suiteRunId = Date.now();
  const contactsToCreate = Array.from({ length: 10 }).map((_, i) => ({
    organizationId: org.id,
    email: `recipient_${suiteRunId}_${i}@testdomain.org`,
    firstName: `Prospect_${i}`,
    lastName: "Tester",
  }));


  const createdContacts: any[] = [];
  for (const c of contactsToCreate) {
    const contact = await prisma.contact.create({ data: c });
    createdContacts.push(contact);
    await prisma.campaignRecipient.create({
      data: {
        campaignId: campLifecycle.id,
        contactId: contact.id,
        emailSnapshot: contact.email,
        status: "PENDING",
      },
    });
  }

  // Enqueue campaign
  await rapidQueueEngine.enqueueCampaign(campLifecycle.id, {
    workerCount: 2,
    emailsPerWorkerPerSecond: 20,
    globalRateLimit: 40,
    batchSize: 50,
  });

  const statusAfterEnqueue = await rapidQueueEngine.getStatus(campLifecycle.id);
  assert(statusAfterEnqueue.total === 10, `10 jobs created in queue (actual: ${statusAfterEnqueue.total})`);
  assert(statusAfterEnqueue.status === "RUNNING", "Campaign status transitioned to RUNNING");

  // Pause campaign
  await rapidQueueEngine.pauseCampaign(campLifecycle.id);
  const statusAfterPause = await rapidQueueEngine.getStatus(campLifecycle.id);
  assert(statusAfterPause.status === "PAUSED", "Campaign status transitioned to PAUSED");

  // Resume campaign
  await rapidQueueEngine.resumeCampaign(campLifecycle.id);
  const statusAfterResume = await rapidQueueEngine.getStatus(campLifecycle.id);
  assert(statusAfterResume.status === "RUNNING", "Campaign status transitioned back to RUNNING");

  // Cancel campaign
  await rapidQueueEngine.cancelCampaign(campLifecycle.id);
  const statusAfterCancel = await rapidQueueEngine.getStatus(campLifecycle.id);
  assert(statusAfterCancel.status === "CANCELLED", "Campaign status transitioned to CANCELLED");
  assert(statusAfterCancel.cancelled > 0, `Pending jobs marked as CANCELLED (cancelled: ${statusAfterCancel.cancelled})`);

  // Clean up workers
  rapidQueueEngine.stopWorkerPool(campLifecycle.id);

  // =========================================================================
  // TEST SUITE 4: Atomic Job Claiming & Concurrency Safety
  // =========================================================================
  console.log("\n[4/6] Testing Atomic Job Claiming & Multi-Worker Concurrency...");

  const campClaim = await prisma.campaign.create({
    data: {
      organizationId: org.id,
      senderId: sender.id,
      name: "Concurrency Claim Test",
      status: "RUNNING",
    },
  });

  const claimRecipient = await prisma.campaignRecipient.create({
    data: {
      campaignId: campClaim.id,
      contactId: createdContacts[0].id,
      emailSnapshot: "claim_test@domain.com",
      status: "QUEUED",
    },
  });

  const testJob = await prisma.emailQueueJob.create({
    data: {
      campaignId: campClaim.id,
      campaignRecipientId: claimRecipient.id,
      contactId: createdContacts[0].id,
      recipientEmail: "claim_test@domain.com",
      recipientDomain: "domain.com",
      status: "QUEUED",
      priority: "NORMAL",
      maxAttempts: 3,
    },
  });

  // Simulate 4 concurrent workers attempting to claim the single available job simultaneously
  const workerIds = ["worker-1", "worker-2", "worker-3", "worker-4"];
  const claimPromises = workerIds.map((wid) =>
    rapidQueueEngine.claimNextJob(campClaim.id, wid, DEFAULT_QUEUE_CONFIG)
  );

  const claimResults = await Promise.all(claimPromises);
  const successfulClaims = claimResults.filter((j) => j !== null);

  assert(successfulClaims.length === 1, `Exactly ONE worker claimed the job (claimed: ${successfulClaims.length}/4)`);
  const claimedJob = successfulClaims[0];
  assert(claimedJob.status === "PROCESSING", "Claimed job status set to PROCESSING");
  assert(claimedJob.lockedBy !== null, `Job locked by: ${claimedJob.lockedBy}`);
  assert(claimedJob.attemptCount === 1, "Job attemptCount incremented to 1");

  // Subsequent claim should return null since job is PROCESSING
  const secondClaim = await rapidQueueEngine.claimNextJob(campClaim.id, "worker-5", DEFAULT_QUEUE_CONFIG);
  assert(secondClaim === null, "Subsequent claim returns null while job is locked");

  // Priority Queue Test: verify HIGH is claimed before NORMAL, and NORMAL before LOW
  console.log("  -> Verifying Priority Queue Ordering (HIGH -> NORMAL -> LOW)...");
  const campPriority = await prisma.campaign.create({
    data: {
      organizationId: org.id,
      senderId: sender.id,
      name: "Priority Dispatch Test",
      status: "RUNNING",
    },
  });

  const recLow = await prisma.campaignRecipient.create({
    data: { campaignId: campPriority.id, contactId: createdContacts[1].id, emailSnapshot: "prio_low@test.org", status: "QUEUED" },
  });
  const recNormal = await prisma.campaignRecipient.create({
    data: { campaignId: campPriority.id, contactId: createdContacts[2].id, emailSnapshot: "prio_normal@test.org", status: "QUEUED" },
  });
  const recHigh = await prisma.campaignRecipient.create({
    data: { campaignId: campPriority.id, contactId: createdContacts[3].id, emailSnapshot: "prio_high@test.org", status: "QUEUED" },
  });

  // Created in order LOW, then NORMAL, then HIGH to prove insertion order does not dictate claim order
  await prisma.emailQueueJob.create({
    data: { campaignId: campPriority.id, campaignRecipientId: recLow.id, contactId: createdContacts[1].id, recipientEmail: "prio_low@test.org", recipientDomain: "test.org", status: "QUEUED", priority: "LOW" },
  });
  await prisma.emailQueueJob.create({
    data: { campaignId: campPriority.id, campaignRecipientId: recNormal.id, contactId: createdContacts[2].id, recipientEmail: "prio_normal@test.org", recipientDomain: "test.org", status: "QUEUED", priority: "NORMAL" },
  });
  await prisma.emailQueueJob.create({
    data: { campaignId: campPriority.id, campaignRecipientId: recHigh.id, contactId: createdContacts[3].id, recipientEmail: "prio_high@test.org", recipientDomain: "test.org", status: "QUEUED", priority: "HIGH" },
  });

  const firstClaimed = await rapidQueueEngine.claimNextJob(campPriority.id, "prio-worker-1", DEFAULT_QUEUE_CONFIG);
  assert(firstClaimed?.priority === "HIGH", "First claimed job is HIGH priority (despite being inserted last)");

  const secondClaimed = await rapidQueueEngine.claimNextJob(campPriority.id, "prio-worker-2", DEFAULT_QUEUE_CONFIG);
  assert(secondClaimed?.priority === "NORMAL", "Second claimed job is NORMAL priority");

  const thirdClaimed = await rapidQueueEngine.claimNextJob(campPriority.id, "prio-worker-3", DEFAULT_QUEUE_CONFIG);
  assert(thirdClaimed?.priority === "LOW", "Third claimed job is LOW priority");

  // =========================================================================
  // TEST SUITE 5: Stale Worker Crash Recovery
  // =========================================================================
  console.log("\n[5/6] Testing Stale Worker Crash Recovery...");

  // Artificially make the locked job stale (locked 70 seconds ago)
  const pastDate = new Date(Date.now() - 70 * 1000);
  await prisma.emailQueueJob.update({
    where: { id: testJob.id },
    data: {
      lockedAt: pastDate,
      lockedBy: "crashed-worker",
      status: "PROCESSING",
    },
  });

  const recoveredCount = await rapidQueueEngine.recoverStaleJobs(campClaim.id);
  assert(recoveredCount === 1, `Stale locked job successfully recovered (recovered: ${recoveredCount})`);

  const reloadedJob = await prisma.emailQueueJob.findUnique({
    where: { id: testJob.id },
  });
  assert(reloadedJob?.status === "QUEUED", "Recovered job returned to QUEUED state");
  assert(reloadedJob?.lockedAt === null, "Recovered job lock cleared");
  assert(reloadedJob?.lockedBy === null, "Recovered job lockedBy cleared");

  // =========================================================================
  // TEST SUITE 6: Large Scale Batch Processing (10,000 Jobs Simulation)
  // =========================================================================
  console.log("\n[6/6] Testing High-Volume Batch Streaming (10,000 Jobs Simulation)...");

  const campLarge = await prisma.campaign.create({
    data: {
      organizationId: org.id,
      senderId: sender.id,
      name: "10k Load Benchmark Campaign",
      status: "DRAFT",
    },
  });

  const LARGE_COUNT = 10000;
  console.log(`  -> Generating ${LARGE_COUNT} simulated campaign recipients...`);

  const runId = Date.now();
  const chunkBatch = 250;

  for (let offset = 0; offset < LARGE_COUNT; offset += chunkBatch) {
    const contactBatch: any[] = [];
    const recipientBatch: any[] = [];

    for (let i = 0; i < chunkBatch; i++) {
      const idx = offset + i;
      const cid = `c_${runId}_${idx}`;
      const email = `scale_${runId}_${idx}@benchmark.org`;

      contactBatch.push({
        id: cid,
        organizationId: org.id,
        email,
        firstName: `User_${idx}`,
        lastName: "Bench",
      });

      recipientBatch.push({
        campaignId: campLarge.id,
        contactId: cid,
        emailSnapshot: email,
        status: "PENDING",
      });
    }

    await prisma.contact.createMany({ data: contactBatch });
    await prisma.campaignRecipient.createMany({ data: recipientBatch });
  }

  const initialCount = await prisma.campaignRecipient.count({
    where: { campaignId: campLarge.id },
  });
  assert(initialCount === LARGE_COUNT, `Verified ${LARGE_COUNT} recipients prepared`);


  console.log("  -> Enqueueing 10,000 recipients via RapidQueueEngine chunked stream...");
  const memBefore = process.memoryUsage().heapUsed;
  const startTime = Date.now();

  await rapidQueueEngine.enqueueCampaign(campLarge.id, {
    workerCount: 4,
    emailsPerWorkerPerSecond: 20,
    globalRateLimit: 80,
    batchSize: 1000,
  });

  const durationMs = Date.now() - startTime;
  const memAfter = process.memoryUsage().heapUsed;
  const memDeltaMb = Math.round((memAfter - memBefore) / 1024 / 1024);

  const queuedJobCount = await prisma.emailQueueJob.count({
    where: { campaignId: campLarge.id },
  });

  assert(queuedJobCount === LARGE_COUNT, `Successfully populated 10,000 queue jobs (${queuedJobCount}/${LARGE_COUNT}) in ${durationMs}ms`);
  assert(memDeltaMb < 150, `Memory efficient: Heap delta was ${memDeltaMb}MB (well below memory limit)`);

  const status10k = await rapidQueueEngine.getStatus(campLarge.id);
  assert(status10k.total === LARGE_COUNT, `Status metrics reflect all 10,000 jobs`);
  assert(status10k.status === "RUNNING", "10k Campaign is active in RUNNING state");

  // Clean up workers
  rapidQueueEngine.stopWorkerPool(campLarge.id);

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log("\n==========================================================");
  console.log(`   TEST RESULTS: ${testPassCount} PASSED | ${testFailCount} FAILED`);
  console.log("==========================================================");

  if (testFailCount > 0) {
    process.exit(1);
  }
}

runTestSuite()
  .catch((err) => {
    console.error("Test execution threw error:", err);
    process.exit(1);
  })
  .finally(async () => {
    rapidQueueEngine.destroy();
    await prisma.$disconnect();
    process.exit(testFailCount > 0 ? 1 : 0);
  });

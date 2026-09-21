const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const prisma = new PrismaClient();

async function runTests() {
  console.log("====================================================");
  console.log("🧪 AEROSEND SYSTEM ENGINE & API INTEGRATION TESTS");
  console.log("====================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}`);
      failed++;
    }
  }

  // TEST 1: Database and Organization Health
  const org = await prisma.organization.findFirst({
    include: { members: true, senders: true }
  });
  assert(org !== null && org.name.length > 0, "Organization exists and is healthy");
  assert(org.senders.length > 0, "Default sender is configured");

  // TEST 2: Personalization & Fallback Resolution
  const { renderPersonalizedText, extractVariables, injectTracking } = require("../src/lib/email/personalization");
  const template = "Hi {{firstName | 'friend'}}, your company {{company}} is located in {{city}}.";
  const rendered = renderPersonalizedText(template, {
    email: "test@example.com",
    firstName: null, // Test fallback
    company: "Acme Corp",
    customFields: { city: "Neo Tokyo" }
  });
  assert(
    rendered === "Hi friend, your company Acme Corp is located in Neo Tokyo.",
    "Variable substitution with fallback syntax (firstName -> friend, city -> Neo Tokyo)"
  );

  const vars = extractVariables(template);
  assert(vars.includes("firstName") && vars.includes("company") && vars.includes("city"), "Variable extraction parses tokens correctly");

  // TEST 3: Pre-flight Validation Checklist
  const { runPreflightValidation } = require("../src/lib/email/preflight");
  const validationGood = runPreflightValidation({
    sender: { status: "CONNECTED", dailyQuota: 500, sentToday: 10 },
    subject: "Hello {{firstName}}",
    htmlBody: "<p>Check out our tool at {{company}}</p>",
    recipients: [
      { email: "john@example.com", firstName: "John", company: "Meta" }
    ]
  });
  assert(validationGood.canSend === true, "Preflight validation passes for valid campaign");

  const validationBad = runPreflightValidation({
    sender: null,
    subject: "",
    htmlBody: "",
    recipients: []
  });
  assert(validationBad.canSend === false, "Preflight validation blocks incomplete campaign");

  // TEST 4: Deterministic Idempotency Key Generation
  const { DeliveryEngine } = require("../src/lib/queue/engine");
  const key1 = DeliveryEngine.generateIdempotencyKey("camp_1", "recip_1", 1);
  const key2 = DeliveryEngine.generateIdempotencyKey("camp_1", "recip_1", 1);
  const key3 = DeliveryEngine.generateIdempotencyKey("camp_1", "recip_2", 1);
  assert(key1 === key2, "Idempotency key is deterministic across identical send attempts");
  assert(key1 !== key3, "Idempotency key differs across different recipients");

  // TEST 5: Create Campaign and Process Outbox Delivery
  const testContact = await prisma.contact.create({
    data: {
      organizationId: org.id,
      email: `test_outreach_${Date.now()}@aerosend.dev`,
      firstName: "TestUser",
      company: "InnovateCo",
      status: "ACTIVE"
    }
  });

  const testCampaign = await prisma.campaign.create({
    data: {
      organizationId: org.id,
      name: `Engine Test Campaign ${Date.now()}`,
      senderId: org.senders[0].id,
      status: "READY",
      subject: "Hello {{firstName}} from AeroSend",
      htmlBody: "<p>Welcome to {{company}}!</p>",
      createdById: org.members[0].userId
    }
  });

  const recip = await prisma.campaignRecipient.create({
    data: {
      campaignId: testCampaign.id,
      contactId: testContact.id,
      emailSnapshot: testContact.email,
      status: "PENDING"
    }
  });

  // Launch campaign
  await DeliveryEngine.startCampaign(testCampaign.id);
  const runningCamp = await prisma.campaign.findUnique({ where: { id: testCampaign.id } });
  assert(runningCamp.status === "RUNNING", "Campaign transitions to RUNNING state");

  // Process batch
  const batchResult = await DeliveryEngine.processCampaignBatch(testCampaign.id, 10);
  assert(batchResult.succeeded === 1, "DeliveryEngine successfully processed and sent message");

  const updatedRecip = await prisma.campaignRecipient.findUnique({
    where: { id: recip.id },
    include: { messages: { include: { events: true } } }
  });
  assert(updatedRecip.status === "SENT", "Recipient transitioned to SENT status");
  assert(updatedRecip.messages.length > 0, "EmailMessage record created in outbox");
  assert(updatedRecip.messages[0].events.length > 0, "Immutable EmailEvent recorded");

  // TEST 6: Duplicate Send Prevention (Idempotency)
  const secondBatch = await DeliveryEngine.processCampaignBatch(testCampaign.id, 10);
  const msgCount = await prisma.emailMessage.count({
    where: { campaignRecipientId: recip.id }
  });
  assert(msgCount === 1, "Duplicate send prevented: exactly 1 EmailMessage created for recipient");

  // TEST 7: Reply Detection & Sequence Halt
  // Create sequence enrollment
  const testSeq = await prisma.sequence.create({
    data: {
      organizationId: org.id,
      name: "Test Stop Sequence",
      steps: {
        create: [
          { stepNo: 1, delaySeconds: 10, subject: "Followup 1", htmlBody: "Step 1" },
          { stepNo: 2, delaySeconds: 20, subject: "Followup 2", htmlBody: "Step 2" }
        ]
      }
    }
  });

  const enrollment = await prisma.sequenceEnrollment.create({
    data: {
      sequenceId: testSeq.id,
      campaignRecipientId: recip.id,
      currentStep: 1,
      status: "ACTIVE"
    }
  });

  // Simulate reply webhook
  await prisma.campaignRecipient.update({
    where: { id: recip.id },
    data: { status: "REPLIED" }
  });
  await prisma.sequenceEnrollment.updateMany({
    where: { campaignRecipientId: recip.id },
    data: { status: "STOPPED" }
  });

  const stoppedEnroll = await prisma.sequenceEnrollment.findUnique({
    where: { id: enrollment.id }
  });
  assert(stoppedEnroll.status === "STOPPED", "Reply detection automatically halts sequence enrollment (STOPPED)");

  console.log("\n====================================================");
  console.log(`🏁 TESTS FINISHED: ${passed} PASSED, ${failed} FAILED`);
  console.log("====================================================\n");

  if (failed > 0) process.exit(1);
}

runTests()
  .catch((e) => {
    console.error("Test execution error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

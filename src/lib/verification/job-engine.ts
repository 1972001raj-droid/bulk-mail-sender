import { prisma } from "../db";
import { verifyEmailAddress, getVerificationExpiryDate } from "./verifier";
import { normalizeEmail } from "./syntax";
import { ImportPolicy, VerificationJobProgress, VerificationResult, VerificationStatus } from "./types";

interface ActiveJobState {
  jobId: string;
  organizationId: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  total: number;
  processed: number;
  safeCount: number;
  riskyCount: number;
  invalidCount: number;
  unknownCount: number;
  error?: string;
  results: Map<string, VerificationResult>;
}

// In-memory active jobs registry for real-time progress updates
const activeJobs = new Map<string, ActiveJobState>();

const CONCURRENCY_LIMIT = 5;

export class VerificationJobEngine {
  /**
   * Returns current progress of an import verification job.
   */
  static async getJobProgress(jobId: string, organizationId: string): Promise<VerificationJobProgress | null> {
    const memoryJob = activeJobs.get(jobId);
    if (memoryJob && memoryJob.organizationId === organizationId) {
      const percent = memoryJob.total > 0 ? Math.round((memoryJob.processed / memoryJob.total) * 100) : 0;
      return {
        jobId: memoryJob.jobId,
        status: memoryJob.status,
        total: memoryJob.total,
        processed: memoryJob.processed,
        safeCount: memoryJob.safeCount,
        riskyCount: memoryJob.riskyCount,
        invalidCount: memoryJob.invalidCount,
        unknownCount: memoryJob.unknownCount,
        percent,
        error: memoryJob.error
      };
    }

    // Fallback to database
    const dbJob = await prisma.emailVerificationJob.findFirst({
      where: { id: jobId, organizationId }
    });

    if (!dbJob) return null;

    const percent = dbJob.total > 0 ? Math.round((dbJob.processed / dbJob.total) * 100) : 0;
    return {
      jobId: dbJob.id,
      status: dbJob.status as any,
      total: dbJob.total,
      processed: dbJob.processed,
      safeCount: dbJob.safeCount,
      riskyCount: dbJob.riskyCount,
      invalidCount: dbJob.invalidCount,
      unknownCount: dbJob.unknownCount,
      percent,
      error: dbJob.error || undefined
    };
  }

  /**
   * Initializes and executes an asynchronous verification job in background.
   */
  static async startJob(
    jobId: string,
    organizationId: string,
    rows: any[],
    mappings: Record<string, string>,
    targetListId?: string,
    targetListName?: string
  ): Promise<void> {
    const emailCol = mappings.email;

    // Deduplicate and group rows by normalized email address
    const emailToRows = new Map<string, any[]>();
    for (const row of rows) {
      const rawEmail = row[emailCol];
      const normalized = normalizeEmail(String(rawEmail || ""));
      if (!emailToRows.has(normalized)) {
        emailToRows.set(normalized, []);
      }
      emailToRows.get(normalized)!.push(row);
    }

    const uniqueEmails = Array.from(emailToRows.keys()).filter(Boolean);
    const totalCount = uniqueEmails.length;

    // Update database job record
    await prisma.emailVerificationJob.update({
      where: { id: jobId },
      data: {
        total: totalCount,
        status: "PROCESSING",
        targetListId,
        targetListName,
        mappingsJson: JSON.stringify(mappings)
      }
    });

    // Initialize in-memory tracker
    const jobState: ActiveJobState = {
      jobId,
      organizationId,
      status: "PROCESSING",
      total: totalCount,
      processed: 0,
      safeCount: 0,
      riskyCount: 0,
      invalidCount: 0,
      unknownCount: 0,
      results: new Map()
    };
    activeJobs.set(jobId, jobState);

    // Fire background execution (non-blocking)
    this.runBackgroundPipeline(jobId, organizationId, uniqueEmails, emailToRows, mappings).catch(async (err) => {
      console.error(`Verification job ${jobId} failed:`, err);
      jobState.status = "FAILED";
      jobState.error = err.message || "Background verification failed";
      await prisma.emailVerificationJob.update({
        where: { id: jobId },
        data: { status: "FAILED", error: jobState.error }
      }).catch(() => {});
    });
  }

  /**
   * Background worker loop with concurrency limiter and batch database commits.
   */
  private static async runBackgroundPipeline(
    jobId: string,
    organizationId: string,
    uniqueEmails: string[],
    emailToRows: Map<string, any[]>,
    mappings: Record<string, string>
  ): Promise<void> {
    const jobState = activeJobs.get(jobId);
    if (!jobState) return;

    let currentIndex = 0;
    const workerPromises: Promise<void>[] = [];

    const worker = async () => {
      while (currentIndex < uniqueEmails.length) {
        const index = currentIndex++;
        const email = uniqueEmails[index];

        try {
          const result = await verifyEmailAddress(email, organizationId);
          jobState.results.set(email, result);

          jobState.processed++;
          if (result.status === "SAFE") jobState.safeCount++;
          else if (result.status === "RISKY") jobState.riskyCount++;
          else if (result.status === "INVALID") jobState.invalidCount++;
          else jobState.unknownCount++;
        } catch (e: any) {
          jobState.processed++;
          jobState.unknownCount++;
          jobState.results.set(email, {
            email,
            status: "UNKNOWN",
            reason: "VERIFICATION_UNCERTAIN",
            message: e.message || "Verification check failed unexpectedly",
            syntax: { isValid: true, normalizedEmail: email, localPart: "", domain: "" },
            durationMs: 0,
            checkedAt: new Date().toISOString()
          });
        }
      }
    };

    // Run parallel workers up to CONCURRENCY_LIMIT
    const concurrency = Math.min(CONCURRENCY_LIMIT, uniqueEmails.length || 1);
    for (let i = 0; i < concurrency; i++) {
      workerPromises.push(worker());
    }

    await Promise.all(workerPromises);

    // Persist all records into database in bulk batches
    const recordsToInsert: Array<{
      jobId: string;
      email: string;
      status: string;
      reason: string;
      detailsJson: string;
      rawRowJson: string;
    }> = [];

    for (const [email, result] of jobState.results.entries()) {
      const associatedRows = emailToRows.get(email) || [{}];
      for (const row of associatedRows) {
        recordsToInsert.push({
          jobId,
          email,
          status: result.status,
          reason: result.reason,
          detailsJson: JSON.stringify(result),
          rawRowJson: JSON.stringify(row)
        });
      }
    }

    // Insert records in chunks of 100
    const chunkSize = 100;
    for (let i = 0; i < recordsToInsert.length; i += chunkSize) {
      const chunk = recordsToInsert.slice(i, i + chunkSize);
      await prisma.emailVerificationRecord.createMany({
        data: chunk
      });
    }

    // Finalize job record in database
    jobState.status = "COMPLETED";
    await prisma.emailVerificationJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        processed: jobState.processed,
        safeCount: jobState.safeCount,
        riskyCount: jobState.riskyCount,
        invalidCount: jobState.invalidCount,
        unknownCount: jobState.unknownCount
      }
    });
  }

  /**
   * Commits contacts to the database according to the user's selected policy.
   */
  static async commitImport(
    jobId: string,
    organizationId: string,
    policy: ImportPolicy,
    targetListId?: string,
    targetListName?: string
  ): Promise<{ importedCount: number; skippedCount: number; listId?: string }> {
    const job = await prisma.emailVerificationJob.findFirst({
      where: { id: jobId, organizationId },
      include: { records: true }
    });

    if (!job) {
      throw new Error("Verification job not found");
    }

    const mappings: Record<string, string> = job.mappingsJson ? JSON.parse(job.mappingsJson) : { email: "email" };

    // Resolve or create target list
    let listId = targetListId || job.targetListId || undefined;
    const listName = targetListName || job.targetListName;

    if (!listId && listName) {
      const newList = await prisma.contactList.create({
        data: {
          organizationId,
          name: listName,
          description: `Imported via verified import on ${new Date().toLocaleDateString()}`
        }
      });
      listId = newList.id;
    }

    // Filter records according to import policy
    const eligibleRecords = job.records.filter((rec) => {
      if (policy === "ALL") return true;
      if (policy === "SAFE") return rec.status === "SAFE";
      if (policy === "SAFE_RISKY") return rec.status === "SAFE" || rec.status === "RISKY";
      if (policy === "SAFE_RISKY_UNKNOWN") return rec.status !== "INVALID";
      return rec.status === "SAFE";
    });

    let importedCount = 0;
    let skippedCount = job.records.length - eligibleRecords.length;
    const expiresAt = getVerificationExpiryDate();

    for (const rec of eligibleRecords) {
      const row = rec.rawRowJson ? JSON.parse(rec.rawRowJson) : {};
      const email = rec.email;

      const firstName = mappings.firstName ? String(row[mappings.firstName] || "").trim() : undefined;
      const lastName = mappings.lastName ? String(row[mappings.lastName] || "").trim() : undefined;
      const company = mappings.company ? String(row[mappings.company] || "").trim() : undefined;
      const title = mappings.title ? String(row[mappings.title] || "").trim() : undefined;

      const customFields: Record<string, any> = {};
      for (const [colKey, targetField] of Object.entries(mappings)) {
        if (!["email", "firstName", "lastName", "company", "title"].includes(targetField as string)) {
          customFields[targetField as string] = row[colKey];
        }
      }

      try {
        const contact = await prisma.contact.upsert({
          where: {
            organizationId_email: {
              organizationId,
              email
            }
          },
          create: {
            organizationId,
            email,
            firstName: firstName || null,
            lastName: lastName || null,
            company: company || null,
            title: title || null,
            customFieldsJson: Object.keys(customFields).length ? JSON.stringify(customFields) : null,
            status: "ACTIVE",
            verificationStatus: rec.status,
            verificationReason: rec.reason,
            verificationCheckedAt: rec.createdAt,
            verificationExpiresAt: expiresAt,
            verificationMetadata: rec.detailsJson
          },
          update: {
            firstName: firstName !== undefined ? firstName : undefined,
            lastName: lastName !== undefined ? lastName : undefined,
            company: company !== undefined ? company : undefined,
            title: title !== undefined ? title : undefined,
            customFieldsJson: Object.keys(customFields).length ? JSON.stringify(customFields) : undefined,
            verificationStatus: rec.status,
            verificationReason: rec.reason,
            verificationCheckedAt: rec.createdAt,
            verificationExpiresAt: expiresAt,
            verificationMetadata: rec.detailsJson
          }
        });

        if (listId) {
          await prisma.contactListMember.upsert({
            where: {
              listId_contactId: {
                listId,
                contactId: contact.id
              }
            },
            create: {
              listId,
              contactId: contact.id
            },
            update: {}
          });
        }

        importedCount++;
      } catch (err) {
        skippedCount++;
      }
    }

    return { importedCount, skippedCount, listId };
  }
}

import { prisma } from "../db";
import { ProviderFactory } from "../providers/factory";
import { renderPersonalizedText, injectTracking } from "../email/personalization";
import crypto from "crypto";

export interface QueueJobResult {
  processed: number;
  succeeded: number;
  failed: number;
  pausedQuota: boolean;
  errors: string[];
}

export class DeliveryEngine {
  /**
   * Generates a deterministic idempotency key for a send attempt.
   */
  static generateIdempotencyKey(campaignId: string, recipientId: string, stepNo: number = 1): string {
    const raw = `${campaignId}:${recipientId}:${stepNo}`;
    return crypto.createHash("sha256").update(raw).digest("hex");
  }

  /**
   * Enqueues a campaign for sending. Transitions campaign to RUNNING and marks recipients QUEUED.
   */
  static async startCampaign(campaignId: string): Promise<void> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { recipients: true, sender: true }
    });

    if (!campaign) throw new Error("Campaign not found");
    if (!campaign.senderId) throw new Error("Sender is required to launch campaign");

    // Update campaign status
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "RUNNING" }
    });

    // Mark pending recipients as QUEUED
    await prisma.campaignRecipient.updateMany({
      where: { campaignId, status: "PENDING" },
      data: { status: "QUEUED" }
    });

    // Record audit log
    await prisma.auditLog.create({
      data: {
        organizationId: campaign.organizationId,
        action: "CAMPAIGN_STARTED",
        entityType: "campaign",
        entityId: campaign.id,
        metadataJson: JSON.stringify({ recipientCount: campaign.recipients.length })
      }
    });
  }

  /**
   * Processes a batch of queued emails for a campaign.
   */
  static async processCampaignBatch(campaignId: string, batchSize: number = 50): Promise<QueueJobResult> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        sender: {
          include: { providerAccounts: true }
        },
        sequence: {
          include: { steps: { orderBy: { stepNo: "asc" } } }
        }
      }
    });

    if (!campaign) throw new Error("Campaign not found");
    if (campaign.status !== "RUNNING") {
      return { processed: 0, succeeded: 0, failed: 0, pausedQuota: false, errors: [`Campaign is ${campaign.status}`] };
    }

    const sender = campaign.sender;
    if (!sender) throw new Error("No sender associated with campaign");

    // Fetch batch of queued recipients
    const recipients = await prisma.campaignRecipient.findMany({
      where: { campaignId, status: "QUEUED" },
      include: { contact: true },
      take: batchSize
    });

    if (recipients.length === 0) {
      // Check if all recipients completed
      const remaining = await prisma.campaignRecipient.count({
        where: { campaignId, status: { in: ["PENDING", "QUEUED"] } }
      });
      if (remaining === 0) {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { status: "COMPLETED" }
        });
      }
      return { processed: 0, succeeded: 0, failed: 0, pausedQuota: false, errors: [] };
    }

    // Resolve Provider
    const activeProviderAccount = sender.providerAccounts[0];
    const provider = ProviderFactory.getProvider({
      provider: activeProviderAccount?.provider || "sandbox",
      senderEmail: sender.email,
      displayName: sender.displayName,
      tokenRef: activeProviderAccount?.tokenRef
    });

    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const r of recipients) {
      // 1. Deterministic Idempotency Key check
      const idempotencyKey = this.generateIdempotencyKey(campaignId, r.id, 1);
      const existingMessage = await prisma.emailMessage.findUnique({
        where: { idempotencyKey }
      });

      if (existingMessage && existingMessage.status === "SENT") {
        // Prevent duplicate send
        await prisma.campaignRecipient.update({
          where: { id: r.id },
          data: { status: "SENT" }
        });
        continue;
      }

      // 3. Resolve personalizations
      const contactData = {
        email: r.emailSnapshot,
        firstName: r.contact.firstName,
        lastName: r.contact.lastName,
        company: r.contact.company,
        title: r.contact.title,
        customFields: r.contact.customFieldsJson ? JSON.parse(r.contact.customFieldsJson) : {}
      };

      const personalizedSubject = renderPersonalizedText(campaign.subject || "Important update", contactData);
      let personalizedBody = renderPersonalizedText(campaign.htmlBody || "", contactData);

      // 4. Create EmailMessage in outbox
      const emailMsg = existingMessage || (await prisma.emailMessage.create({
        data: {
          campaignRecipientId: r.id,
          provider: provider.providerName,
          subject: personalizedSubject,
          status: "QUEUED",
          idempotencyKey
        }
      }));

      // Parse campaign settings for tracking
      const settings = campaign.settingsJson ? JSON.parse(campaign.settingsJson) : {};
      const trackOpens = settings.tracking?.opens !== false;
      const trackClicks = settings.tracking?.clicks !== false;

      // 5. Tracking injection
      const finalHtmlBody = injectTracking(personalizedBody, {
        messageId: emailMsg.id,
        trackOpens,
        trackClicks,
        unsubscribeUrl: `${process.env.APP_BASE_URL || "http://localhost:3000"}/api/v1/track/unsub?id=${r.id}`
      });

      // 6. Provider Send
      try {
        const sendResult = await provider.send({
          to: r.emailSnapshot,
          toName: [r.contact.firstName, r.contact.lastName].filter(Boolean).join(" "),
          from: sender.email,
          fromName: sender.displayName,
          subject: personalizedSubject,
          htmlBody: finalHtmlBody
        });

        if (sendResult.success) {
          // Success: update records
          await prisma.emailMessage.update({
            where: { id: emailMsg.id },
            data: {
              status: sendResult.providerStatus === "ACCEPTED" ? "ACCEPTED" : "SENT",
              providerMessageId: sendResult.providerMessageId,
              threadId: sendResult.threadId,
              sentAt: new Date()
            }
          });

          await prisma.campaignRecipient.update({
            where: { id: r.id },
            data: {
              status: "SENT",
              providerMessageId: sendResult.providerMessageId,
              lastError: null
            }
          });

          // Record immutable event
          await prisma.emailEvent.create({
            data: {
              emailMessageId: emailMsg.id,
              eventType: sendResult.providerStatus === "ACCEPTED" ? "MESSAGE_PROVIDER_ACCEPTED" : "MESSAGE_SENT",
              metadataJson: JSON.stringify(sendResult.rawResponse || {})
            }
          });

          // Sequence enrollment if sequence configured
          if (campaign.sequenceId && campaign.sequence?.steps?.length) {
            const firstStep = campaign.sequence.steps[0];
            const nextRun = new Date(Date.now() + (firstStep.delaySeconds || 86400) * 1000);
            await prisma.sequenceEnrollment.upsert({
              where: { campaignRecipientId: r.id },
              create: {
                sequenceId: campaign.sequenceId,
                campaignRecipientId: r.id,
                currentStep: 1,
                status: "ACTIVE",
                nextRunAt: nextRun
              },
              update: {
                status: "ACTIVE",
                nextRunAt: nextRun
              }
            });
          }

          succeeded++;
        } else {
          // Provider rejected or bounced
          const isBounce = sendResult.error?.includes("550") || sendResult.error?.includes("does not exist");
          const failStatus = isBounce ? "BOUNCED" : "FAILED";

          await prisma.emailMessage.update({
            where: { id: emailMsg.id },
            data: { status: failStatus }
          });

          await prisma.campaignRecipient.update({
            where: { id: r.id },
            data: {
              status: failStatus,
              lastError: sendResult.error
            }
          });

          await prisma.emailEvent.create({
            data: {
              emailMessageId: emailMsg.id,
              eventType: isBounce ? "MESSAGE_BOUNCED" : "MESSAGE_FAILED",
              metadataJson: JSON.stringify({ error: sendResult.error })
            }
          });

          failed++;
          if (sendResult.error) errors.push(sendResult.error);
        }
      } catch (err: any) {
        failed++;
        errors.push(err.message);
        await prisma.campaignRecipient.update({
          where: { id: r.id },
          data: { status: "FAILED", lastError: err.message }
        });
      }
    }

    // Update sender sent counters
    if (succeeded > 0) {
      await prisma.sender.update({
        where: { id: sender.id },
        data: { sentToday: { increment: succeeded } }
      });
    }

    // Check if campaign is now complete
    const remainingCount = await prisma.campaignRecipient.count({
      where: { campaignId, status: { in: ["PENDING", "QUEUED"] } }
    });

    if (remainingCount === 0) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "COMPLETED" }
      });
      await prisma.auditLog.create({
        data: {
          organizationId: campaign.organizationId,
          action: "CAMPAIGN_COMPLETED",
          entityType: "campaign",
          entityId: campaign.id
        }
      });
    }

    return {
      processed: succeeded + failed,
      succeeded,
      failed,
      pausedQuota: false,
      errors
    };
  }

  /**
   * Follow-up sequence step processor.
   * Checks enrolled recipients with nextRunAt <= now, verifies reply/stop conditions, and sends step.
   */
  static async processFollowUpSequences(): Promise<number> {
    const enrollments = await prisma.sequenceEnrollment.findMany({
      where: {
        status: "ACTIVE",
        nextRunAt: { lte: new Date() }
      },
      include: {
        sequence: { include: { steps: { orderBy: { stepNo: "asc" } } } },
        campaignRecipient: {
          include: {
            contact: true,
            campaign: { include: { sender: { include: { providerAccounts: true } } } }
          }
        }
      },
      take: 25
    });

    let sentSteps = 0;

    for (const enroll of enrollments) {
      const recipient = enroll.campaignRecipient;

      // Stop condition: Check if recipient already replied or bounced or unsubscribed
      if (recipient.status === "REPLIED" || recipient.status === "BOUNCED" || recipient.status === "UNSUBSCRIBED") {
        await prisma.sequenceEnrollment.update({
          where: { id: enroll.id },
          data: { status: "STOPPED" }
        });
        continue;
      }

      const nextStepNo = enroll.currentStep + 1;
      const step = enroll.sequence.steps.find((s) => s.stepNo === nextStepNo);

      if (!step) {
        // No further steps; mark complete
        await prisma.sequenceEnrollment.update({
          where: { id: enroll.id },
          data: { status: "COMPLETED" }
        });
        continue;
      }

      // Check conditions
      const conditions = step.conditionsJson ? JSON.parse(step.conditionsJson) : {};
      if (conditions.stopOnReply !== false && recipient.status === "REPLIED") {
        await prisma.sequenceEnrollment.update({
          where: { id: enroll.id },
          data: { status: "STOPPED" }
        });
        continue;
      }

      // Send the follow-up step
      const sender = recipient.campaign.sender;
      if (!sender) continue;

      const providerAccount = sender.providerAccounts[0];
      const provider = ProviderFactory.getProvider({
        provider: providerAccount?.provider || "sandbox",
        senderEmail: sender.email,
        displayName: sender.displayName,
        tokenRef: providerAccount?.tokenRef
      });

      const contactData = {
        email: recipient.emailSnapshot,
        firstName: recipient.contact.firstName,
        lastName: recipient.contact.lastName,
        company: recipient.contact.company,
        title: recipient.contact.title,
        customFields: recipient.contact.customFieldsJson ? JSON.parse(recipient.contact.customFieldsJson) : {}
      };

      const stepSubject = renderPersonalizedText(step.subject || `Follow-up on ${recipient.campaign.name}`, contactData);
      const stepHtml = renderPersonalizedText(step.htmlBody || "<p>Following up on my previous note.</p>", contactData);

      const idempotencyKey = this.generateIdempotencyKey(recipient.campaignId, recipient.id, nextStepNo);

      const emailMsg = await prisma.emailMessage.create({
        data: {
          campaignRecipientId: recipient.id,
          provider: provider.providerName,
          subject: stepSubject,
          status: "QUEUED",
          idempotencyKey
        }
      });

      const finalHtml = injectTracking(stepHtml, {
        messageId: emailMsg.id,
        trackOpens: true,
        trackClicks: true
      });

      const result = await provider.send({
        to: recipient.emailSnapshot,
        toName: recipient.contact.firstName || recipient.emailSnapshot,
        from: sender.email,
        fromName: sender.displayName,
        subject: stepSubject,
        htmlBody: finalHtml
      });

      if (result.success) {
        await prisma.emailMessage.update({
          where: { id: emailMsg.id },
          data: {
            status: "SENT",
            providerMessageId: result.providerMessageId,
            sentAt: new Date()
          }
        });

        await prisma.emailEvent.create({
          data: {
            emailMessageId: emailMsg.id,
            eventType: "MESSAGE_SENT",
            metadataJson: JSON.stringify({ sequenceStep: nextStepNo })
          }
        });

        // Determine if next step exists
        const subsequentStep = enroll.sequence.steps.find((s) => s.stepNo === nextStepNo + 1);
        const nextDate = subsequentStep ? new Date(Date.now() + (subsequentStep.delaySeconds || 86400) * 1000) : null;

        await prisma.sequenceEnrollment.update({
          where: { id: enroll.id },
          data: {
            currentStep: nextStepNo,
            nextRunAt: nextDate,
            status: subsequentStep ? "ACTIVE" : "COMPLETED"
          }
        });

        sentSteps++;
      }
    }

    return sentSteps;
  }
}

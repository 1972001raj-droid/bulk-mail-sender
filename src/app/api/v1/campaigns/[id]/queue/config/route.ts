import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/auth";
import { rapidQueueEngine } from "@/lib/queue/rapid-queue";
import { QueueConfig } from "@/lib/queue/types";

/**
 * GET /api/v1/campaigns/[id]/queue/config
 * Retrieves current queue configuration for the campaign.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionContext();
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
    });

    if (!campaign) {
      return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
    }

    const config = await rapidQueueEngine.getOrInitConfig(campaign.id);
    return NextResponse.json({ success: true, config });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/v1/campaigns/[id]/queue/config
 * Dynamically updates queue configuration and scales workers live.
 * Validates all parameters server-side.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionContext();
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
    });

    if (!campaign) {
      return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
    }

    const body = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Invalid configuration payload" }, { status: 400 });
    }

    const validated: Partial<QueueConfig> = {};

    // Server-side validation
    if (body.workerCount !== undefined) {
      const count = Number(body.workerCount);
      if (isNaN(count) || count < 1 || count > 50) {
        return NextResponse.json(
          { success: false, error: "workerCount must be an integer between 1 and 50" },
          { status: 400 }
        );
      }
      validated.workerCount = Math.floor(count);
    }

    if (body.emailsPerWorkerPerSecond !== undefined) {
      const rate = Number(body.emailsPerWorkerPerSecond);
      if (isNaN(rate) || rate < 0.1 || rate > 200) {
        return NextResponse.json(
          { success: false, error: "emailsPerWorkerPerSecond must be between 0.1 and 200" },
          { status: 400 }
        );
      }
      validated.emailsPerWorkerPerSecond = rate;
    }

    if (body.globalRateLimit !== undefined) {
      const global = Number(body.globalRateLimit);
      if (isNaN(global) || global < 1 || global > 2000) {
        return NextResponse.json(
          { success: false, error: "globalRateLimit must be between 1 and 2000" },
          { status: 400 }
        );
      }
      validated.globalRateLimit = global;
    }

    if (body.maxConcurrentJobs !== undefined) {
      const mc = Number(body.maxConcurrentJobs);
      if (isNaN(mc) || mc < 1 || mc > 500) {
        return NextResponse.json(
          { success: false, error: "maxConcurrentJobs must be between 1 and 500" },
          { status: 400 }
        );
      }
      validated.maxConcurrentJobs = Math.floor(mc);
    }

    if (body.batchSize !== undefined) {
      const bs = Number(body.batchSize);
      if (isNaN(bs) || bs < 10 || bs > 5000) {
        return NextResponse.json(
          { success: false, error: "batchSize must be between 10 and 5000" },
          { status: 400 }
        );
      }
      validated.batchSize = Math.floor(bs);
    }

    if (body.maxRetries !== undefined) {
      const mr = Number(body.maxRetries);
      if (isNaN(mr) || mr < 0 || mr > 20) {
        return NextResponse.json(
          { success: false, error: "maxRetries must be between 0 and 20" },
          { status: 400 }
        );
      }
      validated.maxRetries = Math.floor(mr);
    }

    if (body.initialRetryDelaySeconds !== undefined) {
      const ird = Number(body.initialRetryDelaySeconds);
      if (isNaN(ird) || ird < 1 || ird > 3600) {
        return NextResponse.json(
          { success: false, error: "initialRetryDelaySeconds must be between 1 and 3600" },
          { status: 400 }
        );
      }
      validated.initialRetryDelaySeconds = Math.floor(ird);
    }

    if (body.retryBackoffMultiplier !== undefined) {
      const rbm = Number(body.retryBackoffMultiplier);
      if (isNaN(rbm) || rbm < 1.0 || rbm > 10.0) {
        return NextResponse.json(
          { success: false, error: "retryBackoffMultiplier must be between 1.0 and 10.0" },
          { status: 400 }
        );
      }
      validated.retryBackoffMultiplier = rbm;
    }

    if (body.maxRetryDelaySeconds !== undefined) {
      const mrd = Number(body.maxRetryDelaySeconds);
      if (isNaN(mrd) || mrd < 10 || mrd > 86400) {
        return NextResponse.json(
          { success: false, error: "maxRetryDelaySeconds must be between 10 and 86400" },
          { status: 400 }
        );
      }
      validated.maxRetryDelaySeconds = Math.floor(mrd);
    }

    if (body.dailySendingLimit !== undefined) {
      if (body.dailySendingLimit === null || body.dailySendingLimit === "") {
        validated.dailySendingLimit = null;
      } else {
        const dsl = Number(body.dailySendingLimit);
        if (isNaN(dsl) || dsl < 1) {
          return NextResponse.json(
            { success: false, error: "dailySendingLimit must be a positive integer or null" },
            { status: 400 }
          );
        }
        validated.dailySendingLimit = Math.floor(dsl);
      }
    }

    if (body.hourlySendingLimit !== undefined) {
      if (body.hourlySendingLimit === null || body.hourlySendingLimit === "") {
        validated.hourlySendingLimit = null;
      } else {
        const hsl = Number(body.hourlySendingLimit);
        if (isNaN(hsl) || hsl < 1) {
          return NextResponse.json(
            { success: false, error: "hourlySendingLimit must be a positive integer or null" },
            { status: 400 }
          );
        }
        validated.hourlySendingLimit = Math.floor(hsl);
      }
    }

    if (body.perAccountRateLimit !== undefined) {
      if (body.perAccountRateLimit === null || body.perAccountRateLimit === "") {
        validated.perAccountRateLimit = null;
      } else {
        const parl = Number(body.perAccountRateLimit);
        if (isNaN(parl) || parl <= 0) {
          return NextResponse.json(
            { success: false, error: "perAccountRateLimit must be a positive number or null" },
            { status: 400 }
          );
        }
        validated.perAccountRateLimit = parl;
      }
    }

    if (body.campaignStartTime !== undefined) {
      if (!body.campaignStartTime) {
        validated.campaignStartTime = null;
      } else {
        const date = new Date(body.campaignStartTime);
        if (isNaN(date.getTime())) {
          return NextResponse.json(
            { success: false, error: "campaignStartTime must be a valid ISO date string" },
            { status: 400 }
          );
        }
        validated.campaignStartTime = date.toISOString();
      }
    }

    if (body.campaignEndTime !== undefined) {
      if (!body.campaignEndTime) {
        validated.campaignEndTime = null;
      } else {
        const date = new Date(body.campaignEndTime);
        if (isNaN(date.getTime())) {
          return NextResponse.json(
            { success: false, error: "campaignEndTime must be a valid ISO date string" },
            { status: 400 }
          );
        }
        validated.campaignEndTime = date.toISOString();
      }
    }

    if (body.perDomainThrottlingEnabled !== undefined) {
      validated.perDomainThrottlingEnabled = Boolean(body.perDomainThrottlingEnabled);
    }

    if (body.domainRateLimits !== undefined && typeof body.domainRateLimits === "object") {
      const cleanDomains: Record<string, number> = {};
      for (const [dom, rate] of Object.entries(body.domainRateLimits)) {
        const num = Number(rate);
        if (!isNaN(num) && num > 0) {
          cleanDomains[dom.toLowerCase().trim()] = num;
        }
      }
      validated.domainRateLimits = cleanDomains;
    }

    if (body.queuePriority !== undefined) {
      if (["HIGH", "NORMAL", "LOW"].includes(body.queuePriority)) {
        validated.queuePriority = body.queuePriority;
      }
    }

    // Apply configuration live
    const updated = await rapidQueueEngine.updateConfig(campaign.id, validated);
    const metrics = await rapidQueueEngine.getStatus(campaign.id);

    return NextResponse.json({
      success: true,
      message: "Configuration updated successfully and applied dynamically",
      config: updated,
      metrics,
    });
  } catch (err: any) {
    console.error("[Queue Config PATCH API] Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

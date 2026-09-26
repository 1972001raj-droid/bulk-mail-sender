import net from "net";
import crypto from "crypto";
import { SmtpCheckResult } from "./types";
import { shouldSkipCatchAll, getCustomSmtpTimeout } from "./dns";

interface SmtpOptions {
  heloDomain?: string;
  fromEmail?: string;
  port?: number;
  connectTimeoutMs?: number;
  readTimeoutMs?: number;
  retries?: number;
}

const DEFAULT_OPTIONS: SmtpOptions = {
  heloDomain: "mail.aerosend.dev",
  fromEmail: "verify@aerosend.dev",
  port: 25,
  connectTimeoutMs: 3000,
  readTimeoutMs: 3500,
  retries: 0
};

/**
 * Checks for SMTP error strings indicating an invalid/non-existent mailbox.
 * Directly mirrors check-if-email-exists/core/src/smtp/parser.rs:is_invalid
 */
export function isInvalidMailboxResponse(text: string, email: string): boolean {
  const e = text.toLowerCase();
  return (
    e.includes("address rejected") ||
    e.includes("unrouteable") ||
    e.includes("does not exist") ||
    e.includes("invalid address") ||
    e.includes("invalid email address") ||
    e.includes("invalid recipient") ||
    e.includes("may not exist") ||
    e.includes("recipient invalid") ||
    e.includes("recipient rejected") ||
    e.includes("unknown recipient") ||
    e.includes("undeliverable") ||
    e.includes("user unknown") ||
    e.includes("unknown user") ||
    e.includes("no such user") ||
    e.includes("mailbox not found") ||
    e.includes("invalid mailbox") ||
    e.includes("no mailbox") ||
    e.includes("no such mailbox") ||
    e.includes("mailbox unavailable") ||
    e.includes("mailbox is unavailable") ||
    e.includes("not a valid mailbox") ||
    e.includes("no such recipient") ||
    e.includes("have an account") ||
    e.includes("unknown local part") ||
    e.includes("could not be found") ||
    e.includes("no such person") ||
    e.includes("address error") ||
    e.includes("recipient not found") ||
    e.includes("email doesn't exist") ||
    e.includes("verify address failed") ||
    e.includes("unable to verify user") ||
    e.includes("5.1.1") ||
    e.includes("5.2.1") ||
    e.includes("550 5.1.1") ||
    e.includes("550 user unknown") ||
    e.includes(email.toLowerCase())
  );
}

/**
 * Checks for full inbox error messages.
 * Mirrors check-if-email-exists/core/src/smtp/parser.rs:is_full_inbox
 */
export function isFullInboxResponse(text: string): boolean {
  const e = text.toLowerCase();
  return (
    e.includes("insufficient") ||
    e.includes("mailbox full") ||
    e.includes("quota exceeded") ||
    e.includes("over quota") ||
    e.includes("too many messages") ||
    e.includes("out of storage space") ||
    e.includes("4.2.2") ||
    e.includes("5.2.2")
  );
}

/**
 * Checks for disabled or discontinued account error messages.
 * Mirrors check-if-email-exists/core/src/smtp/parser.rs:is_disabled_account
 */
export function isDisabledAccountResponse(text: string): boolean {
  const e = text.toLowerCase();
  return e.includes("disabled") || e.includes("discontinued") || e.includes("inactive");
}

/**
 * Checks for blacklisted IP or reputation block error messages.
 * Mirrors check-if-email-exists/core/src/smtp/parser.rs:is_err_ip_blacklisted
 */
export function isBlockedOrBlacklistedResponse(text: string): boolean {
  const e = text.toLowerCase();
  return (
    e.includes("blacklist") ||
    e.includes("black list") ||
    e.includes("block list") ||
    e.includes("spamhaus") ||
    e.includes("spam") ||
    e.includes("abusix") ||
    e.includes("relaying denied") ||
    e.includes("access denied") ||
    e.includes("administratively denied") ||
    e.includes("banned") ||
    e.includes("connection rejected") ||
    e.includes("poor reputation") ||
    e.includes("junkmail") ||
    e.includes("proofpoint") ||
    e.includes("dnsbl") ||
    e.includes("blocked") ||
    e.includes("5.7.1")
  );
}

/**
 * Checks for greylisting or temporary deferral error messages.
 */
export function isGreylistedOrTemporaryResponse(text: string, code: number): boolean {
  const e = text.toLowerCase();
  return (
    code >= 400 && code < 500 ||
    e.includes("greylist") ||
    e.includes("graylist") ||
    e.includes("try again later") ||
    e.includes("service temporarily unavailable") ||
    e.includes("come back later") ||
    e.includes("reverse dns") ||
    e.includes("4.7.1")
  );
}

let cachedPort25Available: boolean | null = null;
let lastPort25ProbeTime = 0;
const PORT25_PROBE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Checks whether outbound TCP port 25 is accessible from the current host environment.
 * Most residential/broadband/cloud networks block outbound port 25.
 * We cache this result so we never block or delay subsequent email checks.
 */
export async function isOutboundPort25Available(): Promise<boolean> {
  const now = Date.now();
  if (cachedPort25Available !== null && now - lastPort25ProbeTime < PORT25_PROBE_TTL_MS) {
    return cachedPort25Available;
  }

  try {
    const isAvail = await new Promise<boolean>((resolve) => {
      const probeSocket = net.createConnection({
        host: "gmail-smtp-in.l.google.com",
        port: 25,
        timeout: 1800
      });

      let finished = false;
      const done = (result: boolean) => {
        if (finished) return;
        finished = true;
        probeSocket.removeAllListeners();
        try {
          probeSocket.destroy();
        } catch {}
        resolve(result);
      };

      probeSocket.on("connect", () => done(true));
      probeSocket.on("data", () => done(true));
      probeSocket.on("timeout", () => done(false));
      probeSocket.on("error", () => done(false));
    });

    cachedPort25Available = isAvail;
    lastPort25ProbeTime = now;
    return isAvail;
  } catch {
    cachedPort25Available = false;
    lastPort25ProbeTime = now;
    return false;
  }
}

/**
 * Performs raw SMTP recipient verification and optional catch-all check.
 */
export async function verifySmtpDeliverability(
  email: string,
  mxHost: string,
  domain: string,
  customOptions?: Partial<SmtpOptions>
): Promise<SmtpCheckResult> {
  const customTimeout = getCustomSmtpTimeout(mxHost);
  const options = {
    ...DEFAULT_OPTIONS,
    ...(customTimeout ? { connectTimeoutMs: customTimeout, readTimeoutMs: customTimeout } : {}),
    ...customOptions
  };

  // Check if outbound port 25 is available on this network
  const port25Open = await isOutboundPort25Available();
  if (!port25Open) {
    return {
      canConnect: false,
      isDeliverable: true,
      isCatchAll: false,
      hasFullInbox: false,
      isDisabled: false,
      isBlocked: false,
      isGreylisted: false,
      isTimeout: false,
      isNetworkRestricted: true,
      error: "Outbound SMTP port 25 is restricted on host network; verified via DNS and active MX exchanger"
    };
  }

  // Attempt verification with retries for greylisting/temporary failures
  let remainingAttempts = (options.retries || 1) + 1;
  let lastResult: SmtpCheckResult | null = null;

  while (remainingAttempts > 0) {
    remainingAttempts--;
    lastResult = await attemptSingleSmtp(email, mxHost, domain, options);

    // If result was deliverable, or permanent invalid/disabled, no need to retry
    if (
      lastResult.isDeliverable ||
      lastResult.isDisabled ||
      (!lastResult.isDeliverable && !lastResult.isGreylisted && !lastResult.isTimeout && lastResult.canConnect)
    ) {
      return lastResult;
    }

    // Wait a brief backoff if retrying greylisted/temporary error
    if (remainingAttempts > 0 && (lastResult.isGreylisted || lastResult.isTimeout)) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return lastResult || {
    canConnect: false,
    isDeliverable: false,
    isCatchAll: false,
    hasFullInbox: false,
    isDisabled: false,
    isBlocked: false,
    isGreylisted: false,
    isTimeout: true,
    error: "SMTP verification attempts exhausted"
  };
}

/**
 * Single SMTP conversation pass.
 */
function attemptSingleSmtp(
  email: string,
  mxHost: string,
  domain: string,
  options: SmtpOptions
): Promise<SmtpCheckResult> {
  return new Promise((resolve) => {
    let socket: net.Socket | null = null;
    let timer: NodeJS.Timeout | null = null;
    let step: "GREETING" | "EHLO" | "HELO" | "MAIL" | "RCPT" | "CATCHALL_RCPT" | "QUIT" = "GREETING";
    let buffer = "";
    let isDeliverable = false;
    let isCatchAll = false;
    let hasFullInbox = false;
    let isDisabled = false;
    let isBlocked = false;
    let isGreylisted = false;
    let lastCode = 0;
    let lastMsg = "";

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (socket) {
        socket.removeAllListeners();
        try {
          socket.destroy();
        } catch {}
      }
    };

    timer = setTimeout(() => {
      cleanup();
      resolve({
        canConnect: step !== "GREETING",
        isDeliverable: false,
        isCatchAll: false,
        hasFullInbox: false,
        isDisabled: false,
        isBlocked: false,
        isGreylisted: false,
        isTimeout: true,
        error: `SMTP connection timed out at step ${step}`
      });
    }, (options.connectTimeoutMs || 5000) + (options.readTimeoutMs || 7000));

    try {
      socket = net.createConnection({
        host: mxHost,
        port: options.port || 25,
        timeout: options.connectTimeoutMs || 5000
      });
    } catch (err: any) {
      cleanup();
      return resolve({
        canConnect: false,
        isDeliverable: false,
        isCatchAll: false,
        hasFullInbox: false,
        isDisabled: false,
        isBlocked: false,
        isGreylisted: false,
        isTimeout: false,
        error: `Socket creation failed: ${err.message}`
      });
    }

    socket.on("timeout", () => {
      cleanup();
      resolve({
        canConnect: step !== "GREETING",
        isDeliverable: false,
        isCatchAll: false,
        hasFullInbox: false,
        isDisabled: false,
        isBlocked: false,
        isGreylisted: false,
        isTimeout: true,
        error: `Socket timeout during ${step}`
      });
    });

    socket.on("error", (err: any) => {
      cleanup();
      resolve({
        canConnect: false,
        isDeliverable: false,
        isCatchAll: false,
        hasFullInbox: false,
        isDisabled: false,
        isBlocked: false,
        isGreylisted: false,
        isTimeout: err.code === "ETIMEDOUT",
        error: `Socket error: ${err.message || err.code}`
      });
    });

    socket.on("data", (data) => {
      buffer += data.toString("utf8");

      // SMTP responses can be multi-line (e.g. 250-something\r\n250 HELP\r\n)
      // We only process when the final line of the response is received: digits + space + text
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const lastLine = lines[lines.length - 1];

      // Format of final response line: "XYZ <message>"
      const match = lastLine && lastLine.match(/^(\d{3})\s+(.*)$/);
      if (!match) {
        return; // Wait for complete response
      }

      const code = parseInt(match[1], 10);
      const message = buffer;
      buffer = ""; // reset for next command
      lastCode = code;
      lastMsg = match[2];

      try {
        if (step === "GREETING") {
          if (code >= 200 && code < 300) {
            step = "EHLO";
            socket?.write(`EHLO ${options.heloDomain}\r\n`);
          } else {
            // Server refused initial connection
            cleanup();
            resolve({
              canConnect: true,
              isDeliverable: false,
              isCatchAll: false,
              hasFullInbox: false,
              isDisabled: false,
              isBlocked: isBlockedOrBlacklistedResponse(message),
              isGreylisted: code >= 400 && code < 500,
              isTimeout: false,
              responseCode: code,
              responseMessage: lastMsg,
              error: `Server rejected greeting: ${code} ${lastMsg}`
            });
          }
        } else if (step === "EHLO") {
          if (code >= 200 && code < 300) {
            step = "MAIL";
            socket?.write(`MAIL FROM:<${options.fromEmail}>\r\n`);
          } else if (code >= 500 && code <= 504) {
            // EHLO rejected, fallback to HELO
            step = "HELO";
            socket?.write(`HELO ${options.heloDomain}\r\n`);
          } else {
            cleanup();
            resolve({
              canConnect: true,
              isDeliverable: false,
              isCatchAll: false,
              hasFullInbox: false,
              isDisabled: false,
              isBlocked: isBlockedOrBlacklistedResponse(message),
              isGreylisted: isGreylistedOrTemporaryResponse(message, code),
              isTimeout: false,
              responseCode: code,
              responseMessage: lastMsg,
              error: `EHLO command failed: ${code} ${lastMsg}`
            });
          }
        } else if (step === "HELO") {
          if (code >= 200 && code < 300) {
            step = "MAIL";
            socket?.write(`MAIL FROM:<${options.fromEmail}>\r\n`);
          } else {
            cleanup();
            resolve({
              canConnect: true,
              isDeliverable: false,
              isCatchAll: false,
              hasFullInbox: false,
              isDisabled: false,
              isBlocked: isBlockedOrBlacklistedResponse(message),
              isGreylisted: isGreylistedOrTemporaryResponse(message, code),
              isTimeout: false,
              responseCode: code,
              responseMessage: lastMsg,
              error: `HELO command failed: ${code} ${lastMsg}`
            });
          }
        } else if (step === "MAIL") {
          if (code >= 200 && code < 300) {
            step = "RCPT";
            socket?.write(`RCPT TO:<${email}>\r\n`);
          } else {
            cleanup();
            resolve({
              canConnect: true,
              isDeliverable: false,
              isCatchAll: false,
              hasFullInbox: false,
              isDisabled: false,
              isBlocked: isBlockedOrBlacklistedResponse(message),
              isGreylisted: isGreylistedOrTemporaryResponse(message, code),
              isTimeout: false,
              responseCode: code,
              responseMessage: lastMsg,
              error: `MAIL FROM failed: ${code} ${lastMsg}`
            });
          }
        } else if (step === "RCPT") {
          if (code === 250 || code === 251) {
            isDeliverable = true;

            // Check catch-all setup unless skipped for known domain/provider
            if (!shouldSkipCatchAll(domain, mxHost)) {
              step = "CATCHALL_RCPT";
              const randomToken = crypto.randomBytes(8).toString("hex");
              const randomProbeEmail = `verify_probe_${randomToken}@${domain}`;
              socket?.write(`RCPT TO:<${randomProbeEmail}>\r\n`);
              return;
            } else {
              // Send QUIT
              step = "QUIT";
              socket?.write("QUIT\r\n");
              cleanup();
              resolve({
                canConnect: true,
                isDeliverable: true,
                isCatchAll: false,
                hasFullInbox: false,
                isDisabled: false,
                isBlocked: false,
                isGreylisted: false,
                isTimeout: false,
                responseCode: code,
                responseMessage: lastMsg
              });
              return;
            }
          }

          // RCPT TO was rejected or deferred
          isDeliverable = false;
          isDisabled = isDisabledAccountResponse(message);
          hasFullInbox = isFullInboxResponse(message);
          isBlocked = isBlockedOrBlacklistedResponse(message);
          isGreylisted = isGreylistedOrTemporaryResponse(message, code);

          step = "QUIT";
          socket?.write("QUIT\r\n");
          cleanup();

          resolve({
            canConnect: true,
            isDeliverable: false,
            isCatchAll: false,
            hasFullInbox,
            isDisabled,
            isBlocked,
            isGreylisted,
            isTimeout: false,
            responseCode: code,
            responseMessage: lastMsg
          });
        } else if (step === "CATCHALL_RCPT") {
          // If the random probe was also accepted (250/251), the domain has a catch-all mailbox
          if (code === 250 || code === 251) {
            isCatchAll = true;
          }

          step = "QUIT";
          socket?.write("QUIT\r\n");
          cleanup();

          resolve({
            canConnect: true,
            isDeliverable,
            isCatchAll,
            hasFullInbox,
            isDisabled,
            isBlocked,
            isGreylisted,
            isTimeout: false,
            responseCode: lastCode,
            responseMessage: lastMsg
          });
        }
      } catch (err: any) {
        cleanup();
        resolve({
          canConnect: true,
          isDeliverable: false,
          isCatchAll: false,
          hasFullInbox: false,
          isDisabled: false,
          isBlocked: false,
          isGreylisted: false,
          isTimeout: false,
          error: `Error in SMTP response handling: ${err.message}`
        });
      }
    });
  });
}

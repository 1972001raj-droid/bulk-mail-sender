import { extractVariables, RecipientData } from "./personalization";

export interface PreflightCheckItem {
  id: string;
  category: "sender" | "audience" | "content" | "compliance";
  label: string;
  status: "PASS" | "WARN" | "FAIL";
  message: string;
}

export interface PreflightResult {
  canSend: boolean;
  checks: PreflightCheckItem[];
  stats: {
    totalRecipients: number;
    validEmails: number;
    invalidEmails: number;
    unmappedVariables: string[];
  };
}

export function runPreflightValidation(params: {
  sender?: {
    status: string;
    sentToday?: number;
  } | null;
  subject?: string | null;
  htmlBody?: string | null;
  recipients: RecipientData[];
}): PreflightResult {
  const checks: PreflightCheckItem[] = [];
  const subject = params.subject?.trim() || "";
  const htmlBody = params.htmlBody?.trim() || "";
  const recipients = params.recipients || [];

  // 1. Sender Check
  if (!params.sender) {
    checks.push({
      id: "sender_connected",
      category: "sender",
      label: "Sender Account",
      status: "FAIL",
      message: "No sender mailbox selected."
    });
  } else if (params.sender.status !== "CONNECTED") {
    checks.push({
      id: "sender_connected",
      category: "sender",
      label: "Sender Status",
      status: "FAIL",
      message: `Sender status is ${params.sender.status}. Please reconnect mailbox.`
    });
  } else {
    checks.push({
      id: "sender_connected",
      category: "sender",
      label: "Sender Account",
      status: "PASS",
      message: "Sender account is connected and healthy."
    });
  }

  // 3. Subject Check
  if (!subject) {
    checks.push({
      id: "content_subject",
      category: "content",
      label: "Email Subject",
      status: "FAIL",
      message: "Subject line is required."
    });
  } else {
    checks.push({
      id: "content_subject",
      category: "content",
      label: "Email Subject",
      status: "PASS",
      message: `Subject defined: "${subject.slice(0, 35)}${subject.length > 35 ? "..." : ""}"`
    });
  }

  // 4. Body Check
  if (!htmlBody || htmlBody === "<p></p>") {
    checks.push({
      id: "content_body",
      category: "content",
      label: "Email Content",
      status: "FAIL",
      message: "Email body content is empty."
    });
  } else {
    checks.push({
      id: "content_body",
      category: "content",
      label: "Email Content",
      status: "PASS",
      message: "Email body formatted with HTML and rich text."
    });
  }

  // 5. Audience & Email Syntax Check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let validEmails = 0;
  let invalidEmails = 0;

  for (const r of recipients) {
    if (r.email && emailRegex.test(r.email.trim())) {
      validEmails++;
    } else {
      invalidEmails++;
    }
  }

  if (recipients.length === 0) {
    checks.push({
      id: "audience_count",
      category: "audience",
      label: "Recipient Count",
      status: "FAIL",
      message: "At least one recipient must be selected."
    });
  } else if (invalidEmails > 0) {
    checks.push({
      id: "audience_validity",
      category: "audience",
      label: "Email Validity",
      status: "WARN",
      message: `${invalidEmails} recipient(s) have invalid email formats and will be skipped.`
    });
  } else {
    checks.push({
      id: "audience_validity",
      category: "audience",
      label: "Email Validity",
      status: "PASS",
      message: `All ${validEmails} recipient email addresses are valid.`
    });
  }

  // 6. Variable Mapping Check
  const contentVars = new Set([...extractVariables(subject), ...extractVariables(htmlBody)]);
  const unmapped = new Set<string>();

  if (recipients.length > 0 && contentVars.size > 0) {
    // Check first 10 recipients
    const sample = recipients.slice(0, 10);
    for (const v of contentVars) {
      const vLower = v.toLowerCase().replace(/[^a-z0-9]/g, "");
      const isKnownField = ["email", "firstname", "lastname", "name", "company", "title"].includes(vLower);
      if (!isKnownField) {
        // Check custom fields
        const existsInCustom = sample.some((r) => {
          if (!r.customFields) return false;
          return Object.keys(r.customFields).some((k) => k.toLowerCase().replace(/[^a-z0-9]/g, "") === vLower);
        });
        if (!existsInCustom) {
          unmapped.add(v);
        }
      }
    }
  }

  const unmappedList = Array.from(unmapped);
  if (unmappedList.length > 0) {
    checks.push({
      id: "variables_mapped",
      category: "content",
      label: "Variable Tag Mapping",
      status: "WARN",
      message: `Variables {{${unmappedList.join("}}, {{")}}} not found in recipient data. Fallbacks or blanks will be used.`
    });
  } else if (contentVars.size > 0) {
    checks.push({
      id: "variables_mapped",
      category: "content",
      label: "Variable Tag Mapping",
      status: "PASS",
      message: `All ${contentVars.size} personalized variable tags correctly mapped.`
    });
  }

  const hasFailures = checks.some((c) => c.status === "FAIL");

  return {
    canSend: !hasFailures && recipients.length > 0,
    checks,
    stats: {
      totalRecipients: recipients.length,
      validEmails,
      invalidEmails,
      unmappedVariables: unmappedList
    }
  };
}

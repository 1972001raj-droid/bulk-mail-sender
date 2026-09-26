/**
 * Personalization Variable Resolver for Mailmeteor-like template rendering.
 * Supports {{variableName}} and default fallback syntax {{variableName | "Fallback Value"}}.
 */

export interface RecipientData {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  title?: string | null;
  customFields?: Record<string, any>;
}

export function extractVariables(text: string): string[] {
  if (!text) return [];
  const regex = /{{\s*([a-zA-Z0-9_]+)(\s*\|\s*["'][^"']*["'])?\s*}}/g;
  const variables = new Set<string>();
  let match;
  while ((match = regex.exec(text)) !== null) {
    variables.add(match[1]);
  }
  return Array.from(variables);
}

export function renderPersonalizedText(template: string, data: RecipientData): string {
  if (!template) return "";

  // Normalize recipient data into a flat lookup map (case-insensitive keys)
  const lookup: Record<string, string> = {};

  lookup["email"] = data.email || "";
  lookup["firstname"] = data.firstName || "";
  lookup["lastname"] = data.lastName || "";
  lookup["name"] = [data.firstName, data.lastName].filter(Boolean).join(" ") || data.firstName || "";
  lookup["company"] = data.company || "";
  lookup["title"] = data.title || "";

  if (data.customFields && typeof data.customFields === "object") {
    for (const [k, v] of Object.entries(data.customFields)) {
      if (v !== null && v !== undefined) {
        lookup[k.toLowerCase().replace(/[^a-z0-9]/g, "")] = String(v);
        lookup[k.toLowerCase()] = String(v);
      }
    }
  }

  // Replace {{varName}} or {{varName | "fallback"}}
  return template.replace(/{{\s*([a-zA-Z0-9_]+)(?:\s*\|\s*["']([^"']*)["'])?\s*}}/g, (match, varName, fallback) => {
    const key = varName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const val = lookup[key];
    if (val !== undefined && val.trim() !== "") {
      return val;
    }
    if (fallback !== undefined) {
      return fallback;
    }
    return match; // Keep as is if no fallback or value
  });
}

/**
 * Injects open tracking pixel and click tracking links into HTML body
 */
export function injectTracking(
  htmlBody: string,
  tracking: {
    openTrackingUrl?: string;
    trackOpens?: boolean;
    trackClicks?: boolean;
    unsubscribeUrl?: string;
    clickTrackingUrls?: Map<string, string>;
  }
): string {
  let content = htmlBody || "";

  // Wrap href links for click tracking if enabled
  if (tracking.trackClicks && tracking.clickTrackingUrls) {
    content = content.replace(/<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi, (match, quote, originalUrl) => {
      // Don't wrap mailto, anchors, or an unrecognized destination.
      if (originalUrl.startsWith("mailto:") || originalUrl.startsWith("#") || originalUrl.includes("/api/v1/track/")) {
        return match;
      }

      let normalizedUrl: string;
      try {
        normalizedUrl = new URL(originalUrl).toString();
      } catch {
        return match;
      }
      const trackedUrl = tracking.clickTrackingUrls?.get(normalizedUrl);
      if (!trackedUrl) return match;
      return match.replace(originalUrl, trackedUrl);
    });
  }

  // Inject unsubscribe link if requested or present in footer
  if (tracking.unsubscribeUrl) {
    const unsubLink = `<div style="margin-top: 32px; font-size: 11px; color: #888888; text-align: center;">If you'd prefer not to receive these emails, you can <a href="${tracking.unsubscribeUrl}" style="color: #666666; text-decoration: underline;">unsubscribe here</a>.</div>`;
    content += unsubLink;
  }

  // Inject 1x1 transparent tracking pixel
  if (tracking.trackOpens && tracking.openTrackingUrl) {
    const pixelTag = `<img src="${tracking.openTrackingUrl}" width="1" height="1" alt="" style="display:none !important; width:1px; height:1px; border:0;" />`;
    if (content.includes("</body>")) {
      content = content.replace("</body>", `${pixelTag}</body>`);
    } else {
      content += pixelTag;
    }
  }

  return content;
}

/**
 * Set of known disposable / temporary email provider domains.
 */
const DISPOSABLE_DOMAINS = new Set<string>([
  "10minutemail.com",
  "10minutemail.net",
  "20minutemail.com",
  "airmail.cc",
  "anonaddy.com",
  "burnermail.io",
  "crazymailing.com",
  "discard.email",
  "dispostable.com",
  "drdrb.net",
  "dropmail.me",
  "emailondeck.com",
  "fakemailgenerator.com",
  "fakeinbox.com",
  "getairmail.com",
  "guerrillamail.biz",
  "guerrillamail.com",
  "guerrillamail.de",
  "guerrillamail.info",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamailblock.com",
  "inboxbear.com",
  "inboxkitten.com",
  "maildrop.cc",
  "mailinator.com",
  "mailinator.net",
  "mailinator2.com",
  "mailnesia.com",
  "mohmal.com",
  "mytemp.email",
  "nada.ltd",
  "nada.email",
  "nada.tempmail.com",
  "sharklasers.com",
  "spam4.me",
  "spambog.com",
  "spamevader.com",
  "spamfree24.org",
  "spaml.com",
  "temp-mail.org",
  "temp-mail.ru",
  "tempmail.com",
  "tempmail.net",
  "tempmailaddress.com",
  "throwawaymail.com",
  "trashmail.com",
  "trashmail.net",
  "trashmail.org",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "zillamail.com"
]);

/**
 * Checks if a domain belongs to a known disposable email provider.
 */
export function isDisposableDomain(domain: string): boolean {
  if (!domain) return false;
  const cleanDomain = domain.toLowerCase().trim();
  if (DISPOSABLE_DOMAINS.has(cleanDomain)) return true;

  // Check subdomains
  const parts = cleanDomain.split(".");
  if (parts.length > 2) {
    const rootDomain = parts.slice(-2).join(".");
    return DISPOSABLE_DOMAINS.has(rootDomain);
  }

  return false;
}

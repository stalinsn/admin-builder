const BASE_DISPOSABLE_EMAIL_DOMAINS = [
  '10minutemail.com',
  '10minutemail.net',
  'dispostable.com',
  'fakeinbox.com',
  'getnada.com',
  'guerrillamail.com',
  'maildrop.cc',
  'mailinator.com',
  'mailnesia.com',
  'moakt.com',
  'sharklasers.com',
  'temp-mail.org',
  'tempmail.com',
  'throwawaymail.com',
  'trashmail.com',
  'uorak.com',
  'yopmail.com',
  'yopmail.net',
] as const;

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^\.+/, '').replace(/\.+$/, '');
}

export function parseBlockedEmailDomains(rawValue: string | null | undefined): string[] {
  if (!rawValue) return [];
  return rawValue
    .split(/[\s,;\n]+/)
    .map(normalizeDomain)
    .filter(Boolean);
}

export function getBlockedEmailDomains(extraDomains?: string | null): string[] {
  const domains = new Set<string>(BASE_DISPOSABLE_EMAIL_DOMAINS.map(normalizeDomain));
  for (const domain of parseBlockedEmailDomains(extraDomains)) {
    domains.add(domain);
  }
  return [...domains].sort();
}

export function getEmailDomain(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === normalized.length - 1) return null;
  return normalizeDomain(normalized.slice(atIndex + 1));
}

export function findBlockedEmailDomain(email: string, extraDomains?: string | null): string | null {
  const domain = getEmailDomain(email);
  if (!domain) return null;

  for (const blockedDomain of getBlockedEmailDomains(extraDomains)) {
    if (domain === blockedDomain || domain.endsWith(`.${blockedDomain}`)) {
      return blockedDomain;
    }
  }

  return null;
}

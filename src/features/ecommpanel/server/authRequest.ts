import 'server-only';

import type { NextRequest } from 'next/server';

import { safeCompare, sha256 } from './crypto';
import { getClientIp, getUserAgent } from './requestMeta';

export function isTrustedOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  const host = req.headers.get('host');
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function hasValidCsrf(req: NextRequest, csrfToken: string, cookieName: string): boolean {
  const headerToken = req.headers.get('x-csrf-token')?.trim();
  const cookieToken = req.cookies.get(cookieName)?.value?.trim();
  if (!headerToken || !cookieToken) return false;
  if (!safeCompare(cookieToken, csrfToken)) return false;
  return safeCompare(headerToken, csrfToken);
}

export function validateRequestFingerprint(req: NextRequest, userAgentHash: string, ipHash: string): boolean {
  const incomingUaHash = sha256(getUserAgent(req));
  const incomingIpHash = sha256(getClientIp(req));
  if (!safeCompare(incomingUaHash, userAgentHash)) return false;
  void incomingIpHash;
  void ipHash;
  return true;
}

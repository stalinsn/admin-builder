import 'server-only';

import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

import type { CustomerAccountRecord } from '@/features/ecommerce/types/account';

import { CUSTOMER_ACCOUNT_SECURITY } from '../config/accountSecurity';
import { clearCustomerAuthCookies, getCustomerSessionCookieMaxAgeSeconds, setCustomerAuthCookies } from './customerAuthCookies';
import {
  hasValidCustomerCsrf as hasValidCustomerCsrfBase,
  isTrustedCustomerOrigin as isTrustedCustomerOriginBase,
  validateCustomerRequestFingerprint,
} from './customerAuthRequest';
import { buildCustomerMeResponse, deleteCustomerSession, getCustomerSession, touchCustomerSession } from './customerAccountStore';

export type CustomerAuthContext = {
  rawSessionId: string;
  account: CustomerAccountRecord;
  csrfToken: string;
  session: {
    email: string;
    startedAt: string;
    expiresAt: string;
  };
};

export { clearCustomerAuthCookies, getCustomerSessionCookieMaxAgeSeconds, setCustomerAuthCookies };

export function isTrustedCustomerOrigin(req: NextRequest): boolean {
  return isTrustedCustomerOriginBase(req);
}

export function hasValidCustomerCsrf(req: NextRequest, csrfToken: string): boolean {
  return hasValidCustomerCsrfBase(req, csrfToken, CUSTOMER_ACCOUNT_SECURITY.csrfCookieName);
}

export async function getCustomerApiAuthContext(req: NextRequest, options?: { touch?: boolean }): Promise<CustomerAuthContext | null> {
  const rawSessionId = req.cookies.get(CUSTOMER_ACCOUNT_SECURITY.sessionCookieName)?.value;
  if (!rawSessionId) return null;

  const resolved = options?.touch === false ? await getCustomerSession(rawSessionId) : await touchCustomerSession(rawSessionId);
  if (!resolved) {
    await deleteCustomerSession(rawSessionId);
    return null;
  }

  if (!validateCustomerRequestFingerprint(req, resolved.userAgentHash, resolved.ipHash)) {
    await deleteCustomerSession(rawSessionId);
    return null;
  }

  return {
    rawSessionId,
    account: resolved.account,
    csrfToken: resolved.csrfToken,
    session: resolved.session,
  };
}

export async function getCustomerFromCookies() {
  const cookieStore = await cookies();
  const rawSessionId = cookieStore.get(CUSTOMER_ACCOUNT_SECURITY.sessionCookieName)?.value;
  return buildCustomerMeResponse(rawSessionId);
}

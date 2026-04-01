import 'server-only';

import type { NextResponse } from 'next/server';

import { CUSTOMER_ACCOUNT_RUNTIME, CUSTOMER_ACCOUNT_SECURITY } from '../config/accountSecurity';

export function getCustomerSessionCookieMaxAgeSeconds(session: { expiresAt: string }): number {
  return Math.max(1, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000));
}

export function setCustomerAuthCookies(
  response: NextResponse,
  rawSessionId: string,
  csrfToken: string,
  options?: { maxAgeSeconds?: number },
): void {
  const maxAgeSeconds = options?.maxAgeSeconds || Math.floor(CUSTOMER_ACCOUNT_SECURITY.sessionTtlMs / 1000);
  response.cookies.set(CUSTOMER_ACCOUNT_SECURITY.sessionCookieName, rawSessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: CUSTOMER_ACCOUNT_RUNTIME.secureCookie,
    path: '/',
    maxAge: maxAgeSeconds,
  });

  response.cookies.set(CUSTOMER_ACCOUNT_SECURITY.csrfCookieName, csrfToken, {
    httpOnly: false,
    sameSite: 'lax',
    secure: CUSTOMER_ACCOUNT_RUNTIME.secureCookie,
    path: '/',
    maxAge: maxAgeSeconds,
  });
}

export function clearCustomerAuthCookies(response: NextResponse): void {
  response.cookies.delete({ name: CUSTOMER_ACCOUNT_SECURITY.sessionCookieName, path: '/' });
  response.cookies.delete({ name: CUSTOMER_ACCOUNT_SECURITY.csrfCookieName, path: '/' });
}

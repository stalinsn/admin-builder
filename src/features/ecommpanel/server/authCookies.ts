import 'server-only';

import type { NextResponse } from 'next/server';

import { PANEL_RUNTIME, PANEL_SECURITY } from '../config/security';
import type { PanelSession } from '../types/auth';

export function getSessionCookieMaxAgeSeconds(session: PanelSession): number {
  return Math.max(1, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000));
}

export function setAuthCookies(
  response: NextResponse,
  rawSessionId: string,
  csrfToken: string,
  options?: { maxAgeSeconds?: number },
): void {
  const maxAgeSeconds = options?.maxAgeSeconds || Math.floor(PANEL_SECURITY.sessionTtlMs / 1000);
  response.cookies.set(PANEL_SECURITY.sessionCookieName, rawSessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: PANEL_RUNTIME.secureCookie,
    path: '/',
    maxAge: maxAgeSeconds,
  });

  response.cookies.set(PANEL_SECURITY.csrfCookieName, csrfToken, {
    httpOnly: false,
    sameSite: 'lax',
    secure: PANEL_RUNTIME.secureCookie,
    path: '/',
    maxAge: maxAgeSeconds,
  });
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.delete({ name: PANEL_SECURITY.sessionCookieName, path: '/' });
  response.cookies.delete({ name: PANEL_SECURITY.csrfCookieName, path: '/' });
}

import 'server-only';

import { cookies, headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { PANEL_SECURITY } from '../config/security';
import type { AuthenticatedPanelUser, PanelPermission, PanelSession, PanelUserRecord } from '../types/auth';
import { safeCompare, sha256 } from './crypto';
import { getSessionCookieMaxAgeSeconds, setAuthCookies, clearAuthCookies } from './authCookies';
import { hasValidCsrf as hasValidCsrfBase, isTrustedOrigin as isTrustedOriginBase, validateRequestFingerprint } from './authRequest';
import {
  deleteSession,
  ensureSeededUsers,
  getSession,
  getUserById,
  sanitizeUser,
  touchSession,
} from './panelStore';
import { withResolvedPermissions } from './rbac';

export type PanelAuthContext = {
  rawSessionId: string;
  user: AuthenticatedPanelUser;
  csrfToken: string;
  session: PanelSession;
};

export { clearAuthCookies, getSessionCookieMaxAgeSeconds, setAuthCookies };

function toAuthenticatedUser(record: PanelUserRecord): AuthenticatedPanelUser {
  return withResolvedPermissions(sanitizeUser(record));
}

export function isTrustedOrigin(req: NextRequest): boolean {
  return isTrustedOriginBase(req);
}

export function hasValidCsrf(req: NextRequest, csrfToken: string): boolean {
  return hasValidCsrfBase(req, csrfToken, PANEL_SECURITY.csrfCookieName);
}

export function hasPermission(user: AuthenticatedPanelUser, permission: PanelPermission): boolean {
  return user.permissions.includes(permission);
}

export async function getApiAuthContext(req: NextRequest, options?: { touch?: boolean }): Promise<PanelAuthContext | null> {
  await ensureSeededUsers();
  const rawSessionId = req.cookies.get(PANEL_SECURITY.sessionCookieName)?.value;
  if (!rawSessionId) return null;

  const session = options?.touch === false ? await getSession(rawSessionId) : await touchSession(rawSessionId);
  if (!session) {
    await deleteSession(rawSessionId);
    return null;
  }

  const expired = Date.now() >= new Date(session.expiresAt).getTime();
  if (expired) {
    await deleteSession(rawSessionId);
    return null;
  }

  const userRecord = await getUserById(session.userId);
  if (!userRecord || !userRecord.active) {
    await deleteSession(rawSessionId);
    return null;
  }

  if (!validateRequestFingerprint(req, session.userAgentHash, session.ipHash)) {
    await deleteSession(rawSessionId);
    return null;
  }

  return {
    rawSessionId,
    user: toAuthenticatedUser(userRecord),
    csrfToken: session.csrfToken,
    session,
  };
}

export async function getPanelUserFromCookies(): Promise<AuthenticatedPanelUser | null> {
  await ensureSeededUsers();

  const cookieStore = await cookies();
  const rawSessionId = cookieStore.get(PANEL_SECURITY.sessionCookieName)?.value;
  if (!rawSessionId) return null;

  const session = await touchSession(rawSessionId);
  if (!session) return null;

  const expired = Date.now() >= new Date(session.expiresAt).getTime();
  if (expired) {
    await deleteSession(rawSessionId);
    return null;
  }

  const requestHeaders = await headers();
  const userAgent = requestHeaders.get('user-agent') || 'unknown';
  if (!safeCompare(sha256(userAgent), session.userAgentHash)) {
    await deleteSession(rawSessionId);
    return null;
  }

  const userRecord = await getUserById(session.userId);
  if (!userRecord || !userRecord.active) {
    await deleteSession(rawSessionId);
    return null;
  }

  return toAuthenticatedUser(userRecord);
}

import type { NextRequest } from 'next/server';
import { PANEL_SECURITY } from '@/features/ecommpanel/config/security';
import { getSessionCookieMaxAgeSeconds, isTrustedOrigin, setAuthCookies } from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import {
  addAuditEvent,
  createSession,
  ensureSeededUsers,
  getUserByEmail,
  isUserLocked,
  recordFailedLogin,
  resetFailedLogin,
  sanitizeUser,
} from '@/features/ecommpanel/server/panelStore';
import { verifyPassword } from '@/features/ecommpanel/server/password';
import { getRequestFingerprint, getClientIp, getUserAgent } from '@/features/ecommpanel/server/requestMeta';
import { checkRateLimit } from '@/features/ecommpanel/server/rateLimit';
import { isDemoUser, withResolvedPermissions } from '@/features/ecommpanel/server/rbac';

export const dynamic = 'force-dynamic';

const INVALID_CREDENTIALS_MESSAGE = 'Credenciais inválidas.';

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(req: NextRequest) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const rate = checkRateLimit(
    `auth:login:${getRequestFingerprint(req)}`,
    PANEL_SECURITY.rateLimits.login.limit,
    PANEL_SECURITY.rateLimits.login.windowMs,
  );

  if (!rate.allowed) {
    const response = errorNoStore(429, 'Muitas tentativas. Aguarde para tentar novamente.');
    response.headers.set('Retry-After', String(rate.retryAfterSeconds));
    return response;
  }

  const body = (await req.json().catch(() => null)) as LoginBody | null;
  const email = body?.email?.trim().toLowerCase() || '';
  const password = body?.password || '';

  if (!email || !password) {
    return errorNoStore(400, 'Informe e-mail e senha.');
  }

  await ensureSeededUsers();
  const user = await getUserByEmail(email);

  if (!user || !user.active) {
    addAuditEvent({
      event: 'auth.login',
      outcome: 'failure',
      target: email,
    });
    return errorNoStore(401, INVALID_CREDENTIALS_MESSAGE);
  }

  if (isUserLocked(user)) {
    addAuditEvent({
      actorUserId: user.id,
      event: 'auth.login.locked',
      outcome: 'failure',
      target: user.email,
    });
    return errorNoStore(423, 'Conta temporariamente bloqueada por segurança.');
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) {
    const lock = await recordFailedLogin(user.id);

    addAuditEvent({
      actorUserId: user.id,
      event: 'auth.login.invalid-password',
      outcome: 'failure',
      target: user.email,
      details: {
        locked: lock.locked,
      },
    });

    if (lock.locked) {
      return errorNoStore(423, 'Conta temporariamente bloqueada por segurança.');
    }

    return errorNoStore(401, INVALID_CREDENTIALS_MESSAGE);
  }

  await resetFailedLogin(user.id);
  const { session, rawSessionId } = await createSession({
    userId: user.id,
    userAgent: getUserAgent(req),
    ip: getClientIp(req),
    hardTtlMs: isDemoUser(user) ? PANEL_SECURITY.demoSessionTtlMs : undefined,
  });

  addAuditEvent({
    actorUserId: user.id,
    event: 'auth.login',
    outcome: 'success',
    target: user.email,
  });

  const authenticatedUser = withResolvedPermissions(sanitizeUser(user));
  const response = jsonNoStore({
    ok: true,
    user: authenticatedUser,
    csrfToken: session.csrfToken,
    mustChangePassword: authenticatedUser.mustChangePassword,
  });

  setAuthCookies(response, rawSessionId, session.csrfToken, {
    maxAgeSeconds: getSessionCookieMaxAgeSeconds(session),
  });
  return response;
}

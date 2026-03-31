import type { NextRequest } from 'next/server';
import { PANEL_SECURITY } from '@/features/ecommpanel/config/security';
import { getSessionCookieMaxAgeSeconds, isTrustedOrigin, setAuthCookies } from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import {
  addAuditEvent,
  consumeLoginToken,
  createSession,
  ensureSeededUsers,
  resetFailedLogin,
  sanitizeUser,
} from '@/features/ecommpanel/server/panelStore';
import { getClientIp, getRequestFingerprint, getUserAgent } from '@/features/ecommpanel/server/requestMeta';
import { checkRateLimit } from '@/features/ecommpanel/server/rateLimit';
import { isDemoUser, withResolvedPermissions } from '@/features/ecommpanel/server/rbac';

export const dynamic = 'force-dynamic';

type LoginTokenVerifyBody = {
  email?: string;
  code?: string;
};

export async function POST(req: NextRequest) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const rate = checkRateLimit(
    `auth:login-token:verify:${getRequestFingerprint(req)}`,
    PANEL_SECURITY.rateLimits.loginTokenVerify.limit,
    PANEL_SECURITY.rateLimits.loginTokenVerify.windowMs,
  );

  if (!rate.allowed) {
    const response = errorNoStore(429, 'Muitas tentativas. Aguarde para validar um novo código.');
    response.headers.set('Retry-After', String(rate.retryAfterSeconds));
    return response;
  }

  const body = (await req.json().catch(() => null)) as LoginTokenVerifyBody | null;
  const email = body?.email?.trim().toLowerCase() || '';
  const code = body?.code?.trim() || '';
  if (!email || !code) {
    return errorNoStore(400, 'Informe e-mail e código.');
  }

  await ensureSeededUsers();
  const user = await consumeLoginToken(email, code);
  if (!user || !user.active) {
    addAuditEvent({
      event: 'auth.login-token.invalid',
      outcome: 'failure',
      target: email,
    });
    return errorNoStore(401, 'Código inválido ou expirado.');
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
    event: 'auth.login-token',
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

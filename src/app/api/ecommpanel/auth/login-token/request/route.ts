import type { NextRequest } from 'next/server';
import { PANEL_SECURITY } from '@/features/ecommpanel/config/security';
import { isTrustedOrigin } from '@/features/ecommpanel/server/auth';
import { isPanelMailEnabled, sendPanelLoginTokenEmail } from '@/features/ecommpanel/server/email';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import { addAuditEvent, ensureSeededUsers, getUserByEmail, issueLoginTokenForUser } from '@/features/ecommpanel/server/panelStore';
import { getRequestFingerprint } from '@/features/ecommpanel/server/requestMeta';
import { checkRateLimit } from '@/features/ecommpanel/server/rateLimit';

export const dynamic = 'force-dynamic';

type LoginTokenRequestBody = {
  email?: string;
};

const GENERIC_MESSAGE = 'Se o e-mail estiver ativo, o código de acesso será enviado.';

export async function POST(req: NextRequest) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const rate = checkRateLimit(
    `auth:login-token:request:${getRequestFingerprint(req)}`,
    PANEL_SECURITY.rateLimits.loginTokenRequest.limit,
    PANEL_SECURITY.rateLimits.loginTokenRequest.windowMs,
  );

  if (!rate.allowed) {
    const response = errorNoStore(429, 'Muitas tentativas. Aguarde para solicitar um novo código.');
    response.headers.set('Retry-After', String(rate.retryAfterSeconds));
    return response;
  }

  const body = (await req.json().catch(() => null)) as LoginTokenRequestBody | null;
  const email = body?.email?.trim().toLowerCase() || '';
  if (!email) {
    return errorNoStore(400, 'Informe um e-mail válido.');
  }

  await ensureSeededUsers();
  const user = await getUserByEmail(email);
  const result = await issueLoginTokenForUser(email);
  const mailEnabled = await isPanelMailEnabled();

  if (!result.ok && result.reason === 'cooldown-active') {
    const response = errorNoStore(429, 'Já existe um código recente para este acesso. Aguarde 90 segundos para reenviar.', {
      expiresAt: result.expiresAt,
      retryAfterSeconds: result.retryAfterSeconds,
    });
    if (result.retryAfterSeconds) {
      response.headers.set('Retry-After', String(result.retryAfterSeconds));
    }
    return response;
  }

  if (result.ok && user?.active) {
    if (mailEnabled) {
      try {
        await sendPanelLoginTokenEmail({
          to: user.email,
          name: user.name,
          code: result.code,
          ttlMinutes: Math.floor(PANEL_SECURITY.loginTokenTtlMs / 60000),
        });
      } catch (error) {
        addAuditEvent({
          actorUserId: user.id,
          event: 'auth.login-token.email-failed',
          outcome: 'failure',
          target: user.email,
          details: {
            reason: error instanceof Error ? error.message : 'unknown-mail-error',
          },
        });
      }
    }

    addAuditEvent({
      actorUserId: user.id,
      event: 'auth.login-token.requested',
      outcome: 'success',
      target: user.email,
      details: {
        deliveryMode: mailEnabled ? 'email' : 'debug',
      },
    });
  }

  return jsonNoStore({
    ok: true,
    message: GENERIC_MESSAGE,
    deliveryMode: mailEnabled ? 'email' : 'debug',
    ...(process.env.NODE_ENV !== 'production' && result.ok ? { debugCode: result.code, expiresAt: result.expiresAt } : {}),
  });
}

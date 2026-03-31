import type { NextRequest } from 'next/server';
import { PANEL_SECURITY } from '@/features/ecommpanel/config/security';
import { isTrustedOrigin } from '@/features/ecommpanel/server/auth';
import { buildResetPasswordUrl, isPanelMailEnabled, sendPanelResetPasswordEmail } from '@/features/ecommpanel/server/email';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import { addAuditEvent, ensureSeededUsers, getUserByEmail, issueResetTokenForUser } from '@/features/ecommpanel/server/panelStore';
import { getRequestFingerprint } from '@/features/ecommpanel/server/requestMeta';
import { checkRateLimit } from '@/features/ecommpanel/server/rateLimit';

export const dynamic = 'force-dynamic';

type ForgotPasswordBody = {
  email?: string;
};

const GENERIC_MESSAGE = 'Se o e-mail existir e estiver ativo, enviaremos as instruções de recuperação.';

export async function POST(req: NextRequest) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const rate = checkRateLimit(
    `auth:forgot:${getRequestFingerprint(req)}`,
    PANEL_SECURITY.rateLimits.forgotPassword.limit,
    PANEL_SECURITY.rateLimits.forgotPassword.windowMs,
  );

  if (!rate.allowed) {
    const response = errorNoStore(429, 'Muitas tentativas. Aguarde para tentar novamente.');
    response.headers.set('Retry-After', String(rate.retryAfterSeconds));
    return response;
  }

  const body = (await req.json().catch(() => null)) as ForgotPasswordBody | null;
  const email = body?.email?.trim().toLowerCase() || '';

  if (!email) {
    return errorNoStore(400, 'Informe um e-mail válido.');
  }

  await ensureSeededUsers();
  const user = await getUserByEmail(email);

  let resetToken: string | null = null;
  const mailEnabled = await isPanelMailEnabled();
  if (user?.active) {
    resetToken = await issueResetTokenForUser(email);

    if (resetToken && mailEnabled) {
      try {
        await sendPanelResetPasswordEmail({
          to: user.email,
          name: user.name,
          rawToken: resetToken,
          origin: req.nextUrl.origin,
          ttlMinutes: Math.floor(PANEL_SECURITY.resetPasswordTtlMs / 60000),
        });
      } catch (error) {
        addAuditEvent({
          actorUserId: user.id,
          event: 'auth.forgot-password.email-failed',
          outcome: 'failure',
          target: email,
          details: {
            reason: error instanceof Error ? error.message : 'unknown-mail-error',
          },
        });
      }
    }
  }

  addAuditEvent({
    actorUserId: user?.id,
    event: 'auth.forgot-password',
    outcome: 'success',
    target: email,
  });

  return jsonNoStore({
    ok: true,
    message: GENERIC_MESSAGE,
    deliveryMode: mailEnabled ? 'email' : 'debug',
    ...(process.env.NODE_ENV !== 'production' && resetToken
      ? {
          debugResetToken: resetToken,
          debugResetUrl: await buildResetPasswordUrl(req.nextUrl.origin, resetToken),
        }
      : {}),
  });
}

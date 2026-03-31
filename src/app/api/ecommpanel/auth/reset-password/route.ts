import type { NextRequest } from 'next/server';
import { PANEL_SECURITY } from '@/features/ecommpanel/config/security';
import { isTrustedOrigin } from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import {
  addAuditEvent,
  consumeResetToken,
  deleteSessionsByUser,
  getUserById,
  setUserPassword,
} from '@/features/ecommpanel/server/panelStore';
import { hashPassword, validatePasswordPolicy } from '@/features/ecommpanel/server/password';
import { getRequestFingerprint } from '@/features/ecommpanel/server/requestMeta';
import { checkRateLimit } from '@/features/ecommpanel/server/rateLimit';

export const dynamic = 'force-dynamic';

type ResetPasswordBody = {
  token?: string;
  password?: string;
};

export async function POST(req: NextRequest) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const rate = checkRateLimit(
    `auth:reset:${getRequestFingerprint(req)}`,
    PANEL_SECURITY.rateLimits.resetPassword.limit,
    PANEL_SECURITY.rateLimits.resetPassword.windowMs,
  );

  if (!rate.allowed) {
    const response = errorNoStore(429, 'Muitas tentativas. Aguarde para tentar novamente.');
    response.headers.set('Retry-After', String(rate.retryAfterSeconds));
    return response;
  }

  const body = (await req.json().catch(() => null)) as ResetPasswordBody | null;
  const token = body?.token?.trim() || '';
  const password = body?.password || '';

  if (!token || !password) {
    return errorNoStore(400, 'Token e senha são obrigatórios.');
  }

  const passwordValidation = validatePasswordPolicy(password);
  if (!passwordValidation.ok) {
    return errorNoStore(400, 'Senha fora da política de segurança.', {
      reasons: passwordValidation.reasons,
    });
  }

  const consumed = await consumeResetToken(token);
  if (!consumed) {
    return errorNoStore(400, 'Token inválido ou expirado.');
  }

  const user = await getUserById(consumed.userId);
  if (!user || !user.active) {
    return errorNoStore(400, 'Usuário inválido para recuperação de senha.');
  }

  const newPasswordHash = await hashPassword(password);
  await setUserPassword(user.id, newPasswordHash);
  const sessionsRevoked = await deleteSessionsByUser(user.id);

  addAuditEvent({
    actorUserId: user.id,
    event: 'auth.reset-password',
    outcome: 'success',
    target: user.email,
    details: { sessionsRevoked },
  });

  return jsonNoStore({ ok: true, sessionsRevoked });
}

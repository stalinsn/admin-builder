import type { NextRequest } from 'next/server';

import { jsonNoStore, errorNoStore } from '@/features/ecommpanel/server/http';
import { getRequestFingerprint } from '@/features/ecommpanel/server/requestMeta';
import { checkRateLimit } from '@/features/ecommpanel/server/rateLimit';
import { sendCustomerLoginTokenEmail } from '@/features/ecommpanel/server/email';
import { CUSTOMER_ACCOUNT_SECURITY } from '@/features/ecommerce/config/accountSecurity';
import { isTrustedCustomerOrigin } from '@/features/ecommerce/server/customerAuth';
import { getCustomerAccountByEmail, issueLoginTokenForCustomerEmail } from '@/features/ecommerce/server/customerAccountStore';

export const dynamic = 'force-dynamic';

const GENERIC_MESSAGE = 'Se o e-mail estiver apto para acesso, o código será enviado.';

export async function POST(req: NextRequest) {
  if (!isTrustedCustomerOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const rate = checkRateLimit(
    `customer:login-token:request:${getRequestFingerprint(req)}`,
    CUSTOMER_ACCOUNT_SECURITY.rateLimits.loginTokenRequest.limit,
    CUSTOMER_ACCOUNT_SECURITY.rateLimits.loginTokenRequest.windowMs,
  );
  if (!rate.allowed) {
    const response = errorNoStore(429, 'Muitas tentativas. Aguarde para solicitar um novo código.');
    response.headers.set('Retry-After', String(rate.retryAfterSeconds));
    return response;
  }

  const body = (await req.json().catch(() => null)) as { email?: string } | null;
  const email = body?.email?.trim().toLowerCase() || '';
  if (!email) {
    return errorNoStore(400, 'Informe um e-mail válido.');
  }

  const result = await issueLoginTokenForCustomerEmail(email);
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

  if (!result.ok && result.reason === 'database-unavailable') {
    return errorNoStore(503, 'Base de clientes indisponível no momento.');
  }

  if (result.ok) {
    const account = await getCustomerAccountByEmail(email);
    if (account?.profile.email) {
      try {
        await sendCustomerLoginTokenEmail({
          to: account.profile.email,
          name: account.profile.fullName || account.profile.firstName || account.profile.email,
          code: result.code,
          ttlMinutes: Math.floor(CUSTOMER_ACCOUNT_SECURITY.loginTokenTtlMs / 60000),
        });
      } catch {
        // do not leak email delivery failures
      }
    }
  }

  return jsonNoStore({
    ok: true,
    message: GENERIC_MESSAGE,
    ...(process.env.NODE_ENV !== 'production' && result.ok ? { debugCode: result.code, expiresAt: result.expiresAt } : {}),
  });
}

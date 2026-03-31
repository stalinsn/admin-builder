import type { NextRequest } from 'next/server';

import { jsonNoStore, errorNoStore } from '@/features/ecommpanel/server/http';
import { getClientIp, getRequestFingerprint, getUserAgent } from '@/features/ecommpanel/server/requestMeta';
import { checkRateLimit } from '@/features/ecommpanel/server/rateLimit';
import { CUSTOMER_ACCOUNT_SECURITY } from '@/features/ecommerce/config/accountSecurity';
import {
  getCustomerSessionCookieMaxAgeSeconds,
  isTrustedCustomerOrigin,
  setCustomerAuthCookies,
} from '@/features/ecommerce/server/customerAuth';
import { consumeCustomerLoginToken, createCustomerSession, getCustomerAccountByEmail } from '@/features/ecommerce/server/customerAccountStore';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isTrustedCustomerOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const rate = checkRateLimit(
    `customer:login-token:verify:${getRequestFingerprint(req)}`,
    CUSTOMER_ACCOUNT_SECURITY.rateLimits.loginTokenVerify.limit,
    CUSTOMER_ACCOUNT_SECURITY.rateLimits.loginTokenVerify.windowMs,
  );
  if (!rate.allowed) {
    const response = errorNoStore(429, 'Muitas tentativas. Aguarde para validar um novo código.');
    response.headers.set('Retry-After', String(rate.retryAfterSeconds));
    return response;
  }

  const body = (await req.json().catch(() => null)) as { email?: string; code?: string } | null;
  const email = body?.email?.trim().toLowerCase() || '';
  const code = body?.code?.trim() || '';
  if (!email || !code) {
    return errorNoStore(400, 'Informe e-mail e código.');
  }

  const profile = await consumeCustomerLoginToken(email, code);
  if (!profile) {
    return errorNoStore(401, 'Código inválido ou expirado.');
  }

  const sessionResult = await createCustomerSession({
    accountId: profile.id,
    userAgent: getUserAgent(req),
    ip: getClientIp(req),
  });
  if (!sessionResult) {
    return errorNoStore(503, 'Não foi possível iniciar a sessão do cliente.');
  }

  const account = await getCustomerAccountByEmail(email);
  const response = jsonNoStore({
    ok: true,
    session: sessionResult.session,
    account,
    csrfToken: sessionResult.csrfToken,
  });

  setCustomerAuthCookies(response, sessionResult.rawSessionId, sessionResult.csrfToken, {
    maxAgeSeconds: getCustomerSessionCookieMaxAgeSeconds(sessionResult.session),
  });
  return response;
}

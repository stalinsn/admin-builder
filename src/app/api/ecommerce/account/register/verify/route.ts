import type { NextRequest } from 'next/server';

import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import { checkRateLimit } from '@/features/ecommpanel/server/rateLimit';
import { getClientIp, getRequestFingerprint, getUserAgent } from '@/features/ecommpanel/server/requestMeta';
import { CUSTOMER_ACCOUNT_SECURITY } from '@/features/ecommerce/config/accountSecurity';
import {
  createCustomerSession,
  getCustomerAccountByEmail,
  verifyPendingCustomerRegistration,
} from '@/features/ecommerce/server/customerAccountStore';
import {
  getCustomerSessionCookieMaxAgeSeconds,
  isTrustedCustomerOrigin,
  setCustomerAuthCookies,
} from '@/features/ecommerce/server/customerAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isTrustedCustomerOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const rate = checkRateLimit(
    `customer:register:verify:${getRequestFingerprint(req)}`,
    CUSTOMER_ACCOUNT_SECURITY.rateLimits.registerVerify.limit,
    CUSTOMER_ACCOUNT_SECURITY.rateLimits.registerVerify.windowMs,
  );
  if (!rate.allowed) {
    const response = errorNoStore(429, 'Muitas tentativas de validação. Aguarde antes de tentar novamente.');
    response.headers.set('Retry-After', String(rate.retryAfterSeconds));
    return response;
  }

  const body = (await req.json().catch(() => null)) as { email?: string; code?: string } | null;
  const email = body?.email?.trim().toLowerCase() || '';
  const code = body?.code?.trim() || '';
  if (!email || !code) {
    return errorNoStore(400, 'Informe e-mail e código para concluir o cadastro.');
  }

  const account = await verifyPendingCustomerRegistration(email, code);
  if (!account) {
    return errorNoStore(401, 'Código inválido ou expirado.');
  }

  const sessionResult = await createCustomerSession({
    accountId: account.profile.id,
    userAgent: getUserAgent(req),
    ip: getClientIp(req),
  });
  if (!sessionResult) {
    return errorNoStore(503, 'Não foi possível iniciar a sessão do cliente.');
  }

  const freshAccount = await getCustomerAccountByEmail(account.profile.email);
  const response = jsonNoStore({
    ok: true,
    account: freshAccount || account,
    session: sessionResult.session,
    csrfToken: sessionResult.csrfToken,
  });

  setCustomerAuthCookies(response, sessionResult.rawSessionId, sessionResult.csrfToken, {
    maxAgeSeconds: getCustomerSessionCookieMaxAgeSeconds(sessionResult.session),
  });
  return response;
}

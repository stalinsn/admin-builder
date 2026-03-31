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
import {
  authenticateCustomerPassword,
  createCustomerSession,
  getCustomerAccountByEmail,
} from '@/features/ecommerce/server/customerAccountStore';
import type { CustomerPasswordLoginPayload } from '@/features/ecommerce/types/account';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isTrustedCustomerOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const rate = checkRateLimit(
    `customer:login-password:${getRequestFingerprint(req)}`,
    CUSTOMER_ACCOUNT_SECURITY.rateLimits.loginPassword.limit,
    CUSTOMER_ACCOUNT_SECURITY.rateLimits.loginPassword.windowMs,
  );
  if (!rate.allowed) {
    const response = errorNoStore(429, 'Muitas tentativas. Aguarde para tentar novamente.');
    response.headers.set('Retry-After', String(rate.retryAfterSeconds));
    return response;
  }

  const body = (await req.json().catch(() => null)) as CustomerPasswordLoginPayload | null;
  const identifier = body?.identifier?.trim() || '';
  const password = body?.password || '';
  if (!identifier || !password) {
    return errorNoStore(400, 'Informe e-mail ou CPF e sua senha.');
  }

  const profile = await authenticateCustomerPassword({ identifier, password });
  if (!profile) {
    return errorNoStore(401, 'Credenciais inválidas ou acesso temporariamente bloqueado.');
  }

  const sessionResult = await createCustomerSession({
    accountId: profile.id,
    userAgent: getUserAgent(req),
    ip: getClientIp(req),
  });
  if (!sessionResult) {
    return errorNoStore(503, 'Não foi possível iniciar a sessão do cliente.');
  }

  const account = await getCustomerAccountByEmail(profile.email);
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

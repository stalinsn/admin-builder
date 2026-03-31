import type { NextRequest } from 'next/server';

import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import { getRequestFingerprint } from '@/features/ecommpanel/server/requestMeta';
import { checkRateLimit } from '@/features/ecommpanel/server/rateLimit';
import { CUSTOMER_ACCOUNT_SECURITY } from '@/features/ecommerce/config/accountSecurity';
import { getCustomerApiAuthContext, hasValidCustomerCsrf, isTrustedCustomerOrigin } from '@/features/ecommerce/server/customerAuth';
import { createCustomerLgpdRequest } from '@/features/ecommerce/server/customerAccountStore';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isTrustedCustomerOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const auth = await getCustomerApiAuthContext(req);
  if (!auth) {
    return errorNoStore(401, 'Sessão do cliente não encontrada.');
  }

  if (!hasValidCustomerCsrf(req, auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const rate = checkRateLimit(
    `customer:lgpd:${getRequestFingerprint(req)}`,
    CUSTOMER_ACCOUNT_SECURITY.rateLimits.lgpdErasureRequest.limit,
    CUSTOMER_ACCOUNT_SECURITY.rateLimits.lgpdErasureRequest.windowMs,
  );
  if (!rate.allowed) {
    const response = errorNoStore(429, 'Solicitação enviada recentemente. Aguarde para reenviar.');
    response.headers.set('Retry-After', String(rate.retryAfterSeconds));
    return response;
  }

  const request = await createCustomerLgpdRequest({
    accountId: auth.account.profile.id,
    type: 'erasure_request',
    source: 'customer',
    notes: 'Solicitação enviada pela própria conta.',
  });

  if (!request) {
    return errorNoStore(400, 'Não foi possível registrar a solicitação de exclusão.');
  }

  return jsonNoStore({
    ok: true,
    request,
    message: 'Solicitação registrada. A conta entra na fila interna de tratamento LGPD.',
  });
}

import type { NextRequest } from 'next/server';

import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import { getRequestFingerprint } from '@/features/ecommpanel/server/requestMeta';
import { checkRateLimit } from '@/features/ecommpanel/server/rateLimit';
import { CUSTOMER_ACCOUNT_SECURITY } from '@/features/ecommerce/config/accountSecurity';
import { getCustomerApiAuthContext, hasValidCustomerCsrf, isTrustedCustomerOrigin } from '@/features/ecommerce/server/customerAuth';
import { updateCustomerProfile } from '@/features/ecommerce/server/customerAccountStore';
import type { CustomerRegistrationPayload } from '@/features/ecommerce/types/account';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
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
    `customer:profile:${getRequestFingerprint(req)}`,
    CUSTOMER_ACCOUNT_SECURITY.rateLimits.profileMutation.limit,
    CUSTOMER_ACCOUNT_SECURITY.rateLimits.profileMutation.windowMs,
  );
  if (!rate.allowed) {
    const response = errorNoStore(429, 'Muitas alterações em sequência. Aguarde para tentar novamente.');
    response.headers.set('Retry-After', String(rate.retryAfterSeconds));
    return response;
  }

  const body = (await req.json().catch(() => null)) as Partial<CustomerRegistrationPayload> | null;
  if (!body) {
    return errorNoStore(400, 'Dados inválidos para atualização.');
  }

  const account = await updateCustomerProfile(auth.account.profile.id, body);
  if (!account) {
    return errorNoStore(404, 'Conta do cliente não encontrada.');
  }

  return jsonNoStore({ ok: true, account });
}

import type { NextRequest } from 'next/server';

import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import { getRequestFingerprint } from '@/features/ecommpanel/server/requestMeta';
import { checkRateLimit } from '@/features/ecommpanel/server/rateLimit';
import { CUSTOMER_ACCOUNT_SECURITY } from '@/features/ecommerce/config/accountSecurity';
import { getCustomerApiAuthContext } from '@/features/ecommerce/server/customerAuth';
import { createCustomerLgpdRequest, exportCustomerLgpdPackage } from '@/features/ecommerce/server/customerAccountStore';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await getCustomerApiAuthContext(req);
  if (!auth) {
    return errorNoStore(401, 'Sessão do cliente não encontrada.');
  }

  const rate = checkRateLimit(
    `customer:lgpd-export:${getRequestFingerprint(req)}`,
    CUSTOMER_ACCOUNT_SECURITY.rateLimits.lgpdExport.limit,
    CUSTOMER_ACCOUNT_SECURITY.rateLimits.lgpdExport.windowMs,
  );
  if (!rate.allowed) {
    const response = errorNoStore(429, 'Exportação solicitada recentemente. Aguarde para tentar de novo.');
    response.headers.set('Retry-After', String(rate.retryAfterSeconds));
    return response;
  }

  const data = await exportCustomerLgpdPackage(auth.account.profile.id);
  if (!data) {
    return errorNoStore(404, 'Não foi possível montar o pacote de dados da conta.');
  }

  await createCustomerLgpdRequest({
    accountId: auth.account.profile.id,
    type: 'export',
    source: 'customer',
    notes: 'Exportação solicitada pela própria conta.',
  });

  return jsonNoStore({
    ok: true,
    data,
  });
}

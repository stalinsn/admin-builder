import type { NextRequest } from 'next/server';

import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import { clearCustomerAuthCookies, getCustomerApiAuthContext, hasValidCustomerCsrf, isTrustedCustomerOrigin } from '@/features/ecommerce/server/customerAuth';
import { deleteCustomerSession } from '@/features/ecommerce/server/customerAccountStore';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isTrustedCustomerOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const auth = await getCustomerApiAuthContext(req, { touch: false });
  if (!auth) {
    const response = jsonNoStore({ ok: true });
    clearCustomerAuthCookies(response);
    return response;
  }

  if (!hasValidCustomerCsrf(req, auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  await deleteCustomerSession(auth.rawSessionId);
  const response = jsonNoStore({ ok: true });
  clearCustomerAuthCookies(response);
  return response;
}

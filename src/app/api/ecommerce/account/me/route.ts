import type { NextRequest } from 'next/server';

import { jsonNoStore } from '@/features/ecommpanel/server/http';
import {
  clearCustomerAuthCookies,
  getCustomerApiAuthContext,
  getCustomerSessionCookieMaxAgeSeconds,
  setCustomerAuthCookies,
} from '@/features/ecommerce/server/customerAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await getCustomerApiAuthContext(req);
  if (!auth) {
    const response = jsonNoStore({ authenticated: false, session: null, account: null });
    if (req.cookies.get('ecom_customer_session')?.value) {
      clearCustomerAuthCookies(response);
    }
    return response;
  }

  const response = jsonNoStore({
    authenticated: true,
    session: auth.session,
    account: auth.account,
    csrfToken: auth.csrfToken,
  });

  setCustomerAuthCookies(response, auth.rawSessionId, auth.csrfToken, {
    maxAgeSeconds: getCustomerSessionCookieMaxAgeSeconds(auth.session),
  });

  return response;
}

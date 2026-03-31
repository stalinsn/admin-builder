import type { NextRequest } from 'next/server';

import { canManageCustomerRetention, canReadCustomerLgpd } from '@/features/ecommerce/server/orderPermissions';
import { listCustomerLgpdRequestsAdmin, listCustomerRetentionPoliciesAdmin } from '@/features/ecommerce/server/customerAccountStore';
import { getApiAuthContext } from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) return errorNoStore(401, 'Não autenticado.');
  if (!canReadCustomerLgpd(auth.user)) {
    return errorNoStore(403, 'Sem permissão para acessar o centro LGPD.');
  }

  return jsonNoStore({
    requests: await listCustomerLgpdRequestsAdmin(),
    policies: await listCustomerRetentionPoliciesAdmin(),
    capabilities: {
      canManageRetention: canManageCustomerRetention(auth.user),
    },
  });
}

import type { NextRequest } from 'next/server';

import type {
  CommerceOrderFinancialStatus,
  CommerceOrderFulfillmentStatus,
  CommerceOrderStatus,
} from '@/features/ecommerce/types/commerceOrder';
import { listCommerceOrders } from '@/features/ecommerce/server/orderStore';
import { canAccessOrderWorkspace } from '@/features/ecommerce/server/orderPermissions';
import { getApiAuthContext } from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';

export const dynamic = 'force-dynamic';

async function requireOrderPermission(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) return { error: errorNoStore(401, 'Não autenticado.') };
  if (!canAccessOrderWorkspace(auth.user)) {
    return { error: errorNoStore(403, 'Sem permissão para acessar pedidos.') };
  }
  return { auth };
}

export async function GET(req: NextRequest) {
  const guard = await requireOrderPermission(req);
  if ('error' in guard) return guard.error;

  const { searchParams } = new URL(req.url);
  const orders = await listCommerceOrders({
    q: searchParams.get('q') || undefined,
    status: (searchParams.get('status') as CommerceOrderStatus | null) || undefined,
    financialStatus: (searchParams.get('financialStatus') as CommerceOrderFinancialStatus | null) || undefined,
    fulfillmentStatus: (searchParams.get('fulfillmentStatus') as CommerceOrderFulfillmentStatus | null) || undefined,
    page: Number(searchParams.get('page') || 1),
    limit: Number(searchParams.get('limit') || 20),
  });

  return jsonNoStore(orders);
}

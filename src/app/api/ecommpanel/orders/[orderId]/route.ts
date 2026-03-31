import type { NextRequest } from 'next/server';

import { canManageOrders, canAccessOrderWorkspace } from '@/features/ecommerce/server/orderPermissions';
import { getCommerceOrderById, updateCommerceOrder } from '@/features/ecommerce/server/orderStore';
import { getApiAuthContext, hasValidCsrf, isTrustedOrigin } from '@/features/ecommpanel/server/auth';
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

export async function GET(req: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  const guard = await requireOrderPermission(req);
  if ('error' in guard) return guard.error;

  const { orderId } = await context.params;
  const order = await getCommerceOrderById(orderId);
  if (!order) return errorNoStore(404, 'Pedido não encontrado.');

  return jsonNoStore({ order });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const guard = await requireOrderPermission(req);
  if ('error' in guard) return guard.error;
  if (!canManageOrders(guard.auth.user)) {
    return errorNoStore(403, 'Sem permissão para alterar pedidos.');
  }
  if (!hasValidCsrf(req, guard.auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return errorNoStore(400, 'Payload inválido.');
  }

  const { orderId } = await context.params;
  const order = await updateCommerceOrder(orderId, {
    status: typeof body.status === 'string' ? body.status : undefined,
    financialStatus: typeof body.financialStatus === 'string' ? body.financialStatus : undefined,
    fulfillmentStatus: typeof body.fulfillmentStatus === 'string' ? body.fulfillmentStatus : undefined,
    items: Array.isArray(body.items) ? body.items : undefined,
    totals: body.totals && typeof body.totals === 'object' ? body.totals : undefined,
    customerSnapshot: body.customerSnapshot && typeof body.customerSnapshot === 'object' ? body.customerSnapshot : undefined,
    shippingSnapshot: body.shippingSnapshot && typeof body.shippingSnapshot === 'object' ? body.shippingSnapshot : undefined,
    logistics: body.logistics && typeof body.logistics === 'object' ? body.logistics : undefined,
    title: typeof body.title === 'string' ? body.title : undefined,
    description: typeof body.description === 'string' ? body.description : undefined,
    visibility: typeof body.visibility === 'string' ? body.visibility : undefined,
    actorType: 'admin',
    actorId: guard.auth.user.id,
    eventKind: typeof body.eventKind === 'string' ? body.eventKind : undefined,
    payload: body.payload && typeof body.payload === 'object' ? body.payload : undefined,
  });

  if (!order) return errorNoStore(404, 'Pedido não encontrado.');
  return jsonNoStore({ ok: true, order });
}

import type { NextRequest } from 'next/server';

import {
  canApproveCustomerLgpd,
  canExecuteCustomerLgpd,
  canReadCustomerLgpd,
  canRequestCustomerLgpd,
} from '@/features/ecommerce/server/orderPermissions';
import {
  anonymizeCustomerAccount,
  createCustomerLgpdRequest,
  exportCustomerLgpdPackage,
  reviewCustomerLgpdRequest,
} from '@/features/ecommerce/server/customerAccountStore';
import {
  getApiAuthContext,
  hasValidCsrf,
  isTrustedOrigin,
} from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';

export const dynamic = 'force-dynamic';

type Body = {
  action?: 'request-erasure' | 'approve-erasure' | 'reject-erasure' | 'execute-anonymization';
  requestId?: string;
  notes?: string;
};

async function requireCustomerAccess(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) return { error: errorNoStore(401, 'Não autenticado.') };
  if (!canReadCustomerLgpd(auth.user)) {
    return { error: errorNoStore(403, 'Sem permissão para acessar LGPD de clientes.') };
  }
  return { auth };
}

export async function GET(req: NextRequest, context: { params: Promise<{ customerId: string }> }) {
  const guard = await requireCustomerAccess(req);
  if ('error' in guard) return guard.error;

  const { customerId } = await context.params;
  const data = await exportCustomerLgpdPackage(customerId);
  if (!data) {
    return errorNoStore(404, 'Cliente não encontrado para exportação.');
  }

  return jsonNoStore({
    ok: true,
    data,
  });
}

export async function POST(req: NextRequest, context: { params: Promise<{ customerId: string }> }) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const guard = await requireCustomerAccess(req);
  if ('error' in guard) return guard.error;
  if (!hasValidCsrf(req, guard.auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const { customerId } = await context.params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.action) {
    return errorNoStore(400, 'Ação LGPD obrigatória.');
  }

  if (body.action === 'request-erasure') {
    if (!canRequestCustomerLgpd(guard.auth.user)) {
      return errorNoStore(403, 'Sem permissão para registrar solicitação LGPD.');
    }
    const request = await createCustomerLgpdRequest({
      accountId: customerId,
      type: 'erasure_request',
      source: 'admin',
      notes: body.notes,
    });
    if (!request) return errorNoStore(404, 'Cliente não encontrado.');
    return jsonNoStore({ ok: true, request });
  }

  if (body.action === 'approve-erasure' || body.action === 'reject-erasure') {
    if (!canApproveCustomerLgpd(guard.auth.user)) {
      return errorNoStore(403, 'Sem permissão para aprovar solicitações LGPD.');
    }
    if (!body.requestId) {
      return errorNoStore(400, 'requestId é obrigatório para revisão.');
    }
    const request = await reviewCustomerLgpdRequest(body.requestId, {
      decision: body.action === 'approve-erasure' ? 'approved' : 'rejected',
      actorUserId: guard.auth.user.id,
      actorUserName: guard.auth.user.name,
      notes: body.notes,
    });
    if (!request) return errorNoStore(404, 'Solicitação LGPD não encontrada.');
    return jsonNoStore({ ok: true, request });
  }

  if (body.action === 'execute-anonymization') {
    if (!canExecuteCustomerLgpd(guard.auth.user)) {
      return errorNoStore(403, 'Sem permissão para executar anonimização.');
    }
    const request = await anonymizeCustomerAccount(customerId, {
      requestId: body.requestId,
      actorType: 'admin',
      actorId: guard.auth.user.id,
      actorName: guard.auth.user.name,
      notes: body.notes,
    });
    if (!request) return errorNoStore(409, 'A conta precisa de uma solicitação aprovada antes da anonimização.');
    return jsonNoStore({ ok: true, request });
  }

  return errorNoStore(400, 'Ação LGPD inválida.');
}

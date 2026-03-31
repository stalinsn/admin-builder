import type { NextRequest } from 'next/server';

import { canManageCustomerRetention, canReadCustomerLgpd } from '@/features/ecommerce/server/orderPermissions';
import { listCustomerRetentionPoliciesAdmin, updateCustomerRetentionPolicy } from '@/features/ecommerce/server/customerAccountStore';
import { getApiAuthContext, hasValidCsrf, isTrustedOrigin } from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';

export const dynamic = 'force-dynamic';

type Body = {
  entityKey?: string;
  action?: 'delete' | 'anonymize' | 'retain_minimum';
  retentionDays?: number;
  legalBasis?: string;
  enabled?: boolean;
};

export async function GET(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) return errorNoStore(401, 'Não autenticado.');
  if (!canReadCustomerLgpd(auth.user)) {
    return errorNoStore(403, 'Sem permissão para consultar retenção.');
  }

  return jsonNoStore({
    policies: await listCustomerRetentionPoliciesAdmin(),
  });
}

export async function PUT(req: NextRequest) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const auth = await getApiAuthContext(req);
  if (!auth) return errorNoStore(401, 'Não autenticado.');
  if (!canManageCustomerRetention(auth.user)) {
    return errorNoStore(403, 'Sem permissão para alterar retenção.');
  }
  if (!hasValidCsrf(req, auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.entityKey || !body.action || !body.legalBasis || typeof body.retentionDays !== 'number') {
    return errorNoStore(400, 'Política de retenção incompleta.');
  }

  const policy = await updateCustomerRetentionPolicy(body.entityKey, {
    action: body.action,
    retentionDays: body.retentionDays,
    legalBasis: body.legalBasis,
    enabled: body.enabled !== false,
    actorUserId: auth.user.id,
  });
  if (!policy) {
    return errorNoStore(404, 'Política não encontrada.');
  }

  return jsonNoStore({ ok: true, policy });
}

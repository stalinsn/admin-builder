import type { NextRequest } from 'next/server';

import {
  getLogisticsAdminSnapshotRuntime,
  updateLogisticsSettingsRuntime,
} from '@/features/ecommerce/server/logisticsStore';
import { getApiAuthContext, hasValidCsrf, isTrustedOrigin } from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';

export const dynamic = 'force-dynamic';

async function requireLogisticsPermission(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) return { error: errorNoStore(401, 'Não autenticado.') };
  if (!auth.user.permissions.includes('logistics.manage') && !auth.user.permissions.includes('security.superuser')) {
    return { error: errorNoStore(403, 'Sem permissão para operar logística.') };
  }
  return { auth };
}

export async function GET(req: NextRequest) {
  const guard = await requireLogisticsPermission(req);
  if ('error' in guard) return guard.error;

  return jsonNoStore(await getLogisticsAdminSnapshotRuntime());
}

export async function PUT(req: NextRequest) {
  if (!isTrustedOrigin(req)) return errorNoStore(403, 'Origem não permitida.');

  const guard = await requireLogisticsPermission(req);
  if ('error' in guard) return guard.error;
  if (!hasValidCsrf(req, guard.auth.csrfToken)) return errorNoStore(403, 'Token CSRF inválido.');

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return errorNoStore(400, 'Payload inválido.');
  }

  const settings = await updateLogisticsSettingsRuntime(body);
  const snapshot = await getLogisticsAdminSnapshotRuntime();

  return jsonNoStore({
    ok: true,
    settings,
    summary: snapshot.summary,
    effectiveOffers: snapshot.effectiveOffers,
  });
}

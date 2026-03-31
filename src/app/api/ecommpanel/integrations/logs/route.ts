import type { NextRequest } from 'next/server';

import { listApiLogs } from '@/features/ecommpanel/server/apiIntegrationStore';
import { getApiAuthContext, hasPermission } from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';

export const dynamic = 'force-dynamic';

async function requireIntegrationsAccess(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) return { error: errorNoStore(401, 'Não autenticado.') };
  if (!hasPermission(auth.user, 'integrations.manage') && !hasPermission(auth.user, 'api.keys.manage')) {
    return { error: errorNoStore(403, 'Sem permissão para visualizar logs de integração.') };
  }
  return { auth };
}

export async function GET(req: NextRequest) {
  const guard = await requireIntegrationsAccess(req);
  if ('error' in guard) return guard.error;

  const { searchParams } = new URL(req.url);
  const limit = Math.max(1, Math.min(Number(searchParams.get('limit') || 80), 200));
  const clientId = (searchParams.get('clientId') || '').trim() || undefined;

  return jsonNoStore({
    logs: await listApiLogs(limit, clientId),
  });
}

import type { NextRequest } from 'next/server';

import {
  getAnalyticsConfigRuntime,
  normalizeAnalyticsConfig,
  updateAnalyticsConfigRuntime,
} from '@/features/analytics/server/configStore';
import {
  getApiAuthContext,
  hasPermission,
  hasValidCsrf,
  isTrustedOrigin,
} from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';

export const dynamic = 'force-dynamic';

type UpdateAnalyticsConfigBody = {
  config?: unknown;
};

async function requireReadAccess(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) return { error: errorNoStore(401, 'Não autenticado.') };
  if (!hasPermission(auth.user, 'analytics.read')) {
    return { error: errorNoStore(403, 'Sem permissão para visualizar analytics.') };
  }
  return { auth };
}

export async function GET(req: NextRequest) {
  const guard = await requireReadAccess(req);
  if ('error' in guard) return guard.error;

  try {
    return jsonNoStore({ config: await getAnalyticsConfigRuntime() });
  } catch (error) {
    return errorNoStore(503, error instanceof Error ? error.message : 'Não foi possível carregar a configuração de analytics.');
  }
}

export async function PATCH(req: NextRequest) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const guard = await requireReadAccess(req);
  if ('error' in guard) return guard.error;

  if (!hasPermission(guard.auth.user, 'analytics.manage')) {
    return errorNoStore(403, 'Sem permissão para alterar as integrações e a coleta de analytics.');
  }

  if (!hasValidCsrf(req, guard.auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const body = (await req.json().catch(() => null)) as UpdateAnalyticsConfigBody | null;
  if (!body?.config) {
    return errorNoStore(400, 'Payload de configuração é obrigatório.');
  }

  try {
    const config = await updateAnalyticsConfigRuntime(normalizeAnalyticsConfig(body.config));
    return jsonNoStore({ ok: true, config });
  } catch (error) {
    return errorNoStore(503, error instanceof Error ? error.message : 'Não foi possível salvar a configuração de analytics.');
  }
}

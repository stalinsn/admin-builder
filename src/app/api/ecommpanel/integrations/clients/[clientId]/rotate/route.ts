import type { NextRequest } from 'next/server';

import { rotateApiClientSecret } from '@/features/ecommpanel/server/apiIntegrationStore';
import {
  getApiAuthContext,
  hasPermission,
  hasValidCsrf,
  isTrustedOrigin,
} from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';

export const dynamic = 'force-dynamic';

async function requireIntegrationsAccess(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) return { error: errorNoStore(401, 'Não autenticado.') };
  if (!hasPermission(auth.user, 'integrations.manage') && !hasPermission(auth.user, 'api.keys.manage')) {
    return { error: errorNoStore(403, 'Sem permissão para administrar integrações.') };
  }
  return { auth };
}

export async function POST(req: NextRequest, context: { params: Promise<{ clientId: string }> }) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const guard = await requireIntegrationsAccess(req);
  if ('error' in guard) return guard.error;

  if (!hasValidCsrf(req, guard.auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const { clientId } = await context.params;
  const rotated = await rotateApiClientSecret(clientId);
  if (!rotated) {
    return errorNoStore(404, 'Cliente de integração não encontrado.');
  }

  return jsonNoStore({
    client: rotated.client,
    secret: {
      keyId: rotated.keyId,
      value: rotated.secret,
    },
  });
}

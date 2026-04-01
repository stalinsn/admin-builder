import type { NextRequest } from 'next/server';

import {
  createApiClient,
  listApiClients,
  type ApiClientUpsertInput,
} from '@/features/ecommpanel/server/apiIntegrationStore';
import {
  getApiAuthContext,
  hasPermission,
  hasValidCsrf,
  isTrustedOrigin,
} from '@/features/ecommpanel/server/auth';
import { getDataStudioSnapshot } from '@/features/ecommpanel/server/dataStudioStore';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import { isKnownApiIntegrationScope, type ApiIntegrationScope } from '@/features/public-api/integration';

export const dynamic = 'force-dynamic';

type ClientBody = {
  client?: Partial<ApiClientUpsertInput> & {
    allowedIpsText?: string;
  };
};

function normalizeScopes(value: unknown): ApiIntegrationScope[] {
  if (!Array.isArray(value)) return [];
  const snapshot = getDataStudioSnapshot();
  return value.filter((entry): entry is ApiIntegrationScope => isKnownApiIntegrationScope(entry, snapshot));
}

function normalizeAllowedIps(value: unknown, multiline?: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean);
  }
  if (typeof multiline === 'string') {
    return multiline
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

async function requireIntegrationsAccess(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) return { error: errorNoStore(401, 'Não autenticado.') };
  if (!hasPermission(auth.user, 'integrations.manage') && !hasPermission(auth.user, 'api.keys.manage')) {
    return { error: errorNoStore(403, 'Sem permissão para administrar integrações.') };
  }
  return { auth };
}

export async function GET(req: NextRequest) {
  const guard = await requireIntegrationsAccess(req);
  if ('error' in guard) return guard.error;

  return jsonNoStore({
    clients: await listApiClients(),
  });
}

export async function POST(req: NextRequest) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const guard = await requireIntegrationsAccess(req);
  if ('error' in guard) return guard.error;

  if (!hasValidCsrf(req, guard.auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const body = (await req.json().catch(() => null)) as ClientBody | null;
  const client = body?.client;
  if (!client || typeof client.name !== 'string') {
    return errorNoStore(400, 'Payload de cliente inválido.');
  }

  const created = await createApiClient({
    name: client.name,
    description: typeof client.description === 'string' ? client.description : undefined,
    scopes: normalizeScopes(client.scopes),
    allowedIps: normalizeAllowedIps(client.allowedIps, client.allowedIpsText),
    active: client.active !== false,
    expiresAt: typeof client.expiresAt === 'string' && client.expiresAt.trim() ? client.expiresAt : undefined,
  });

  if (!created) {
    return errorNoStore(400, 'Não foi possível criar o cliente de integração. Revise nome e escopos.');
  }

  return jsonNoStore({
    client: created.client,
    secret: {
      keyId: created.keyId,
      value: created.secret,
    },
  });
}

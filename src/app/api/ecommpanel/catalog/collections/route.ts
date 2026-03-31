import type { NextRequest } from 'next/server';

import { canAccessCatalogWorkspace, canManageCatalogProducts } from '@/features/catalog/server/permissions';
import {
  createCatalogCollectionRuntime,
  listCatalogCollectionsListRuntime,
} from '@/features/catalog/server/catalogStore';
import { getApiAuthContext, hasValidCsrf, isTrustedOrigin } from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import { isDemoUser } from '@/features/ecommpanel/server/rbac';

export const dynamic = 'force-dynamic';

type CollectionBody = {
  slug?: string;
  name?: string;
  description?: string;
  status?: 'draft' | 'active' | 'archived';
  metadata?: Record<string, unknown> | null;
};

async function requireCatalogPermission(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) return { error: errorNoStore(401, 'Não autenticado.') };
  if (!canAccessCatalogWorkspace(auth.user)) return { error: errorNoStore(403, 'Sem permissão para acessar o catálogo.') };
  return { auth };
}

export async function GET(req: NextRequest) {
  const guard = await requireCatalogPermission(req);
  if ('error' in guard) return guard.error;
  const runtimeContext = isDemoUser(guard.auth.user)
    ? { demoSessionId: guard.auth.rawSessionId, demoSessionExpiresAt: guard.auth.session.expiresAt }
    : undefined;
  return jsonNoStore({ collections: await listCatalogCollectionsListRuntime(runtimeContext) });
}

export async function POST(req: NextRequest) {
  if (!isTrustedOrigin(req)) return errorNoStore(403, 'Origem não permitida.');
  const guard = await requireCatalogPermission(req);
  if ('error' in guard) return guard.error;
  if (!canManageCatalogProducts(guard.auth.user)) return errorNoStore(403, 'Sem permissão para cadastrar coleções.');
  if (!hasValidCsrf(req, guard.auth.csrfToken)) return errorNoStore(403, 'Token CSRF inválido.');

  const body = (await req.json().catch(() => null)) as CollectionBody | null;
  const name = body?.name?.trim() || '';
  const slug = body?.slug?.trim() || '';
  if (!name || !slug) return errorNoStore(400, 'Nome e slug são obrigatórios.');

  const runtimeContext = isDemoUser(guard.auth.user)
    ? { demoSessionId: guard.auth.rawSessionId, demoSessionExpiresAt: guard.auth.session.expiresAt }
    : undefined;

  const collection = await createCatalogCollectionRuntime({
    slug,
    name,
    description: body?.description,
    status: body?.status || 'draft',
    metadata: body?.metadata || null,
  }, runtimeContext);

  return jsonNoStore({ ok: true, collection });
}

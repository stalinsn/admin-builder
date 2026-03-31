import type { NextRequest } from 'next/server';

import { canAccessCatalogWorkspace, canManageCatalogProducts } from '@/features/catalog/server/permissions';
import {
  getCatalogCollectionByIdRuntime,
  updateCatalogCollectionRuntime,
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

export async function GET(req: NextRequest, context: { params: Promise<{ collectionId: string }> }) {
  const guard = await requireCatalogPermission(req);
  if ('error' in guard) return guard.error;

  const runtimeContext = isDemoUser(guard.auth.user)
    ? { demoSessionId: guard.auth.rawSessionId, demoSessionExpiresAt: guard.auth.session.expiresAt }
    : undefined;
  const { collectionId } = await context.params;
  const collection = await getCatalogCollectionByIdRuntime(collectionId, runtimeContext);
  if (!collection) return errorNoStore(404, 'Coleção não encontrada.');
  return jsonNoStore({ collection });
}

export async function PUT(req: NextRequest, context: { params: Promise<{ collectionId: string }> }) {
  if (!isTrustedOrigin(req)) return errorNoStore(403, 'Origem não permitida.');
  const guard = await requireCatalogPermission(req);
  if ('error' in guard) return guard.error;
  if (!canManageCatalogProducts(guard.auth.user)) return errorNoStore(403, 'Sem permissão para editar coleções.');
  if (!hasValidCsrf(req, guard.auth.csrfToken)) return errorNoStore(403, 'Token CSRF inválido.');

  const runtimeContext = isDemoUser(guard.auth.user)
    ? { demoSessionId: guard.auth.rawSessionId, demoSessionExpiresAt: guard.auth.session.expiresAt }
    : undefined;
  const { collectionId } = await context.params;
  const current = await getCatalogCollectionByIdRuntime(collectionId, runtimeContext);
  if (!current) return errorNoStore(404, 'Coleção não encontrada.');

  const body = (await req.json().catch(() => null)) as CollectionBody | null;
  const name = body?.name?.trim() || '';
  const slug = body?.slug?.trim() || '';
  if (!name || !slug) return errorNoStore(400, 'Nome e slug são obrigatórios.');

  const collection = await updateCatalogCollectionRuntime(collectionId, {
    slug,
    name,
    description: body?.description,
    status: body?.status || current.status,
    metadata: body?.metadata || null,
  }, runtimeContext);

  return jsonNoStore({ ok: true, collection });
}

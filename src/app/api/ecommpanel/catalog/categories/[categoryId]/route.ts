import type { NextRequest } from 'next/server';

import { canAccessCatalogWorkspace, canManageCatalogProducts } from '@/features/catalog/server/permissions';
import {
  getCatalogCategoryByIdRuntime,
  updateCatalogCategoryRuntime,
} from '@/features/catalog/server/catalogStore';
import { getApiAuthContext, hasValidCsrf, isTrustedOrigin } from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import { isDemoUser } from '@/features/ecommpanel/server/rbac';

export const dynamic = 'force-dynamic';

type CategoryBody = {
  slug?: string;
  name?: string;
  description?: string;
  status?: 'draft' | 'active' | 'archived';
  parentId?: string | null;
  children?: Array<{
    id?: string;
    slug?: string;
    name?: string;
  }>;
  metadata?: Record<string, unknown> | null;
};

async function requireCatalogPermission(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) return { error: errorNoStore(401, 'Não autenticado.') };
  if (!canAccessCatalogWorkspace(auth.user)) return { error: errorNoStore(403, 'Sem permissão para acessar o catálogo.') };
  return { auth };
}

export async function GET(req: NextRequest, context: { params: Promise<{ categoryId: string }> }) {
  const guard = await requireCatalogPermission(req);
  if ('error' in guard) return guard.error;

  const runtimeContext = isDemoUser(guard.auth.user)
    ? { demoSessionId: guard.auth.rawSessionId, demoSessionExpiresAt: guard.auth.session.expiresAt }
    : undefined;
  const { categoryId } = await context.params;
  const category = await getCatalogCategoryByIdRuntime(categoryId, runtimeContext);
  if (!category) return errorNoStore(404, 'Categoria não encontrada.');
  return jsonNoStore({ category });
}

export async function PUT(req: NextRequest, context: { params: Promise<{ categoryId: string }> }) {
  if (!isTrustedOrigin(req)) return errorNoStore(403, 'Origem não permitida.');
  const guard = await requireCatalogPermission(req);
  if ('error' in guard) return guard.error;
  if (!canManageCatalogProducts(guard.auth.user)) return errorNoStore(403, 'Sem permissão para editar categorias.');
  if (!hasValidCsrf(req, guard.auth.csrfToken)) return errorNoStore(403, 'Token CSRF inválido.');

  const runtimeContext = isDemoUser(guard.auth.user)
    ? { demoSessionId: guard.auth.rawSessionId, demoSessionExpiresAt: guard.auth.session.expiresAt }
    : undefined;
  const { categoryId } = await context.params;
  const current = await getCatalogCategoryByIdRuntime(categoryId, runtimeContext);
  if (!current) return errorNoStore(404, 'Categoria não encontrada.');

  const body = (await req.json().catch(() => null)) as CategoryBody | null;
  const name = body?.name?.trim() || '';
  const slug = body?.slug?.trim() || '';
  if (!name || !slug) return errorNoStore(400, 'Nome e slug são obrigatórios.');

  const category = await updateCatalogCategoryRuntime(categoryId, {
    slug,
    name,
    description: body?.description,
    status: body?.status || current.status || 'draft',
    parentId: body?.parentId,
    children: Array.isArray(body?.children)
      ? body.children
          .filter((child): child is { id?: string; slug?: string; name: string } => Boolean(child?.name?.trim()))
          .map((child) => ({ id: child.id, slug: child.slug, name: child.name }))
      : current.children,
    metadata: body?.metadata || null,
  }, runtimeContext);

  return jsonNoStore({ ok: true, category });
}

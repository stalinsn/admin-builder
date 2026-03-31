import type { NextRequest } from 'next/server';

import { canAccessCatalogWorkspace, canManageCatalogProducts } from '@/features/catalog/server/permissions';
import {
  createCatalogProductRuntime,
  getCatalogProductBySlugRuntime,
  listCatalogProductsRuntime,
} from '@/features/catalog/server/catalogStore';
import type { CatalogProductUpsertInput } from '@/features/catalog/types';
import { getApiAuthContext, hasValidCsrf, isTrustedOrigin } from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import { isDemoUser } from '@/features/ecommpanel/server/rbac';

export const dynamic = 'force-dynamic';

type ProductBody = Partial<CatalogProductUpsertInput>;

async function requireCatalogPermission(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) return { error: errorNoStore(401, 'Não autenticado.') };
  if (!canAccessCatalogWorkspace(auth.user)) {
    return { error: errorNoStore(403, 'Sem permissão para acessar o catálogo.') };
  }
  return { auth };
}

export async function GET(req: NextRequest) {
  const guard = await requireCatalogPermission(req);
  if ('error' in guard) return guard.error;

  const runtimeContext = isDemoUser(guard.auth.user)
    ? { demoSessionId: guard.auth.rawSessionId, demoSessionExpiresAt: guard.auth.session.expiresAt }
    : undefined;
  return jsonNoStore({ products: await listCatalogProductsRuntime(runtimeContext) });
}

export async function POST(req: NextRequest) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const guard = await requireCatalogPermission(req);
  if ('error' in guard) return guard.error;

  if (!canManageCatalogProducts(guard.auth.user)) {
    return errorNoStore(403, 'Sem permissão para cadastrar produtos.');
  }

  if (!hasValidCsrf(req, guard.auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const body = (await req.json().catch(() => null)) as ProductBody | null;
  const name = body?.name?.trim() || '';
  const slug = body?.slug?.trim() || '';
  if (!name || !slug) {
    return errorNoStore(400, 'Nome e slug são obrigatórios.');
  }

  const runtimeContext = isDemoUser(guard.auth.user)
    ? { demoSessionId: guard.auth.rawSessionId, demoSessionExpiresAt: guard.auth.session.expiresAt }
    : undefined;

  const duplicate = await getCatalogProductBySlugRuntime(slug, runtimeContext);
  if (duplicate) {
    return errorNoStore(409, 'Já existe um produto com esse slug.');
  }

  const product = await createCatalogProductRuntime({
    slug,
    sku: body?.sku,
    name,
    brand: body?.brand,
    status: body?.status || 'draft',
    available: Boolean(body?.available),
    image: body?.image,
    price: Number(body?.price || 0),
    listPrice: body?.listPrice !== undefined ? Number(body.listPrice) : undefined,
    unit: body?.unit,
    packSize: body?.packSize !== undefined ? Number(body.packSize) : undefined,
    commercialUnit: body?.commercialUnit || null,
    packaging: body?.packaging || null,
    merchandising: body?.merchandising || null,
    categories: Array.isArray(body?.categories) ? body.categories : [],
    departments: Array.isArray(body?.departments) ? body.departments : [],
    collections: Array.isArray(body?.collections) ? body.collections : [],
    shortDescription: body?.shortDescription,
    longDescription: body?.longDescription,
    stock: body?.stock,
    seo: body?.seo,
    identification: body?.identification || null,
    dimensions: body?.dimensions || null,
    supplier: body?.supplier || null,
    attributes: Array.isArray(body?.attributes) ? body.attributes : [],
    variants: Array.isArray(body?.variants) ? body.variants : [],
    customFields: body?.customFields || null,
  }, runtimeContext);

  return jsonNoStore({ ok: true, product });
}

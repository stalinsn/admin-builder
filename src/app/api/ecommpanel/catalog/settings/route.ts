import type { NextRequest } from 'next/server';

import { canAccessCatalogWorkspace, canManageCatalogProducts } from '@/features/catalog/server/permissions';
import {
  getCatalogDisplaySettingsRuntime,
  updateCatalogDisplaySettingsRuntime,
} from '@/features/catalog/server/catalogDisplaySettingsStore';
import { getApiAuthContext, hasValidCsrf, isTrustedOrigin } from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';

export const dynamic = 'force-dynamic';

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
  return jsonNoStore({ settings: await getCatalogDisplaySettingsRuntime() });
}

export async function PUT(req: NextRequest) {
  if (!isTrustedOrigin(req)) return errorNoStore(403, 'Origem não permitida.');
  const guard = await requireCatalogPermission(req);
  if ('error' in guard) return guard.error;
  if (!canManageCatalogProducts(guard.auth.user)) {
    return errorNoStore(403, 'Sem permissão para alterar política do catálogo.');
  }
  if (!hasValidCsrf(req, guard.auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const body = await req.json().catch(() => null);
  const settings = await updateCatalogDisplaySettingsRuntime(body);
  return jsonNoStore({ ok: true, settings });
}

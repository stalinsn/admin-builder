import type { NextRequest } from 'next/server';

import { canAccessCatalogWorkspace, canManageCatalogProducts } from '@/features/catalog/server/permissions';
import {
  clearCatalogProductsRuntime,
  exportCatalogProductsCsvRuntime,
  importCatalogProductsCsvRuntime,
} from '@/features/catalog/server/catalogStore';
import { getApiAuthContext, hasValidCsrf, isTrustedOrigin } from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import { isDemoUser } from '@/features/ecommpanel/server/rbac';

export const dynamic = 'force-dynamic';

type BulkBody =
  | {
      action: 'importCsv';
      csvContent?: string;
      mode?: 'append' | 'replace';
    }
  | {
      action: 'clearProducts';
    };

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
  const payload = await exportCatalogProductsCsvRuntime(runtimeContext);
  return jsonNoStore(payload);
}

export async function POST(req: NextRequest) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const guard = await requireCatalogPermission(req);
  if ('error' in guard) return guard.error;

  if (!canManageCatalogProducts(guard.auth.user)) {
    return errorNoStore(403, 'Sem permissão para operações em lote do catálogo.');
  }

  if (!hasValidCsrf(req, guard.auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const body = (await req.json().catch(() => null)) as BulkBody | null;
  const runtimeContext = isDemoUser(guard.auth.user)
    ? { demoSessionId: guard.auth.rawSessionId, demoSessionExpiresAt: guard.auth.session.expiresAt }
    : undefined;

  if (!body?.action) {
    return errorNoStore(400, 'Ação em lote inválida.');
  }

  try {
    if (body.action === 'importCsv') {
      if (!body.csvContent?.trim()) {
        return errorNoStore(400, 'Envie o conteúdo CSV para importar.');
      }

      const summary = await importCatalogProductsCsvRuntime(body.csvContent, body.mode === 'replace' ? 'replace' : 'append', runtimeContext);
      return jsonNoStore({ ok: true, summary });
    }

    if (body.action === 'clearProducts') {
      const summary = await clearCatalogProductsRuntime(runtimeContext);
      return jsonNoStore({ ok: true, summary });
    }

    return errorNoStore(400, 'Ação em lote não suportada.');
  } catch (error) {
    return errorNoStore(400, error instanceof Error ? error.message : 'Falha na operação em lote do catálogo.');
  }
}

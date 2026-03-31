import type { NextRequest } from 'next/server';
import {
  getApiAuthContext,
  hasPermission,
  hasValidCsrf,
  isTrustedOrigin,
} from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import { restoreSitePageRuntime } from '@/features/ecommpanel/server/siteBuilderStore';

export const dynamic = 'force-dynamic';

async function requireSiteContentPermission(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) return { error: errorNoStore(401, 'Não autenticado.') };
  if (!hasPermission(auth.user, 'site.content.manage')) {
    return { error: errorNoStore(403, 'Sem permissão para gerenciar rotas.') };
  }
  return { auth };
}

export async function POST(req: NextRequest, context: { params: Promise<{ pageId: string }> }) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const guard = await requireSiteContentPermission(req);
  if ('error' in guard) return guard.error;

  if (!hasValidCsrf(req, guard.auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const { pageId } = await context.params;
  try {
    const page = await restoreSitePageRuntime(pageId);
    if (!page) return errorNoStore(404, 'Rota não encontrada na lixeira.');

    return jsonNoStore({ ok: true, route: page });
  } catch (error) {
    return errorNoStore(503, error instanceof Error ? error.message : 'Não foi possível restaurar a rota.');
  }
}

import type { NextRequest } from 'next/server';

import { canAccessCatalogWorkspace } from '@/features/catalog/server/permissions';
import { getApiAuthContext } from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import { listPanelMediaAssets } from '@/features/ecommpanel/server/panelMediaService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) {
    return errorNoStore(401, 'Não autenticado.');
  }

  const canReadMedia =
    canAccessCatalogWorkspace(auth.user) ||
    auth.user.permissions.includes('site.content.manage') ||
    auth.user.permissions.includes('blog.posts.manage') ||
    auth.user.permissions.includes('blog.posts.edit') ||
    auth.user.permissions.includes('store.settings.manage') ||
    auth.user.permissions.includes('integrations.manage');

  if (!canReadMedia) {
    return errorNoStore(403, 'Sem permissão para visualizar a biblioteca de mídia.');
  }

  const scope = req.nextUrl.searchParams.get('scope') || undefined;

  try {
    const assets = await listPanelMediaAssets(scope);
    return jsonNoStore({ assets });
  } catch (error) {
    return errorNoStore(503, error instanceof Error ? error.message : 'Não foi possível carregar a biblioteca de mídia.');
  }
}

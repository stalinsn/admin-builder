import type { NextRequest } from 'next/server';
import {
  getApiAuthContext,
  hasPermission,
  hasValidCsrf,
  isTrustedOrigin,
} from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import {
  createSitePageRuntime,
  getSitePageBySlugRuntime,
  isValidSlug,
  listSitePagesRuntime,
  normalizeSlug,
} from '@/features/ecommpanel/server/siteBuilderStore';
import { getReservedStorefrontSlugError } from '@/features/site-runtime/routeRules';

export const dynamic = 'force-dynamic';

type CreateRouteBody = {
  title?: string;
  slug?: string;
  description?: string;
};

async function requireSiteContentPermission(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) return { error: errorNoStore(401, 'Não autenticado.') };
  if (!hasPermission(auth.user, 'site.content.manage')) {
    return { error: errorNoStore(403, 'Sem permissão para gerenciar rotas.') };
  }
  return { auth };
}

export async function GET(req: NextRequest) {
  const guard = await requireSiteContentPermission(req);
  if ('error' in guard) return guard.error;

  try {
    const routes = (await listSitePagesRuntime()).map((page) => ({
      id: page.id,
      title: page.title,
      slug: page.slug,
      status: page.status,
      updatedAt: page.updatedAt,
      publishedAt: page.publishedAt,
    }));

    return jsonNoStore({ routes });
  } catch (error) {
    return errorNoStore(503, error instanceof Error ? error.message : 'Não foi possível carregar as rotas.');
  }
}

export async function POST(req: NextRequest) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const guard = await requireSiteContentPermission(req);
  if ('error' in guard) return guard.error;

  if (!hasValidCsrf(req, guard.auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const body = (await req.json().catch(() => null)) as CreateRouteBody | null;
  const title = body?.title?.trim() || '';
  const slug = normalizeSlug(body?.slug || '');

  if (!title || !slug) {
    return errorNoStore(400, 'Título e slug são obrigatórios.');
  }

  if (!isValidSlug(slug)) {
    return errorNoStore(400, 'Caminho inválido. Use letras minúsculas, números, hífen e barra para segmentação.');
  }

  const reservedError = getReservedStorefrontSlugError(slug);
  if (reservedError) {
    return errorNoStore(409, reservedError);
  }

  try {
    if (await getSitePageBySlugRuntime(slug)) {
      return errorNoStore(409, 'Já existe uma rota com esse slug.');
    }

    const page = await createSitePageRuntime({
      title,
      slug,
      description: body?.description,
    });

    return jsonNoStore({ ok: true, route: page });
  } catch (error) {
    return errorNoStore(503, error instanceof Error ? error.message : 'Não foi possível criar a rota.');
  }
}

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

type CreatePageBody = {
  title?: string;
  slug?: string;
  description?: string;
};

async function requireSiteContentPermission(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) return { error: errorNoStore(401, 'Não autenticado.') };
  if (!hasPermission(auth.user, 'site.content.manage')) {
    return { error: errorNoStore(403, 'Sem permissão para gerenciar páginas.') };
  }
  return { auth };
}

export async function GET(req: NextRequest) {
  const guard = await requireSiteContentPermission(req);
  if ('error' in guard) return guard.error;

  try {
    return jsonNoStore({ pages: await listSitePagesRuntime() });
  } catch (error) {
    return errorNoStore(503, error instanceof Error ? error.message : 'Não foi possível carregar as páginas.');
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

  const body = (await req.json().catch(() => null)) as CreatePageBody | null;
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
    const existing = await getSitePageBySlugRuntime(slug);
    if (existing) {
      return errorNoStore(409, 'Já existe uma página com esse slug.');
    }

    const page = await createSitePageRuntime({
      title,
      slug,
      description: body?.description,
    });

    return jsonNoStore({ ok: true, page });
  } catch (error) {
    return errorNoStore(503, error instanceof Error ? error.message : 'Não foi possível criar a página.');
  }
}

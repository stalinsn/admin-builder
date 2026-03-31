import type { NextRequest } from 'next/server';
import {
  getApiAuthContext,
  hasPermission,
  hasValidCsrf,
  isTrustedOrigin,
} from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import {
  getStorefrontTemplateRuntime,
  updateStorefrontTemplateRuntime,
} from '@/features/ecommpanel/server/storefrontTemplateStore';
import { getPublishedRuntimePageBySlug } from '@/features/site-runtime/server/publishedStore';
import { normalizeStorefrontTemplate } from '@/features/site-runtime/storefrontTemplate';

export const dynamic = 'force-dynamic';

type UpdateTemplateBody = {
  template?: unknown;
};

async function requireSiteLayoutPermission(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) return { error: errorNoStore(401, 'Não autenticado.') };
  if (!hasPermission(auth.user, 'site.layout.manage')) {
    return { error: errorNoStore(403, 'Sem permissão para gerenciar o template da loja.') };
  }
  return { auth };
}

export async function GET(req: NextRequest) {
  const guard = await requireSiteLayoutPermission(req);
  if ('error' in guard) return guard.error;

  try {
    return jsonNoStore({ template: await getStorefrontTemplateRuntime() });
  } catch (error) {
    return errorNoStore(503, error instanceof Error ? error.message : 'Não foi possível carregar o template da loja.');
  }
}

export async function PATCH(req: NextRequest) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const guard = await requireSiteLayoutPermission(req);
  if ('error' in guard) return guard.error;

  if (!hasValidCsrf(req, guard.auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const body = (await req.json().catch(() => null)) as UpdateTemplateBody | null;
  if (!body?.template) {
    return errorNoStore(400, 'Payload do template é obrigatório.');
  }

  const normalizedTemplate = normalizeStorefrontTemplate(body.template);
  const homeOverride = normalizedTemplate.home.override;
  if (homeOverride.enabled) {
    const pageSlug = homeOverride.pageSlug.trim().replace(/^\/+/, '');
    if (!pageSlug) {
      return errorNoStore(400, 'Selecione um slug publicado para usar como override da home.');
    }

    const publishedPage = getPublishedRuntimePageBySlug(pageSlug);
    if (!publishedPage) {
      return errorNoStore(409, `A página publicada "${pageSlug}" não foi encontrada no runtime.`);
    }
  }

  try {
    const template = await updateStorefrontTemplateRuntime(normalizedTemplate);
    return jsonNoStore({ ok: true, template });
  } catch (error) {
    return errorNoStore(503, error instanceof Error ? error.message : 'Não foi possível salvar o template da loja.');
  }
}

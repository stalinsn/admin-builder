import type { NextRequest } from 'next/server';

import {
  getApiAuthContext,
  hasValidCsrf,
  isTrustedOrigin,
} from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import { processPanelMediaUpload } from '@/features/ecommpanel/server/panelMediaService';

export const dynamic = 'force-dynamic';

function canUploadMedia(permissions: string[]): boolean {
  return [
    'catalog.products.manage',
    'catalog.content.manage',
    'site.content.manage',
    'site.layout.manage',
    'blog.posts.manage',
    'blog.posts.edit',
    'store.settings.manage',
    'integrations.manage',
  ].some((permission) => permissions.includes(permission));
}

export async function POST(req: NextRequest) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const auth = await getApiAuthContext(req);
  if (!auth) {
    return errorNoStore(401, 'Não autenticado.');
  }

  if (!canUploadMedia(auth.user.permissions)) {
    return errorNoStore(403, 'Sem permissão para enviar imagens.');
  }

  if (!hasValidCsrf(req, auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const formData = await req.formData().catch(() => null);
  const fileValue = formData?.get('file');
  const scopeValue = formData?.get('scope');

  if (!(fileValue instanceof File)) {
    return errorNoStore(400, 'Envie um arquivo de imagem no campo "file".');
  }

  if (!fileValue.size) {
    return errorNoStore(400, 'O arquivo enviado está vazio.');
  }

  try {
    const asset = await processPanelMediaUpload({
      fileName: fileValue.name,
      mimeType: fileValue.type || 'application/octet-stream',
      bytes: Buffer.from(await fileValue.arrayBuffer()),
      scope: typeof scopeValue === 'string' ? scopeValue : undefined,
    });

    return jsonNoStore({
      ok: true,
      asset,
    });
  } catch (error) {
    return errorNoStore(400, error instanceof Error ? error.message : 'Não foi possível processar a imagem enviada.');
  }
}

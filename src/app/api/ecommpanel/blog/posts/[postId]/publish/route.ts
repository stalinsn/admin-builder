import type { NextRequest } from 'next/server';

import { getApiAuthContext, hasValidCsrf, isTrustedOrigin } from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import { canPublishBlogPost } from '@/features/blog/server/permissions';
import { setBlogPostStatusRuntime } from '@/features/blog/server/blogStore';

export const dynamic = 'force-dynamic';

async function requireBlogPostPermission(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) return { error: errorNoStore(401, 'Não autenticado.') };
  if (!canPublishBlogPost(auth.user)) {
    return { error: errorNoStore(403, 'Sem permissão para publicar posts do blog.') };
  }
  return { auth };
}

export async function POST(req: NextRequest, context: { params: Promise<{ postId: string }> }) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const guard = await requireBlogPostPermission(req);
  if ('error' in guard) return guard.error;

  if (!hasValidCsrf(req, guard.auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const { postId } = await context.params;
  const post = await setBlogPostStatusRuntime(postId, 'published', {
    userId: guard.auth.user.id,
    name: guard.auth.user.name,
  });
  if (!post) {
    return errorNoStore(404, 'Post não encontrado.');
  }

  return jsonNoStore({ ok: true, post });
}

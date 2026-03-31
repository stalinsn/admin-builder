import type { NextRequest } from 'next/server';

import { getApiAuthContext, hasValidCsrf, isTrustedOrigin } from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import { canModerateBlogComments } from '@/features/blog/server/permissions';
import { moderateBlogCommentRuntime } from '@/features/blog/server/blogStore';

export const dynamic = 'force-dynamic';

type ModerateCommentBody = {
  status?: 'approved' | 'rejected';
  moderationNote?: string;
};

async function requireBlogCommentPermission(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) return { error: errorNoStore(401, 'Não autenticado.') };
  if (!canModerateBlogComments(auth.user)) {
    return { error: errorNoStore(403, 'Sem permissão para moderar comentários.') };
  }
  return { auth };
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ postId: string; commentId: string }> },
) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const guard = await requireBlogCommentPermission(req);
  if ('error' in guard) return guard.error;

  if (!hasValidCsrf(req, guard.auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const body = (await req.json().catch(() => null)) as ModerateCommentBody | null;
  if (body?.status !== 'approved' && body?.status !== 'rejected') {
    return errorNoStore(400, 'Status inválido para moderação.');
  }

  const { postId, commentId } = await context.params;
  const comment = await moderateBlogCommentRuntime(postId, commentId, body.status, body?.moderationNote);
  if (!comment) {
    return errorNoStore(404, 'Comentário não encontrado.');
  }

  return jsonNoStore({ ok: true, comment });
}

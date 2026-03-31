import type { NextRequest } from 'next/server';

import { getApiAuthContext, hasValidCsrf, isTrustedOrigin } from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import { isValidBlogSlug, normalizeBlogSlug } from '@/features/blog/slug';
import { canAccessBlogWorkspace, canCreateBlogPost } from '@/features/blog/server/permissions';
import {
  createBlogPostRuntime,
  getBlogPostBySlugRuntime,
  listBlogPostsRuntime,
} from '@/features/blog/server/blogStore';

export const dynamic = 'force-dynamic';

type CreatePostBody = {
  title?: string;
  slug?: string;
  category?: string;
  excerpt?: string;
  authorName?: string;
};

async function requireBlogPostPermission(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) return { error: errorNoStore(401, 'Não autenticado.') };
  if (!canAccessBlogWorkspace(auth.user)) {
    return { error: errorNoStore(403, 'Sem permissão para acessar a operação editorial do blog.') };
  }
  return { auth };
}

export async function GET(req: NextRequest) {
  const guard = await requireBlogPostPermission(req);
  if ('error' in guard) return guard.error;

  return jsonNoStore({ posts: await listBlogPostsRuntime() });
}

export async function POST(req: NextRequest) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const guard = await requireBlogPostPermission(req);
  if ('error' in guard) return guard.error;

  if (!canCreateBlogPost(guard.auth.user)) {
    return errorNoStore(403, 'Sem permissão para criar posts do blog.');
  }

  if (!hasValidCsrf(req, guard.auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const body = (await req.json().catch(() => null)) as CreatePostBody | null;
  const title = body?.title?.trim() || '';
  const slug = normalizeBlogSlug(body?.slug || '');

  if (!title || !slug) {
    return errorNoStore(400, 'Título e slug são obrigatórios.');
  }

  if (!isValidBlogSlug(slug)) {
    return errorNoStore(400, 'Slug inválido. Use apenas letras minúsculas, números e hífen.');
  }

  const duplicate = await getBlogPostBySlugRuntime(slug);
  if (duplicate) {
    return errorNoStore(409, 'Já existe um post com esse slug.');
  }

  const post = await createBlogPostRuntime({
    title,
    slug,
    category: body?.category,
    excerpt: body?.excerpt,
    authorName: body?.authorName,
    actor: {
      userId: guard.auth.user.id,
      name: guard.auth.user.name,
    },
  });

  return jsonNoStore({ ok: true, post });
}

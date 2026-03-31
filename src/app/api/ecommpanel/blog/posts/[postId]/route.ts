import type { NextRequest } from 'next/server';

import { getApiAuthContext, hasValidCsrf, isTrustedOrigin } from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';
import { isValidBlogSlug, normalizeBlogSlug } from '@/features/blog/slug';
import { canAccessBlogWorkspace, canEditBlogPost, canManageBlogAuthors } from '@/features/blog/server/permissions';
import {
  getBlogPostByIdRuntime,
  getBlogPostBySlugRuntime,
  listAdminBlogCommentsRuntime,
  updateBlogPostRuntime,
} from '@/features/blog/server/blogStore';
import type { BlogContentSection } from '@/features/blog/types';

export const dynamic = 'force-dynamic';

type UpdatePostBody = {
  slug?: string;
  title?: string;
  excerpt?: string;
  category?: string;
  tags?: string[];
  coverImageUrl?: string;
  coverImageAlt?: string;
  intro?: string;
  sections?: BlogContentSection[];
  outro?: string;
  readTimeMinutes?: number;
  featured?: boolean;
  author?: {
    name?: string;
    role?: string;
    avatarUrl?: string;
  };
  interaction?: {
    commentsEnabled?: boolean;
    commentsRequireModeration?: boolean;
    reactionsEnabled?: boolean;
    bookmarksEnabled?: boolean;
    shareEnabled?: boolean;
  };
  seo?: {
    title?: string;
    description?: string;
    keywords?: string;
    noIndex?: boolean;
  };
  governance?: {
    ownerUserId?: string;
    ownerName?: string;
  };
};

async function requireBlogPostPermission(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) return { error: errorNoStore(401, 'Não autenticado.') };
  if (!canAccessBlogWorkspace(auth.user)) {
    return { error: errorNoStore(403, 'Sem permissão para acessar a operação editorial do blog.') };
  }
  return { auth };
}

export async function GET(req: NextRequest, context: { params: Promise<{ postId: string }> }) {
  const guard = await requireBlogPostPermission(req);
  if ('error' in guard) return guard.error;

  const { postId } = await context.params;
  const post = await getBlogPostByIdRuntime(postId);
  if (!post) {
    return errorNoStore(404, 'Post não encontrado.');
  }

  return jsonNoStore({
    post,
    comments: await listAdminBlogCommentsRuntime(postId),
  });
}

export async function PUT(req: NextRequest, context: { params: Promise<{ postId: string }> }) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const guard = await requireBlogPostPermission(req);
  if ('error' in guard) return guard.error;

  if (!hasValidCsrf(req, guard.auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const { postId } = await context.params;
  const current = await getBlogPostByIdRuntime(postId);
  if (!current) {
    return errorNoStore(404, 'Post não encontrado.');
  }

  if (!canEditBlogPost(guard.auth.user, current)) {
    return errorNoStore(403, 'Seu perfil não pode editar este post.');
  }

  const body = (await req.json().catch(() => null)) as UpdatePostBody | null;
  const slug = normalizeBlogSlug(body?.slug || '');
  const title = body?.title?.trim() || '';
  const excerpt = body?.excerpt?.trim() || '';
  const category = body?.category?.trim() || '';
  const sections = Array.isArray(body?.sections) ? body?.sections : null;

  if (!slug || !title || !excerpt || !category || !sections?.length) {
    return errorNoStore(400, 'Slug, título, resumo, categoria e ao menos uma seção são obrigatórios.');
  }

  if (!isValidBlogSlug(slug)) {
    return errorNoStore(400, 'Slug inválido. Use apenas letras minúsculas, números e hífen.');
  }

  const duplicate = await getBlogPostBySlugRuntime(slug);
  if (duplicate && duplicate.id !== postId) {
    return errorNoStore(409, 'Já existe um post com esse slug.');
  }

  if (body?.governance && !canManageBlogAuthors(guard.auth.user)) {
    return errorNoStore(403, 'Seu perfil não pode reatribuir autores deste post.');
  }

  const post = await updateBlogPostRuntime(postId, {
    slug,
    title,
    excerpt,
    category,
    tags: body?.tags || [],
    coverImageUrl: body?.coverImageUrl || '',
    coverImageAlt: body?.coverImageAlt || '',
    intro: body?.intro || '',
    sections,
    outro: body?.outro || '',
    readTimeMinutes: Number(body?.readTimeMinutes || 1),
    featured: Boolean(body?.featured),
    author: {
      name: body?.author?.name || current.author.name,
      role: body?.author?.role || current.author.role,
      avatarUrl: body?.author?.avatarUrl || current.author.avatarUrl,
    },
    interaction: {
      commentsEnabled: body?.interaction?.commentsEnabled ?? current.interaction.commentsEnabled,
      commentsRequireModeration: body?.interaction?.commentsRequireModeration ?? current.interaction.commentsRequireModeration,
      reactionsEnabled: body?.interaction?.reactionsEnabled ?? current.interaction.reactionsEnabled,
      bookmarksEnabled: body?.interaction?.bookmarksEnabled ?? current.interaction.bookmarksEnabled,
      shareEnabled: body?.interaction?.shareEnabled ?? current.interaction.shareEnabled,
    },
    seo: {
      title: body?.seo?.title || title,
      description: body?.seo?.description || excerpt,
      keywords: body?.seo?.keywords || '',
      noIndex: body?.seo?.noIndex ?? current.seo.noIndex,
    },
    governance: body?.governance
      ? {
          ownerUserId: body.governance.ownerUserId || current.governance.ownerUserId,
          ownerName: body.governance.ownerName || current.governance.ownerName || current.author.name,
        }
      : undefined,
    actor: {
      userId: guard.auth.user.id,
      name: guard.auth.user.name,
    },
  });

  if (!post) {
    return errorNoStore(404, 'Post não encontrado.');
  }

  return jsonNoStore({ ok: true, post, comments: await listAdminBlogCommentsRuntime(postId) });
}

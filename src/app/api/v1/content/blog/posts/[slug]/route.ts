import { errorPublic, jsonPublic } from '@/features/public-api/server';
import {
  getBlogReactionSummaryRuntime,
  getPublishedBlogPostBySlugRuntime,
  listPublicBlogCommentsRuntime,
} from '@/features/blog/server/blogStore';
import { normalizeBlogSlug } from '@/features/blog/slug';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, context: { params: Promise<{ slug: string }> }) {
  const params = await context.params;
  const slug = normalizeBlogSlug(params.slug);
  const post = await getPublishedBlogPostBySlugRuntime(slug);

  if (!post) {
    return errorPublic(404, 'Post publicado não encontrado.');
  }

  const comments = await listPublicBlogCommentsRuntime(post.slug);
  const reactions = await getBlogReactionSummaryRuntime(post.slug);

  return jsonPublic(
    {
      post,
      interaction: {
        commentsCount: comments.length,
        comments,
        reactions,
      },
    },
    {
      generatedAt: post.updatedAt,
      meta: {
        canonicalPath: post.canonicalPath,
      },
    },
  );
}

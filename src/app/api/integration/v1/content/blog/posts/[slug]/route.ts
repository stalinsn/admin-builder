import type { NextRequest } from 'next/server';

import {
  getBlogReactionSummaryRuntime,
  getPublishedBlogPostBySlugRuntime,
  listPublicBlogCommentsRuntime,
} from '@/features/blog/server/blogStore';
import { normalizeBlogSlug } from '@/features/blog/slug';
import { errorIntegration, jsonIntegration, withIntegrationAccess } from '@/features/public-api/integrationAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  return withIntegrationAccess(req, {
    scope: 'content.read',
    handler: async () => {
      const params = await context.params;
      const slug = normalizeBlogSlug(params.slug);
      const post = await getPublishedBlogPostBySlugRuntime(slug);

      if (!post) {
        return errorIntegration(404, 'Post publicado não encontrado.');
      }

      const comments = await listPublicBlogCommentsRuntime(post.slug);
      const reactions = await getBlogReactionSummaryRuntime(post.slug);

      return jsonIntegration(
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
    },
  });
}

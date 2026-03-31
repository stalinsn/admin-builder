import type { NextRequest } from 'next/server';

import type { PublicApiBlogPostSummary } from '@/features/public-api/contracts';
import { listPublishedBlogPostsRuntime } from '@/features/blog/server/blogStore';
import { jsonIntegration, withIntegrationAccess } from '@/features/public-api/integrationAuth';
import { readBooleanParam, readLimitParam } from '@/features/public-api/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withIntegrationAccess(req, {
    scope: 'content.read',
    handler: async () => {
      const { searchParams } = new URL(req.url);
      const limit = readLimitParam(searchParams.get('limit'), 20);
      const category = (searchParams.get('category') || '').trim().toLowerCase();
      const featured = readBooleanParam(searchParams.get('featured'));

      const filtered = (await listPublishedBlogPostsRuntime()).filter((post) => {
        if (featured !== null && post.featured !== featured) return false;
        if (category && post.category.trim().toLowerCase() !== category) return false;
        return true;
      });

      const items = filtered
        .slice(0, limit)
        .map<PublicApiBlogPostSummary>((post) => ({
          id: post.id,
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          category: post.category,
          tags: post.tags,
          featured: post.featured,
          coverImageUrl: post.coverImageUrl,
          coverImageAlt: post.coverImageAlt,
          authorName: post.authorName,
          ownerName: post.ownerName,
          publishedAt: post.publishedAt,
          readTimeMinutes: post.readTimeMinutes,
          canonicalPath: `/e-commerce/blog/${post.slug}`,
        }));

      return jsonIntegration(
        {
          items,
          total: filtered.length,
        },
        {
          meta: {
            limit,
            filters: {
              category: category || null,
              featured,
            },
          },
        },
      );
    },
  });
}

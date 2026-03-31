import type { PublicApiBlogPostSummary } from '@/features/public-api/contracts';
import { jsonPublic, readBooleanParam, readLimitParam } from '@/features/public-api/server';
import { listPublishedBlogPostsRuntime } from '@/features/blog/server/blogStore';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
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

  return jsonPublic(
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
}

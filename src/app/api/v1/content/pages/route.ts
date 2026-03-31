import type { PublicApiContentPageSummary } from '@/features/public-api/contracts';
import { jsonPublic, readLimitParam } from '@/features/public-api/server';
import { readPublishedRuntimeSnapshot } from '@/features/site-runtime/server/publishedStore';

export const dynamic = 'force-dynamic';

function resolvePublicPath(slug: string): string {
  if (slug === 'home' || slug === 'index') return '/e-commerce';
  return `/e-commerce/${slug}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = readLimitParam(searchParams.get('limit'), 50);
  const snapshot = readPublishedRuntimeSnapshot();
  const pages = snapshot?.pages || [];

  const items: PublicApiContentPageSummary[] = pages.slice(0, limit).map((page) => ({
    id: page.id,
    slug: page.slug,
    title: page.title,
    description: page.description,
    layoutPreset: page.layoutPreset,
    publicPath: resolvePublicPath(page.slug),
    seo: {
      title: page.seo.title,
      description: page.seo.description,
      noIndex: page.seo.noIndex,
    },
  }));

  return jsonPublic(
    {
      items,
      total: pages.length,
    },
    {
      generatedAt: snapshot?.generatedAt,
      meta: {
        limit,
        snapshotGeneratedAt: snapshot?.generatedAt || null,
      },
    },
  );
}

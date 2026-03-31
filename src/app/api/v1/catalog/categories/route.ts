import type { PublicApiCatalogCategorySummary } from '@/features/public-api/contracts';
import { listCatalogCategoriesRuntime } from '@/features/catalog/server/catalogStore';
import { jsonPublic, readLimitParam } from '@/features/public-api/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = readLimitParam(searchParams.get('limit'), 50);
  const categories = await listCatalogCategoriesRuntime();

  const items: PublicApiCatalogCategorySummary[] = categories.slice(0, limit).map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.name,
    parentId: category.parentId,
    productCount: category.productIds.length,
    children: category.children || [],
  }));

  return jsonPublic(
    {
      items,
      total: categories.length,
    },
    {
      meta: {
        limit,
      },
    },
  );
}

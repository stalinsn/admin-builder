import { queryCatalogPlpRuntime } from '@/features/catalog/server/catalogStore';
import { mapPublicCatalogProductSummary } from '@/features/public-api/catalog';
import { jsonPublic, readBooleanParam, readLimitParam } from '@/features/public-api/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = readLimitParam(searchParams.get('limit'), 24);
  const query = (searchParams.get('q') || '').trim().toLowerCase();
  const category = (searchParams.get('category') || '').trim().toLowerCase();
  const collection = (searchParams.get('collection') || '').trim().toLowerCase();
  const available = readBooleanParam(searchParams.get('available'));
  const page = readLimitParam(searchParams.get('page'), 1, 1000);
  const postalCode = (searchParams.get('postalCode') || '').trim();
  const mode = searchParams.get('mode') === 'pickup' ? 'pickup' : searchParams.get('mode') === 'delivery' ? 'delivery' : undefined;
  const sort = (searchParams.get('sort') || 'relevance') as 'relevance' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc';
  const brands = searchParams.getAll('brand').filter(Boolean);
  const departments = searchParams.getAll('dept').filter(Boolean);
  const collections = searchParams.getAll('collection').filter(Boolean);
  const priceRange = (searchParams.get('price') || '').trim();
  const price = priceRange
    ? (() => {
        const [min, max] = priceRange.split('-').map((value) => Number(value));
        return Number.isFinite(min) && Number.isFinite(max) ? ([min, max] as [number, number]) : undefined;
      })()
    : undefined;

  const result = await queryCatalogPlpRuntime({
    q: query,
    categorySlug: category || undefined,
    collection: collection || undefined,
    available,
    sort,
    page,
    pageSize: limit,
    regionalization: postalCode || mode ? { postalCode: postalCode || undefined, mode } : undefined,
    brands,
    departments,
    collections,
    price,
  });
  const items = await Promise.all(result.items.map((item) => mapPublicCatalogProductSummary(item)));

  return jsonPublic(
    {
      items,
      total: result.total,
      category: result.category
        ? {
            id: result.category.id,
            slug: result.category.slug,
            name: result.category.name,
            parentId: result.category.parentId,
            productCount: result.category.productIds.length,
            children: result.category.children,
          }
        : null,
      facets: result.facets || [],
    },
    {
      meta: {
        limit,
        filters: {
          q: query || null,
          category: category || null,
          collection: collection || null,
          available,
          page,
          postalCode: postalCode || null,
          mode: mode || null,
          sort,
        },
      },
    },
  );
}

import type { NextRequest } from 'next/server';

import type { PublicApiCatalogCategorySummary } from '@/features/public-api/contracts';
import { listCatalogCategoriesRuntime } from '@/features/catalog/server/catalogStore';
import { jsonIntegration, withIntegrationAccess } from '@/features/public-api/integrationAuth';
import { readLimitParam } from '@/features/public-api/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withIntegrationAccess(req, {
    scope: 'catalog.read',
    handler: async () => {
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

      return jsonIntegration(
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
    },
  });
}

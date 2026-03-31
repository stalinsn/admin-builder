import type { NextRequest } from 'next/server';

import type { PublicApiCatalogCollectionSummary } from '@/features/public-api/contracts';
import { listCatalogCollectionsRuntime } from '@/features/catalog/server/catalogStore';
import { jsonIntegration, withIntegrationAccess } from '@/features/public-api/integrationAuth';
import { readLimitParam } from '@/features/public-api/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withIntegrationAccess(req, {
    scope: 'catalog.read',
    handler: async () => {
      const { searchParams } = new URL(req.url);
      const limit = readLimitParam(searchParams.get('limit'), 50);
      const collections = await listCatalogCollectionsRuntime();

      const items: PublicApiCatalogCollectionSummary[] = collections.slice(0, limit).map((collection) => ({
        id: collection.id,
        slug: collection.slug,
        name: collection.name,
        description: collection.description,
        productCount: collection.productIds.length,
        status: collection.status,
      }));

      return jsonIntegration(
        {
          items,
          total: collections.length,
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

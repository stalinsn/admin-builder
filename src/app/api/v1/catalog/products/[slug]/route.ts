import { getCatalogProductBySlugRuntime } from '@/features/catalog/server/catalogStore';
import {
  getCoveredProductIdsForRegionalizationRuntime,
  shouldApplyRegionalizationRuntime,
} from '@/features/ecommerce/server/logisticsStore';
import { mapPublicCatalogProductDetail, mapPublicCatalogProductSummary } from '@/features/public-api/catalog';
import { errorPublic, jsonPublic } from '@/features/public-api/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, context: { params: Promise<{ slug: string }> }) {
  const params = await context.params;
  const product = await getCatalogProductBySlugRuntime(params.slug);

  if (!product || product.status !== 'active') {
    return errorPublic(404, 'Produto não encontrado.');
  }

  const { searchParams } = new URL(req.url);
  const postalCode = (searchParams.get('postalCode') || '').trim();
  const mode = searchParams.get('mode') === 'pickup' ? 'pickup' : searchParams.get('mode') === 'delivery' ? 'delivery' : undefined;
  const applyRegionalization = (postalCode || mode) && (await shouldApplyRegionalizationRuntime());
  const coveredIds =
    applyRegionalization
      ? await getCoveredProductIdsForRegionalizationRuntime({
          productIds: [product.id],
          postalCode: postalCode || undefined,
          mode,
        })
      : [];
  const regionCovered = !applyRegionalization ? true : coveredIds.includes(product.id);
  const baseDetail = await mapPublicCatalogProductDetail(product);
  const detail = {
    ...baseDetail,
    available: baseDetail.available && regionCovered,
    regionalAvailability: {
      covered: regionCovered,
      mode: mode || null,
      postalCode: postalCode || null,
    },
  };

  return jsonPublic(detail, {
    generatedAt: detail.updatedAt,
    meta: {
      summary: await mapPublicCatalogProductSummary(product),
      regionalized: Boolean(applyRegionalization),
    },
  });
}

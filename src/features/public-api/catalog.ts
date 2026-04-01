import type { CatalogProduct } from '@/features/catalog/types';
import type { PublicApiCatalogProductSummary } from '@/features/public-api/contracts';
import { getCatalogAvailabilityPresentationRuntime } from '@/features/catalog/server/catalogDisplaySettingsStore';

export async function mapPublicCatalogProductSummary(product: CatalogProduct): Promise<PublicApiCatalogProductSummary> {
  const availability = await getCatalogAvailabilityPresentationRuntime(product);
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    image: product.image,
    price: product.price,
    listPrice: product.listPrice,
    available: product.available,
    availabilityLabel: availability.label,
    unit: product.unit,
    packSize: product.packSize,
    canonicalPath: `/e-commerce/${product.slug}/p`,
    categories: product.categories,
    departments: product.departments,
    collections: product.collections,
  };
}

export async function mapPublicCatalogProductDetail(product: CatalogProduct) {
  const summary = await mapPublicCatalogProductSummary(product);
  return {
    ...summary,
    categoryPath: product.categoryPath,
    images: product.images,
    shortDescription: product.shortDescription,
    longDescription: product.longDescription,
    pricing: product.pricing,
    stock: product.stock,
    logistics: product.logistics,
    regionalization: product.regionalization,
    seo: product.seo,
    allergens: product.allergens,
    ingredients: product.ingredients,
    storageInstructions: product.storageInstructions,
    marketing: product.marketing,
    variationGroup: product.variationGroup,
    updatedAt: product.updatedAt,
  };
}

import { EcommerceItem, UIProduct } from '../types/product';

function ensureProtocol(url?: string) {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  return url;
}

export function mapToUIProduct(item: EcommerceItem): UIProduct {
  const priceCents = item.sellingPrice ?? item.price ?? 0;
  const listCents = item.listPrice ?? priceCents;
  const image = ensureProtocol(item.imageUrls?.at2x) || '/file.svg';
  const packSize = item.priceDefinition?.sellingPrices?.[0]?.quantity || item.quantity || undefined;
  const categories: string[] | undefined = item.productCategories ? Object.values(item.productCategories) : undefined;
  const categoryPath = item.productCategoryIds
    ? item.productCategoryIds
        .split('/')
        .filter(Boolean)
        .map((id) => ({ id, name: item.productCategories?.[id] || '' }))
    : undefined;

  return {
    id: item.id,
    name: item.name,
    image,
    brand: item.additionalInfo?.brandName,
    price: priceCents / 100,
    listPrice: listCents / 100,
    unit: item.measurementUnit ?? 'un',
    url: item.detailUrl,
    available: item.availability !== 'unavailable',
    availabilityLabel: item.availability === 'unavailable' ? 'Esgotado' : 'Disponível',
    packSize,
    categories,
    categoryPath,
  };
}

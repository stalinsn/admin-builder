import { VtexSearchedProduct } from '../types/vtex';
import { UIProduct } from '../types/product';

function pickFirstImage(p: VtexSearchedProduct): string {
  const img = p.items?.[0]?.images?.[0]?.imageUrl;
  if (!img) return '/file.svg';
  return img.startsWith('http') ? img : `https://${img.replace(/^\/+/, '')}`;
}

export function vtexProductToUI(p: VtexSearchedProduct): UIProduct {
  const firstSku = p.items?.[0];
  const firstSeller = firstSku?.sellers?.[0];
  const offer = firstSeller?.commertialOffer;
  const price = offer?.Price ?? 0;
  const list = offer?.ListPrice ?? price;
  return {
    id: p.productId,
    name: p.productName,
    image: pickFirstImage(p),
    brand: p.brand,
    price,
    listPrice: list,
    unit: 'un',
    url: p.linkText ? `/${p.linkText}/p` : undefined,
    available: (offer?.AvailableQuantity ?? 0) > 0,
    categories: p.categories,
    categoryPath: p.categoriesIds?.map((id, idx) => ({ id: String(id), name: p.categories?.[idx] || '' })),
  };
}

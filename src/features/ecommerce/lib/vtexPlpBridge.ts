import { mockVtexGateway } from './vtexGateway';
import { vtexProductToUI } from './vtexAdapters';
import type { UIProduct } from '../types/product';
import type { VtexSearchedProduct } from '../types/vtex';
import type { RegionalizationContext } from './regionalization';

export type VtexPlpQuery = {
  term?: string;
  categoryIds?: string[];
  page?: number;
  pageSize?: number;
  sort?: 'relevance' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc';
  regionalization?: RegionalizationContext;
};

export async function queryVtexPLP(q: VtexPlpQuery): Promise<{ products: UIProduct[]; total: number }> {
  const mode = (process.env.NEXT_PUBLIC_DATA_SOURCE || 'local').toString();
  if (mode === 'vtexLive') {
    const params = new URLSearchParams();
    if (q.term) params.set('term', q.term);
    if (q.categoryIds?.length) params.set('categoryIds', q.categoryIds.join(','));
    if (q.page) params.set('page', String(q.page));
    if (q.pageSize) params.set('pageSize', String(q.pageSize));
    if (q.sort) params.set('sort', q.sort);
    if (q.regionalization?.postalCode) params.set('postalCode', q.regionalization.postalCode);
    if (q.regionalization?.mode) params.set('fulfillment', q.regionalization.mode);
    const res = await fetch(`/api/vtex/search?${params.toString()}`, { cache: 'no-store' });
    const raw = (await res.json()) as VtexSearchedProduct[];
    const arr: VtexSearchedProduct[] = Array.isArray(raw) ? raw : [];
    const products = arr.map((p) => vtexProductToUI(p));
    return { products, total: products.length };
  }
  const raw = await mockVtexGateway.searchProducts({ term: q.term, categoryIds: q.categoryIds, page: q.page, pageSize: q.pageSize, sort: q.sort });
  const products = raw.map(vtexProductToUI);
  return { products, total: products.length };
}

import type { UIProduct } from '../types/product';
import type { PLPQuery } from './plp';
import { queryPLP as queryLocalPLP } from './plp';
import { queryVtexPLP } from './vtexPlpBridge';
import { catalogCategories, catalogProducts, productCollectionsById, productDepartmentsById } from './catalog';
import type { PublicApiEnvelope } from '@/features/public-api/contracts';

type Category = (typeof catalogCategories)[number];
const allCategories = catalogCategories as Category[];

function getCategoryBySlug(slug?: string) {
  if (!slug) return undefined;
  return allCategories.find((c) => c.slug === slug);
}

function applyFilters(products: UIProduct[], filters?: PLPQuery['filters']) {
  if (!filters) return products;
  let filteredProducts = products;
  if (filters.price) {
    const [min, max] = filters.price;
    filteredProducts = filteredProducts.filter((p) => p.price >= min && p.price <= max);
  }
  if (filters.brand?.length) {
    const set = new Set(filters.brand.map((b) => b.toLocaleLowerCase()));
    filteredProducts = filteredProducts.filter((p) => (p.brand ? set.has(p.brand.toLocaleLowerCase()) : false));
  }
  if (filters.dept?.length) {
    const set = new Set(filters.dept.map((d) => d.toLocaleLowerCase()));
    filteredProducts = filteredProducts.filter((p) => {
      const departments = productDepartmentsById[p.id] || p.categories || [];
      return departments.some((department) => set.has(department.toLocaleLowerCase()));
    });
  }
  if (filters.collection?.length) {
    const set = new Set(filters.collection.map((c) => c.toLocaleLowerCase()));
    filteredProducts = filteredProducts.filter((p) => {
      const collections = productCollectionsById[p.id] || [];
      return collections.some((collection) => set.has(collection.toLocaleLowerCase()));
    });
  }
  return filteredProducts;
}

function sortProducts(products: UIProduct[], sort?: PLPQuery['sort']) {
  if (!sort || sort === 'relevance') return products;
  const arr = [...products];
  switch (sort) {
    case 'price-asc':
      arr.sort((a, b) => a.price - b.price); break;
    case 'price-desc':
      arr.sort((a, b) => b.price - a.price); break;
    case 'name-asc':
      arr.sort((a, b) => a.name.localeCompare(b.name)); break;
    case 'name-desc':
      arr.sort((a, b) => b.name.localeCompare(a.name)); break;
  }
  return arr;
}

function buildFacets(products: UIProduct[]) {
  const brands = Array.from(new Set(products.map((p) => p.brand).filter(Boolean))) as string[];
  const depts = Array.from(new Set(products.flatMap((p) => productDepartmentsById[p.id] || p.categories || [])));
  const collections = Array.from(new Set(products.flatMap((p) => productCollectionsById[p.id] || [])));
  const prices = products.map((p) => p.price);
  const min = prices.length ? Math.floor(Math.min(...prices)) : 0;
  const max = prices.length ? Math.ceil(Math.max(...prices)) : 0;
  const facets = [
    { type: 'range', key: 'price', label: 'Faixa de preço', min, max, step: Math.max(1, Math.round((max - min) / 10)) },
    { type: 'multi', key: 'brand', label: 'Marca', options: brands },
    { type: 'multi', key: 'dept', label: 'Subcategoria', options: depts },
  ] as NonNullable<ReturnType<typeof queryLocalPLP>['facets']>;
  if (collections.length) {
    facets.push({ type: 'multi', key: 'collection', label: 'Coleções', options: collections });
  }
  return facets;
}

export type DataSource = 'app' | 'local' | 'vtexMock' | 'vtexLive';

export function getDataSource(): DataSource {
  return (process.env.NEXT_PUBLIC_DATA_SOURCE as DataSource) || 'app';
}

export async function queryPLPUnified(params: PLPQuery) {
  const source = getDataSource();
  if (source === 'local') {
    return queryLocalPLP(params);
  }

  if (source === 'app') {
    const pageSize = params.pageSize ?? 24;
    const page = params.page ?? 1;
    const search = new URLSearchParams();
    if (params.categorySlug) search.set('category', params.categorySlug);
    if (params.searchTerm) search.set('q', params.searchTerm);
    if (params.sort) search.set('sort', params.sort);
    search.set('page', String(page));
    search.set('limit', String(pageSize));
    if (params.filters?.price) search.set('price', `${params.filters.price[0]}-${params.filters.price[1]}`);
    for (const brand of params.filters?.brand || []) search.append('brand', brand);
    for (const department of params.filters?.dept || []) search.append('dept', department);
    for (const collection of params.filters?.collection || []) search.append('collection', collection);

    const req = await fetch(`/api/v1/catalog/products?${search.toString()}`, { cache: 'no-store' });
    const payload = (await req.json().catch(() => null)) as PublicApiEnvelope<{
      items?: Array<{
        id: string;
        name: string;
        image: string;
        brand: string;
        price: number;
        listPrice?: number;
        unit: string;
        canonicalPath: string;
        available: boolean;
        availabilityLabel?: string;
        packSize?: number;
        categories: string[];
      }>;
      total?: number;
      category?: { id: string; slug: string; name: string; parentId: string | null; children: Array<{ id: string; slug: string; name: string }> } | null;
      facets?: ReturnType<typeof buildFacets>;
    }> | null;

    if (!req.ok || !payload?.data) {
      return queryLocalPLP(params);
    }

    const products: UIProduct[] = (payload.data.items || []).map((item) => ({
      id: item.id,
      name: item.name,
      image: item.image,
      brand: item.brand,
      price: item.price,
      listPrice: item.listPrice,
      unit: item.unit,
      url: item.canonicalPath,
      available: item.available,
      availabilityLabel: item.availabilityLabel,
      packSize: item.packSize,
      categories: item.categories,
      categoryPath: [],
    }));

    return {
      products,
      total: payload.data.total || 0,
      page,
      pageSize,
      category: payload.data.category
        ? {
            ...payload.data.category,
            productIds: [],
            facets: payload.data.facets || [],
          }
        : undefined,
      facets: payload.data.facets || [],
    } as ReturnType<typeof queryLocalPLP>;
  }

  const cat = getCategoryBySlug(params.categorySlug);
  const categoryIds = cat ? [String(cat.id)] : undefined;
  const pageSize = params.pageSize ?? 24;
  const page = params.page ?? 1;
  const term = params.searchTerm;
  const { products } = await queryVtexPLP({ term, categoryIds, page, pageSize, sort: params.sort, regionalization: params.regionalization });
  // Safety: if VTEX/mocks return nothing, fall back to local to avoid blank PLP during dev
  if (!products || products.length === 0) {
    return queryLocalPLP(params);
  }

  let result = products;
  result = applyFilters(result, params.filters);
  result = sortProducts(result, params.sort);

  const total = result.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return {
    products: result.slice(start, end),
    total,
    page,
    pageSize,
    category: cat,
    facets: buildFacets(result),
  } as ReturnType<typeof queryLocalPLP>;
}

export async function getProductBySlugUnified(
  slug: string,
  regionalization?: {
    postalCode?: string;
    mode?: 'delivery' | 'pickup';
  },
): Promise<UIProduct | null> {
  const source = getDataSource();
  if (source === 'local') {
    const all = catalogProducts;
    const bySlug = all.find((p) => p.url && p.url.includes(`/${slug}/p`));
    if (bySlug) return bySlug;
    return all.find((p) => p.id === slug) || null;
  }
  if (source === 'app') {
    const search = new URLSearchParams();
    if (regionalization?.postalCode) search.set('postalCode', regionalization.postalCode);
    if (regionalization?.mode) search.set('mode', regionalization.mode);
    const suffix = search.toString() ? `?${search.toString()}` : '';
    const req = await fetch(`/api/v1/catalog/products/${encodeURIComponent(slug)}${suffix}`, { cache: 'no-store' });
    const payload = (await req.json().catch(() => null)) as PublicApiEnvelope<{
      id: string;
      name: string;
      image: string;
      brand: string;
      price: number;
      listPrice?: number;
      unit: string;
      canonicalPath: string;
      available: boolean;
      availabilityLabel?: string;
      packSize?: number;
      categories: string[];
      categoryPath?: Array<{ id: string; name: string }>;
      regionalAvailability?: { covered?: boolean };
    }> | null;

    if (!req.ok || !payload?.data) {
      const all = catalogProducts;
      return all.find((p) => p.url && p.url.includes(`/${slug}/p`)) || all.find((p) => p.id === slug) || null;
    }

    return {
      id: payload.data.id,
      name: payload.data.name,
      image: payload.data.image,
      brand: payload.data.brand,
      price: payload.data.price,
      listPrice: payload.data.listPrice,
      unit: payload.data.unit,
      url: payload.data.canonicalPath,
      available: payload.data.available,
      availabilityLabel: payload.data.availabilityLabel,
      packSize: payload.data.packSize,
      categories: payload.data.categories,
      categoryPath: payload.data.categoryPath,
    };
  }
  const { products } = await queryVtexPLP({ term: slug, page: 1, pageSize: 12 });
  const bySlug = products.find((p) => p.url && p.url.includes(`/${slug}/p`));
  if (bySlug) return bySlug;
  // Try local fallback by slug or id
  const all = catalogProducts;
  const fromLocal = all.find((p) => p.url && p.url.includes(`/${slug}/p`)) || all.find((p) => p.id === slug) || null;
  return products[0] || fromLocal;
}

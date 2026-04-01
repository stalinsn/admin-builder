import { catalogCategories, catalogProducts, productCollectionsById, productDepartmentsById } from './catalog';
import type { CatalogCategory } from './catalog';
import type { UIProduct } from '../types/product';
import { applyRegionalization, type RegionalizationContext } from './regionalization';

export type Category = CatalogCategory;

export type PLPQuery = {
  categorySlug?: string;
  searchTerm?: string;
  page?: number;
  pageSize?: number;
  sort?: 'relevance' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc';
  regionalization?: RegionalizationContext;
  filters?: {
    price?: [number, number];
    brand?: string[];
    dept?: string[];
    collection?: string[];
  };
};
const allProducts: UIProduct[] = catalogProducts;
const allCategories: Category[] = catalogCategories;

function getCategoryBySlug(slug?: string) {
  if (!slug) return undefined;
  return allCategories.find((c) => c.slug === slug);
}

function textIncludes(haystack: string, needle: string) {
  return haystack.toLocaleLowerCase().includes(needle.toLocaleLowerCase());
}

function filterByCategory(products: UIProduct[], cat?: Category) {
  if (!cat) return products;
  const set = new Set(cat.productIds);
  return products.filter((p) => set.has(p.id) || p.categoryPath?.some((c) => c.id === cat.id));
}

function filterBySearch(products: UIProduct[], term?: string) {
  if (!term) return products;
  return products.filter((p) =>
    textIncludes(p.name, term) || textIncludes(p.brand || '', term) || p.categories?.some((c) => textIncludes(c, term))
  );
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
      arr.sort((a, b) => a.price - b.price);
      break;
    case 'price-desc':
      arr.sort((a, b) => b.price - a.price);
      break;
    case 'name-asc':
      arr.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'name-desc':
      arr.sort((a, b) => b.name.localeCompare(a.name));
      break;
  }
  return arr;
}

export function queryPLP(params: PLPQuery) {
  const { categorySlug, searchTerm, page = 1, pageSize = 16, sort, filters, regionalization } = params;
  const cat = getCategoryBySlug(categorySlug);
  let result = allProducts;
  result = filterByCategory(result, cat);
  result = filterBySearch(result, searchTerm);
  result = applyFilters(result, filters);
  if (!sort || sort === 'relevance') {
    result = applyRegionalization(result, regionalization);
  }
  const total = result.length;
  result = sortProducts(result, sort);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return {
    products: result.slice(start, end),
    total,
    page,
    pageSize,
    category: cat,
    facets: cat?.facets || buildFacetsFromProducts(result),
  };
}

function buildFacetsFromProducts(products: UIProduct[]): Category['facets'] {
  const brands = Array.from(new Set(products.map((p) => p.brand).filter(Boolean))) as string[];
  const depts = Array.from(new Set(products.flatMap((p) => productDepartmentsById[p.id] || p.categories || [])));
  const collections = Array.from(new Set(products.flatMap((p) => productCollectionsById[p.id] || [])));
  const prices = products.map((p) => p.price);
  const min = Math.floor(Math.min(...prices, 0));
  const max = Math.ceil(Math.max(...prices, 0));
  const facets: NonNullable<Category['facets']> = [
    { type: 'range', key: 'price', label: 'Faixa de preço', min, max, step: Math.max(1, Math.round((max - min) / 10)) },
    { type: 'multi', key: 'brand', label: 'Marca', options: brands },
    { type: 'multi', key: 'dept', label: 'Subcategoria', options: depts },
  ];
  if (collections.length) {
    facets.push({ type: 'multi', key: 'collection', label: 'Coleções', options: collections });
  }
  return facets;
}

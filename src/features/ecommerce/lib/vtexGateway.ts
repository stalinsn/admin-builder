import type { VtexSearchedProduct, VtexCategoryNode, VtexBrand } from '../types/vtex';
import { vtexProductsMock, vtexCategoriesMock, vtexBrandsMock } from './vtexMocks';

export type VtexGateway = {
  searchProducts: (params: { term?: string; categoryIds?: string[]; page?: number; pageSize?: number; sort?: string }) => Promise<VtexSearchedProduct[]>;
  getCategories: () => Promise<VtexCategoryNode[]>;
  getBrands: () => Promise<VtexBrand[]>;
};

export const mockVtexGateway: VtexGateway = {
  async searchProducts(params) {
    let filtered = vtexProductsMock;
    if (params.term) {
      const termLower = params.term.toLocaleLowerCase();
      filtered = filtered.filter((p) => p.productName.toLocaleLowerCase().includes(termLower) || p.brand.toLocaleLowerCase().includes(termLower));
    }
    if (params.categoryIds?.length) {
      const set = new Set(params.categoryIds.map(String));
      filtered = filtered.filter((p) => p.categoriesIds?.some((id) => set.has(String(id))));
    }
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 16;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  },
  async getCategories() {
    return vtexCategoriesMock;
  },
  async getBrands() {
    return vtexBrandsMock;
  },
};

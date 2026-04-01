import rawBaseProducts from '../data/products.json';
import rawMockProducts from '../data/mock-catalog/products-index.json';
import rawBaseCategories from '../data/categories.json';
import rawTaxonomy from '../data/mock-catalog/taxonomy.json';
import type { EcommerceItem, UIProduct } from '../types/product';
import { mapToUIProduct } from './mapProduct';

export type CatalogFacet =
  | { type: 'range'; key: 'price'; label: string; min: number; max: number; step?: number }
  | { type: 'multi'; key: 'brand' | 'dept' | 'collection'; label: string; options: string[] };

export type CatalogCategory = {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  children?: { id: string; slug: string; name: string }[];
  productIds: string[];
  facets?: CatalogFacet[];
};

export type CatalogCollection = {
  id: string;
  slug: string;
  name: string;
  productIds: string[];
};

type BaseCategory = {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  children?: { id: string; slug: string; name: string }[];
  productIds?: string[];
  facets?: CatalogFacet[];
};

type TaxonomySubcategory = {
  id?: string;
  slug: string;
  name: string;
  keywords?: string[];
  tags?: string[];
};

type TaxonomyCategory = {
  slug: string;
  aliases?: string[];
  name?: string;
  subcategories?: TaxonomySubcategory[];
};

type TaxonomyFile = {
  categories?: TaxonomyCategory[];
};

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

function dedupeProducts(items: EcommerceItem[]) {
  const byId = new Map<string, EcommerceItem>();
  for (const item of items) {
    if (!item?.id) continue;
    byId.set(item.id, item);
  }
  return Array.from(byId.values());
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function deriveCollectionLabels(product: UIProduct, raw: EcommerceItem | null): string[] {
  const labels = new Set<string>();

  if ((product.listPrice || product.price) > product.price) labels.add('Ofertas');
  if (/organico/i.test(product.name)) labels.add('Organicos');

  if (raw) {
    const dynamic = raw as unknown as Record<string, unknown>;
    const tags = readStringArray(dynamic.tags).map((tag) => tag.toLocaleLowerCase());
    const badges = readStringArray(dynamic.badges).map((badge) => badge.toLocaleLowerCase());

    if (tags.includes('organico') || badges.includes('organico')) labels.add('Organicos');
    if (badges.some((badge) => badge.includes('oferta'))) labels.add('Ofertas');
    if (badges.includes('estoque-limitado')) labels.add('Estoque Limitado');

    const regionalization = (dynamic.regionalization || {}) as Record<string, unknown>;
    if (regionalization.pickupEligible === true) labels.add('Retirada em Loja');

    const logistics = (dynamic.logistics || {}) as Record<string, unknown>;
    if (logistics.temperatureZone === 'frozen') labels.add('Congelados');
    if (logistics.temperatureZone === 'chilled') labels.add('Refrigerados');

    const marketing = (dynamic.marketing || {}) as Record<string, unknown>;
    for (const campaign of readStringArray(marketing.campaignEligibility)) {
      if (campaign === 'black-friday') labels.add('Black Friday');
      if (campaign === 'mothers-day') labels.add('Dia das Maes');
      if (campaign === 'easter') labels.add('Pascoa');
    }
  }

  if (!labels.size) labels.add('Novidades');
  return Array.from(labels);
}

const baseProducts = rawBaseProducts as unknown as EcommerceItem[];
const mockProducts = rawMockProducts as unknown as EcommerceItem[];
const taxonomy = (rawTaxonomy as TaxonomyFile).categories || [];

export const catalogRawProducts: EcommerceItem[] = dedupeProducts([...baseProducts, ...mockProducts]);
export const catalogProducts: UIProduct[] = catalogRawProducts.map(mapToUIProduct);

const rawById = new Map(catalogRawProducts.map((item) => [item.id, item]));

function getTaxonomyCategory(slug: string, name: string): TaxonomyCategory | undefined {
  const normalizedSlug = slugify(slug || name);
  return taxonomy.find((entry) => {
    const aliases = [entry.slug, ...(entry.aliases || [])];
    return aliases.some((alias) => slugify(alias) === normalizedSlug);
  });
}

function inferTaxonomyDepartments(
  product: UIProduct,
  raw: EcommerceItem | undefined,
  subcategories: TaxonomySubcategory[] | undefined
) {
  if (!subcategories?.length) return [];
  const textPool = [
    product.name,
    ...(product.categories || []),
    ...(product.categoryPath?.map((node) => node.name) || []),
    ...readStringArray((raw as unknown as Record<string, unknown>)?.tags),
  ]
    .map(normalizeText)
    .join(' ');

  const matches = subcategories.flatMap((subcategory) => {
    const terms = uniqueStrings([...(subcategory.keywords || []), ...(subcategory.tags || [])]).map(normalizeText);
    return terms.some((term) => term && textPool.includes(term)) ? [subcategory.name] : [];
  });

  return uniqueStrings(matches);
}

export const productCollectionsById: Record<string, string[]> = Object.fromEntries(
  catalogProducts.map((product) => [product.id, deriveCollectionLabels(product, rawById.get(product.id) || null)])
);

const collectionMap = new Map<string, CatalogCollection>();
for (const product of catalogProducts) {
  const labels = productCollectionsById[product.id] || [];
  for (const label of labels) {
    const slug = slugify(label);
    const id = `collection-${slug}`;
    if (!collectionMap.has(slug)) {
      collectionMap.set(slug, { id, slug, name: label, productIds: [] });
    }
    const collection = collectionMap.get(slug);
    if (collection && !collection.productIds.includes(product.id)) {
      collection.productIds.push(product.id);
    }
  }
}

export const catalogCollections: CatalogCollection[] = Array.from(collectionMap.values()).sort((a, b) =>
  a.name.localeCompare(b.name)
);

const baseCategories = rawBaseCategories as unknown as BaseCategory[];

function buildCatalogData() {
  const topSeed = baseCategories.filter((category) => category.parentId === null);
  const topMap = new Map<
    string,
    {
      id: string;
      slug: string;
      name: string;
      order: number;
      children: Map<string, { id: string; slug: string; name: string }>;
      productIds: Set<string>;
      facets?: CatalogFacet[];
    }
  >();

  topSeed.forEach((category, index) => {
    const taxonomyCategory = getTaxonomyCategory(category.slug, category.name);
    const taxonomyChildren = taxonomyCategory?.subcategories || [];
    const seededChildren = new Map((category.children || []).map((child) => [child.id || child.name, child]));
    taxonomyChildren.forEach((subcategory, subcategoryIndex) => {
      const taxonomyId = subcategory.id || `${category.id}-${subcategory.slug || subcategoryIndex}`;
      if (!seededChildren.has(taxonomyId)) {
        seededChildren.set(taxonomyId, {
          id: taxonomyId,
          slug: subcategory.slug || slugify(subcategory.name),
          name: subcategory.name,
        });
      }
    });

    topMap.set(category.id, {
      id: category.id,
      slug: category.slug,
      name: category.name,
      order: index,
      children: seededChildren,
      productIds: new Set(category.productIds || []),
      facets: category.facets,
    });
  });

  const unknownStartOrder = topSeed.length + 10;
  let unknownCounter = 0;

  for (const product of catalogProducts) {
    const path = product.categoryPath || [];
    const topNode = path[0];
    if (!topNode?.id) continue;

    if (!topMap.has(topNode.id)) {
      topMap.set(topNode.id, {
        id: topNode.id,
        slug: slugify(topNode.name || `categoria-${topNode.id}`),
        name: topNode.name || `Categoria ${topNode.id}`,
        order: unknownStartOrder + unknownCounter++,
        children: new Map(),
        productIds: new Set(),
      });
    }

    const topCategory = topMap.get(topNode.id);
    if (!topCategory) continue;
    topCategory.productIds.add(product.id);

    const subNode = path[1];
    if (subNode?.id && subNode?.name) {
      topCategory.children.set(subNode.id, {
        id: subNode.id,
        slug: slugify(subNode.name),
        name: subNode.name,
      });
    }
  }

  const productDepartmentsAccumulator = new Map<string, Set<string>>();

  const categories = Array.from(topMap.values())
    .sort((a, b) => a.order - b.order)
    .map<CatalogCategory>((entry) => {
      const categoryProducts = catalogProducts.filter((product) => entry.productIds.has(product.id));
      const taxonomyCategory = getTaxonomyCategory(entry.slug, entry.name);
      const taxonomyChildren = taxonomyCategory?.subcategories || [];

      const mergedChildren = new Map(entry.children);
      taxonomyChildren.forEach((subcategory, subcategoryIndex) => {
        const taxonomyId = subcategory.id || `${entry.id}-${subcategory.slug || subcategoryIndex}`;
        mergedChildren.set(taxonomyId, {
          id: taxonomyId,
          slug: subcategory.slug || slugify(subcategory.name),
          name: subcategory.name,
        });
      });

      const brands = uniqueStrings(categoryProducts.map((product) => product.brand || ''));
      const deptFromChildren = Array.from(mergedChildren.values()).map((child) => child.name);
      const deptFromProducts = uniqueStrings(categoryProducts.flatMap((product) => product.categoryPath?.slice(1).map((node) => node.name) || []));
      const deptFromTaxonomy = uniqueStrings(
        categoryProducts.flatMap((product) => inferTaxonomyDepartments(product, rawById.get(product.id), taxonomyChildren))
      );
      const depts = uniqueStrings([...deptFromChildren, ...deptFromProducts, ...deptFromTaxonomy]);

      for (const product of categoryProducts) {
        const explicitDepartments = uniqueStrings((product.categoryPath || []).slice(1).map((node) => node.name));
        const inferredDepartments = inferTaxonomyDepartments(product, rawById.get(product.id), taxonomyChildren);
        const combinedDepartments = uniqueStrings([...explicitDepartments, ...inferredDepartments]);
        if (!combinedDepartments.length) continue;
        const byProduct = productDepartmentsAccumulator.get(product.id) || new Set<string>();
        combinedDepartments.forEach((department) => byProduct.add(department));
        productDepartmentsAccumulator.set(product.id, byProduct);
      }

      const collectionOptions = uniqueStrings(
        categoryProducts.flatMap((product) => productCollectionsById[product.id] || [])
      );

      const prices = categoryProducts.map((product) => product.price);
      const minPrice = prices.length ? Math.floor(Math.min(...prices)) : 0;
      const maxPrice = prices.length ? Math.ceil(Math.max(...prices)) : 0;

      const dynamicFacets: CatalogFacet[] = [
        {
          type: 'range',
          key: 'price',
          label: 'Faixa de preço',
          min: minPrice,
          max: maxPrice,
          step: Math.max(1, Math.round((maxPrice - minPrice) / 10)),
        },
        { type: 'multi', key: 'brand', label: 'Marca', options: brands },
        { type: 'multi', key: 'dept', label: 'Subcategoria', options: depts },
      ];

      if (collectionOptions.length) {
        dynamicFacets.push({ type: 'multi', key: 'collection', label: 'Coleções', options: collectionOptions });
      }

      return {
        id: entry.id,
        slug: entry.slug,
        name: entry.name,
        parentId: null,
        children: Array.from(mergedChildren.values()).sort((a, b) => a.name.localeCompare(b.name)),
        productIds: Array.from(entry.productIds),
        facets: dynamicFacets,
      };
    })
    .filter((category) => category.productIds.length > 0 || (category.children?.length || 0) > 0);

  const productDepartmentsById: Record<string, string[]> = Object.fromEntries(
    Array.from(productDepartmentsAccumulator.entries()).map(([productId, departments]) => [productId, Array.from(departments)])
  );

  return {
    categories,
    productDepartmentsById,
  };
}

const builtCatalog = buildCatalogData();

export const catalogCategories: CatalogCategory[] = builtCatalog.categories;
export const productDepartmentsById: Record<string, string[]> = builtCatalog.productDepartmentsById;

export function getCatalogCategoryBySlug(slug?: string) {
  if (!slug) return undefined;
  return catalogCategories.find((category) => category.slug === slug);
}

export function getCatalogProductBySlug(slug: string) {
  const normalizedSlug = slug.toLocaleLowerCase();
  return (
    catalogProducts.find((product) => product.url && product.url.toLocaleLowerCase().includes(`/${normalizedSlug}/p`)) ||
    catalogProducts.find((product) => product.id.toLocaleLowerCase() === normalizedSlug) ||
    null
  );
}

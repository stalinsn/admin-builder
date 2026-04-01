import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

import { PANEL_SECURITY } from '@/features/ecommpanel/config/security';
import { nowIso, randomToken, sha256 } from '@/features/ecommpanel/server/crypto';
import { resolvePostgresRuntime } from '@/features/ecommpanel/server/postgresRuntime';
import { sanitizeImageUrl } from '@/utils/inputSecurity';
import {
  catalogProducts as localCatalogProducts,
  productCollectionsById,
  productDepartmentsById,
} from '@/features/ecommerce/lib/catalog';
import type { EcommerceItem, UIProduct } from '@/features/ecommerce/types/product';
import type {
  CatalogCategory,
  CatalogCategoryListItem,
  CatalogCategoryUpsertInput,
  CatalogCollection,
  CatalogCollectionListItem,
  CatalogCollectionUpsertInput,
  CatalogFacet,
  CatalogOperationalSummary,
  CatalogPlpResult,
  CatalogProduct,
  CatalogProductListItem,
  CatalogProductStatus,
  CatalogProductUpsertInput,
} from '@/features/catalog/types';
import {
  deleteAllCatalogProductsFromDatabase,
  countCatalogProductsInDatabase,
  getCatalogCategoryByIdFromDatabase,
  getCatalogCollectionByIdFromDatabase,
  getCatalogProductByIdFromDatabase,
  getCatalogProductBySlugFromDatabase,
  listCatalogCategoriesFromDatabase,
  listCatalogCollectionsFromDatabase,
  listCatalogProductsFromDatabase,
  upsertCatalogCategoryInDatabase,
  upsertCatalogCollectionInDatabase,
  upsertCatalogProductInDatabase,
} from './catalogDatabaseStore';
import {
  buildCatalogProductsCsv,
  parseCatalogProductsCsv,
} from './catalogCsvStore';
import {
  getCoveredProductIdsForRegionalizationRuntime,
  shouldApplyRegionalizationRuntime,
} from '@/features/ecommerce/server/logisticsStore';
import {
  getCatalogAvailabilityPresentationRuntime,
  getCatalogDisplaySettingsRuntime,
} from './catalogDisplaySettingsStore';

const CATALOG_SCHEMA_VERSION = 1;
const ADMIN_ROOT = path.join(process.cwd(), 'src/data/ecommpanel/catalog');
const ADMIN_PRODUCTS_DIR = path.join(ADMIN_ROOT, 'products');
const ADMIN_INDEX_FILE = path.join(ADMIN_ROOT, 'products-index.json');
const ADMIN_CATEGORIES_FILE = path.join(ADMIN_ROOT, 'categories-index.json');
const ADMIN_COLLECTIONS_FILE = path.join(ADMIN_ROOT, 'collections-index.json');
const STATIC_CATALOG_INDEX = path.join(process.cwd(), 'src/features/ecommerce/data/mock-catalog/products-index.json');

type PersistedCatalogIndex = {
  schemaVersion: number;
  updatedAt: string;
  products: CatalogProductListItem[];
};

type PersistedCatalogCategories = {
  schemaVersion: number;
  updatedAt: string;
  categories: CatalogCategory[];
};

type PersistedCatalogCollections = {
  schemaVersion: number;
  updatedAt: string;
  collections: CatalogCollection[];
};

type CatalogPersistenceMode = 'files' | 'hybrid' | 'database';
export type CatalogRuntimeContext = {
  demoSessionId?: string;
  demoSessionExpiresAt?: string;
};

type CatalogDemoSnapshot = {
  schemaVersion: number;
  createdAt: string;
  expiresAt: string;
  products: CatalogProduct[];
  categories: CatalogCategory[];
  collections: CatalogCollection[];
};

declare global {
  var __CATALOG_DB_FILE_SEEDED_KEYS__: Set<string> | undefined;
}

const DEMO_ROOT = path.join(process.cwd(), 'src/data/ecommpanel/catalog-demo');
const DEMO_SCHEMA_VERSION = 1;

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeSlug(value: string): string {
  return slugify(value || '').slice(0, 120);
}

function normalizeLine(value: string | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function normalizeMultiline(value: string | undefined): string {
  return (value || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => normalizeLine(item)).filter(Boolean)));
}

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function normalizeMetadata(value: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

function normalizePositiveNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
}

function normalizeIdentification(
  value: CatalogProduct['identification'] | null | undefined,
): CatalogProduct['identification'] | null {
  if (!value) return null;

  const normalized = {
    gtin: normalizeLine(value.gtin),
    ean: normalizeLine(value.ean),
    referenceId: normalizeLine(value.referenceId),
    mpn: normalizeLine(value.mpn),
    ncm: normalizeLine(value.ncm),
    cest: normalizeLine(value.cest),
    originCountry: normalizeLine(value.originCountry),
  };

  return Object.values(normalized).some(Boolean) ? normalized : null;
}

function normalizeDimensions(
  value: CatalogProduct['dimensions'] | null | undefined,
): CatalogProduct['dimensions'] | null {
  if (!value) return null;

  const normalized = {
    weightKg: normalizePositiveNumber(value.weightKg),
    heightCm: normalizePositiveNumber(value.heightCm),
    widthCm: normalizePositiveNumber(value.widthCm),
    lengthCm: normalizePositiveNumber(value.lengthCm),
  };

  return Object.values(normalized).some((item) => item !== undefined) ? normalized : null;
}

function normalizeSellMode(value: unknown): CatalogProduct['commercialUnit']['sellMode'] {
  return value === 'weight' || value === 'volume' || value === 'length' || value === 'area' ? value : 'unit';
}

function normalizeCommercialUnit(
  value: CatalogProduct['commercialUnit'] | null | undefined,
  fallbackUnit = 'un',
  fallbackPackSize?: number,
): CatalogProduct['commercialUnit'] {
  const salesUnit = normalizeLine(value?.salesUnit || fallbackUnit || 'un') || 'un';
  const multiplier =
    value?.multiplier !== undefined
      ? Math.max(1, Number(value.multiplier))
      : fallbackPackSize !== undefined && fallbackPackSize > 1
        ? Math.max(1, Number(fallbackPackSize))
        : undefined;

  return {
    sellMode: normalizeSellMode(value?.sellMode),
    salesUnit,
    pricingBaseQuantity: normalizePositiveNumber(value?.pricingBaseQuantity),
    pricingBaseUnit: normalizeLine(value?.pricingBaseUnit),
    referenceQuantity: normalizePositiveNumber(value?.referenceQuantity),
    referenceUnit: normalizeLine(value?.referenceUnit),
    multiplier,
    multiplierUnit: normalizeLine(value?.multiplierUnit),
    allowFractionalQuantity: Boolean(value?.allowFractionalQuantity),
  };
}

function normalizePackaging(
  value: CatalogProduct['packaging'] | null | undefined,
  fallbackPackSize?: number,
): CatalogProduct['packaging'] | null {
  const normalized = {
    packageType: normalizeLine(value?.packageType),
    packageLabel: normalizeLine(value?.packageLabel),
    unitsPerPackage:
      value?.unitsPerPackage !== undefined
        ? Math.max(1, Math.floor(Number(value.unitsPerPackage)))
        : fallbackPackSize !== undefined && fallbackPackSize > 1
          ? Math.max(1, Math.floor(Number(fallbackPackSize)))
          : undefined,
    contentQuantity: normalizePositiveNumber(value?.contentQuantity),
    contentUnit: normalizeLine(value?.contentUnit),
    soldByPackage: Boolean(value?.soldByPackage),
  };

  return Object.values(normalized).some((item) => item !== undefined && item !== '' && item !== false) ? normalized : null;
}

function normalizeVariantAxes(
  value: CatalogProduct['merchandising']['variantAxes'] | null | undefined,
): CatalogProduct['merchandising']['variantAxes'] {
  if (!Array.isArray(value)) return [];

  return value
    .map((axis, index) => ({
      key: normalizeLine(axis.key) || `axis-${index + 1}`,
      label: normalizeLine(axis.label) || normalizeLine(axis.key) || `Eixo ${index + 1}`,
      values: uniqueStrings(Array.isArray(axis.values) ? axis.values : []),
    }))
    .filter((axis) => axis.values.length > 0);
}

function normalizeMerchandising(
  value: CatalogProduct['merchandising'] | null | undefined,
): CatalogProduct['merchandising'] {
  const profile = (() => {
    switch (value?.profile) {
      case 'food':
      case 'small_appliance':
      case 'large_appliance':
      case 'fashion':
        return value.profile;
      default:
        return 'generic';
    }
  })();

  return {
    profile,
    variantAxes: normalizeVariantAxes(value?.variantAxes),
    supportedVoltages: uniqueStrings(value?.supportedVoltages || []),
    supportedColors: uniqueStrings(value?.supportedColors || []),
    supportedSizes: uniqueStrings(value?.supportedSizes || []),
    sizeSystem: normalizeLine(value?.sizeSystem),
    targetGender: normalizeLine(value?.targetGender),
  };
}

function normalizeSupplier(
  value: CatalogProduct['supplier'] | null | undefined,
): CatalogProduct['supplier'] | null {
  if (!value) return null;

  const normalized = {
    supplierId: normalizeLine(value.supplierId),
    supplierName: normalizeLine(value.supplierName),
    supplierSku: normalizeLine(value.supplierSku),
    costPrice: normalizePositiveNumber(value.costPrice),
  };

  return Object.values(normalized).some((item) => item !== undefined && item !== '') ? normalized : null;
}

function normalizeInventoryLocations(
  value: CatalogProduct['stock']['warehouses'] | null | undefined,
): CatalogProduct['stock']['warehouses'] {
  if (!Array.isArray(value)) return [];

  return value
    .map((location, index) => ({
      id: normalizeLine(location.id) || `warehouse-${index + 1}`,
      name: normalizeLine(location.name) || `Estoque ${index + 1}`,
      availableQuantity: Math.max(0, Math.floor(Number(location.availableQuantity || 0))),
      reservedQuantity: Math.max(0, Math.floor(Number(location.reservedQuantity || 0))),
      incomingQuantity: Math.max(0, Math.floor(Number(location.incomingQuantity || 0))),
      safetyStock: Math.max(0, Math.floor(Number(location.safetyStock || 0))),
      reorderPoint:
        location.reorderPoint !== undefined ? Math.max(0, Math.floor(Number(location.reorderPoint || 0))) : undefined,
      leadTimeDays:
        location.leadTimeDays !== undefined ? Math.max(0, Math.floor(Number(location.leadTimeDays || 0))) : undefined,
    }))
    .filter((location) => location.name);
}

function normalizeProductAttributes(
  value: CatalogProduct['attributes'] | undefined,
): CatalogProduct['attributes'] {
  if (!Array.isArray(value)) return [];

  return value
    .map((attribute, index) => ({
      key: normalizeLine(attribute.key) || `attr-${index + 1}`,
      label: normalizeLine(attribute.label) || normalizeLine(attribute.key) || `Atributo ${index + 1}`,
      value: normalizeLine(attribute.value),
      highlight: Boolean(attribute.highlight),
      filterable: Boolean(attribute.filterable),
    }))
    .filter((attribute) => attribute.value);
}

function normalizeProductVariants(
  value: CatalogProduct['variants'] | undefined,
): CatalogProduct['variants'] {
  if (!Array.isArray(value)) return [];

  return value
    .map((variant, index) => ({
      id: normalizeLine(variant.id) || `variant-${index + 1}`,
      sku: normalizeLine(variant.sku) || `variant-sku-${index + 1}`,
      label: normalizeLine(variant.label) || `Variação ${index + 1}`,
      values: uniqueStrings(Array.isArray(variant.values) ? variant.values : []),
      available: Boolean(variant.available),
      image: sanitizeImageUrl(normalizeLine(variant.image || ''), ''),
      price: variant.price !== undefined ? Number(variant.price) : undefined,
      listPrice: variant.listPrice !== undefined ? Number(variant.listPrice) : undefined,
      stock: {
        availableQuantity: Math.max(0, Math.floor(Number(variant.stock?.availableQuantity || 0))),
        reservedQuantity: Math.max(0, Math.floor(Number(variant.stock?.reservedQuantity || 0))),
        incomingQuantity: Math.max(0, Math.floor(Number(variant.stock?.incomingQuantity || 0))),
        safetyStock: Math.max(0, Math.floor(Number(variant.stock?.safetyStock || 0))),
        reorderPoint:
          variant.stock?.reorderPoint !== undefined ? Math.max(0, Math.floor(Number(variant.stock.reorderPoint || 0))) : undefined,
      },
      attributes: normalizeMetadata(variant.attributes ?? null),
    }))
    .filter((variant) => variant.sku && variant.label);
}

function parseJsonObject(value: string | undefined): Record<string, unknown> | null {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function ensureCatalogDirs(): void {
  fs.mkdirSync(ADMIN_PRODUCTS_DIR, { recursive: true });
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpPath, JSON.stringify(value, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function getAdminProductPath(productId: string): string {
  return path.join(ADMIN_PRODUCTS_DIR, `${productId}.json`);
}

function toListItem(product: CatalogProduct): CatalogProductListItem {
  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    brand: product.brand,
    status: product.status,
    available: product.available,
    image: product.image,
    price: product.price,
    listPrice: product.listPrice,
    categories: product.categories,
    collections: product.collections,
    stockQuantity: product.stock.availableQuantity,
    reservedStockQuantity: product.stock.reservedQuantity || 0,
    incomingStockQuantity: product.stock.incomingQuantity || 0,
    lowStock: product.stock.availableQuantity <= product.stock.safetyStock,
    variantsCount: product.variants.length,
    updatedAt: product.updatedAt,
  };
}

function hydrateProduct(product: CatalogProduct): CatalogProduct {
  const primaryImage = sanitizeImageUrl(
    product.images.find((image) => image.isPrimary)?.url || product.images[0]?.url || product.image || '/file.svg',
    '/file.svg',
  );
  const categories = uniqueStrings(product.categories);
  const departments = uniqueStrings(product.departments);
  const collections = uniqueStrings(product.collections);
  const categoryPath = (product.categoryPath || [])
    .filter((node) => normalizeLine(node.name))
    .map((node, index) => ({
      id: normalizeLine(node.id) || `cat-${index}-${normalizeSlug(node.name)}`,
      slug: normalizeSlug(node.slug || node.name || node.id),
      name: normalizeLine(node.name || node.slug || node.id),
    }));

  const topCategory = categories[0];
  const firstDepartment = departments[0];
  const nextCategoryPath =
    categoryPath.length > 0
      ? categoryPath
      : [
          ...(topCategory ? [{ id: `cat-${normalizeSlug(topCategory)}`, slug: normalizeSlug(topCategory), name: topCategory }] : []),
          ...(firstDepartment ? [{ id: `dept-${normalizeSlug(firstDepartment)}`, slug: normalizeSlug(firstDepartment), name: firstDepartment }] : []),
        ];

  return {
    ...product,
    slug: normalizeSlug(product.slug || product.name || product.id),
    sku: normalizeLine(product.sku || product.id),
    name: normalizeLine(product.name),
    brand: normalizeLine(product.brand || 'Sem marca'),
    status: product.status || 'active',
    available: Boolean(product.available),
    image: primaryImage,
    images:
      product.images?.length > 0
        ? product.images
            .map((image) => ({
              url: sanitizeImageUrl(image.url.trim(), primaryImage),
              alt: normalizeLine(image.alt || product.name),
              label: normalizeLine(image.label),
              isPrimary: Boolean(image.isPrimary),
            }))
            .filter((image) => image.url)
        : [{ url: primaryImage, alt: normalizeLine(product.name), isPrimary: true }],
    price: Number(product.price || 0),
    listPrice: product.listPrice ? Number(product.listPrice) : undefined,
    unit: normalizeLine(product.unit || 'un') || 'un',
    packSize: product.packSize ? Math.max(1, Math.floor(product.packSize)) : undefined,
    commercialUnit: normalizeCommercialUnit(product.commercialUnit, product.unit || 'un', product.packSize),
    packaging: normalizePackaging(product.packaging, product.packSize),
    merchandising: normalizeMerchandising(product.merchandising),
    categories,
    categoryPath: nextCategoryPath,
    departments,
    collections,
    shortDescription: normalizeLine(product.shortDescription || product.name),
    longDescription: normalizeMultiline(product.longDescription),
    seo: {
      title: normalizeLine(product.seo?.title || product.name),
      description: normalizeLine(product.seo?.description || product.shortDescription || product.name),
      keywords: uniqueStrings(product.seo?.keywords || []),
      noIndex: Boolean(product.seo?.noIndex),
    },
    identification: normalizeIdentification(product.identification),
    dimensions: normalizeDimensions(product.dimensions),
    supplier: normalizeSupplier(product.supplier),
    attributes: normalizeProductAttributes(product.attributes),
    stock: {
      availableQuantity: Math.max(0, Math.floor(Number(product.stock?.availableQuantity || 0))),
      reservedQuantity: Math.max(0, Math.floor(Number(product.stock?.reservedQuantity || 0))),
      incomingQuantity: Math.max(0, Math.floor(Number(product.stock?.incomingQuantity || 0))),
      safetyStock: Math.max(0, Math.floor(Number(product.stock?.safetyStock || 0))),
      reorderPoint:
        product.stock?.reorderPoint !== undefined ? Math.max(0, Math.floor(Number(product.stock.reorderPoint || 0))) : undefined,
      backorderable: Boolean(product.stock?.backorderable),
      leadTimeDays: product.stock?.leadTimeDays ? Math.max(0, Math.floor(Number(product.stock.leadTimeDays))) : undefined,
      trackInventory: product.stock?.trackInventory !== undefined ? Boolean(product.stock.trackInventory) : true,
      allowOversell: Boolean(product.stock?.allowOversell),
      warehouses: normalizeInventoryLocations(product.stock?.warehouses),
    },
    logistics: product.logistics || null,
    pricing: product.pricing || null,
    regionalization: product.regionalization || null,
    marketing: product.marketing || null,
    variationGroup: product.variationGroup || null,
    variants: normalizeProductVariants(product.variants),
    customFields: normalizeMetadata(product.customFields),
    allergens: uniqueStrings(product.allergens || []),
    ingredients: normalizeMultiline(product.ingredients),
    storageInstructions: normalizeMultiline(product.storageInstructions),
    createdAt: product.createdAt || nowIso(),
    updatedAt: product.updatedAt || nowIso(),
  };
}

function buildCategoryPath(
  categories: string[],
  departments: string[],
  fallbackPath: CatalogProduct['categoryPath'],
): CatalogProduct['categoryPath'] {
  if (fallbackPath?.length) {
    return fallbackPath.map((node, index) => ({
      id: normalizeLine(node.id) || `cat-${index}-${normalizeSlug(node.name)}`,
      slug: normalizeSlug(node.slug || node.name || node.id),
      name: normalizeLine(node.name || node.slug || node.id),
    }));
  }

  return [
    ...(categories[0] ? [{ id: `cat-${normalizeSlug(categories[0])}`, slug: normalizeSlug(categories[0]), name: categories[0] }] : []),
    ...(departments[0] ? [{ id: `dept-${normalizeSlug(departments[0])}`, slug: normalizeSlug(departments[0]), name: departments[0] }] : []),
  ];
}

function resolveRawProduct(productId: string): (EcommerceItem & Record<string, unknown>) | null {
  const stored = readJsonFile<Array<EcommerceItem & Record<string, unknown>>>(STATIC_CATALOG_INDEX) || [];
  return stored.find((item) => item.id === productId) || null;
}

function seedCatalogProductsFromLocal(): CatalogProduct[] {
  return localCatalogProducts.map((product) => {
    const raw = resolveRawProduct(product.id);
    const categories = uniqueStrings(product.categories || []);
    const departments = uniqueStrings(productDepartmentsById[product.id] || []);
    const collections = uniqueStrings(productCollectionsById[product.id] || []);
    const images =
      Array.isArray(raw?.images) && raw?.images.length
        ? raw.images
            .filter((image): image is Record<string, unknown> => Boolean(image) && typeof image === 'object')
            .map((image, index) => ({
              url: sanitizeImageUrl(normalizeLine(String(image.url || '')), product.image),
              alt: normalizeLine(String(image.alt || product.name)),
              label: normalizeLine(String(image.label || '')),
              isPrimary: Boolean(image.isPrimary) || index === 0,
            }))
            .filter((image) => image.url)
        : [{ url: sanitizeImageUrl(product.image, '/file.svg'), alt: product.name, isPrimary: true }];

    const rawStatus = normalizeLine(String(raw?.status || '')).toLowerCase();
    const status: CatalogProductStatus = rawStatus === 'draft' || rawStatus === 'archived' ? rawStatus : 'active';
    const rawAudit = raw && typeof raw.audit === 'object' && raw.audit ? (raw.audit as Record<string, unknown>) : null;
    const createdAt = typeof rawAudit?.createdAt === 'string' ? rawAudit.createdAt : nowIso();
    const updatedAt = typeof rawAudit?.updatedAt === 'string' ? rawAudit.updatedAt : createdAt;

    return hydrateProduct({
      id: product.id,
      slug: normalizeSlug(String(raw?.slug || '')) || normalizeSlug(product.url || '') || product.id.toLowerCase(),
      sku: normalizeLine(String(raw?.productRefId || raw?.refId || product.id)),
      name: normalizeLine(product.name),
      brand: normalizeLine(product.brand || String(raw?.brand || 'Sem marca')),
      status,
      available: product.available,
      image: product.image,
      images,
      price: Number(product.price || 0),
      listPrice: product.listPrice ? Number(product.listPrice) : undefined,
      unit: normalizeLine(product.unit || String(raw?.measurementUnit || 'un')) || 'un',
      packSize: product.packSize,
      commercialUnit:
        raw && typeof raw.commercialUnit === 'object'
          ? (raw.commercialUnit as CatalogProduct['commercialUnit'])
          : normalizeCommercialUnit(null, normalizeLine(product.unit || String(raw?.measurementUnit || 'un')) || 'un', product.packSize),
      packaging:
        raw && typeof raw.packaging === 'object'
          ? (raw.packaging as CatalogProduct['packaging'])
          : normalizePackaging(null, product.packSize),
      merchandising:
        raw && typeof raw.merchandising === 'object'
          ? (raw.merchandising as CatalogProduct['merchandising'])
          : normalizeMerchandising(null),
      categories,
      categoryPath: buildCategoryPath(
        categories,
        departments,
        (product.categoryPath || []).map((node) => ({
          id: String(node.id),
          slug: normalizeSlug(node.name || String(node.id)),
          name: node.name,
        })),
      ),
      departments,
      collections,
      shortDescription: typeof raw?.shortDescription === 'string' ? raw.shortDescription : product.name,
      longDescription: typeof raw?.longDescription === 'string' ? raw.longDescription : '',
      seo:
        raw && typeof raw.seo === 'object' && raw.seo
          ? {
              title: normalizeLine(String((raw.seo as Record<string, unknown>).title || product.name)),
              description: normalizeLine(String((raw.seo as Record<string, unknown>).description || product.name)),
              keywords: parseStringArray((raw.seo as Record<string, unknown>).keywords),
              noIndex: false,
            }
          : {
              title: product.name,
              description: product.name,
              keywords: [],
              noIndex: false,
            },
      identification: raw && typeof raw.identification === 'object' ? (raw.identification as CatalogProduct['identification']) : null,
      dimensions: raw && typeof raw.dimensions === 'object' ? (raw.dimensions as CatalogProduct['dimensions']) : null,
      supplier: raw && typeof raw.supplier === 'object' ? (raw.supplier as CatalogProduct['supplier']) : null,
      attributes: Array.isArray(raw?.attributes) ? (raw.attributes as CatalogProduct['attributes']) : [],
      stock: {
        availableQuantity:
          raw && typeof raw.stock === 'object' && raw.stock ? Number((raw.stock as Record<string, unknown>).availableQuantity || 0) : 0,
        reservedQuantity:
          raw && typeof raw.stock === 'object' && raw.stock ? Number((raw.stock as Record<string, unknown>).reservedQuantity || 0) : 0,
        incomingQuantity:
          raw && typeof raw.stock === 'object' && raw.stock ? Number((raw.stock as Record<string, unknown>).incomingQuantity || 0) : 0,
        safetyStock: raw && typeof raw.stock === 'object' && raw.stock ? Number((raw.stock as Record<string, unknown>).safetyStock || 0) : 0,
        reorderPoint:
          raw && typeof raw.stock === 'object' && raw.stock ? Number((raw.stock as Record<string, unknown>).reorderPoint || 0) : undefined,
        backorderable: Boolean(raw && typeof raw.stock === 'object' && raw.stock && (raw.stock as Record<string, unknown>).backorderable),
        leadTimeDays:
          raw && typeof raw.stock === 'object' && raw.stock ? Number((raw.stock as Record<string, unknown>).leadTimeDays || 0) : undefined,
        trackInventory:
          raw && typeof raw.stock === 'object' && raw.stock
            ? Boolean((raw.stock as Record<string, unknown>).trackInventory ?? true)
            : true,
        allowOversell:
          raw && typeof raw.stock === 'object' && raw.stock
            ? Boolean((raw.stock as Record<string, unknown>).allowOversell)
            : false,
        warehouses:
          raw && typeof raw.stock === 'object' && raw.stock && Array.isArray((raw.stock as Record<string, unknown>).warehouses)
            ? ((raw.stock as Record<string, unknown>).warehouses as CatalogProduct['stock']['warehouses'])
            : [],
      },
      logistics: raw && typeof raw.logistics === 'object' ? (raw.logistics as Record<string, unknown>) : null,
      pricing: raw && typeof raw.pricing === 'object' ? (raw.pricing as Record<string, unknown>) : null,
      regionalization: raw && typeof raw.regionalization === 'object' ? (raw.regionalization as Record<string, unknown>) : null,
      marketing: raw && typeof raw.marketing === 'object' ? (raw.marketing as Record<string, unknown>) : null,
      variationGroup: raw && typeof raw.variationGroup === 'object' ? (raw.variationGroup as Record<string, unknown>) : null,
      variants: Array.isArray(raw?.variants) ? (raw.variants as CatalogProduct['variants']) : [],
      customFields: null,
      allergens: parseStringArray(raw?.allergens),
      ingredients: typeof raw?.ingredients === 'string' ? raw.ingredients : '',
      storageInstructions: typeof raw?.storageInstructions === 'string' ? raw.storageInstructions : '',
      createdAt,
      updatedAt,
    });
  });
}

function writeProduct(product: CatalogProduct): CatalogProduct {
  ensureCatalogDirs();
  const hydrated = hydrateProduct(product);
  writeJsonAtomic(getAdminProductPath(hydrated.id), hydrated);
  const index = readCatalogIndex();
  const next = index.products.filter((item) => item.id !== hydrated.id);
  next.push(toListItem(hydrated));
  writeCatalogIndex(next);
  return hydrated;
}

function readCatalogIndex(): PersistedCatalogIndex {
  ensureCatalogDirs();
  const stored = readJsonFile<PersistedCatalogIndex>(ADMIN_INDEX_FILE);
  if (stored?.products) {
    return {
      schemaVersion: stored.schemaVersion || CATALOG_SCHEMA_VERSION,
      updatedAt: stored.updatedAt || nowIso(),
      products: [...stored.products].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()),
    };
  }

  const seeded = seedCatalogProductsFromLocal();
  seeded.forEach((product) => writeJsonAtomic(getAdminProductPath(product.id), product));
  const payload = writeCatalogIndex(seeded.map(toListItem));
  return payload;
}

function writeCatalogIndex(products: CatalogProductListItem[]): PersistedCatalogIndex {
  const payload: PersistedCatalogIndex = {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    updatedAt: nowIso(),
    products: [...products].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()),
  };
  writeJsonAtomic(ADMIN_INDEX_FILE, payload);
  return payload;
}

function clearCatalogProductFiles(): number {
  ensureCatalogDirs();
  const index = readCatalogIndex();
  for (const product of index.products) {
    fs.rmSync(getAdminProductPath(product.id), { force: true });
  }
  writeCatalogIndex([]);
  return index.products.length;
}

function listAllCatalogProducts(): CatalogProduct[] {
  const index = readCatalogIndex();
  return index.products
    .map((item) => readJsonFile<CatalogProduct>(getAdminProductPath(item.id)))
    .filter((item): item is CatalogProduct => Boolean(item))
    .map(hydrateProduct)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

function deriveSeedCategories(products: CatalogProduct[]): CatalogCategory[] {
  const map = new Map<string, CatalogCategory>();
  const visibleProducts = products.filter(productVisibleInStore);

  for (const product of visibleProducts) {
    const topNode =
      product.categoryPath[0] ||
      (product.categories[0]
        ? { id: `cat-${normalizeSlug(product.categories[0])}`, slug: normalizeSlug(product.categories[0]), name: product.categories[0] }
        : null);
    if (!topNode) continue;

    if (!map.has(topNode.id)) {
      map.set(topNode.id, {
        id: topNode.id,
        slug: topNode.slug,
        name: topNode.name,
        description: '',
        status: 'active',
        parentId: null,
        children: [],
        productIds: [],
        metadata: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }

    const category = map.get(topNode.id);
    if (!category) continue;
    if (!category.productIds.includes(product.id)) category.productIds.push(product.id);

    const childNode =
      product.categoryPath[1] ||
      (product.departments[0]
        ? { id: `dept-${normalizeSlug(product.departments[0])}`, slug: normalizeSlug(product.departments[0]), name: product.departments[0] }
        : null);

    if (childNode && !category.children.some((child) => child.id === childNode.id)) {
      category.children.push({
        id: childNode.id,
        slug: childNode.slug,
        name: childNode.name,
      });
    }
  }

  return Array.from(map.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function deriveSeedCollections(products: CatalogProduct[]): CatalogCollection[] {
  const map = new Map<string, CatalogCollection>();

  for (const product of products.filter(productVisibleInStore)) {
    for (const name of product.collections) {
      const slug = normalizeSlug(name);
      if (!slug) continue;
      if (!map.has(slug)) {
        map.set(slug, {
          id: `collection-${slug}`,
          slug,
          name,
          description: '',
          status: 'active',
          productIds: [],
          metadata: null,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        });
      }

      const collection = map.get(slug);
      if (collection && !collection.productIds.includes(product.id)) {
        collection.productIds.push(product.id);
      }
    }
  }

  return Array.from(map.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function readCatalogCategoriesFile(): PersistedCatalogCategories {
  const stored = readJsonFile<PersistedCatalogCategories>(ADMIN_CATEGORIES_FILE);
  if (stored?.categories) {
    return stored;
  }

  const seeded = deriveSeedCategories(listAllCatalogProducts());
  const payload: PersistedCatalogCategories = {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    updatedAt: nowIso(),
    categories: seeded,
  };
  writeJsonAtomic(ADMIN_CATEGORIES_FILE, payload);
  return payload;
}

function writeCatalogCategoriesFile(categories: CatalogCategory[]): PersistedCatalogCategories {
  const payload: PersistedCatalogCategories = {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    updatedAt: nowIso(),
    categories: [...categories].sort((left, right) => left.name.localeCompare(right.name)),
  };
  writeJsonAtomic(ADMIN_CATEGORIES_FILE, payload);
  return payload;
}

function readCatalogCollectionsFile(): PersistedCatalogCollections {
  const stored = readJsonFile<PersistedCatalogCollections>(ADMIN_COLLECTIONS_FILE);
  if (stored?.collections) {
    return stored;
  }

  const seeded = deriveSeedCollections(listAllCatalogProducts());
  const payload: PersistedCatalogCollections = {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    updatedAt: nowIso(),
    collections: seeded,
  };
  writeJsonAtomic(ADMIN_COLLECTIONS_FILE, payload);
  return payload;
}

function writeCatalogCollectionsFile(collections: CatalogCollection[]): PersistedCatalogCollections {
  const payload: PersistedCatalogCollections = {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    updatedAt: nowIso(),
    collections: [...collections].sort((left, right) => left.name.localeCompare(right.name)),
  };
  writeJsonAtomic(ADMIN_COLLECTIONS_FILE, payload);
  return payload;
}

function resolveDemoSessionKey(context?: CatalogRuntimeContext): string | null {
  if (!context?.demoSessionId) return null;
  return sha256(context.demoSessionId).slice(0, 24);
}

function getDemoSnapshotPath(sessionKey: string): string {
  return path.join(DEMO_ROOT, `${sessionKey}.json`);
}

function cleanupExpiredDemoSnapshots(): void {
  if (!fs.existsSync(DEMO_ROOT)) return;

  const now = Date.now();
  for (const entry of fs.readdirSync(DEMO_ROOT)) {
    const filePath = path.join(DEMO_ROOT, entry);
    try {
      const payload = readJsonFile<CatalogDemoSnapshot>(filePath);
      if (!payload?.expiresAt || new Date(payload.expiresAt).getTime() <= now) {
        fs.rmSync(filePath, { force: true });
      }
    } catch {
      fs.rmSync(filePath, { force: true });
    }
  }
}

function normalizeDemoSnapshot(snapshot: CatalogDemoSnapshot): CatalogDemoSnapshot {
  const products = snapshot.products.map(hydrateProduct);
  return {
    ...snapshot,
    products,
    categories: mergeProductCountsIntoCategories(snapshot.categories, products),
    collections: mergeProductCountsIntoCollections(snapshot.collections, products),
  };
}

async function createDemoSnapshot(context: CatalogRuntimeContext): Promise<CatalogDemoSnapshot> {
  const products = await listBaseRuntimeProducts();
  const categories = await listBaseRuntimeCategories(products);
  const collections = await listBaseRuntimeCollections(products);
  return normalizeDemoSnapshot({
    schemaVersion: DEMO_SCHEMA_VERSION,
    createdAt: nowIso(),
    expiresAt:
      context.demoSessionExpiresAt ||
      new Date(Date.now() + PANEL_SECURITY.demoSessionTtlMs).toISOString(),
    products,
    categories,
    collections,
  });
}

async function getDemoSnapshot(context?: CatalogRuntimeContext): Promise<CatalogDemoSnapshot | null> {
  const sessionKey = resolveDemoSessionKey(context);
  if (!sessionKey) return null;

  cleanupExpiredDemoSnapshots();
  const filePath = getDemoSnapshotPath(sessionKey);
  const stored = readJsonFile<CatalogDemoSnapshot>(filePath);
  if (stored?.expiresAt && new Date(stored.expiresAt).getTime() > Date.now()) {
    return normalizeDemoSnapshot(stored);
  }

  const snapshot = await createDemoSnapshot(context || {});
  writeJsonAtomic(filePath, snapshot);
  return snapshot;
}

function writeDemoSnapshot(context: CatalogRuntimeContext | undefined, snapshot: CatalogDemoSnapshot): CatalogDemoSnapshot {
  const sessionKey = resolveDemoSessionKey(context);
  if (!sessionKey) return snapshot;

  const normalized = normalizeDemoSnapshot({
    ...snapshot,
    schemaVersion: DEMO_SCHEMA_VERSION,
    expiresAt:
      context?.demoSessionExpiresAt ||
      snapshot.expiresAt ||
      new Date(Date.now() + PANEL_SECURITY.demoSessionTtlMs).toISOString(),
  });
  writeJsonAtomic(getDemoSnapshotPath(sessionKey), normalized);
  return normalized;
}

function mergeProductCountsIntoCategories(categories: CatalogCategory[], products: CatalogProduct[]): CatalogCategory[] {
  const visibleProducts = products.filter(productVisibleInStore);

  return categories.map((category) => {
    const productIds = visibleProducts
      .filter((product) => {
        const matchesTop = product.categoryPath[0]?.slug === category.slug || product.categories.some((item) => normalizeSlug(item) === category.slug);
        return matchesTop;
      })
      .map((product) => product.id);

    return {
      ...category,
      productIds,
      children: [...(category.children || [])].sort((left, right) => left.name.localeCompare(right.name)),
      status: category.status || 'active',
      metadata: normalizeMetadata(category.metadata),
      createdAt: category.createdAt || nowIso(),
      updatedAt: category.updatedAt || nowIso(),
    };
  });
}

function mergeProductCountsIntoCollections(collections: CatalogCollection[], products: CatalogProduct[]): CatalogCollection[] {
  const visibleProducts = products.filter(productVisibleInStore);

  return collections.map((collection) => {
    const productIds = visibleProducts
      .filter((product) => product.collections.some((item) => normalizeSlug(item) === collection.slug))
      .map((product) => product.id);

    return {
      ...collection,
      productIds,
      status: collection.status || 'active',
      metadata: normalizeMetadata(collection.metadata),
      createdAt: collection.createdAt || nowIso(),
      updatedAt: collection.updatedAt || nowIso(),
    };
  });
}

function mapInputToProduct(
  input: CatalogProductUpsertInput,
  current?: CatalogProduct,
  forcedId?: string,
): CatalogProduct {
  const createdAt = current?.createdAt || nowIso();
  const categories = uniqueStrings(input.categories);
  const departments = uniqueStrings(input.departments);
  const collections = uniqueStrings(input.collections);
  const fallbackImage =
    sanitizeImageUrl(normalizeLine(input.image || current?.image || ''), '') ||
    sanitizeImageUrl(current?.images[0]?.url || '', '') ||
    '/file.svg';
  const nextImages =
    input.images && input.images.length > 0
      ? input.images
      : current?.images?.length
        ? current.images
        : [{ url: fallbackImage, alt: normalizeLine(input.name || current?.name || ''), isPrimary: true }];

  return hydrateProduct({
    id: forcedId || current?.id || `prd-${randomToken(6)}`,
    slug: normalizeSlug(input.slug || current?.slug || input.name || current?.name || ''),
    sku: normalizeLine(input.sku || current?.sku || ''),
    name: normalizeLine(input.name || current?.name || ''),
    brand: normalizeLine(input.brand || current?.brand || 'Sem marca'),
    status: input.status || current?.status || 'draft',
    available: Boolean(input.available),
    image: fallbackImage,
    images: nextImages,
    price: Number(input.price || 0),
    listPrice: input.listPrice !== undefined ? Number(input.listPrice) : current?.listPrice,
    unit: normalizeLine(input.unit || current?.unit || 'un') || 'un',
    packSize: input.packSize !== undefined ? Math.max(1, Math.floor(input.packSize)) : current?.packSize,
    commercialUnit: normalizeCommercialUnit(
      input.commercialUnit ?? current?.commercialUnit ?? null,
      normalizeLine(input.unit || current?.unit || 'un') || 'un',
      input.packSize !== undefined ? Math.max(1, Math.floor(input.packSize)) : current?.packSize,
    ),
    packaging: normalizePackaging(
      input.packaging ?? current?.packaging ?? null,
      input.packSize !== undefined ? Math.max(1, Math.floor(input.packSize)) : current?.packSize,
    ),
    merchandising: normalizeMerchandising(input.merchandising ?? current?.merchandising ?? null),
    categories,
    categoryPath: buildCategoryPath(categories, departments, current?.categoryPath || []),
    departments,
    collections,
    shortDescription: normalizeLine(input.shortDescription || current?.shortDescription || input.name || ''),
    longDescription: normalizeMultiline(input.longDescription || current?.longDescription || ''),
    seo: {
      title: normalizeLine(input.seo?.title || current?.seo.title || input.name || ''),
      description: normalizeLine(input.seo?.description || current?.seo.description || input.shortDescription || input.name || ''),
      keywords: uniqueStrings(input.seo?.keywords || current?.seo.keywords || []),
      noIndex: Boolean(input.seo?.noIndex ?? current?.seo.noIndex ?? false),
    },
    identification: normalizeIdentification(input.identification ?? current?.identification ?? null),
    dimensions: normalizeDimensions(input.dimensions ?? current?.dimensions ?? null),
    supplier: normalizeSupplier(input.supplier ?? current?.supplier ?? null),
    attributes: normalizeProductAttributes(input.attributes ?? current?.attributes ?? []),
    stock: {
      availableQuantity: Math.max(0, Math.floor(Number(input.stock?.availableQuantity ?? current?.stock.availableQuantity ?? 0))),
      reservedQuantity: Math.max(0, Math.floor(Number(input.stock?.reservedQuantity ?? current?.stock.reservedQuantity ?? 0))),
      incomingQuantity: Math.max(0, Math.floor(Number(input.stock?.incomingQuantity ?? current?.stock.incomingQuantity ?? 0))),
      safetyStock: Math.max(0, Math.floor(Number(input.stock?.safetyStock ?? current?.stock.safetyStock ?? 0))),
      reorderPoint:
        input.stock?.reorderPoint !== undefined || current?.stock.reorderPoint !== undefined
          ? Math.max(0, Math.floor(Number(input.stock?.reorderPoint ?? current?.stock.reorderPoint ?? 0)))
          : undefined,
      backorderable: Boolean(input.stock?.backorderable ?? current?.stock.backorderable ?? false),
      leadTimeDays:
        input.stock?.leadTimeDays !== undefined || current?.stock.leadTimeDays !== undefined
          ? Math.max(0, Math.floor(Number(input.stock?.leadTimeDays ?? current?.stock.leadTimeDays ?? 0)))
          : undefined,
      trackInventory: Boolean(input.stock?.trackInventory ?? current?.stock.trackInventory ?? true),
      allowOversell: Boolean(input.stock?.allowOversell ?? current?.stock.allowOversell ?? false),
      warehouses: normalizeInventoryLocations(input.stock?.warehouses ?? current?.stock.warehouses ?? []),
    },
    logistics: input.logistics ?? current?.logistics ?? null,
    pricing: input.pricing ?? current?.pricing ?? null,
    regionalization: input.regionalization ?? current?.regionalization ?? null,
    marketing: input.marketing ?? current?.marketing ?? null,
    variationGroup: input.variationGroup ?? current?.variationGroup ?? null,
    variants: normalizeProductVariants(input.variants ?? current?.variants ?? []),
    customFields: normalizeMetadata(input.customFields ?? current?.customFields ?? null),
    allergens: uniqueStrings(input.allergens || current?.allergens || []),
    ingredients: normalizeMultiline(input.ingredients || current?.ingredients || ''),
    storageInstructions: normalizeMultiline(input.storageInstructions || current?.storageInstructions || ''),
    createdAt,
    updatedAt: nowIso(),
  });
}

function getCatalogPersistenceMode(): CatalogPersistenceMode {
  const value = process.env.ECOM_CATALOG_PERSISTENCE_MODE?.trim().toLowerCase();
  if (value === 'files') return 'files';
  if (value === 'database') return 'database';
  return 'hybrid';
}

function requireDatabaseValue<T>(
  result: { available: true; value: T } | { available: false },
  action: string,
): T {
  if (!result.available) {
    throw new Error(`Catalogo em modo database exige PostgreSQL disponível para ${action}.`);
  }

  return result.value;
}

async function seedCatalogDatabaseFromFilesIfNeeded(): Promise<void> {
  if (getCatalogPersistenceMode() !== 'hybrid') return;

  const runtime = resolvePostgresRuntime();
  if (!runtime) return;

  const seededKeys = global.__CATALOG_DB_FILE_SEEDED_KEYS__ || new Set<string>();
  global.__CATALOG_DB_FILE_SEEDED_KEYS__ = seededKeys;
  if (seededKeys.has(runtime.key)) return;

  const count = await countCatalogProductsInDatabase();
  if (!count.available) return;

  if (count.value > 0) {
    seededKeys.add(runtime.key);
    return;
  }

  for (const product of listAllCatalogProducts()) {
    await upsertCatalogProductInDatabase(product);
  }

  for (const category of readCatalogCategoriesFile().categories) {
    await upsertCatalogCategoryInDatabase(category);
  }

  for (const collection of readCatalogCollectionsFile().collections) {
    await upsertCatalogCollectionInDatabase(collection);
  }

  seededKeys.add(runtime.key);
}

function productVisibleInStore(product: CatalogProduct): boolean {
  return product.status === 'active';
}

function buildCatalogFacets(products: CatalogProduct[]): CatalogFacet[] {
  const brands = uniqueStrings(products.map((product) => product.brand));
  const departments = uniqueStrings(products.flatMap((product) => product.departments));
  const collections = uniqueStrings(products.flatMap((product) => product.collections));
  const prices = products.map((product) => product.price);
  const min = prices.length ? Math.floor(Math.min(...prices)) : 0;
  const max = prices.length ? Math.ceil(Math.max(...prices)) : 0;

  const facets: CatalogFacet[] = [
    {
      type: 'range',
      key: 'price',
      label: 'Faixa de preço',
      min,
      max,
      step: Math.max(1, Math.round((max - min) / 10) || 1),
    },
    {
      type: 'multi',
      key: 'brand',
      label: 'Marca',
      options: brands,
    },
    {
      type: 'multi',
      key: 'dept',
      label: 'Subcategoria',
      options: departments,
    },
  ];

  if (collections.length) {
    facets.push({
      type: 'multi',
      key: 'collection',
      label: 'Coleções',
      options: collections,
    });
  }

  return facets;
}

function filterProducts(
  products: CatalogProduct[],
  options: {
    q?: string;
    category?: string;
    collection?: string;
    available?: boolean | null;
    onlyVisible?: boolean;
    price?: [number, number];
    brands?: string[];
    departments?: string[];
    collections?: string[];
  },
): CatalogProduct[] {
  const query = normalizeLine(options.q).toLowerCase();
  const categorySlug = normalizeSlug(options.category || '');
  const collectionQuery = normalizeLine(options.collection).toLowerCase();
  const brandSet = new Set((options.brands || []).map((value) => value.toLowerCase()));
  const departmentSet = new Set((options.departments || []).map((value) => value.toLowerCase()));
  const collectionSet = new Set((options.collections || []).map((value) => value.toLowerCase()));

  return products.filter((product) => {
    if (options.onlyVisible && !productVisibleInStore(product)) return false;
    if (options.available !== null && options.available !== undefined && product.available !== options.available) return false;
    if (categorySlug) {
      const matchesCategory =
        product.categoryPath.some((node) => node.slug === categorySlug) ||
        product.categories.some((item) => normalizeSlug(item) === categorySlug);
      if (!matchesCategory) return false;
    }

    if (collectionQuery && !product.collections.some((item) => item.toLowerCase() === collectionQuery)) return false;
    if (options.price && (product.price < options.price[0] || product.price > options.price[1])) return false;
    if (brandSet.size > 0 && !brandSet.has(product.brand.toLowerCase())) return false;
    if (departmentSet.size > 0 && !product.departments.some((item) => departmentSet.has(item.toLowerCase()))) return false;
    if (collectionSet.size > 0 && !product.collections.some((item) => collectionSet.has(item.toLowerCase()))) return false;

    if (!query) return true;
    const pool = [product.name, product.brand, product.shortDescription, ...product.categories, ...product.departments, ...product.collections]
      .join(' ')
      .toLowerCase();
    return pool.includes(query);
  });
}

function sortProducts(products: CatalogProduct[], sort?: 'relevance' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc'): CatalogProduct[] {
  if (!sort || sort === 'relevance') {
    return [...products].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  }

  const next = [...products];
  switch (sort) {
    case 'price-asc':
      next.sort((left, right) => left.price - right.price);
      break;
    case 'price-desc':
      next.sort((left, right) => right.price - left.price);
      break;
    case 'name-asc':
      next.sort((left, right) => left.name.localeCompare(right.name));
      break;
    case 'name-desc':
      next.sort((left, right) => right.name.localeCompare(left.name));
      break;
  }
  return next;
}

function getCatalogSummary(products: CatalogProduct[]): CatalogOperationalSummary {
  const activeProducts = products.filter((product) => product.status === 'active');
  const categoryCounts = new Map<string, number>();

  for (const product of activeProducts) {
    const category = product.categoryPath[0]?.name || product.categories[0] || 'Sem categoria';
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
  }

  return {
    totalProducts: products.length,
    activeProducts: products.filter((product) => product.status === 'active').length,
    draftProducts: products.filter((product) => product.status === 'draft').length,
    archivedProducts: products.filter((product) => product.status === 'archived').length,
    unavailableProducts: products.filter((product) => !product.available).length,
    lowStockProducts: products.filter((product) => product.stock.availableQuantity <= product.stock.safetyStock).length,
    topCategories: Array.from(categoryCounts.entries())
      .map(([name, count]) => ({ name, products: count }))
      .sort((left, right) => right.products - left.products)
      .slice(0, 5),
  };
}

async function listBaseRuntimeProducts(): Promise<CatalogProduct[]> {
  const mode = getCatalogPersistenceMode();
  if (mode === 'files') return listAllCatalogProducts();

  await seedCatalogDatabaseFromFilesIfNeeded();
  const result = await listCatalogProductsFromDatabase();
  if (mode === 'database') return requireDatabaseValue(result, 'listar produtos do catalogo');
  return result.available ? result.value : listAllCatalogProducts();
}

export async function listCatalogProductsRuntime(context?: CatalogRuntimeContext): Promise<CatalogProductListItem[]> {
  const demoSnapshot = await getDemoSnapshot(context);
  const products = demoSnapshot ? demoSnapshot.products : await listBaseRuntimeProducts();
  return products.map(toListItem);
}

export async function listCatalogProductsDetailedRuntime(context?: CatalogRuntimeContext): Promise<CatalogProduct[]> {
  const demoSnapshot = await getDemoSnapshot(context);
  return demoSnapshot ? demoSnapshot.products : await listBaseRuntimeProducts();
}

export async function getCatalogProductByIdRuntime(productId: string, context?: CatalogRuntimeContext): Promise<CatalogProduct | null> {
  const demoSnapshot = await getDemoSnapshot(context);
  if (demoSnapshot) {
    return demoSnapshot.products.find((product) => product.id === productId) || null;
  }

  const mode = getCatalogPersistenceMode();
  if (mode === 'files') {
    return listAllCatalogProducts().find((product) => product.id === productId) || null;
  }

  await seedCatalogDatabaseFromFilesIfNeeded();
  const result = await getCatalogProductByIdFromDatabase(productId);
  if (mode === 'database') return requireDatabaseValue(result, 'ler produto por id');
  return result.available ? result.value : listAllCatalogProducts().find((product) => product.id === productId) || null;
}

export async function getCatalogProductBySlugRuntime(slug: string, context?: CatalogRuntimeContext): Promise<CatalogProduct | null> {
  const safeSlug = normalizeSlug(slug);
  if (!safeSlug) return null;

  const demoSnapshot = await getDemoSnapshot(context);
  if (demoSnapshot) {
    return demoSnapshot.products.find((product) => product.slug === safeSlug) || null;
  }

  const mode = getCatalogPersistenceMode();
  if (mode === 'files') {
    return listAllCatalogProducts().find((product) => product.slug === safeSlug) || null;
  }

  await seedCatalogDatabaseFromFilesIfNeeded();
  const result = await getCatalogProductBySlugFromDatabase(safeSlug);
  if (mode === 'database') return requireDatabaseValue(result, 'ler produto por slug');
  return result.available ? result.value : listAllCatalogProducts().find((product) => product.slug === safeSlug) || null;
}

export async function createCatalogProductRuntime(input: CatalogProductUpsertInput, context?: CatalogRuntimeContext): Promise<CatalogProduct> {
  const demoSnapshot = await getDemoSnapshot(context);
  if (demoSnapshot) {
    const next = mapInputToProduct(input);
    demoSnapshot.products = [...demoSnapshot.products.filter((product) => product.id !== next.id), next];
    writeDemoSnapshot(context, demoSnapshot);
    return next;
  }

  const mode = getCatalogPersistenceMode();
  if (mode === 'files') {
    return writeProduct(mapInputToProduct(input));
  }

  if (mode === 'database') {
    const next = mapInputToProduct(input);
    const result = await upsertCatalogProductInDatabase(next);
    return requireDatabaseValue(result, 'criar produto');
  }

  const next = writeProduct(mapInputToProduct(input));
  await upsertCatalogProductInDatabase(next);
  return next;
}

export async function updateCatalogProductRuntime(productId: string, input: CatalogProductUpsertInput, context?: CatalogRuntimeContext): Promise<CatalogProduct | null> {
  const current = await getCatalogProductByIdRuntime(productId, context);
  if (!current) return null;

  const next = mapInputToProduct(input, current);
  const demoSnapshot = await getDemoSnapshot(context);
  if (demoSnapshot) {
    demoSnapshot.products = [...demoSnapshot.products.filter((product) => product.id !== productId), next];
    writeDemoSnapshot(context, demoSnapshot);
    return next;
  }

  const mode = getCatalogPersistenceMode();

  if (mode === 'files') {
    return writeProduct(next);
  }

  if (mode === 'database') {
    const result = await upsertCatalogProductInDatabase(next);
    return requireDatabaseValue(result, 'atualizar produto');
  }

  const saved = writeProduct(next);
  await upsertCatalogProductInDatabase(saved);
  return saved;
}

export async function exportCatalogProductsCsvRuntime(context?: CatalogRuntimeContext): Promise<{ csv: string; fileName: string; count: number }> {
  const products = await listCatalogProductsDetailedRuntime(context);
  return {
    csv: buildCatalogProductsCsv(products),
    fileName: `catalog-products-${new Date().toISOString().slice(0, 10)}.csv`,
    count: products.length,
  };
}

export async function clearCatalogProductsRuntime(
  context?: CatalogRuntimeContext,
): Promise<{ removedCount: number }> {
  const demoSnapshot = await getDemoSnapshot(context);
  if (demoSnapshot) {
    const removedCount = demoSnapshot.products.length;
    demoSnapshot.products = [];
    writeDemoSnapshot(context, demoSnapshot);
    return { removedCount };
  }

  const mode = getCatalogPersistenceMode();

  if (mode === 'files') {
    return { removedCount: clearCatalogProductFiles() };
  }

  if (mode === 'database') {
    const result = await deleteAllCatalogProductsFromDatabase();
    return { removedCount: requireDatabaseValue(result, 'limpar produtos do catalogo') };
  }

  const removedCount = clearCatalogProductFiles();
  await deleteAllCatalogProductsFromDatabase();
  return { removedCount };
}

export async function importCatalogProductsCsvRuntime(
  csvContent: string,
  mode: 'append' | 'replace',
  context?: CatalogRuntimeContext,
): Promise<{ importedCount: number; createdCount: number; updatedCount: number }> {
  const rows = parseCatalogProductsCsv(csvContent);
  if (mode === 'replace') {
    await clearCatalogProductsRuntime(context);
  }

  let createdCount = 0;
  let updatedCount = 0;

  for (const row of rows) {
    const existing =
      (row.id ? await getCatalogProductByIdRuntime(row.id, context) : null) ||
      (await getCatalogProductBySlugRuntime(row.input.slug, context));

    if (existing) {
      const next = mapInputToProduct(row.input, existing, row.id || existing.id);
      const demoSnapshot = await getDemoSnapshot(context);
      if (demoSnapshot) {
        demoSnapshot.products = [...demoSnapshot.products.filter((product) => product.id !== existing.id), next];
        writeDemoSnapshot(context, demoSnapshot);
      } else if (getCatalogPersistenceMode() === 'files') {
        writeProduct(next);
      } else if (getCatalogPersistenceMode() === 'database') {
        const result = await upsertCatalogProductInDatabase(next);
        requireDatabaseValue(result, 'importar produto do catalogo');
      } else {
        const saved = writeProduct(next);
        await upsertCatalogProductInDatabase(saved);
      }
      updatedCount += 1;
    } else {
      const next = mapInputToProduct(row.input, undefined, row.id);
      const demoSnapshot = await getDemoSnapshot(context);
      if (demoSnapshot) {
        demoSnapshot.products = [...demoSnapshot.products.filter((product) => product.id !== next.id), next];
        writeDemoSnapshot(context, demoSnapshot);
      } else if (getCatalogPersistenceMode() === 'files') {
        writeProduct(next);
      } else if (getCatalogPersistenceMode() === 'database') {
        const result = await upsertCatalogProductInDatabase(next);
        requireDatabaseValue(result, 'importar produto do catalogo');
      } else {
        const saved = writeProduct(next);
        await upsertCatalogProductInDatabase(saved);
      }
      createdCount += 1;
    }
  }

  return {
    importedCount: rows.length,
    createdCount,
    updatedCount,
  };
}

function toCategoryListItem(category: CatalogCategory): CatalogCategoryListItem {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description,
    status: category.status || 'active',
    parentId: category.parentId,
    childrenCount: category.children.length,
    productCount: category.productIds.length,
    updatedAt: category.updatedAt || nowIso(),
  };
}

function toCollectionListItem(collection: CatalogCollection): CatalogCollectionListItem {
  return {
    id: collection.id,
    slug: collection.slug,
    name: collection.name,
    description: collection.description,
    status: collection.status,
    productCount: collection.productIds.length,
    updatedAt: collection.updatedAt,
  };
}

function buildCategoryFromInput(input: CatalogCategoryUpsertInput, current?: CatalogCategory): CatalogCategory {
  const createdAt = current?.createdAt || nowIso();
  return {
    id: current?.id || `cat-${randomToken(6)}`,
    slug: normalizeSlug(input.slug || current?.slug || input.name || ''),
    name: normalizeLine(input.name || current?.name || ''),
    description: normalizeMultiline(input.description || current?.description || ''),
    status: input.status || current?.status || 'draft',
    parentId: input.parentId !== undefined ? input.parentId : (current?.parentId ?? null),
    children:
      input.children?.map((child, index) => ({
        id: normalizeLine(child.id) || `cat-child-${randomToken(4)}-${index}`,
        slug: normalizeSlug(child.slug || child.name || child.id || ''),
        name: normalizeLine(child.name),
      })) || current?.children || [],
    productIds: current?.productIds || [],
    facets: current?.facets,
    metadata: normalizeMetadata(input.metadata ?? current?.metadata ?? null),
    createdAt,
    updatedAt: nowIso(),
  };
}

function buildCollectionFromInput(input: CatalogCollectionUpsertInput, current?: CatalogCollection): CatalogCollection {
  const createdAt = current?.createdAt || nowIso();
  return {
    id: current?.id || `collection-${randomToken(6)}`,
    slug: normalizeSlug(input.slug || current?.slug || input.name || ''),
    name: normalizeLine(input.name || current?.name || ''),
    description: normalizeMultiline(input.description || current?.description || ''),
    status: input.status || current?.status || 'draft',
    productIds: current?.productIds || [],
    metadata: normalizeMetadata(input.metadata ?? current?.metadata ?? null),
    createdAt,
    updatedAt: nowIso(),
  };
}

async function listBaseRuntimeCategories(products?: CatalogProduct[]): Promise<CatalogCategory[]> {
  const mode = getCatalogPersistenceMode();
  const runtimeProducts = products || (await listBaseRuntimeProducts());

  if (mode === 'files') {
    return mergeProductCountsIntoCategories(readCatalogCategoriesFile().categories, runtimeProducts);
  }

  await seedCatalogDatabaseFromFilesIfNeeded();
  const result = await listCatalogCategoriesFromDatabase();
  if (mode === 'database') {
    return mergeProductCountsIntoCategories(requireDatabaseValue(result, 'listar categorias do catalogo'), runtimeProducts);
  }

  return result.available
    ? mergeProductCountsIntoCategories(result.value, runtimeProducts)
    : mergeProductCountsIntoCategories(readCatalogCategoriesFile().categories, runtimeProducts);
}

async function listBaseRuntimeCollections(products?: CatalogProduct[]): Promise<CatalogCollection[]> {
  const mode = getCatalogPersistenceMode();
  const runtimeProducts = products || (await listBaseRuntimeProducts());

  if (mode === 'files') {
    return mergeProductCountsIntoCollections(readCatalogCollectionsFile().collections, runtimeProducts);
  }

  await seedCatalogDatabaseFromFilesIfNeeded();
  const result = await listCatalogCollectionsFromDatabase();
  if (mode === 'database') {
    return mergeProductCountsIntoCollections(requireDatabaseValue(result, 'listar colecoes do catalogo'), runtimeProducts);
  }

  return result.available
    ? mergeProductCountsIntoCollections(result.value, runtimeProducts)
    : mergeProductCountsIntoCollections(readCatalogCollectionsFile().collections, runtimeProducts);
}

export async function listCatalogCategoriesRuntime(context?: CatalogRuntimeContext): Promise<CatalogCategory[]> {
  const demoSnapshot = await getDemoSnapshot(context);
  if (demoSnapshot) {
    return mergeProductCountsIntoCategories(demoSnapshot.categories, demoSnapshot.products);
  }
  return listBaseRuntimeCategories();
}

export async function listCatalogCategoriesListRuntime(context?: CatalogRuntimeContext): Promise<CatalogCategoryListItem[]> {
  return (await listCatalogCategoriesRuntime(context)).map(toCategoryListItem);
}

export async function getCatalogCategoryByIdRuntime(categoryId: string, context?: CatalogRuntimeContext): Promise<CatalogCategory | null> {
  const demoSnapshot = await getDemoSnapshot(context);
  if (demoSnapshot) {
    return demoSnapshot.categories.find((category) => category.id === categoryId) || null;
  }

  const mode = getCatalogPersistenceMode();
  if (mode === 'files') {
    return readCatalogCategoriesFile().categories.find((category) => category.id === categoryId) || null;
  }

  await seedCatalogDatabaseFromFilesIfNeeded();
  const result = await getCatalogCategoryByIdFromDatabase(categoryId);
  if (mode === 'database') return requireDatabaseValue(result, 'ler categoria por id');
  return result.available ? result.value : readCatalogCategoriesFile().categories.find((category) => category.id === categoryId) || null;
}

export async function createCatalogCategoryRuntime(input: CatalogCategoryUpsertInput, context?: CatalogRuntimeContext): Promise<CatalogCategory> {
  const mode = getCatalogPersistenceMode();
  const next = buildCategoryFromInput(input);

  const demoSnapshot = await getDemoSnapshot(context);
  if (demoSnapshot) {
    demoSnapshot.categories = [...demoSnapshot.categories.filter((category) => category.id !== next.id), next];
    writeDemoSnapshot(context, demoSnapshot);
    return next;
  }

  if (mode === 'files') {
    const current = readCatalogCategoriesFile().categories.filter((category) => category.id !== next.id);
    current.push(next);
    writeCatalogCategoriesFile(current);
    return next;
  }

  if (mode === 'database') {
    const result = await upsertCatalogCategoryInDatabase(next);
    return requireDatabaseValue(result, 'criar categoria');
  }

  const current = readCatalogCategoriesFile().categories.filter((category) => category.id !== next.id);
  current.push(next);
  writeCatalogCategoriesFile(current);
  await upsertCatalogCategoryInDatabase(next);
  return next;
}

export async function updateCatalogCategoryRuntime(categoryId: string, input: CatalogCategoryUpsertInput, context?: CatalogRuntimeContext): Promise<CatalogCategory | null> {
  const current = await getCatalogCategoryByIdRuntime(categoryId, context);
  if (!current) return null;
  const next = buildCategoryFromInput(input, current);
  const demoSnapshot = await getDemoSnapshot(context);
  if (demoSnapshot) {
    demoSnapshot.categories = [...demoSnapshot.categories.filter((item) => item.id !== categoryId), next];
    writeDemoSnapshot(context, demoSnapshot);
    return next;
  }

  const mode = getCatalogPersistenceMode();

  if (mode === 'files') {
    writeCatalogCategoriesFile([...readCatalogCategoriesFile().categories.filter((item) => item.id !== categoryId), next]);
    return next;
  }

  if (mode === 'database') {
    const result = await upsertCatalogCategoryInDatabase(next);
    return requireDatabaseValue(result, 'atualizar categoria');
  }

  writeCatalogCategoriesFile([...readCatalogCategoriesFile().categories.filter((item) => item.id !== categoryId), next]);
  await upsertCatalogCategoryInDatabase(next);
  return next;
}

export async function listCatalogCollectionsRuntime(context?: CatalogRuntimeContext): Promise<CatalogCollection[]> {
  const demoSnapshot = await getDemoSnapshot(context);
  if (demoSnapshot) {
    return mergeProductCountsIntoCollections(demoSnapshot.collections, demoSnapshot.products);
  }
  return listBaseRuntimeCollections();
}

export async function listCatalogCollectionsListRuntime(context?: CatalogRuntimeContext): Promise<CatalogCollectionListItem[]> {
  return (await listCatalogCollectionsRuntime(context)).map(toCollectionListItem);
}

export async function getCatalogCollectionByIdRuntime(collectionId: string, context?: CatalogRuntimeContext): Promise<CatalogCollection | null> {
  const demoSnapshot = await getDemoSnapshot(context);
  if (demoSnapshot) {
    return demoSnapshot.collections.find((collection) => collection.id === collectionId) || null;
  }

  const mode = getCatalogPersistenceMode();
  if (mode === 'files') {
    return readCatalogCollectionsFile().collections.find((collection) => collection.id === collectionId) || null;
  }

  await seedCatalogDatabaseFromFilesIfNeeded();
  const result = await getCatalogCollectionByIdFromDatabase(collectionId);
  if (mode === 'database') return requireDatabaseValue(result, 'ler colecao por id');
  return result.available ? result.value : readCatalogCollectionsFile().collections.find((collection) => collection.id === collectionId) || null;
}

export async function createCatalogCollectionRuntime(input: CatalogCollectionUpsertInput, context?: CatalogRuntimeContext): Promise<CatalogCollection> {
  const mode = getCatalogPersistenceMode();
  const next = buildCollectionFromInput(input);

  const demoSnapshot = await getDemoSnapshot(context);
  if (demoSnapshot) {
    demoSnapshot.collections = [...demoSnapshot.collections.filter((collection) => collection.id !== next.id), next];
    writeDemoSnapshot(context, demoSnapshot);
    return next;
  }

  if (mode === 'files') {
    const current = readCatalogCollectionsFile().collections.filter((collection) => collection.id !== next.id);
    current.push(next);
    writeCatalogCollectionsFile(current);
    return next;
  }

  if (mode === 'database') {
    const result = await upsertCatalogCollectionInDatabase(next);
    return requireDatabaseValue(result, 'criar colecao');
  }

  const current = readCatalogCollectionsFile().collections.filter((collection) => collection.id !== next.id);
  current.push(next);
  writeCatalogCollectionsFile(current);
  await upsertCatalogCollectionInDatabase(next);
  return next;
}

export async function updateCatalogCollectionRuntime(collectionId: string, input: CatalogCollectionUpsertInput, context?: CatalogRuntimeContext): Promise<CatalogCollection | null> {
  const current = await getCatalogCollectionByIdRuntime(collectionId, context);
  if (!current) return null;
  const next = buildCollectionFromInput(input, current);
  const demoSnapshot = await getDemoSnapshot(context);
  if (demoSnapshot) {
    demoSnapshot.collections = [...demoSnapshot.collections.filter((item) => item.id !== collectionId), next];
    writeDemoSnapshot(context, demoSnapshot);
    return next;
  }

  const mode = getCatalogPersistenceMode();

  if (mode === 'files') {
    writeCatalogCollectionsFile([...readCatalogCollectionsFile().collections.filter((item) => item.id !== collectionId), next]);
    return next;
  }

  if (mode === 'database') {
    const result = await upsertCatalogCollectionInDatabase(next);
    return requireDatabaseValue(result, 'atualizar colecao');
  }

  writeCatalogCollectionsFile([...readCatalogCollectionsFile().collections.filter((item) => item.id !== collectionId), next]);
  await upsertCatalogCollectionInDatabase(next);
  return next;
}

export async function queryCatalogPlpRuntime(params: {
  categorySlug?: string;
  q?: string;
  collection?: string;
  available?: boolean | null;
  regionalization?: {
    postalCode?: string;
    mode?: 'delivery' | 'pickup';
  };
  price?: [number, number];
  brands?: string[];
  departments?: string[];
  collections?: string[];
  sort?: 'relevance' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc';
  page?: number;
  pageSize?: number;
}): Promise<CatalogPlpResult> {
  const products = await listBaseRuntimeProducts();
  const categories = await listBaseRuntimeCategories(products);
  const category = params.categorySlug ? categories.find((item) => item.slug === params.categorySlug) : undefined;
  const displaySettings = await getCatalogDisplaySettingsRuntime();

  let filtered = filterProducts(products, {
    q: params.q,
    category: params.categorySlug,
    collection: params.collection,
    available: params.available,
    onlyVisible: true,
    price: params.price,
    brands: params.brands,
    departments: params.departments,
    collections: params.collections,
  });

  if (!displaySettings.showUnavailableProducts) {
    filtered = filtered.filter((product) => product.available);
  }

  const useRegionalizedSortment =
    (params.regionalization?.postalCode || params.regionalization?.mode === 'pickup') &&
    (await shouldApplyRegionalizationRuntime());

  if (useRegionalizedSortment && params.regionalization) {
    const coveredIds = await getCoveredProductIdsForRegionalizationRuntime({
      productIds: filtered.map((product) => product.id),
      postalCode: params.regionalization.postalCode,
      mode: params.regionalization.mode,
    });
    const coveredSet = new Set(coveredIds);
    filtered = filtered.filter((product) => coveredSet.has(product.id));
  }

  const facets = buildCatalogFacets(filtered);
  filtered = sortProducts(filtered, params.sort);

  const page = Math.max(1, params.page || 1);
  const pageSize = Math.max(1, params.pageSize || 24);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return {
    items: filtered.slice(start, end),
    total: filtered.length,
    category: category
      ? {
          ...category,
          facets,
        }
      : undefined,
    facets,
  };
}

export async function getCatalogOperationalSummaryRuntime(): Promise<CatalogOperationalSummary> {
  return getCatalogSummary(await listBaseRuntimeProducts());
}

export function toUiProduct(product: CatalogProduct): UIProduct {
  return {
    id: product.id,
    name: product.name,
    image: product.image,
    brand: product.brand,
    price: product.price,
    listPrice: product.listPrice,
    unit: product.unit,
    url: `/e-commerce/${product.slug}/p`,
    available: product.available,
    packSize: product.packSize,
    categories: product.categories,
    categoryPath: product.categoryPath.map((node) => ({ id: node.id, name: node.name })),
  };
}

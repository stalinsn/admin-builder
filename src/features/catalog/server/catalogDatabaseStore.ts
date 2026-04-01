import 'server-only';

import type { PoolClient } from 'pg';

import { withPostgresClient } from '@/features/ecommpanel/server/postgresRuntime';
import type { CatalogCategory, CatalogCollection, CatalogProduct } from '@/features/catalog/types';

type StoreAvailability<T> = { available: true; value: T } | { available: false };

type CatalogProductRow = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  brand: string;
  status: CatalogProduct['status'];
  available: boolean;
  image: string;
  images: unknown;
  price: string | number;
  list_price: string | number | null;
  unit: string;
  pack_size: number | null;
  commercial_unit: unknown;
  packaging: unknown;
  merchandising: unknown;
  categories: unknown;
  category_path: unknown;
  departments: unknown;
  collections: unknown;
  short_description: string;
  long_description: string;
  seo: unknown;
  identification: unknown;
  dimensions: unknown;
  supplier: unknown;
  attributes: unknown;
  stock: unknown;
  logistics: unknown;
  pricing: unknown;
  regionalization: unknown;
  marketing: unknown;
  variation_group: unknown;
  variants: unknown;
  custom_fields: unknown;
  allergens: unknown;
  ingredients: string;
  storage_instructions: string;
  created_at: string | Date;
  updated_at: string | Date;
};

type CatalogCategoryRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: NonNullable<CatalogCategory['status']>;
  parent_id: string | null;
  children: unknown;
  metadata: unknown;
  created_at: string | Date;
  updated_at: string | Date;
};

type CatalogCollectionRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: CatalogCollection['status'];
  metadata: unknown;
  created_at: string | Date;
  updated_at: string | Date;
};

declare global {
  var __CATALOG_POSTGRES_SCHEMA_KEYS__: Set<string> | undefined;
}

function toIso(value: string | Date | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value && typeof value === 'object') {
    return value as T;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  return fallback;
}

function mapRow(row: CatalogProductRow): CatalogProduct {
  return {
    id: row.id,
    slug: row.slug,
    sku: row.sku,
    name: row.name,
    brand: row.brand,
    status: row.status,
    available: Boolean(row.available),
    image: row.image,
    images: parseJson(row.images, []),
    price: Number(row.price || 0),
    listPrice: row.list_price === null || row.list_price === undefined ? undefined : Number(row.list_price),
    unit: row.unit,
    packSize: row.pack_size ?? undefined,
    commercialUnit: parseJson(row.commercial_unit, {
      sellMode: 'unit',
      salesUnit: row.unit || 'un',
      multiplier: row.pack_size ?? undefined,
      allowFractionalQuantity: false,
    }),
    packaging: parseJson<Record<string, unknown> | null>(
      row.packaging,
      row.pack_size
        ? {
            unitsPerPackage: row.pack_size,
          }
        : null,
    ),
    merchandising: parseJson(row.merchandising, {
      profile: 'generic',
      variantAxes: [],
      supportedVoltages: [],
      supportedColors: [],
      supportedSizes: [],
    }),
    categories: parseJson(row.categories, []),
    categoryPath: parseJson(row.category_path, []),
    departments: parseJson(row.departments, []),
    collections: parseJson(row.collections, []),
    shortDescription: row.short_description,
    longDescription: row.long_description,
    seo: parseJson(row.seo, { title: row.name, description: row.short_description, keywords: [], noIndex: false }),
    identification: parseJson<Record<string, unknown> | null>(row.identification, null),
    dimensions: parseJson<Record<string, unknown> | null>(row.dimensions, null),
    supplier: parseJson<Record<string, unknown> | null>(row.supplier, null),
    attributes: parseJson(row.attributes, []),
    stock: parseJson(row.stock, {
      availableQuantity: 0,
      reservedQuantity: 0,
      incomingQuantity: 0,
      safetyStock: 0,
      reorderPoint: 0,
      backorderable: false,
      trackInventory: true,
      allowOversell: false,
      warehouses: [],
    }),
    logistics: parseJson<Record<string, unknown> | null>(row.logistics, null),
    pricing: parseJson<Record<string, unknown> | null>(row.pricing, null),
    regionalization: parseJson<Record<string, unknown> | null>(row.regionalization, null),
    marketing: parseJson<Record<string, unknown> | null>(row.marketing, null),
    variationGroup: parseJson<Record<string, unknown> | null>(row.variation_group, null),
    variants: parseJson(row.variants, []),
    customFields: parseJson<Record<string, unknown> | null>(row.custom_fields, null),
    allergens: parseJson(row.allergens, []),
    ingredients: row.ingredients,
    storageInstructions: row.storage_instructions,
    createdAt: toIso(row.created_at) || new Date().toISOString(),
    updatedAt: toIso(row.updated_at) || new Date().toISOString(),
  };
}

function mapCategoryRow(row: CatalogCategoryRow): CatalogCategory {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description || '',
    status: row.status,
    parentId: row.parent_id,
    children: parseJson(row.children, []),
    productIds: [],
    facets: undefined,
    metadata: parseJson<Record<string, unknown> | null>(row.metadata, null),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapCollectionRow(row: CatalogCollectionRow): CatalogCollection {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description || '',
    status: row.status,
    productIds: [],
    metadata: parseJson<Record<string, unknown> | null>(row.metadata, null),
    createdAt: toIso(row.created_at) || new Date().toISOString(),
    updatedAt: toIso(row.updated_at) || new Date().toISOString(),
  };
}

async function ensureCatalogSchema(client: PoolClient, runtimeKey: string): Promise<void> {
  const ensured = global.__CATALOG_POSTGRES_SCHEMA_KEYS__ || new Set<string>();
  global.__CATALOG_POSTGRES_SCHEMA_KEYS__ = ensured;
  if (ensured.has(runtimeKey)) return;

  await client.query(`
    CREATE TABLE IF NOT EXISTS catalog_products (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      brand TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'archived')),
      available BOOLEAN NOT NULL DEFAULT TRUE,
      image TEXT NOT NULL DEFAULT '',
      images JSONB NOT NULL DEFAULT '[]'::jsonb,
      price NUMERIC(12, 2) NOT NULL DEFAULT 0,
      list_price NUMERIC(12, 2) NULL,
      unit TEXT NOT NULL DEFAULT 'un',
      pack_size INTEGER NULL,
      commercial_unit JSONB NOT NULL DEFAULT '{"sellMode":"unit","salesUnit":"un","allowFractionalQuantity":false}'::jsonb,
      packaging JSONB NULL,
      merchandising JSONB NOT NULL DEFAULT '{"profile":"generic","variantAxes":[],"supportedVoltages":[],"supportedColors":[],"supportedSizes":[]}'::jsonb,
      categories JSONB NOT NULL DEFAULT '[]'::jsonb,
      category_path JSONB NOT NULL DEFAULT '[]'::jsonb,
      departments JSONB NOT NULL DEFAULT '[]'::jsonb,
      collections JSONB NOT NULL DEFAULT '[]'::jsonb,
      short_description TEXT NOT NULL DEFAULT '',
      long_description TEXT NOT NULL DEFAULT '',
      seo JSONB NOT NULL DEFAULT '{}'::jsonb,
      identification JSONB NULL,
      dimensions JSONB NULL,
      supplier JSONB NULL,
      attributes JSONB NOT NULL DEFAULT '[]'::jsonb,
      stock JSONB NOT NULL DEFAULT '{}'::jsonb,
      logistics JSONB NULL,
      pricing JSONB NULL,
      regionalization JSONB NULL,
      marketing JSONB NULL,
      variation_group JSONB NULL,
      variants JSONB NOT NULL DEFAULT '[]'::jsonb,
      custom_fields JSONB NULL,
      allergens JSONB NOT NULL DEFAULT '[]'::jsonb,
      ingredients TEXT NOT NULL DEFAULT '',
      storage_instructions TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_catalog_products_slug ON catalog_products (slug);
    CREATE INDEX IF NOT EXISTS idx_catalog_products_status ON catalog_products (status);
    CREATE INDEX IF NOT EXISTS idx_catalog_products_available ON catalog_products (available);

    ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS custom_fields JSONB NULL;
    ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS identification JSONB NULL;
    ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS dimensions JSONB NULL;
    ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS supplier JSONB NULL;
    ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS commercial_unit JSONB NOT NULL DEFAULT '{"sellMode":"unit","salesUnit":"un","allowFractionalQuantity":false}'::jsonb;
    ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS packaging JSONB NULL;
    ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS merchandising JSONB NOT NULL DEFAULT '{"profile":"generic","variantAxes":[],"supportedVoltages":[],"supportedColors":[],"supportedSizes":[]}'::jsonb;

    CREATE TABLE IF NOT EXISTS catalog_categories (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'archived')),
      parent_id TEXT NULL,
      children JSONB NOT NULL DEFAULT '[]'::jsonb,
      metadata JSONB NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_catalog_categories_slug ON catalog_categories (slug);
    CREATE INDEX IF NOT EXISTS idx_catalog_categories_status ON catalog_categories (status);

    CREATE TABLE IF NOT EXISTS catalog_collections (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'archived')),
      metadata JSONB NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_catalog_collections_slug ON catalog_collections (slug);
    CREATE INDEX IF NOT EXISTS idx_catalog_collections_status ON catalog_collections (status);
  `);

  ensured.add(runtimeKey);
}

async function withCatalogDb<T>(handler: (client: PoolClient) => Promise<T>): Promise<StoreAvailability<T>> {
  const result = await withPostgresClient(async (client, runtime) => {
    await ensureCatalogSchema(client, runtime.key);
    return handler(client);
  });

  return result.available ? { available: true, value: result.value } : { available: false };
}

export async function countCatalogProductsInDatabase(): Promise<StoreAvailability<number>> {
  return withCatalogDb(async (client) => {
    const result = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM catalog_products');
    return Number(result.rows[0]?.count || 0);
  });
}

export async function listCatalogProductsFromDatabase(): Promise<StoreAvailability<CatalogProduct[]>> {
  return withCatalogDb(async (client) => {
    const result = await client.query<CatalogProductRow>('SELECT * FROM catalog_products ORDER BY updated_at DESC');
    return result.rows.map(mapRow);
  });
}

export async function getCatalogProductByIdFromDatabase(productId: string): Promise<StoreAvailability<CatalogProduct | null>> {
  return withCatalogDb(async (client) => {
    const result = await client.query<CatalogProductRow>('SELECT * FROM catalog_products WHERE id = $1 LIMIT 1', [productId]);
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  });
}

export async function getCatalogProductBySlugFromDatabase(slug: string): Promise<StoreAvailability<CatalogProduct | null>> {
  return withCatalogDb(async (client) => {
    const result = await client.query<CatalogProductRow>('SELECT * FROM catalog_products WHERE slug = $1 LIMIT 1', [slug]);
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  });
}

export async function upsertCatalogProductInDatabase(product: CatalogProduct): Promise<StoreAvailability<CatalogProduct>> {
  return withCatalogDb(async (client) => {
    await client.query(
      `INSERT INTO catalog_products (
        id, slug, sku, name, brand, status, available, image, images, price, list_price, unit, pack_size, commercial_unit, packaging, merchandising,
        categories, category_path, departments, collections, short_description, long_description, seo, identification, dimensions,
        supplier, attributes, stock, logistics, pricing, regionalization, marketing, variation_group, variants, allergens, ingredients, storage_instructions,
        custom_fields,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16::jsonb,
        $17::jsonb, $18::jsonb, $19::jsonb, $20::jsonb, $21, $22, $23::jsonb, $24::jsonb, $25::jsonb,
        $26::jsonb, $27::jsonb, $28::jsonb, $29::jsonb, $30::jsonb, $31::jsonb, $32::jsonb, $33::jsonb, $34::jsonb, $35, $36,
        $37::jsonb, $38::timestamptz, $39::timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        slug = EXCLUDED.slug,
        sku = EXCLUDED.sku,
        name = EXCLUDED.name,
        brand = EXCLUDED.brand,
        status = EXCLUDED.status,
        available = EXCLUDED.available,
        image = EXCLUDED.image,
        images = EXCLUDED.images,
        price = EXCLUDED.price,
        list_price = EXCLUDED.list_price,
        unit = EXCLUDED.unit,
        pack_size = EXCLUDED.pack_size,
        commercial_unit = EXCLUDED.commercial_unit,
        packaging = EXCLUDED.packaging,
        merchandising = EXCLUDED.merchandising,
        categories = EXCLUDED.categories,
        category_path = EXCLUDED.category_path,
        departments = EXCLUDED.departments,
        collections = EXCLUDED.collections,
        short_description = EXCLUDED.short_description,
        long_description = EXCLUDED.long_description,
        seo = EXCLUDED.seo,
        identification = EXCLUDED.identification,
        dimensions = EXCLUDED.dimensions,
        supplier = EXCLUDED.supplier,
        attributes = EXCLUDED.attributes,
        stock = EXCLUDED.stock,
        logistics = EXCLUDED.logistics,
        pricing = EXCLUDED.pricing,
        regionalization = EXCLUDED.regionalization,
        marketing = EXCLUDED.marketing,
        variation_group = EXCLUDED.variation_group,
        variants = EXCLUDED.variants,
        custom_fields = EXCLUDED.custom_fields,
        allergens = EXCLUDED.allergens,
        ingredients = EXCLUDED.ingredients,
        storage_instructions = EXCLUDED.storage_instructions,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at`,
      [
        product.id,
        product.slug,
        product.sku,
        product.name,
        product.brand,
        product.status,
        product.available,
        product.image,
        JSON.stringify(product.images),
        product.price,
        product.listPrice ?? null,
        product.unit,
        product.packSize ?? null,
        JSON.stringify(product.commercialUnit),
        JSON.stringify(product.packaging ?? null),
        JSON.stringify(product.merchandising),
        JSON.stringify(product.categories),
        JSON.stringify(product.categoryPath),
        JSON.stringify(product.departments),
        JSON.stringify(product.collections),
        product.shortDescription,
        product.longDescription,
        JSON.stringify(product.seo),
        JSON.stringify(product.identification ?? null),
        JSON.stringify(product.dimensions ?? null),
        JSON.stringify(product.supplier ?? null),
        JSON.stringify(product.attributes || []),
        JSON.stringify(product.stock),
        JSON.stringify(product.logistics ?? null),
        JSON.stringify(product.pricing ?? null),
        JSON.stringify(product.regionalization ?? null),
        JSON.stringify(product.marketing ?? null),
        JSON.stringify(product.variationGroup ?? null),
        JSON.stringify(product.variants || []),
        JSON.stringify(product.allergens),
        product.ingredients,
        product.storageInstructions,
        JSON.stringify(product.customFields ?? null),
        product.createdAt,
        product.updatedAt,
      ],
    );

    return product;
  });
}

export async function deleteAllCatalogProductsFromDatabase(): Promise<StoreAvailability<number>> {
  return withCatalogDb(async (client) => {
    const result = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM catalog_products');
    const count = Number(result.rows[0]?.count || 0);
    await client.query('DELETE FROM catalog_products');
    return count;
  });
}

export async function listCatalogCategoriesFromDatabase(): Promise<StoreAvailability<CatalogCategory[]>> {
  return withCatalogDb(async (client) => {
    const result = await client.query<CatalogCategoryRow>('SELECT * FROM catalog_categories ORDER BY name ASC');
    return result.rows.map(mapCategoryRow);
  });
}

export async function getCatalogCategoryByIdFromDatabase(categoryId: string): Promise<StoreAvailability<CatalogCategory | null>> {
  return withCatalogDb(async (client) => {
    const result = await client.query<CatalogCategoryRow>('SELECT * FROM catalog_categories WHERE id = $1 LIMIT 1', [categoryId]);
    return result.rows[0] ? mapCategoryRow(result.rows[0]) : null;
  });
}

export async function upsertCatalogCategoryInDatabase(category: CatalogCategory): Promise<StoreAvailability<CatalogCategory>> {
  return withCatalogDb(async (client) => {
    await client.query(
      `INSERT INTO catalog_categories (
        id, slug, name, description, status, parent_id, children, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::timestamptz, $10::timestamptz)
      ON CONFLICT (id) DO UPDATE SET
        slug = EXCLUDED.slug,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        parent_id = EXCLUDED.parent_id,
        children = EXCLUDED.children,
        metadata = EXCLUDED.metadata,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at`,
      [
        category.id,
        category.slug,
        category.name,
        category.description || '',
        category.status || 'active',
        category.parentId,
        JSON.stringify(category.children || []),
        JSON.stringify(category.metadata ?? null),
        category.createdAt || new Date().toISOString(),
        category.updatedAt || new Date().toISOString(),
      ],
    );

    return category;
  });
}

export async function listCatalogCollectionsFromDatabase(): Promise<StoreAvailability<CatalogCollection[]>> {
  return withCatalogDb(async (client) => {
    const result = await client.query<CatalogCollectionRow>('SELECT * FROM catalog_collections ORDER BY name ASC');
    return result.rows.map(mapCollectionRow);
  });
}

export async function getCatalogCollectionByIdFromDatabase(collectionId: string): Promise<StoreAvailability<CatalogCollection | null>> {
  return withCatalogDb(async (client) => {
    const result = await client.query<CatalogCollectionRow>('SELECT * FROM catalog_collections WHERE id = $1 LIMIT 1', [collectionId]);
    return result.rows[0] ? mapCollectionRow(result.rows[0]) : null;
  });
}

export async function upsertCatalogCollectionInDatabase(collection: CatalogCollection): Promise<StoreAvailability<CatalogCollection>> {
  return withCatalogDb(async (client) => {
    await client.query(
      `INSERT INTO catalog_collections (
        id, slug, name, description, status, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::timestamptz, $8::timestamptz)
      ON CONFLICT (id) DO UPDATE SET
        slug = EXCLUDED.slug,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        metadata = EXCLUDED.metadata,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at`,
      [
        collection.id,
        collection.slug,
        collection.name,
        collection.description || '',
        collection.status,
        JSON.stringify(collection.metadata ?? null),
        collection.createdAt,
        collection.updatedAt,
      ],
    );

    return collection;
  });
}

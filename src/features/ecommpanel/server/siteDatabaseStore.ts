import 'server-only';

import type { PoolClient } from 'pg';

import { withPostgresClient } from '@/features/ecommpanel/server/postgresRuntime';
import type { SitePage } from '@/features/ecommpanel/types/siteBuilder';

type StoreAvailability<T> = { available: true; value: T } | { available: false };

type SitePageRow = {
  id: string;
  title: string;
  slug: string;
  description: string;
  seo: unknown;
  theme: unknown;
  status: SitePage['status'];
  layout_preset: SitePage['layoutPreset'];
  slots: unknown;
  created_at: string | Date;
  updated_at: string | Date;
  published_at: string | Date | null;
  deleted_at: string | Date | null;
  delete_expires_at: string | Date | null;
};

declare global {
  var __SITE_POSTGRES_SCHEMA_KEYS__: Set<string> | undefined;
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

function mapSitePageRow(row: SitePageRow): SitePage {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    seo: parseJson(row.seo, {
      title: row.title,
      description: row.description,
      keywords: '',
      noIndex: true,
    }),
    theme: parseJson(row.theme, {
      backgroundColor: '#ffffff',
      textColor: '#0f172a',
      accentColor: '#1f4738',
    }),
    status: row.status,
    layoutPreset: row.layout_preset,
    slots: parseJson(row.slots, []),
    createdAt: toIso(row.created_at) || new Date().toISOString(),
    updatedAt: toIso(row.updated_at) || new Date().toISOString(),
    publishedAt: toIso(row.published_at),
    deletedAt: toIso(row.deleted_at),
    deleteExpiresAt: toIso(row.delete_expires_at),
  };
}

async function ensureSiteSchema(client: PoolClient, runtimeKey: string): Promise<void> {
  const ensured = global.__SITE_POSTGRES_SCHEMA_KEYS__ || new Set<string>();
  global.__SITE_POSTGRES_SCHEMA_KEYS__ = ensured;
  if (ensured.has(runtimeKey)) return;

  await client.query(`
    CREATE TABLE IF NOT EXISTS site_pages (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      seo JSONB NOT NULL DEFAULT '{}'::jsonb,
      theme JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
      layout_preset TEXT NOT NULL,
      slots JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      published_at TIMESTAMPTZ NULL,
      deleted_at TIMESTAMPTZ NULL,
      delete_expires_at TIMESTAMPTZ NULL
    );

    CREATE INDEX IF NOT EXISTS idx_site_pages_slug ON site_pages (slug);
    CREATE INDEX IF NOT EXISTS idx_site_pages_status ON site_pages (status);
    CREATE INDEX IF NOT EXISTS idx_site_pages_deleted_at ON site_pages (deleted_at);
    CREATE INDEX IF NOT EXISTS idx_site_pages_published_at ON site_pages (published_at DESC);
  `);

  ensured.add(runtimeKey);
}

async function withSiteDb<T>(handler: (client: PoolClient) => Promise<T>): Promise<StoreAvailability<T>> {
  const result = await withPostgresClient(async (client, runtime) => {
    await ensureSiteSchema(client, runtime.key);
    return handler(client);
  });

  return result.available ? { available: true, value: result.value } : { available: false };
}

export async function countSitePagesInDatabase(): Promise<StoreAvailability<number>> {
  return withSiteDb(async (client) => {
    const result = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM site_pages');
    return Number(result.rows[0]?.count || 0);
  });
}

export async function listSitePagesFromDatabase(options?: {
  includeTrashed?: boolean;
  publishedOnly?: boolean;
}): Promise<StoreAvailability<SitePage[]>> {
  return withSiteDb(async (client) => {
    const clauses: string[] = [];
    if (!options?.includeTrashed) clauses.push('deleted_at IS NULL');
    if (options?.publishedOnly) clauses.push(`status = 'published'`);
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await client.query<SitePageRow>(`SELECT * FROM site_pages ${where} ORDER BY updated_at DESC`);
    return result.rows.map(mapSitePageRow);
  });
}

export async function getSitePageByIdFromDatabase(
  pageId: string,
  options?: { includeTrashed?: boolean },
): Promise<StoreAvailability<SitePage | null>> {
  return withSiteDb(async (client) => {
    const result = await client.query<SitePageRow>(
      `SELECT * FROM site_pages
       WHERE id = $1
         AND ($2::boolean = TRUE OR deleted_at IS NULL)
       LIMIT 1`,
      [pageId, Boolean(options?.includeTrashed)],
    );
    return result.rows[0] ? mapSitePageRow(result.rows[0]) : null;
  });
}

export async function getSitePageBySlugFromDatabase(
  slug: string,
  options?: { includeTrashed?: boolean; publishedOnly?: boolean },
): Promise<StoreAvailability<SitePage | null>> {
  return withSiteDb(async (client) => {
    const clauses = ['slug = $1'];
    const values: Array<string | boolean> = [slug];
    if (!options?.includeTrashed) clauses.push('deleted_at IS NULL');
    if (options?.publishedOnly) clauses.push(`status = 'published'`);

    const result = await client.query<SitePageRow>(
      `SELECT * FROM site_pages WHERE ${clauses.join(' AND ')} LIMIT 1`,
      values,
    );
    return result.rows[0] ? mapSitePageRow(result.rows[0]) : null;
  });
}

export async function upsertSitePageInDatabase(page: SitePage): Promise<StoreAvailability<SitePage>> {
  return withSiteDb(async (client) => {
    await client.query(
      `INSERT INTO site_pages (
        id, title, slug, description, seo, theme, status, layout_preset, slots,
        created_at, updated_at, published_at, deleted_at, delete_expires_at
      ) VALUES (
        $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9::jsonb,
        $10::timestamptz, $11::timestamptz, $12::timestamptz, $13::timestamptz, $14::timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        slug = EXCLUDED.slug,
        description = EXCLUDED.description,
        seo = EXCLUDED.seo,
        theme = EXCLUDED.theme,
        status = EXCLUDED.status,
        layout_preset = EXCLUDED.layout_preset,
        slots = EXCLUDED.slots,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at,
        published_at = EXCLUDED.published_at,
        deleted_at = EXCLUDED.deleted_at,
        delete_expires_at = EXCLUDED.delete_expires_at`,
      [
        page.id,
        page.title,
        page.slug,
        page.description,
        JSON.stringify(page.seo),
        JSON.stringify(page.theme),
        page.status,
        page.layoutPreset,
        JSON.stringify(page.slots),
        page.createdAt,
        page.updatedAt,
        page.publishedAt || null,
        page.deletedAt || null,
        page.deleteExpiresAt || null,
      ],
    );

    return page;
  });
}

import 'server-only';

import type { PoolClient } from 'pg';

import { withPostgresClient } from '@/features/ecommpanel/server/postgresRuntime';
import {
  type StorefrontTemplate,
  createDefaultStorefrontTemplate,
  normalizeStorefrontTemplate,
} from '@/features/site-runtime/storefrontTemplate';

type StoreAvailability<T> = { available: true; value: T } | { available: false };

type StorefrontTemplateRow = {
  id: string;
  template: unknown;
  updated_at: string | Date;
};

declare global {
  var __STOREFRONT_TEMPLATE_POSTGRES_SCHEMA_KEYS__: Set<string> | undefined;
}

function toIso(value: string | Date | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function parseTemplate(value: unknown): StorefrontTemplate {
  if (value && typeof value === 'object') {
    return normalizeStorefrontTemplate(value);
  }

  if (typeof value === 'string') {
    try {
      return normalizeStorefrontTemplate(JSON.parse(value));
    } catch {
      return createDefaultStorefrontTemplate();
    }
  }

  return createDefaultStorefrontTemplate();
}

async function ensureTemplateSchema(client: PoolClient, runtimeKey: string): Promise<void> {
  const ensured = global.__STOREFRONT_TEMPLATE_POSTGRES_SCHEMA_KEYS__ || new Set<string>();
  global.__STOREFRONT_TEMPLATE_POSTGRES_SCHEMA_KEYS__ = ensured;
  if (ensured.has(runtimeKey)) return;

  await client.query(`
    CREATE TABLE IF NOT EXISTS storefront_templates (
      id TEXT PRIMARY KEY,
      template JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  ensured.add(runtimeKey);
}

async function withTemplateDb<T>(handler: (client: PoolClient) => Promise<T>): Promise<StoreAvailability<T>> {
  const result = await withPostgresClient(async (client, runtime) => {
    await ensureTemplateSchema(client, runtime.key);
    return handler(client);
  });

  return result.available ? { available: true, value: result.value } : { available: false };
}

export async function getStorefrontTemplateFromDatabase(): Promise<StoreAvailability<StorefrontTemplate | null>> {
  return withTemplateDb(async (client) => {
    const result = await client.query<StorefrontTemplateRow>(
      'SELECT * FROM storefront_templates WHERE id = $1 LIMIT 1',
      ['default'],
    );
    if (!result.rows[0]) return null;
    const template = parseTemplate(result.rows[0].template);
    return {
      ...template,
      updatedAt: toIso(result.rows[0].updated_at) || template.updatedAt,
    };
  });
}

export async function upsertStorefrontTemplateInDatabase(
  template: StorefrontTemplate,
): Promise<StoreAvailability<StorefrontTemplate>> {
  const normalized = normalizeStorefrontTemplate(template);

  return withTemplateDb(async (client) => {
    await client.query(
      `INSERT INTO storefront_templates (id, template, updated_at)
       VALUES ($1, $2::jsonb, $3::timestamptz)
       ON CONFLICT (id) DO UPDATE SET
         template = EXCLUDED.template,
         updated_at = EXCLUDED.updated_at`,
      ['default', JSON.stringify(normalized), normalized.updatedAt],
    );

    return normalized;
  });
}

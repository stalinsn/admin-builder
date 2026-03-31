import 'server-only';

import type { PoolClient } from 'pg';

import { withPostgresClient } from '@/features/ecommpanel/server/postgresRuntime';

type StoreAvailability<T> = { available: true; value: T } | { available: false };

type PanelSettingRow = {
  key: string;
  value: unknown;
  updated_at: string | Date;
};

declare global {
  var __PANEL_SETTINGS_POSTGRES_SCHEMA_KEYS__: Set<string> | undefined;
}

async function ensurePanelSettingsSchema(client: PoolClient, runtimeKey: string): Promise<void> {
  const ensured = global.__PANEL_SETTINGS_POSTGRES_SCHEMA_KEYS__ || new Set<string>();
  global.__PANEL_SETTINGS_POSTGRES_SCHEMA_KEYS__ = ensured;
  if (ensured.has(runtimeKey)) return;

  await client.query(`
    CREATE TABLE IF NOT EXISTS panel_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  ensured.add(runtimeKey);
}

async function withPanelSettingsDb<T>(handler: (client: PoolClient) => Promise<T>): Promise<StoreAvailability<T>> {
  const result = await withPostgresClient(async (client, runtime) => {
    await ensurePanelSettingsSchema(client, runtime.key);
    return handler(client);
  });

  return result.available ? { available: true, value: result.value } : { available: false };
}

export async function getPanelSettingFromDatabase<T>(key: string): Promise<StoreAvailability<T | null>> {
  return withPanelSettingsDb(async (client) => {
    const result = await client.query<PanelSettingRow>(
      'SELECT key, value, updated_at FROM panel_settings WHERE key = $1 LIMIT 1',
      [key],
    );
    if (!result.rows[0]) return null;
    return result.rows[0].value as T;
  });
}

export async function upsertPanelSettingInDatabase<T>(key: string, value: T): Promise<StoreAvailability<T>> {
  return withPanelSettingsDb(async (client) => {
    await client.query(
      `INSERT INTO panel_settings (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         updated_at = EXCLUDED.updated_at`,
      [key, JSON.stringify(value)],
    );

    return value;
  });
}

import 'server-only';

import type { PoolClient } from 'pg';

import { withPostgresClient } from '@/features/ecommpanel/server/postgresRuntime';
import type { AnalyticsDeviceType, AnalyticsEventRecord, AnalyticsEventType } from '@/features/analytics/types';

type StoreAvailability<T> = { available: true; value: T } | { available: false };

type AnalyticsEventRow = {
  id: string;
  session_id: string;
  visitor_id: string | null;
  type: AnalyticsEventType;
  occurred_at: string | Date;
  received_at: string | Date;
  pathname: string;
  search: string;
  referrer: string;
  title: string | null;
  track_id: string | null;
  label: string | null;
  element: string | null;
  target_href: string | null;
  search_query: string | null;
  checkout_step: string | null;
  payment_method: string | null;
  action: string | null;
  product_id: string | null;
  product_name: string | null;
  cart_items_count: number | null;
  cart_subtotal: number | null;
  cart_value: number | null;
  purchase_order_id: string | null;
  purchase_value: number | null;
  purchase_items_count: number | null;
  shipping_value: number | null;
  discount_value: number | null;
  postal_code_prefix: string | null;
  currency: 'BRL';
  source: 'storefront' | 'server';
  location_country: string | null;
  location_region: string | null;
  location_city: string | null;
  device_type: AnalyticsDeviceType;
};

declare global {
  var __ANALYTICS_POSTGRES_SCHEMA_KEYS__: Set<string> | undefined;
}

function toIso(value: string | Date | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function mapEventRow(row: AnalyticsEventRow): AnalyticsEventRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    visitorId: row.visitor_id || undefined,
    type: row.type,
    occurredAt: toIso(row.occurred_at) || new Date().toISOString(),
    receivedAt: toIso(row.received_at) || new Date().toISOString(),
    pathname: row.pathname,
    search: row.search,
    referrer: row.referrer,
    title: row.title || undefined,
    trackId: row.track_id || undefined,
    label: row.label || undefined,
    element: row.element || undefined,
    targetHref: row.target_href || undefined,
    searchQuery: row.search_query || undefined,
    checkoutStep: row.checkout_step || undefined,
    paymentMethod: row.payment_method || undefined,
    action: row.action || undefined,
    productId: row.product_id || undefined,
    productName: row.product_name || undefined,
    cartItemsCount: row.cart_items_count ?? undefined,
    cartSubtotal: row.cart_subtotal ?? undefined,
    cartValue: row.cart_value ?? undefined,
    purchaseOrderId: row.purchase_order_id || undefined,
    purchaseValue: row.purchase_value ?? undefined,
    purchaseItemsCount: row.purchase_items_count ?? undefined,
    shippingValue: row.shipping_value ?? undefined,
    discountValue: row.discount_value ?? undefined,
    postalCodePrefix: row.postal_code_prefix || undefined,
    currency: row.currency,
    source: row.source,
    locationCountry: row.location_country || undefined,
    locationRegion: row.location_region || undefined,
    locationCity: row.location_city || undefined,
    deviceType: row.device_type,
  };
}

async function ensureAnalyticsSchema(client: PoolClient, runtimeKey: string): Promise<void> {
  const ensured = global.__ANALYTICS_POSTGRES_SCHEMA_KEYS__ || new Set<string>();
  global.__ANALYTICS_POSTGRES_SCHEMA_KEYS__ = ensured;
  if (ensured.has(runtimeKey)) return;

  await client.query(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      visitor_id TEXT NULL,
      type TEXT NOT NULL CHECK (type IN ('page_view', 'heartbeat', 'interaction_click', 'search_submit', 'cart_update', 'checkout_step', 'purchase_complete')),
      occurred_at TIMESTAMPTZ NOT NULL,
      received_at TIMESTAMPTZ NOT NULL,
      pathname TEXT NOT NULL,
      search TEXT NOT NULL DEFAULT '',
      referrer TEXT NOT NULL DEFAULT '',
      title TEXT NULL,
      track_id TEXT NULL,
      label TEXT NULL,
      element TEXT NULL,
      target_href TEXT NULL,
      search_query TEXT NULL,
      checkout_step TEXT NULL,
      payment_method TEXT NULL,
      action TEXT NULL,
      product_id TEXT NULL,
      product_name TEXT NULL,
      cart_items_count INTEGER NULL,
      cart_subtotal DOUBLE PRECISION NULL,
      cart_value DOUBLE PRECISION NULL,
      purchase_order_id TEXT NULL,
      purchase_value DOUBLE PRECISION NULL,
      purchase_items_count INTEGER NULL,
      shipping_value DOUBLE PRECISION NULL,
      discount_value DOUBLE PRECISION NULL,
      postal_code_prefix TEXT NULL,
      currency TEXT NOT NULL DEFAULT 'BRL',
      source TEXT NOT NULL CHECK (source IN ('storefront', 'server')),
      location_country TEXT NULL,
      location_region TEXT NULL,
      location_city TEXT NULL,
      device_type TEXT NOT NULL CHECK (device_type IN ('mobile', 'tablet', 'desktop', 'bot', 'unknown'))
    );

    CREATE INDEX IF NOT EXISTS idx_analytics_events_occurred_at ON analytics_events (occurred_at DESC);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events (type);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_events (session_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_pathname ON analytics_events (pathname);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_purchase_order_id ON analytics_events (purchase_order_id);
  `);

  ensured.add(runtimeKey);
}

async function withAnalyticsDb<T>(handler: (client: PoolClient) => Promise<T>): Promise<StoreAvailability<T>> {
  const result = await withPostgresClient(async (client, runtime) => {
    await ensureAnalyticsSchema(client, runtime.key);
    return handler(client);
  });

  return result.available ? { available: true, value: result.value } : { available: false };
}

export async function countAnalyticsEventsInDatabase(): Promise<StoreAvailability<number>> {
  return withAnalyticsDb(async (client) => {
    const result = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM analytics_events');
    return Number(result.rows[0]?.count || 0);
  });
}

export async function insertAnalyticsEventsInDatabase(events: AnalyticsEventRecord[]): Promise<StoreAvailability<number>> {
  return withAnalyticsDb(async (client) => {
    if (!events.length) return 0;

    const valueRows: string[] = [];
    const values: Array<string | number | null> = [];

    for (const event of events) {
      const offset = values.length;
      valueRows.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}::timestamptz, $${offset + 6}::timestamptz, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16}, $${offset + 17}, $${offset + 18}, $${offset + 19}, $${offset + 20}, $${offset + 21}, $${offset + 22}, $${offset + 23}, $${offset + 24}, $${offset + 25}, $${offset + 26}, $${offset + 27}, $${offset + 28}, $${offset + 29}, $${offset + 30}, $${offset + 31}, $${offset + 32}, $${offset + 33}, $${offset + 34}, $${offset + 35})`,
      );
      values.push(
        event.id,
        event.sessionId,
        event.visitorId || null,
        event.type,
        event.occurredAt,
        event.receivedAt,
        event.pathname,
        event.search,
        event.referrer,
        event.title || null,
        event.trackId || null,
        event.label || null,
        event.element || null,
        event.targetHref || null,
        event.searchQuery || null,
        event.checkoutStep || null,
        event.paymentMethod || null,
        event.action || null,
        event.productId || null,
        event.productName || null,
        event.cartItemsCount ?? null,
        event.cartSubtotal ?? null,
        event.cartValue ?? null,
        event.purchaseOrderId || null,
        event.purchaseValue ?? null,
        event.purchaseItemsCount ?? null,
        event.shippingValue ?? null,
        event.discountValue ?? null,
        event.postalCodePrefix || null,
        event.currency,
        event.source,
        event.locationCountry || null,
        event.locationRegion || null,
        event.locationCity || null,
        event.deviceType,
      );
    }

    await client.query(
      `INSERT INTO analytics_events (
        id, session_id, visitor_id, type, occurred_at, received_at, pathname, search, referrer, title, track_id, label, element,
        target_href, search_query, checkout_step, payment_method, action, product_id, product_name, cart_items_count, cart_subtotal,
        cart_value, purchase_order_id, purchase_value, purchase_items_count, shipping_value, discount_value, postal_code_prefix, currency,
        source, location_country, location_region, location_city, device_type
      ) VALUES ${valueRows.join(', ')}
      ON CONFLICT (id) DO NOTHING`,
      values,
    );

    return events.length;
  });
}

export async function listAnalyticsEventsFromDatabaseSince(startAtIso: string): Promise<StoreAvailability<AnalyticsEventRecord[]>> {
  return withAnalyticsDb(async (client) => {
    const result = await client.query<AnalyticsEventRow>(
      `SELECT
        id, session_id, visitor_id, type, occurred_at, received_at, pathname, search, referrer, title, track_id, label, element,
        target_href, search_query, checkout_step, payment_method, action, product_id, product_name, cart_items_count, cart_subtotal,
        cart_value, purchase_order_id, purchase_value, purchase_items_count, shipping_value, discount_value, postal_code_prefix, currency,
        source, location_country, location_region, location_city, device_type
       FROM analytics_events
       WHERE occurred_at >= $1::timestamptz
       ORDER BY occurred_at ASC`,
      [startAtIso],
    );
    return result.rows.map(mapEventRow);
  });
}

export async function deleteAnalyticsEventsOlderThanInDatabase(cutoffIso: string): Promise<StoreAvailability<number>> {
  return withAnalyticsDb(async (client) => {
    const result = await client.query<{ count: string }>(
      `WITH deleted AS (
         DELETE FROM analytics_events
         WHERE occurred_at < $1::timestamptz
         RETURNING 1
       )
       SELECT COUNT(*)::text AS count FROM deleted`,
      [cutoffIso],
    );
    return Number(result.rows[0]?.count || 0);
  });
}

import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

import type { NextRequest } from 'next/server';

import {
  ANALYTICS_SESSION_COOKIE,
  ANALYTICS_SESSION_HEADER,
  ANALYTICS_VISITOR_COOKIE,
  type AnalyticsClientEventInput,
  type AnalyticsConfig,
  type AnalyticsDashboard,
  type AnalyticsDeviceType,
  type AnalyticsEventRecord,
  type AnalyticsEventType,
  type AnalyticsRecentEvent,
  type AnalyticsRecentPurchase,
  type AnalyticsTimelineRow,
  type AnalyticsTopRow,
} from '@/features/analytics/types';
import { nowIso, randomToken, sha256 } from '@/features/ecommpanel/server/crypto';
import { getClientIp, getUserAgent } from '@/features/ecommpanel/server/requestMeta';
import { resolvePostgresRuntime } from '@/features/ecommpanel/server/postgresRuntime';
import {
  deleteAnalyticsEventsOlderThanInDatabase,
  insertAnalyticsEventsInDatabase,
  listAnalyticsEventsFromDatabaseSince,
} from './analyticsDatabaseStore';
import { resolveRuntimeAnalyticsConfig } from './configStore';

type ParsedEventsCache = {
  filePath: string;
  mtimeMs: number;
  events: AnalyticsEventRecord[];
};

type RecordEventInput = {
  type: AnalyticsEventType;
  sessionId?: string;
  visitorId?: string;
  pathname?: string;
  search?: string;
  referrer?: string;
  title?: string;
  trackId?: string;
  label?: string;
  element?: string;
  targetHref?: string;
  searchQuery?: string;
  checkoutStep?: string;
  paymentMethod?: string;
  action?: string;
  productId?: string;
  productName?: string;
  cartItemsCount?: number;
  cartSubtotal?: number;
  cartValue?: number;
  purchaseOrderId?: string;
  purchaseValue?: number;
  purchaseItemsCount?: number;
  shippingValue?: number;
  discountValue?: number;
  postalCodePrefix?: string;
  locationCountry?: string;
  locationRegion?: string;
  locationCity?: string;
  occurredAt?: string;
  source?: 'storefront' | 'server';
};

type CollectAnalyticsEventsResult = {
  accepted: number;
  ignored: number;
};

type AnalyticsEventsPersistenceMode = 'files' | 'hybrid' | 'database';

declare global {
  var __APP_HUB_ANALYTICS_EVENTS_CACHE__: Map<string, ParsedEventsCache> | undefined;
  var __APP_HUB_ANALYTICS_DB_FILE_SYNC_KEYS__: Map<string, number> | undefined;
  var __APP_HUB_ANALYTICS_DB_CLEANUP_KEYS__: Map<string, number> | undefined;
}

const ADMIN_ROOT = path.join(process.cwd(), 'src/data/ecommpanel/analytics');
const EVENTS_DIR = path.join(ADMIN_ROOT, 'events');
const DB_SYNC_INTERVAL_MS = 1000 * 60 * 2;
const DB_CLEANUP_INTERVAL_MS = 1000 * 60 * 60;

function getEventsCache(): Map<string, ParsedEventsCache> {
  if (!global.__APP_HUB_ANALYTICS_EVENTS_CACHE__) {
    global.__APP_HUB_ANALYTICS_EVENTS_CACHE__ = new Map();
  }

  return global.__APP_HUB_ANALYTICS_EVENTS_CACHE__;
}

function getDbSyncRegistry(): Map<string, number> {
  if (!global.__APP_HUB_ANALYTICS_DB_FILE_SYNC_KEYS__) {
    global.__APP_HUB_ANALYTICS_DB_FILE_SYNC_KEYS__ = new Map();
  }

  return global.__APP_HUB_ANALYTICS_DB_FILE_SYNC_KEYS__;
}

function getDbCleanupRegistry(): Map<string, number> {
  if (!global.__APP_HUB_ANALYTICS_DB_CLEANUP_KEYS__) {
    global.__APP_HUB_ANALYTICS_DB_CLEANUP_KEYS__ = new Map();
  }

  return global.__APP_HUB_ANALYTICS_DB_CLEANUP_KEYS__;
}

function ensureEventsDir(): void {
  fs.mkdirSync(EVENTS_DIR, { recursive: true });
}

function getEventsPersistenceMode(): AnalyticsEventsPersistenceMode {
  const value = process.env.ECOM_ANALYTICS_EVENTS_PERSISTENCE_MODE?.trim().toLowerCase();
  if (value === 'files') return 'files';
  if (value === 'database') return 'database';
  return 'hybrid';
}

function requireDatabaseValue<T>(
  result: { available: true; value: T } | { available: false },
  action: string,
): T {
  if (!result.available) {
    throw new Error(`Analytics em modo database exige PostgreSQL disponível para ${action}.`);
  }

  return result.value;
}

function clampNumber(value: unknown, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function sanitizeText(value: unknown, maxLength: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function sanitizePathname(value: unknown, fallback = '/e-commerce'): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).pathname.slice(0, 240) || fallback;
    } catch {
      return fallback;
    }
  }
  return trimmed.startsWith('/') ? trimmed.slice(0, 240) : `/${trimmed.slice(0, 239)}`;
}

function sanitizeOptionalText(value: unknown, maxLength: number): string | undefined {
  const normalized = sanitizeText(value, maxLength, '');
  return normalized || undefined;
}

function sanitizeEventType(value: unknown): AnalyticsEventType | null {
  const normalized = sanitizeText(value, 40);
  switch (normalized) {
    case 'page_view':
    case 'heartbeat':
    case 'interaction_click':
    case 'search_submit':
    case 'cart_update':
    case 'checkout_step':
    case 'purchase_complete':
      return normalized;
    default:
      return null;
  }
}

function parseTimestamp(value: unknown): string {
  if (typeof value !== 'string') return nowIso();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return nowIso();

  const now = Date.now();
  const distanceMs = Math.abs(now - parsed.getTime());
  if (distanceMs > 1000 * 60 * 60 * 48) return nowIso();
  return parsed.toISOString();
}

function detectDeviceType(userAgent: string): AnalyticsDeviceType {
  const ua = userAgent.toLowerCase();
  if (!ua) return 'unknown';
  if (/bot|crawler|spider|preview|facebookexternalhit|slurp/.test(ua)) return 'bot';
  if (/ipad|tablet/.test(ua)) return 'tablet';
  if (/mobi|android|iphone/.test(ua)) return 'mobile';
  if (/macintosh|windows|linux|x11/.test(ua)) return 'desktop';
  return 'unknown';
}

function getDayKey(input: string | number | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  return date.toISOString().slice(0, 10);
}

function getRangeStartIso(rangeDays: number): string {
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - (rangeDays - 1));
  return startDate.toISOString();
}

function getDayFilePath(dayKey: string): string {
  return path.join(EVENTS_DIR, `${dayKey}.ndjson`);
}

function readEventLines(filePath: string): AnalyticsEventRecord[] {
  if (!fs.existsSync(filePath)) return [];

  const stat = fs.statSync(filePath);
  const cache = getEventsCache().get(filePath);
  if (cache && cache.mtimeMs === stat.mtimeMs) {
    return cache.events;
  }

  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
  const events = lines.flatMap((line) => {
    try {
      const parsed = JSON.parse(line) as AnalyticsEventRecord;
      return parsed ? [parsed] : [];
    } catch {
      return [];
    }
  });

  getEventsCache().set(filePath, {
    filePath,
    mtimeMs: stat.mtimeMs,
    events,
  });
  return events;
}

function appendEvents(events: AnalyticsEventRecord[]): void {
  if (!events.length) return;

  ensureEventsDir();
  const byDay = new Map<string, AnalyticsEventRecord[]>();

  for (const event of events) {
    const dayKey = getDayKey(event.occurredAt);
    const bucket = byDay.get(dayKey);
    if (bucket) {
      bucket.push(event);
    } else {
      byDay.set(dayKey, [event]);
    }
  }

  for (const [dayKey, bucket] of byDay.entries()) {
    const filePath = getDayFilePath(dayKey);
    const payload = `${bucket.map((event) => JSON.stringify(event)).join('\n')}\n`;
    fs.appendFileSync(filePath, payload, 'utf-8');
    getEventsCache().delete(filePath);
  }
}

function cleanupOldEventFiles(retainDays: number): void {
  ensureEventsDir();
  const cutoff = Date.now() - retainDays * 24 * 60 * 60 * 1000;

  for (const entry of fs.readdirSync(EVENTS_DIR)) {
    if (!entry.endsWith('.ndjson')) continue;
    const filePath = path.join(EVENTS_DIR, entry);
    const stat = fs.statSync(filePath);
    if (stat.mtimeMs >= cutoff) continue;
    fs.unlinkSync(filePath);
    getEventsCache().delete(filePath);
  }
}

function buildLocationLabel(input: {
  city?: string;
  region?: string;
  country?: string;
}): string {
  const parts = [input.city, input.region, input.country].filter(Boolean);
  return parts.join(' · ') || 'Local não informado';
}

function normalizeLocationFromRequest(req: NextRequest): {
  country?: string;
  region?: string;
  city?: string;
} {
  const country = sanitizeOptionalText(req.headers.get('x-vercel-ip-country'), 24);
  const region = sanitizeOptionalText(req.headers.get('x-vercel-ip-country-region'), 48);
  const city = sanitizeOptionalText(req.headers.get('x-vercel-ip-city'), 64);

  return {
    country,
    region,
    city,
  };
}

function resolveSessionId(req: NextRequest, providedSessionId?: string): string {
  const rawSessionId =
    sanitizeOptionalText(providedSessionId, 120) ||
    sanitizeOptionalText(req.headers.get(ANALYTICS_SESSION_HEADER), 120) ||
    sanitizeOptionalText(req.cookies.get(ANALYTICS_SESSION_COOKIE)?.value, 120);

  if (rawSessionId) return rawSessionId;

  return `anon-${sha256(`${getClientIp(req)}::${getUserAgent(req)}`).slice(0, 24)}`;
}

function resolveVisitorId(req: NextRequest, providedVisitorId?: string, sessionId?: string): string | undefined {
  const normalized = sanitizeOptionalText(providedVisitorId, 120);
  if (normalized) return normalized;

  const cookieValue = sanitizeOptionalText(req.cookies.get(ANALYTICS_VISITOR_COOKIE)?.value, 120);
  if (cookieValue) return cookieValue;

  return sessionId ? `visitor-${sha256(sessionId).slice(0, 20)}` : undefined;
}

function buildNormalizedEvent(req: NextRequest, input: RecordEventInput): AnalyticsEventRecord {
  const timestamp = parseTimestamp(input.occurredAt);
  const sessionId = resolveSessionId(req, input.sessionId);
  const locationFromRequest = normalizeLocationFromRequest(req);
  const userAgent = getUserAgent(req);
  const pathname = sanitizePathname(input.pathname, req.nextUrl.pathname || '/e-commerce');

  return {
    id: randomToken(8),
    sessionId,
    visitorId: resolveVisitorId(req, input.visitorId, sessionId),
    type: input.type,
    occurredAt: timestamp,
    receivedAt: nowIso(),
    pathname,
    search: sanitizeText(input.search, 180),
    referrer: sanitizeText(input.referrer, 240),
    title: sanitizeOptionalText(input.title, 160),
    trackId: sanitizeOptionalText(input.trackId, 80),
    label: sanitizeOptionalText(input.label, 160),
    element: sanitizeOptionalText(input.element, 40),
    targetHref: sanitizeOptionalText(input.targetHref, 240),
    searchQuery: sanitizeOptionalText(input.searchQuery, 160),
    checkoutStep: sanitizeOptionalText(input.checkoutStep, 64),
    paymentMethod: sanitizeOptionalText(input.paymentMethod, 64),
    action: sanitizeOptionalText(input.action, 64),
    productId: sanitizeOptionalText(input.productId, 80),
    productName: sanitizeOptionalText(input.productName, 160),
    cartItemsCount: clampNumber(input.cartItemsCount, 0, 0, 9999),
    cartSubtotal: clampNumber(input.cartSubtotal, 0, 0, 999999999),
    cartValue: clampNumber(input.cartValue, 0, 0, 999999999),
    purchaseOrderId: sanitizeOptionalText(input.purchaseOrderId, 64),
    purchaseValue: clampNumber(input.purchaseValue, 0, 0, 999999999),
    purchaseItemsCount: clampNumber(input.purchaseItemsCount, 0, 0, 9999),
    shippingValue: clampNumber(input.shippingValue, 0, 0, 999999999),
    discountValue: clampNumber(input.discountValue, 0, -999999999, 0),
    postalCodePrefix: sanitizeOptionalText(input.postalCodePrefix, 12),
    currency: 'BRL',
    source: input.source || 'storefront',
    locationCountry: sanitizeOptionalText(input.locationCountry, 24) || locationFromRequest.country,
    locationRegion: sanitizeOptionalText(input.locationRegion, 48) || locationFromRequest.region,
    locationCity: sanitizeOptionalText(input.locationCity, 64) || locationFromRequest.city,
    deviceType: detectDeviceType(userAgent),
  };
}

function listDayKeys(rangeDays: number): string[] {
  const days: string[] = [];
  const now = new Date();

  for (let index = rangeDays - 1; index >= 0; index -= 1) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - index);
    days.push(getDayKey(day));
  }

  return days;
}

function readEventsForRangeFromFiles(rangeDays: number): AnalyticsEventRecord[] {
  const dayKeys = listDayKeys(rangeDays);
  const startTime = new Date(getRangeStartIso(rangeDays)).getTime();

  return dayKeys.flatMap((dayKey) =>
    readEventLines(getDayFilePath(dayKey)).filter((event) => {
      const eventTime = new Date(event.occurredAt).getTime();
      return !Number.isNaN(eventTime) && eventTime >= startTime;
    }),
  );
}

function listEventsForBackfill(retainDays: number): AnalyticsEventRecord[] {
  ensureEventsDir();
  const startTime = new Date(getRangeStartIso(Math.max(retainDays, 1))).getTime();
  return fs
    .readdirSync(EVENTS_DIR)
    .filter((entry) => entry.endsWith('.ndjson'))
    .sort()
    .flatMap((entry) =>
      readEventLines(path.join(EVENTS_DIR, entry)).filter((event) => {
        const eventTime = new Date(event.occurredAt).getTime();
        return !Number.isNaN(eventTime) && eventTime >= startTime;
      }),
    );
}

async function syncFileEventsToDatabaseIfNeeded(config: AnalyticsConfig): Promise<void> {
  if (getEventsPersistenceMode() !== 'hybrid') return;

  const runtime = resolvePostgresRuntime();
  if (!runtime) return;

  const registry = getDbSyncRegistry();
  const lastSyncedAt = registry.get(runtime.key) || 0;
  if (Date.now() - lastSyncedAt < DB_SYNC_INTERVAL_MS) return;

  const events = listEventsForBackfill(config.internal.retainDays);
  if (events.length) {
    await insertAnalyticsEventsInDatabase(events);
  }

  registry.set(runtime.key, Date.now());
}

async function cleanupDatabaseEventsIfNeeded(config: AnalyticsConfig, force = false): Promise<void> {
  const mode = getEventsPersistenceMode();
  if (mode === 'files') return;

  const runtime = resolvePostgresRuntime();
  if (!runtime) return;

  const registry = getDbCleanupRegistry();
  const lastCleanupAt = registry.get(runtime.key) || 0;
  if (!force && Date.now() - lastCleanupAt < DB_CLEANUP_INTERVAL_MS) return;

  const cutoff = new Date(Date.now() - config.internal.retainDays * 24 * 60 * 60 * 1000).toISOString();
  await deleteAnalyticsEventsOlderThanInDatabase(cutoff);
  registry.set(runtime.key, Date.now());
}

async function persistAnalyticsEvents(events: AnalyticsEventRecord[], config: AnalyticsConfig): Promise<number> {
  if (!events.length || !config.internal.enabled) {
    return 0;
  }

  const mode = getEventsPersistenceMode();
  if (mode === 'files') {
    appendEvents(events);
    cleanupOldEventFiles(config.internal.retainDays);
    return events.length;
  }

  if (mode === 'hybrid') {
    await syncFileEventsToDatabaseIfNeeded(config);
    const dbResult = await insertAnalyticsEventsInDatabase(events);
    appendEvents(events);
    cleanupOldEventFiles(config.internal.retainDays);
    await cleanupDatabaseEventsIfNeeded(config);
    if (dbResult.available) return events.length;
    return events.length;
  }

  const dbResult = await insertAnalyticsEventsInDatabase(events);
  await cleanupDatabaseEventsIfNeeded(config);
  return dbResult.available ? events.length : 0;
}

async function readEventsForRange(rangeDays: number, config: AnalyticsConfig): Promise<AnalyticsEventRecord[]> {
  const mode = getEventsPersistenceMode();
  if (mode === 'files') {
    return readEventsForRangeFromFiles(rangeDays);
  }

  if (mode === 'hybrid') {
    await syncFileEventsToDatabaseIfNeeded(config);
    const dbEvents = await listAnalyticsEventsFromDatabaseSince(getRangeStartIso(rangeDays));
    await cleanupDatabaseEventsIfNeeded(config);
    return dbEvents.available ? dbEvents.value : readEventsForRangeFromFiles(rangeDays);
  }

  const dbEvents = await listAnalyticsEventsFromDatabaseSince(getRangeStartIso(rangeDays));
  await cleanupDatabaseEventsIfNeeded(config);
  return requireDatabaseValue(dbEvents, 'carregar eventos de analytics');
}

export async function collectAnalyticsEvents(req: NextRequest, body: unknown): Promise<CollectAnalyticsEventsResult> {
  const config = resolveRuntimeAnalyticsConfig();
  if (!config.internal.enabled) {
    return { accepted: 0, ignored: 0 };
  }

  const source = (body && typeof body === 'object' ? body : {}) as {
    events?: AnalyticsClientEventInput[];
    sessionId?: string;
    visitorId?: string;
  };
  const rawEvents = Array.isArray(source.events) ? source.events : [];
  const maxBatchSize = config.internal.maxBatchSize;
  const acceptedEvents: AnalyticsEventRecord[] = [];

  for (const item of rawEvents.slice(0, maxBatchSize)) {
    const type = sanitizeEventType(item?.type);
    if (!type) continue;

    acceptedEvents.push(
      buildNormalizedEvent(req, {
        ...item,
        type,
        sessionId: source.sessionId,
        visitorId: source.visitorId,
        source: 'storefront',
      }),
    );
  }

  const persistedCount = await persistAnalyticsEvents(acceptedEvents, config);

  return {
    accepted: persistedCount,
    ignored: Math.max(0, rawEvents.length - acceptedEvents.length) + Math.max(0, acceptedEvents.length - persistedCount),
  };
}

export async function recordServerAnalyticsEvent(req: NextRequest, input: RecordEventInput): Promise<AnalyticsEventRecord> {
  const config = resolveRuntimeAnalyticsConfig();
  const event = buildNormalizedEvent(req, {
    ...input,
    source: 'server',
  });

  if (config.internal.enabled) {
    await persistAnalyticsEvents([event], config);
  }

  return event;
}

export async function buildCheckoutPurchaseEvent(
  req: NextRequest,
  payload: {
    orderId: string;
    value: number;
    itemsCount: number;
    paymentMethod?: string;
    shippingValue?: number;
    discountValue?: number;
    postalCode?: string;
    city?: string;
    state?: string;
    country?: string;
  },
): Promise<AnalyticsEventRecord> {
  return recordServerAnalyticsEvent(req, {
    type: 'purchase_complete',
    pathname: '/e-commerce/checkout',
    checkoutStep: 'completed',
    paymentMethod: payload.paymentMethod,
    purchaseOrderId: payload.orderId,
    purchaseValue: payload.value,
    purchaseItemsCount: payload.itemsCount,
    shippingValue: payload.shippingValue,
    discountValue: payload.discountValue,
    postalCodePrefix: sanitizeOptionalText(payload.postalCode?.replace(/\D/g, '').slice(0, 5), 12),
    locationCity: payload.city,
    locationRegion: payload.state,
    locationCountry: payload.country,
    occurredAt: nowIso(),
  });
}

function buildTopRows(entries: Map<string, { value: number; secondary?: string }>, limit = 8): AnalyticsTopRow[] {
  return Array.from(entries.entries())
    .sort((left, right) => right[1].value - left[1].value)
    .slice(0, limit)
    .map(([label, item]) => ({
      label,
      value: item.value,
      secondary: item.secondary,
    }));
}

function formatEventLabel(event: AnalyticsEventRecord): AnalyticsRecentEvent {
  const labelByType: Record<AnalyticsEventType, string> = {
    page_view: 'Visualização de página',
    heartbeat: 'Sessão ativa',
    interaction_click: event.label || event.trackId || 'Clique',
    search_submit: event.searchQuery ? `Busca: ${event.searchQuery}` : 'Busca enviada',
    cart_update: event.action ? `Carrinho: ${event.action}` : 'Carrinho atualizado',
    checkout_step: event.checkoutStep ? `Checkout: ${event.checkoutStep}` : 'Checkout atualizado',
    purchase_complete: event.purchaseOrderId ? `Compra concluída: ${event.purchaseOrderId}` : 'Compra concluída',
  };

  const secondaryParts = [
    event.paymentMethod ? `Pagamento: ${event.paymentMethod}` : null,
    event.purchaseValue ? `Valor: R$ ${event.purchaseValue.toFixed(2)}` : null,
    event.cartValue ? `Carrinho: R$ ${event.cartValue.toFixed(2)}` : null,
  ].filter(Boolean);

  return {
    id: event.id,
    occurredAt: event.occurredAt,
    type: event.type,
    label: labelByType[event.type],
    pathname: event.pathname,
    secondary: secondaryParts.join(' • ') || undefined,
  };
}

function buildAnalyticsDashboardFromEvents(
  events: AnalyticsEventRecord[],
  rangeDays: number,
  config: AnalyticsConfig,
): AnalyticsDashboard {
  const safeRangeDays = Math.min(Math.max(Math.round(rangeDays), 1), 90);
  const orderedEvents = [...events].sort((left, right) => {
    return new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime();
  });
  const now = Date.now();
  const activeWindowMs = config.internal.activeWindowMinutes * 60 * 1000;
  const todayKey = getDayKey(now);

  const sessions = new Map<
    string,
    {
      visitorId?: string;
      firstAt: number;
      lastAt: number;
      pageViews: number;
      searches: number;
      clicks: number;
      cartUpdates: number;
      checkoutEvents: number;
      purchases: number;
      revenue: number;
      deviceType: AnalyticsDeviceType;
      locationLabel: string;
    }
  >();
  const topPages = new Map<string, { value: number; secondary?: string }>();
  const topSearches = new Map<string, { value: number; secondary?: string }>();
  const topClicks = new Map<string, { value: number; secondary?: string }>();
  const paymentMethods = new Map<string, { value: number; secondary?: string }>();
  const locations = new Map<string, { value: number; secondary?: string }>();
  const deviceCounts = new Map<string, { value: number; secondary?: string }>();
  const timeline = new Map<string, AnalyticsTimelineRow>();
  const purchases: AnalyticsRecentPurchase[] = [];
  const recentEvents: AnalyticsRecentEvent[] = [];

  let pageViews = 0;
  let searches = 0;
  let clicks = 0;
  let cartUpdates = 0;
  let purchasesCount = 0;
  let revenue = 0;

  for (const dayKey of listDayKeys(safeRangeDays)) {
    timeline.set(dayKey, {
      day: dayKey,
      sessions: 0,
      activeSessions: 0,
      pageViews: 0,
      searches: 0,
      clicks: 0,
      purchases: 0,
      revenue: 0,
    });
  }

  for (const event of orderedEvents) {
    const occurredAtMs = new Date(event.occurredAt).getTime();
    if (Number.isNaN(occurredAtMs)) continue;

    const session = sessions.get(event.sessionId) || {
      visitorId: event.visitorId,
      firstAt: occurredAtMs,
      lastAt: occurredAtMs,
      pageViews: 0,
      searches: 0,
      clicks: 0,
      cartUpdates: 0,
      checkoutEvents: 0,
      purchases: 0,
      revenue: 0,
      deviceType: event.deviceType,
      locationLabel: buildLocationLabel({
        city: event.locationCity,
        region: event.locationRegion,
        country: event.locationCountry,
      }),
    };

    session.firstAt = Math.min(session.firstAt, occurredAtMs);
    session.lastAt = Math.max(session.lastAt, occurredAtMs);
    session.visitorId = session.visitorId || event.visitorId;
    session.deviceType = session.deviceType === 'unknown' ? event.deviceType : session.deviceType;
    if (event.locationCity || event.locationRegion || event.locationCountry) {
      session.locationLabel = buildLocationLabel({
        city: event.locationCity,
        region: event.locationRegion,
        country: event.locationCountry,
      });
    }

    const dayKey = getDayKey(event.occurredAt);
    const timelineRow = timeline.get(dayKey);

    switch (event.type) {
      case 'page_view': {
        pageViews += 1;
        session.pageViews += 1;
        topPages.set(event.pathname, {
          value: (topPages.get(event.pathname)?.value || 0) + 1,
          secondary: event.title,
        });
        if (timelineRow) timelineRow.pageViews += 1;
        break;
      }
      case 'search_submit': {
        searches += 1;
        session.searches += 1;
        const query = event.searchQuery || 'Busca sem termo';
        topSearches.set(query, {
          value: (topSearches.get(query)?.value || 0) + 1,
        });
        if (timelineRow) timelineRow.searches += 1;
        break;
      }
      case 'interaction_click': {
        clicks += 1;
        session.clicks += 1;
        const label = event.label || event.trackId || event.targetHref || event.pathname;
        topClicks.set(label, {
          value: (topClicks.get(label)?.value || 0) + 1,
          secondary: event.pathname,
        });
        if (timelineRow) timelineRow.clicks += 1;
        break;
      }
      case 'cart_update': {
        cartUpdates += 1;
        session.cartUpdates += 1;
        break;
      }
      case 'checkout_step': {
        session.checkoutEvents += 1;
        break;
      }
      case 'purchase_complete': {
        purchasesCount += 1;
        session.purchases += 1;
        session.checkoutEvents += 1;
        session.revenue += event.purchaseValue || 0;
        revenue += event.purchaseValue || 0;
        const paymentMethod = event.paymentMethod || 'Não informado';
        paymentMethods.set(paymentMethod, {
          value: (paymentMethods.get(paymentMethod)?.value || 0) + 1,
        });
        purchases.push({
          orderId: event.purchaseOrderId || 'pedido-sem-id',
          occurredAt: event.occurredAt,
          value: event.purchaseValue || 0,
          itemsCount: event.purchaseItemsCount || 0,
          paymentMethod,
          locationLabel: buildLocationLabel({
            city: event.locationCity,
            region: event.locationRegion,
            country: event.locationCountry,
          }),
        });
        if (timelineRow) {
          timelineRow.purchases += 1;
          timelineRow.revenue += event.purchaseValue || 0;
        }
        break;
      }
      default:
        break;
    }

    sessions.set(event.sessionId, session);
    recentEvents.push(formatEventLabel(event));
  }

  for (const session of sessions.values()) {
    const locationLabel = session.locationLabel || 'Local não informado';
    const dayKey = getDayKey(session.firstAt);
    const timelineRow = timeline.get(dayKey);
    if (timelineRow) {
      timelineRow.sessions += 1;
      if (dayKey === todayKey && session.lastAt >= now - activeWindowMs) {
        timelineRow.activeSessions += 1;
      }
    }

    locations.set(locationLabel, {
      value: (locations.get(locationLabel)?.value || 0) + 1,
    });
    deviceCounts.set(session.deviceType, {
      value: (deviceCounts.get(session.deviceType)?.value || 0) + 1,
    });
  }

  const sessionEntries = Array.from(sessions.values());
  const uniqueVisitors = new Set(sessionEntries.map((session) => session.visitorId).filter(Boolean)).size;
  const totalSessions = sessionEntries.length;
  const activeSessions = sessionEntries.filter((session) => session.lastAt >= now - activeWindowMs).length;
  const averageSessionMinutes = sessionEntries.length
    ? sessionEntries.reduce((sum, session) => {
        return sum + Math.max((session.lastAt - session.firstAt) / 60000, config.internal.heartbeatIntervalSeconds / 120);
      }, 0) / sessionEntries.length
    : 0;
  const checkoutSessions = sessionEntries.filter((session) => session.checkoutEvents > 0).length;
  const sessionsWithCart = sessionEntries.filter((session) => session.cartUpdates > 0).length;
  const conversionRate = totalSessions ? (purchasesCount / totalSessions) * 100 : 0;
  const cartAbandonmentRate = sessionsWithCart
    ? (sessionEntries.filter((session) => session.cartUpdates > 0 && session.purchases === 0).length / sessionsWithCart) * 100
    : 0;

  const alerts: string[] = [];
  if (!config.internal.enabled) {
    alerts.push('A coleta interna está desligada. O painel continuará disponível, mas não receberá novos dados.');
  }
  if (!config.google.enabled) {
    alerts.push('Google Tag Manager / Google Analytics ainda não foram habilitados nesta loja.');
  }
  if (!purchasesCount) {
    alerts.push('Nenhuma compra concluída entrou na janela escolhida. Vale conferir se o checkout foi exercitado no período.');
  }

  return {
    generatedAt: nowIso(),
    rangeDays: safeRangeDays,
    overview: {
      activeSessions,
      totalSessions,
      uniqueVisitors,
      averageSessionMinutes,
      pageViews,
      searches,
      clicks,
      cartUpdates,
      checkoutSessions,
      purchases: purchasesCount,
      revenue,
      averageTicket: purchasesCount ? revenue / purchasesCount : 0,
      conversionRate,
      cartAbandonmentRate,
    },
    topPages: buildTopRows(topPages),
    topSearches: buildTopRows(topSearches),
    topClicks: buildTopRows(topClicks),
    paymentMethods: buildTopRows(paymentMethods, 6),
    locations: buildTopRows(locations, 6),
    devices: buildTopRows(deviceCounts, 6),
    timeline: Array.from(timeline.values()).sort((left, right) => left.day.localeCompare(right.day)),
    recentPurchases: purchases.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)).slice(0, 10),
    recentEvents: recentEvents.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)).slice(0, 18),
    alerts,
  };
}

export async function getAnalyticsDashboard(
  rangeDays = 7,
  config = resolveRuntimeAnalyticsConfig(),
): Promise<AnalyticsDashboard> {
  const safeRangeDays = Math.min(Math.max(Math.round(rangeDays), 1), 90);
  const events = await readEventsForRange(safeRangeDays, config);
  return buildAnalyticsDashboardFromEvents(events, safeRangeDays, config);
}

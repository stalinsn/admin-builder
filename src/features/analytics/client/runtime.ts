import { safeGet, safeSet } from '@/utils/safeStorage';
import { STORAGE_KEYS } from '@/utils/storageKeys';
import {
  ANALYTICS_SESSION_COOKIE,
  ANALYTICS_SESSION_HEADER,
  ANALYTICS_VISITOR_COOKIE,
  type AnalyticsClientEventInput,
  type AnalyticsConfig,
} from '@/features/analytics/types';

type RuntimeState = {
  enabled: boolean;
  heartbeatIntervalSeconds: number;
  sessionTimeoutMinutes: number;
  maxBatchSize: number;
};

const SESSION_STORAGE_KEY = 'app_hub.analytics.session.v1';
const SESSION_LAST_SEEN_KEY = 'app_hub.analytics.session.last-seen.v1';
const COLLECT_ENDPOINT = '/api/analytics/collect';

let runtimeState: RuntimeState = {
  enabled: false,
  heartbeatIntervalSeconds: 30,
  sessionTimeoutMinutes: 30,
  maxBatchSize: 20,
};

let queue: AnalyticsClientEventInput[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function createId(prefix: string): string {
  if (!isBrowser()) return `${prefix}-${Date.now()}`;

  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (!isBrowser()) return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
}

function getSessionStorage(): Storage | null {
  if (!isBrowser()) return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getAnalyticsSessionId(): string {
  if (!isBrowser()) return 'server-session';

  const storage = getSessionStorage();
  const fromStorage = storage?.getItem(SESSION_STORAGE_KEY);
  const lastSeenRaw = storage?.getItem(SESSION_LAST_SEEN_KEY);
  const lastSeen = Number(lastSeenRaw || '0');
  const timeoutMs = runtimeState.sessionTimeoutMinutes * 60 * 1000;
  const expired = !lastSeen || Date.now() - lastSeen > timeoutMs;

  if (fromStorage && !expired) {
    storage?.setItem(SESSION_LAST_SEEN_KEY, String(Date.now()));
    writeCookie(ANALYTICS_SESSION_COOKIE, fromStorage, 60 * 60 * 8);
    return fromStorage;
  }

  const created = createId('sess');
  storage?.setItem(SESSION_STORAGE_KEY, created);
  storage?.setItem(SESSION_LAST_SEEN_KEY, String(Date.now()));
  writeCookie(ANALYTICS_SESSION_COOKIE, created, 60 * 60 * 8);
  return created;
}

export function getAnalyticsVisitorId(): string {
  if (!isBrowser()) return 'server-visitor';

  const fromStorage = safeGet(STORAGE_KEYS.analyticsVisitor);
  if (fromStorage) {
    writeCookie(ANALYTICS_VISITOR_COOKIE, fromStorage, 60 * 60 * 24 * 365);
    return fromStorage;
  }

  const created = createId('visitor');
  safeSet(STORAGE_KEYS.analyticsVisitor, created);
  writeCookie(ANALYTICS_VISITOR_COOKIE, created, 60 * 60 * 24 * 365);
  return created;
}

function clearFlushTimer(): void {
  if (!flushTimer) return;
  clearTimeout(flushTimer);
  flushTimer = null;
}

function scheduleFlush(delayMs = 2500): void {
  if (!runtimeState.enabled || !isBrowser()) return;
  clearFlushTimer();
  flushTimer = setTimeout(() => {
    void flushAnalyticsQueue('timer');
  }, delayMs);
}

function buildEnvelope(events: AnalyticsClientEventInput[]) {
  const sessionId = getAnalyticsSessionId();
  const visitorId = getAnalyticsVisitorId();

  return {
    sessionId,
    visitorId,
    events,
  };
}

async function sendPayload(events: AnalyticsClientEventInput[]): Promise<void> {
  if (!events.length || !isBrowser()) return;

  const body = JSON.stringify(buildEnvelope(events));
  const sessionId = getAnalyticsSessionId();

  if (navigator.sendBeacon && body.length < 60_000) {
    const blob = new Blob([body], { type: 'application/json' });
    const ok = navigator.sendBeacon(COLLECT_ENDPOINT, blob);
    if (ok) return;
  }

  await fetch(COLLECT_ENDPOINT, {
    method: 'POST',
    credentials: 'same-origin',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      [ANALYTICS_SESSION_HEADER]: sessionId,
    },
    body,
  }).catch(() => undefined);
}

export async function flushAnalyticsQueue(_reason = 'manual'): Promise<void> {
  if (!runtimeState.enabled || !queue.length) return;

  clearFlushTimer();
  const batch = queue.slice(0, runtimeState.maxBatchSize);
  queue = queue.slice(batch.length);
  await sendPayload(batch);

  if (queue.length) {
    scheduleFlush(400);
  }
}

export function initStorefrontAnalytics(config: AnalyticsConfig): void {
  runtimeState = {
    enabled: config.internal.enabled,
    heartbeatIntervalSeconds: config.internal.heartbeatIntervalSeconds,
    sessionTimeoutMinutes: config.internal.sessionTimeoutMinutes,
    maxBatchSize: config.internal.maxBatchSize,
  };

  if (!runtimeState.enabled || !isBrowser()) return;
  getAnalyticsSessionId();
  getAnalyticsVisitorId();
}

export function getAnalyticsHeartbeatIntervalMs(): number {
  return runtimeState.heartbeatIntervalSeconds * 1000;
}

export function isInternalAnalyticsEnabled(): boolean {
  return runtimeState.enabled;
}

export function trackStorefrontEvent(event: AnalyticsClientEventInput): void {
  if (!runtimeState.enabled || !isBrowser()) return;

  queue.push({
    ...event,
    occurredAt: event.occurredAt || new Date().toISOString(),
    pathname: event.pathname || window.location.pathname,
    search: event.search ?? window.location.search,
    referrer: event.referrer ?? document.referrer,
  });

  if (queue.length >= runtimeState.maxBatchSize || event.type === 'page_view' || event.type === 'search_submit') {
    void flushAnalyticsQueue(event.type);
    return;
  }

  scheduleFlush();
}

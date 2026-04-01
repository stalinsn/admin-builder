import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

import { resolvePostgresRuntime } from '@/features/ecommpanel/server/postgresRuntime';
import {
  getPanelSettingFromDatabase,
  upsertPanelSettingInDatabase,
} from '@/features/ecommpanel/server/panelSettingsDatabaseStore';
import {
  ANALYTICS_SCHEMA_VERSION,
  type AnalyticsConfig,
  type RuntimeAnalyticsConfigSnapshot,
} from '@/features/analytics/types';

type AnalyticsConfigCache = {
  config: AnalyticsConfig;
  loaded: boolean;
};

type PanelSettingsPersistenceMode = 'files' | 'hybrid' | 'database';

const ADMIN_ROOT = path.join(process.cwd(), 'src/data/ecommpanel/analytics');
const ADMIN_CONFIG_FILE = path.join(ADMIN_ROOT, 'config.json');
const RUNTIME_FILE_NAME = 'config.published.json';
const ANALYTICS_CONFIG_KEY = 'analytics-config';

declare global {
  var __APP_HUB_ANALYTICS_CONFIG_CACHE__: AnalyticsConfigCache | undefined;
  var __PANEL_SETTINGS_DB_FILE_SEEDED_KEYS__: Set<string> | undefined;
  var __APP_HUB_ANALYTICS_RUNTIME_CACHE__:
    | {
        filePath: string;
        mtimeMs: number;
        snapshot: RuntimeAnalyticsConfigSnapshot | null;
      }
    | undefined;
}

function nowIso(): string {
  return new Date().toISOString();
}

function getPanelSettingsPersistenceMode(): PanelSettingsPersistenceMode {
  const value = process.env.ECOM_PANEL_SETTINGS_PERSISTENCE_MODE?.trim().toLowerCase();
  if (value === 'files') return 'files';
  if (value === 'database') return 'database';
  return 'hybrid';
}

function requireDatabaseValue<T>(
  result: { available: true; value: T } | { available: false },
  action: string,
): T {
  if (!result.available) {
    throw new Error(`Configurações do painel em modo database exigem PostgreSQL disponível para ${action}.`);
  }

  return result.value;
}

function getRuntimeRoot(): string {
  const envPath = process.env.ECOM_CONTENT_PATH?.trim();
  const base = envPath ? path.resolve(envPath) : path.join(process.cwd(), 'src/data/site-runtime');
  return path.join(base, 'analytics');
}

function getRuntimeFilePath(): string {
  return path.join(getRuntimeRoot(), RUNTIME_FILE_NAME);
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
  const payload = JSON.stringify(value, null, 2);
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpPath, payload, 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

export function createDefaultAnalyticsConfig(): AnalyticsConfig {
  return {
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    updatedAt: nowIso(),
    internal: {
      enabled: true,
      heartbeatIntervalSeconds: 30,
      activeWindowMinutes: 5,
      sessionTimeoutMinutes: 30,
      retainDays: 90,
      maxBatchSize: 20,
    },
    google: {
      enabled: false,
      gtmEnabled: false,
      gtmContainerId: '',
      gaEnabled: false,
      gaMeasurementId: '',
      dataLayerName: 'dataLayer',
      sendPageView: true,
    },
  };
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizePositiveInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.round(parsed), min), max);
}

function normalizeString(value: unknown, fallback = '', maxLength = 120): string {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, maxLength);
}

function normalizeGtmId(value: unknown): string {
  const normalized = normalizeString(value, '', 32).toUpperCase();
  return /^GTM-[A-Z0-9]+$/.test(normalized) ? normalized : '';
}

function normalizeGaId(value: unknown): string {
  const normalized = normalizeString(value, '', 32).toUpperCase();
  return /^G-[A-Z0-9]+$/.test(normalized) ? normalized : '';
}

export function normalizeAnalyticsConfig(input: unknown): AnalyticsConfig {
  const fallback = createDefaultAnalyticsConfig();
  const source = (input && typeof input === 'object' ? input : {}) as Partial<AnalyticsConfig> & {
    internal?: Partial<AnalyticsConfig['internal']>;
    google?: Partial<AnalyticsConfig['google']>;
  };

  const internal = (source.internal || {}) as Partial<AnalyticsConfig['internal']>;
  const google = (source.google || {}) as Partial<AnalyticsConfig['google']>;

  const normalized: AnalyticsConfig = {
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    updatedAt: normalizeString(source.updatedAt, fallback.updatedAt, 64) || fallback.updatedAt,
    internal: {
      enabled: normalizeBoolean(internal.enabled, fallback.internal.enabled),
      heartbeatIntervalSeconds: normalizePositiveInteger(
        internal.heartbeatIntervalSeconds,
        fallback.internal.heartbeatIntervalSeconds,
        10,
        300,
      ),
      activeWindowMinutes: normalizePositiveInteger(internal.activeWindowMinutes, fallback.internal.activeWindowMinutes, 1, 30),
      sessionTimeoutMinutes: normalizePositiveInteger(
        internal.sessionTimeoutMinutes,
        fallback.internal.sessionTimeoutMinutes,
        5,
        120,
      ),
      retainDays: normalizePositiveInteger(internal.retainDays, fallback.internal.retainDays, 7, 365),
      maxBatchSize: normalizePositiveInteger(internal.maxBatchSize, fallback.internal.maxBatchSize, 1, 100),
    },
    google: {
      enabled: normalizeBoolean(google.enabled, fallback.google.enabled),
      gtmEnabled: normalizeBoolean(google.gtmEnabled, fallback.google.gtmEnabled),
      gtmContainerId: normalizeGtmId(google.gtmContainerId),
      gaEnabled: normalizeBoolean(google.gaEnabled, fallback.google.gaEnabled),
      gaMeasurementId: normalizeGaId(google.gaMeasurementId),
      dataLayerName: normalizeString(google.dataLayerName, fallback.google.dataLayerName, 40).replace(/[^A-Za-z0-9_]/g, '') || fallback.google.dataLayerName,
      sendPageView: normalizeBoolean(google.sendPageView, fallback.google.sendPageView),
    },
  };

  if (!normalized.google.gtmContainerId) {
    normalized.google.gtmEnabled = false;
  }
  if (!normalized.google.gaMeasurementId) {
    normalized.google.gaEnabled = false;
  }
  if (!normalized.google.gtmEnabled && !normalized.google.gaEnabled) {
    normalized.google.enabled = false;
  }

  return normalized;
}

function getConfigCache(): AnalyticsConfigCache {
  if (!global.__APP_HUB_ANALYTICS_CONFIG_CACHE__) {
    global.__APP_HUB_ANALYTICS_CONFIG_CACHE__ = {
      config: createDefaultAnalyticsConfig(),
      loaded: false,
    };
  }

  return global.__APP_HUB_ANALYTICS_CONFIG_CACHE__;
}

function publishRuntimeConfig(config: AnalyticsConfig): RuntimeAnalyticsConfigSnapshot {
  const snapshot: RuntimeAnalyticsConfigSnapshot = {
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    generatedAt: nowIso(),
    config,
  };
  const filePath = getRuntimeFilePath();
  writeJsonAtomic(filePath, snapshot);
  global.__APP_HUB_ANALYTICS_RUNTIME_CACHE__ = {
    filePath,
    mtimeMs: fs.statSync(filePath).mtimeMs,
    snapshot,
  };
  return snapshot;
}

function loadConfig(): void {
  const cache = getConfigCache();
  if (cache.loaded) return;

  cache.loaded = true;
  cache.config = normalizeAnalyticsConfig(readJsonFile<AnalyticsConfig>(ADMIN_CONFIG_FILE));
  writeJsonAtomic(ADMIN_CONFIG_FILE, cache.config);
  publishRuntimeConfig(cache.config);
}

export function getAnalyticsConfig(): AnalyticsConfig {
  loadConfig();
  return normalizeAnalyticsConfig(getConfigCache().config);
}

export function updateAnalyticsConfig(input: unknown): AnalyticsConfig {
  loadConfig();
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const normalized = normalizeAnalyticsConfig({
    ...source,
    updatedAt: nowIso(),
  });
  const cache = getConfigCache();
  cache.config = normalized;
  writeJsonAtomic(ADMIN_CONFIG_FILE, normalized);
  publishRuntimeConfig(normalized);
  return normalized;
}

async function seedAnalyticsConfigDatabaseFromFilesIfNeeded(): Promise<void> {
  if (getPanelSettingsPersistenceMode() !== 'hybrid') return;

  const runtime = resolvePostgresRuntime();
  if (!runtime) return;

  const seededKeys = global.__PANEL_SETTINGS_DB_FILE_SEEDED_KEYS__ || new Set<string>();
  global.__PANEL_SETTINGS_DB_FILE_SEEDED_KEYS__ = seededKeys;
  const registryKey = `${runtime.key}:${ANALYTICS_CONFIG_KEY}`;
  if (seededKeys.has(registryKey)) return;

  const current = await getPanelSettingFromDatabase<AnalyticsConfig>(ANALYTICS_CONFIG_KEY);
  if (!current.available) return;

  if (current.value) {
    seededKeys.add(registryKey);
    return;
  }

  await upsertPanelSettingInDatabase(ANALYTICS_CONFIG_KEY, getAnalyticsConfig());
  seededKeys.add(registryKey);
}

export async function getAnalyticsConfigRuntime(): Promise<AnalyticsConfig> {
  const mode = getPanelSettingsPersistenceMode();
  if (mode === 'files') return getAnalyticsConfig();

  await seedAnalyticsConfigDatabaseFromFilesIfNeeded();
  const result = await getPanelSettingFromDatabase<AnalyticsConfig>(ANALYTICS_CONFIG_KEY);
  if (mode === 'database') {
    const config = normalizeAnalyticsConfig(
      requireDatabaseValue(result, 'ler configuracoes de analytics') || createDefaultAnalyticsConfig(),
    );
    publishRuntimeConfig(config);
    return config;
  }

  const config = result.available && result.value ? normalizeAnalyticsConfig(result.value) : getAnalyticsConfig();
  publishRuntimeConfig(config);
  return config;
}

export async function updateAnalyticsConfigRuntime(input: unknown): Promise<AnalyticsConfig> {
  const mode = getPanelSettingsPersistenceMode();
  if (mode === 'files') return updateAnalyticsConfig(input);

  const normalized = normalizeAnalyticsConfig({
    ...(input && typeof input === 'object' ? input : {}),
    updatedAt: nowIso(),
  });

  if (mode === 'database') {
    const result = await upsertPanelSettingInDatabase(ANALYTICS_CONFIG_KEY, normalized);
    const config = normalizeAnalyticsConfig(requireDatabaseValue(result, 'salvar configuracoes de analytics'));
    publishRuntimeConfig(config);
    return config;
  }

  const config = updateAnalyticsConfig(normalized);
  await upsertPanelSettingInDatabase(ANALYTICS_CONFIG_KEY, config);
  return config;
}

export function readPublishedRuntimeAnalyticsConfig(): RuntimeAnalyticsConfigSnapshot | null {
  const filePath = getRuntimeFilePath();
  if (!fs.existsSync(filePath)) return null;

  const stat = fs.statSync(filePath);
  const cached = global.__APP_HUB_ANALYTICS_RUNTIME_CACHE__;
  if (cached && cached.filePath === filePath && cached.mtimeMs === stat.mtimeMs) {
    return cached.snapshot;
  }

  const snapshot = readJsonFile<RuntimeAnalyticsConfigSnapshot>(filePath);
  const normalizedSnapshot = snapshot
    ? {
        schemaVersion: ANALYTICS_SCHEMA_VERSION,
        generatedAt: normalizeString(snapshot.generatedAt, nowIso(), 64) || nowIso(),
        config: normalizeAnalyticsConfig(snapshot.config),
      }
    : null;

  global.__APP_HUB_ANALYTICS_RUNTIME_CACHE__ = {
    filePath,
    mtimeMs: stat.mtimeMs,
    snapshot: normalizedSnapshot,
  };
  return normalizedSnapshot;
}

export function resolveRuntimeAnalyticsConfig(): AnalyticsConfig {
  const snapshot = readPublishedRuntimeAnalyticsConfig();
  if (!snapshot?.config) {
    return createDefaultAnalyticsConfig();
  }
  return normalizeAnalyticsConfig(snapshot.config);
}

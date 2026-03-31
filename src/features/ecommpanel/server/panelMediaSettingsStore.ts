import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

import { resolvePostgresRuntime } from '@/features/ecommpanel/server/postgresRuntime';
import {
  getPanelSettingFromDatabase,
  upsertPanelSettingInDatabase,
} from '@/features/ecommpanel/server/panelSettingsDatabaseStore';
import {
  PANEL_MEDIA_PRESET_KEYS,
  PANEL_MEDIA_SETTINGS_SCHEMA_VERSION,
  type PanelMediaFit,
  type PanelMediaFormat,
  type PanelMediaPreset,
  type PanelMediaPresetKey,
  type PanelMediaSettings,
  type PanelMediaSettingsDiagnostics,
} from '@/features/ecommpanel/types/panelMediaSettings';

type PanelMediaSettingsCache = {
  loaded: boolean;
  settings: PanelMediaSettings;
};

type PanelSettingsPersistenceMode = 'files' | 'hybrid' | 'database';

const ROOT_DIR = path.join(process.cwd(), 'src/data/ecommpanel/panel-settings');
const SETTINGS_FILE = path.join(ROOT_DIR, 'media.json');
const PANEL_MEDIA_SETTINGS_KEY = 'panel-media-settings';

declare global {
  var __ECOMMPANEL_MEDIA_SETTINGS_CACHE__: PanelMediaSettingsCache | undefined;
  var __PANEL_MEDIA_SETTINGS_DB_FILE_SEEDED_KEYS__: Set<string> | undefined;
}

function nowIso(): string {
  return new Date().toISOString();
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
  const tmpFile = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpFile, payload, 'utf-8');
  fs.renameSync(tmpFile, filePath);
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeString(value: unknown, fallback = '', maxLength = 200): string {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, maxLength);
}

function normalizeInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.round(parsed), min), max);
}

function normalizeMimeTypes(value: unknown): string[] {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!Array.isArray(value)) return allowed;
  const items = value
    .map((item) => normalizeString(item, '', 40).toLowerCase())
    .filter((item) => allowed.includes(item));
  return Array.from(new Set(items.length ? items : allowed));
}

function normalizeFormat(value: unknown, fallback: PanelMediaFormat): PanelMediaFormat {
  return value === 'jpeg' || value === 'png' ? value : fallback;
}

function normalizeFit(value: unknown, fallback: PanelMediaFit): PanelMediaFit {
  return value === 'cover' ? 'cover' : fallback;
}

function normalizeColor(value: unknown, fallback = '#ffffff'): string {
  const normalized = normalizeString(value, fallback, 20).toLowerCase();
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/.test(normalized) ? normalized : fallback;
}

function createPreset(overrides: Partial<PanelMediaPreset>): PanelMediaPreset {
  return {
    enabled: overrides.enabled ?? true,
    maxWidth: overrides.maxWidth ?? 800,
    maxHeight: overrides.maxHeight ?? 800,
    format: overrides.format ?? 'webp',
    quality: overrides.quality ?? 82,
    fit: overrides.fit ?? 'inside',
    background: overrides.background ?? '#ffffff',
  };
}

export function createDefaultPanelMediaSettings(): PanelMediaSettings {
  return {
    schemaVersion: PANEL_MEDIA_SETTINGS_SCHEMA_VERSION,
    updatedAt: nowIso(),
    upload: {
      maxFileSizeMb: 32,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    },
    storage: {
      publicBasePath: '/ecommpanel-media',
    },
    presets: {
      productPdp: createPreset({ maxWidth: 800, maxHeight: 800, quality: 84 }),
      productThumb: createPreset({ maxWidth: 300, maxHeight: 300, quality: 80, fit: 'cover' }),
      productZoom: createPreset({ maxWidth: 1600, maxHeight: 1600, quality: 86 }),
      contentCard: createPreset({ maxWidth: 720, maxHeight: 720, quality: 82 }),
      contentHero: createPreset({ maxWidth: 1600, maxHeight: 900, quality: 84, fit: 'inside' }),
    },
  };
}

function getPanelSettingsPersistenceMode(): PanelSettingsPersistenceMode {
  const value = process.env.ECOM_PANEL_SETTINGS_PERSISTENCE_MODE?.trim().toLowerCase();
  if (value === 'files') return 'files';
  if (value === 'database') return 'database';
  return 'hybrid';
}

function requireDatabaseValue<T>(result: { available: true; value: T } | { available: false }, action: string): T {
  if (!result.available) {
    throw new Error(`Configurações de mídia em modo database exigem PostgreSQL disponível para ${action}.`);
  }

  return result.value;
}

function normalizePreset(input: unknown, fallback: PanelMediaPreset): PanelMediaPreset {
  const source = input && typeof input === 'object' ? (input as Partial<PanelMediaPreset>) : {};
  return {
    enabled: normalizeBoolean(source.enabled, fallback.enabled),
    maxWidth: normalizeInteger(source.maxWidth, fallback.maxWidth, 64, 4096),
    maxHeight: normalizeInteger(source.maxHeight, fallback.maxHeight, 64, 4096),
    format: normalizeFormat(source.format, fallback.format),
    quality: normalizeInteger(source.quality, fallback.quality, 40, 95),
    fit: normalizeFit(source.fit, fallback.fit),
    background: normalizeColor(source.background, fallback.background),
  };
}

export function normalizePanelMediaSettings(input: unknown): PanelMediaSettings {
  const fallback = createDefaultPanelMediaSettings();
  const source = (input && typeof input === 'object' ? input : {}) as Partial<PanelMediaSettings> & {
    upload?: Partial<PanelMediaSettings['upload']>;
    storage?: Partial<PanelMediaSettings['storage']>;
    presets?: Partial<Record<PanelMediaPresetKey, Partial<PanelMediaPreset>>>;
  };

  const presets = PANEL_MEDIA_PRESET_KEYS.reduce<Record<PanelMediaPresetKey, PanelMediaPreset>>((acc, key) => {
    acc[key] = normalizePreset(source.presets?.[key], fallback.presets[key]);
    return acc;
  }, {} as Record<PanelMediaPresetKey, PanelMediaPreset>);

  return {
    schemaVersion: PANEL_MEDIA_SETTINGS_SCHEMA_VERSION,
    updatedAt: normalizeString(source.updatedAt, fallback.updatedAt, 64) || fallback.updatedAt,
    upload: {
      maxFileSizeMb: normalizeInteger(source.upload?.maxFileSizeMb, fallback.upload.maxFileSizeMb, 1, 128),
      allowedMimeTypes: normalizeMimeTypes(source.upload?.allowedMimeTypes),
    },
    storage: {
      publicBasePath: normalizeString(source.storage?.publicBasePath, fallback.storage.publicBasePath, 80) || '/ecommpanel-media',
    },
    presets,
  };
}

function getCache(): PanelMediaSettingsCache {
  if (!global.__ECOMMPANEL_MEDIA_SETTINGS_CACHE__) {
    global.__ECOMMPANEL_MEDIA_SETTINGS_CACHE__ = {
      loaded: false,
      settings: createDefaultPanelMediaSettings(),
    };
  }

  return global.__ECOMMPANEL_MEDIA_SETTINGS_CACHE__;
}

function loadSettings(): void {
  const cache = getCache();
  if (cache.loaded) return;

  cache.loaded = true;
  cache.settings = normalizePanelMediaSettings(readJsonFile<PanelMediaSettings>(SETTINGS_FILE));
  writeJsonAtomic(SETTINGS_FILE, cache.settings);
}

export function getPanelMediaSettings(): PanelMediaSettings {
  loadSettings();
  return normalizePanelMediaSettings(getCache().settings);
}

export function updatePanelMediaSettings(input: unknown): PanelMediaSettings {
  loadSettings();
  const normalized = normalizePanelMediaSettings({
    ...(input && typeof input === 'object' ? input : {}),
    updatedAt: nowIso(),
  });
  const cache = getCache();
  cache.settings = normalized;
  writeJsonAtomic(SETTINGS_FILE, normalized);
  return normalized;
}

export function getPanelMediaSettingsDiagnostics(
  settings = getPanelMediaSettings(),
): PanelMediaSettingsDiagnostics {
  const enabledPresets = PANEL_MEDIA_PRESET_KEYS.filter((key) => settings.presets[key].enabled);
  return {
    uploadEnabled: settings.upload.maxFileSizeMb > 0 && enabledPresets.length > 0,
    maxFileSizeMb: settings.upload.maxFileSizeMb,
    allowedMimeTypes: settings.upload.allowedMimeTypes,
    publicBasePath: settings.storage.publicBasePath,
    enabledPresets,
  };
}

async function seedPanelMediaSettingsDatabaseFromFilesIfNeeded(): Promise<void> {
  if (getPanelSettingsPersistenceMode() !== 'hybrid') return;

  const runtime = resolvePostgresRuntime();
  if (!runtime) return;

  const seededKeys = global.__PANEL_MEDIA_SETTINGS_DB_FILE_SEEDED_KEYS__ || new Set<string>();
  global.__PANEL_MEDIA_SETTINGS_DB_FILE_SEEDED_KEYS__ = seededKeys;
  const registryKey = `${runtime.key}:${PANEL_MEDIA_SETTINGS_KEY}`;
  if (seededKeys.has(registryKey)) return;

  const current = await getPanelSettingFromDatabase<PanelMediaSettings>(PANEL_MEDIA_SETTINGS_KEY);
  if (!current.available) return;
  if (current.value) {
    seededKeys.add(registryKey);
    return;
  }

  await upsertPanelSettingInDatabase(PANEL_MEDIA_SETTINGS_KEY, getPanelMediaSettings());
  seededKeys.add(registryKey);
}

export async function getPanelMediaSettingsRuntime(): Promise<PanelMediaSettings> {
  const mode = getPanelSettingsPersistenceMode();
  if (mode === 'files') return getPanelMediaSettings();

  await seedPanelMediaSettingsDatabaseFromFilesIfNeeded();
  const result = await getPanelSettingFromDatabase<PanelMediaSettings>(PANEL_MEDIA_SETTINGS_KEY);
  if (mode === 'database') {
    return normalizePanelMediaSettings(
      requireDatabaseValue(result, 'ler configuracoes de mídia') || createDefaultPanelMediaSettings(),
    );
  }

  return result.available && result.value ? normalizePanelMediaSettings(result.value) : getPanelMediaSettings();
}

export async function updatePanelMediaSettingsRuntime(input: unknown): Promise<PanelMediaSettings> {
  const mode = getPanelSettingsPersistenceMode();
  if (mode === 'files') return updatePanelMediaSettings(input);

  const normalized = normalizePanelMediaSettings({
    ...(input && typeof input === 'object' ? input : {}),
    updatedAt: nowIso(),
  });

  if (mode === 'database') {
    const result = await upsertPanelSettingInDatabase(PANEL_MEDIA_SETTINGS_KEY, normalized);
    return normalizePanelMediaSettings(requireDatabaseValue(result, 'salvar configuracoes de mídia'));
  }

  const settings = updatePanelMediaSettings(normalized);
  await upsertPanelSettingInDatabase(PANEL_MEDIA_SETTINGS_KEY, settings);
  return settings;
}

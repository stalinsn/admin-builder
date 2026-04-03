import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

import type { DataStudioSnapshot } from '@/features/ecommpanel/types/dataStudio';

type AccountWorkspaceMode = 'native' | 'entity';

export type AdminBuilderSettings = {
  schemaVersion: number;
  updatedAt: string;
  accountWorkspace: {
    mode: AccountWorkspaceMode;
    entitySlug: string;
  };
  recordsWorkspace: {
    visibleColumnsByEntity: Record<string, string[]>;
  };
};

const ROOT_DIR = path.join(process.cwd(), 'src/data/ecommpanel/panel-settings');
const SETTINGS_FILE = path.join(ROOT_DIR, 'admin-builder.json');
const SCHEMA_VERSION = 2;

declare global {
  var __ADMIN_BUILDER_SETTINGS_CACHE__:
    | {
        loaded: boolean;
        settings: AdminBuilderSettings;
      }
    | undefined;
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

function normalizeString(value: unknown, fallback = '', maxLength = 160): string {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, maxLength);
}

export function createDefaultAdminBuilderSettings(): AdminBuilderSettings {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: nowIso(),
    accountWorkspace: {
      mode: 'native',
      entitySlug: '',
    },
    recordsWorkspace: {
      visibleColumnsByEntity: {},
    },
  };
}

export function normalizeAdminBuilderSettings(
  input: unknown,
  snapshot?: DataStudioSnapshot | null,
): AdminBuilderSettings {
  const fallback = createDefaultAdminBuilderSettings();
  const source = (input && typeof input === 'object' ? input : {}) as Partial<AdminBuilderSettings> & {
    accountWorkspace?: Partial<AdminBuilderSettings['accountWorkspace']>;
    recordsWorkspace?: Partial<AdminBuilderSettings['recordsWorkspace']>;
  };
  const accountWorkspace: Partial<AdminBuilderSettings['accountWorkspace']> = source.accountWorkspace ?? {};
  const recordsWorkspace: Partial<AdminBuilderSettings['recordsWorkspace']> = source.recordsWorkspace ?? {};
  const requestedMode = accountWorkspace.mode === 'entity' ? 'entity' : 'native';
  const requestedSlug = normalizeString(accountWorkspace.entitySlug, '');
  const availableSlugs = new Set((snapshot?.entities || []).map((entity) => entity.slug));
  const hasRequestedEntity = requestedSlug && availableSlugs.has(requestedSlug);
  const firstEntitySlug = snapshot?.entities[0]?.slug || '';
  const visibleColumnsByEntity = Object.fromEntries(
    Object.entries(recordsWorkspace.visibleColumnsByEntity || {})
      .filter(([entitySlug]) => !snapshot || availableSlugs.has(entitySlug))
      .map(([entitySlug, columns]) => [
        entitySlug,
        Array.isArray(columns)
          ? columns
              .filter((column): column is string => typeof column === 'string' && column.trim().length > 0)
              .map((column) => column.trim())
              .slice(0, 12)
          : [],
      ])
      .filter(([, columns]) => columns.length > 0),
  );

  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: normalizeString(source.updatedAt, fallback.updatedAt, 64) || fallback.updatedAt,
    accountWorkspace: {
      mode: requestedMode === 'entity' && (hasRequestedEntity || firstEntitySlug) ? 'entity' : 'native',
      entitySlug: hasRequestedEntity ? requestedSlug : requestedMode === 'entity' ? firstEntitySlug : '',
    },
    recordsWorkspace: {
      visibleColumnsByEntity,
    },
  };
}

function getCache() {
  if (!global.__ADMIN_BUILDER_SETTINGS_CACHE__) {
    global.__ADMIN_BUILDER_SETTINGS_CACHE__ = {
      loaded: false,
      settings: createDefaultAdminBuilderSettings(),
    };
  }

  return global.__ADMIN_BUILDER_SETTINGS_CACHE__;
}

function loadSettings(snapshot?: DataStudioSnapshot | null) {
  const cache = getCache();
  if (cache.loaded) {
    cache.settings = normalizeAdminBuilderSettings(cache.settings, snapshot);
    return;
  }

  cache.loaded = true;
  cache.settings = normalizeAdminBuilderSettings(readJsonFile<AdminBuilderSettings>(SETTINGS_FILE), snapshot);
  writeJsonAtomic(SETTINGS_FILE, cache.settings);
}

export function getAdminBuilderSettings(snapshot?: DataStudioSnapshot | null): AdminBuilderSettings {
  loadSettings(snapshot);
  return normalizeAdminBuilderSettings(getCache().settings, snapshot);
}

export function updateAdminBuilderSettings(
  input: unknown,
  snapshot?: DataStudioSnapshot | null,
): AdminBuilderSettings {
  loadSettings(snapshot);
  const cache = getCache();
  const partial = input && typeof input === 'object' ? input : {};
  const normalized = normalizeAdminBuilderSettings(
    {
      ...cache.settings,
      ...partial,
      accountWorkspace: {
        ...cache.settings.accountWorkspace,
        ...((partial as { accountWorkspace?: Partial<AdminBuilderSettings['accountWorkspace']> }).accountWorkspace || {}),
      },
      recordsWorkspace: {
        ...cache.settings.recordsWorkspace,
        ...((partial as { recordsWorkspace?: Partial<AdminBuilderSettings['recordsWorkspace']> }).recordsWorkspace || {}),
      },
      updatedAt: nowIso(),
    },
    snapshot,
  );
  cache.settings = normalized;
  writeJsonAtomic(SETTINGS_FILE, normalized);
  return normalized;
}

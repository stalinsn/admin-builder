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
    entityListFieldNames: Record<string, string[]>;
  };
};

const ROOT_DIR = path.join(process.cwd(), 'src/data/ecommpanel/panel-settings');
const SETTINGS_FILE = path.join(ROOT_DIR, 'admin-builder.json');
const SCHEMA_VERSION = 1;

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
      entityListFieldNames: {},
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
  };
  const accountWorkspace: Partial<AdminBuilderSettings['accountWorkspace']> = source.accountWorkspace ?? {};
  const requestedMode = accountWorkspace.mode === 'entity' ? 'entity' : 'native';
  const requestedSlug = normalizeString(accountWorkspace.entitySlug, '');
  const availableSlugs = new Set((snapshot?.entities || []).map((entity) => entity.slug));
  const hasRequestedEntity = requestedSlug && availableSlugs.has(requestedSlug);
  const firstEntitySlug = snapshot?.entities[0]?.slug || '';
  const rawFieldMap =
    accountWorkspace.entityListFieldNames && typeof accountWorkspace.entityListFieldNames === 'object'
      ? accountWorkspace.entityListFieldNames
      : {};
  const entityListFieldNames = Object.fromEntries(
    Object.entries(rawFieldMap).flatMap(([entitySlug, fieldNames]) => {
      if (!availableSlugs.has(entitySlug) || !Array.isArray(fieldNames)) return [];
      const entity = snapshot?.entities.find((currentEntity) => currentEntity.slug === entitySlug);
      if (!entity) return [];
      const allowedFieldNames = new Set(entity.fields.map((field) => field.name));
      const normalizedFieldNames = fieldNames
        .map((fieldName) => normalizeString(fieldName, '', 160))
        .filter((fieldName) => fieldName && allowedFieldNames.has(fieldName));
      return [[entitySlug, Array.from(new Set(normalizedFieldNames)).slice(0, 8)]];
    }),
  );

  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: normalizeString(source.updatedAt, fallback.updatedAt, 64) || fallback.updatedAt,
    accountWorkspace: {
      mode: requestedMode === 'entity' && (hasRequestedEntity || firstEntitySlug) ? 'entity' : 'native',
      entitySlug: hasRequestedEntity ? requestedSlug : requestedMode === 'entity' ? firstEntitySlug : '',
      entityListFieldNames,
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
  const normalized = normalizeAdminBuilderSettings(
    {
      ...(input && typeof input === 'object' ? input : {}),
      updatedAt: nowIso(),
    },
    snapshot,
  );
  const cache = getCache();
  cache.settings = normalized;
  writeJsonAtomic(SETTINGS_FILE, normalized);
  return normalized;
}

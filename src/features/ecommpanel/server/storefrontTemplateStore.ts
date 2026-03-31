import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

import {
  type StorefrontTemplate,
  createDefaultStorefrontTemplate,
  normalizeStorefrontTemplate,
} from '@/features/site-runtime/storefrontTemplate';
import { publishRuntimeStorefrontTemplate } from '@/features/site-runtime/server/publishedTemplateStore';
import { resolvePostgresRuntime } from '@/features/ecommpanel/server/postgresRuntime';
import { nowIso } from './crypto';
import {
  getStorefrontTemplateFromDatabase,
  upsertStorefrontTemplateInDatabase,
} from './storefrontTemplateDatabaseStore';

type StorefrontTemplateDb = {
  template: StorefrontTemplate;
  loaded: boolean;
};

type StorefrontTemplateMetaDocument = Pick<StorefrontTemplate, 'schemaVersion' | 'updatedAt' | 'brandName'>;
type StorefrontPersistenceMode = 'files' | 'hybrid' | 'database';

const LEGACY_DATA_FILE = path.join(process.cwd(), 'src/data/ecommpanel/storefront-template.json');
const STOREFRONT_DATA_DIR = path.join(process.cwd(), 'src/data/ecommpanel/storefront');
const META_FILE = path.join(STOREFRONT_DATA_DIR, 'meta.json');
const THEME_FILE = path.join(STOREFRONT_DATA_DIR, 'theme.json');
const HEADER_FILE = path.join(STOREFRONT_DATA_DIR, 'header.json');
const HOME_FILE = path.join(STOREFRONT_DATA_DIR, 'home.json');
const FOOTER_FILE = path.join(STOREFRONT_DATA_DIR, 'footer.json');

declare global {
  var __ECOMMPANEL_STOREFRONT_TEMPLATE_DB__: StorefrontTemplateDb | undefined;
  var __STOREFRONT_TEMPLATE_DB_FILE_SEEDED_KEYS__: Set<string> | undefined;
}

function getDb(): StorefrontTemplateDb {
  if (!global.__ECOMMPANEL_STOREFRONT_TEMPLATE_DB__) {
    global.__ECOMMPANEL_STOREFRONT_TEMPLATE_DB__ = {
      template: createDefaultStorefrontTemplate(),
      loaded: false,
    };
  }

  return global.__ECOMMPANEL_STOREFRONT_TEMPLATE_DB__;
}

function ensureDataDir(): void {
  fs.mkdirSync(STOREFRONT_DATA_DIR, { recursive: true });
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
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

function saveDb(): void {
  const db = getDb();
  const normalized = normalizeStorefrontTemplate(db.template);
  ensureDataDir();

  const meta: StorefrontTemplateMetaDocument = {
    schemaVersion: normalized.schemaVersion,
    updatedAt: normalized.updatedAt,
    brandName: normalized.brandName,
  };

  writeJsonAtomic(META_FILE, meta);
  writeJsonAtomic(THEME_FILE, normalized.theme);
  writeJsonAtomic(HEADER_FILE, normalized.header);
  writeJsonAtomic(HOME_FILE, normalized.home);
  writeJsonAtomic(FOOTER_FILE, normalized.footer);
  writeJsonAtomic(LEGACY_DATA_FILE, normalized);

  publishRuntimeStorefrontTemplate(normalized);
}

function getStorefrontPersistenceMode(): StorefrontPersistenceMode {
  const value = process.env.ECOM_STOREFRONT_PERSISTENCE_MODE?.trim().toLowerCase();
  if (value === 'files') return 'files';
  if (value === 'database') return 'database';
  return 'hybrid';
}

function requireDatabaseValue<T>(
  result: { available: true; value: T } | { available: false },
  action: string,
): T {
  if (!result.available) {
    throw new Error(`Storefront em modo database exige PostgreSQL disponível para ${action}.`);
  }

  return result.value;
}

async function seedStorefrontTemplateDatabaseFromFilesIfNeeded(): Promise<void> {
  if (getStorefrontPersistenceMode() !== 'hybrid') return;

  const runtime = resolvePostgresRuntime();
  if (!runtime) return;

  const seededKeys = global.__STOREFRONT_TEMPLATE_DB_FILE_SEEDED_KEYS__ || new Set<string>();
  global.__STOREFRONT_TEMPLATE_DB_FILE_SEEDED_KEYS__ = seededKeys;
  if (seededKeys.has(runtime.key)) return;

  const current = await getStorefrontTemplateFromDatabase();
  if (!current.available) return;

  if (current.value) {
    seededKeys.add(runtime.key);
    return;
  }

  await upsertStorefrontTemplateInDatabase(getStorefrontTemplate());
  seededKeys.add(runtime.key);
}

async function syncStorefrontRuntimeProjectionFromDatabase(): Promise<void> {
  const result = await getStorefrontTemplateFromDatabase();
  if (!result.available || !result.value) return;
  publishRuntimeStorefrontTemplate(result.value);
}

function loadFromSplitFiles(): StorefrontTemplate | null {
  const fallback = createDefaultStorefrontTemplate();
  const meta = readJsonFile<Partial<StorefrontTemplateMetaDocument>>(META_FILE);
  const theme = readJsonFile<StorefrontTemplate['theme']>(THEME_FILE);
  const header = readJsonFile<StorefrontTemplate['header']>(HEADER_FILE);
  const home = readJsonFile<StorefrontTemplate['home']>(HOME_FILE);
  const footer = readJsonFile<StorefrontTemplate['footer']>(FOOTER_FILE);

  if (!meta && !theme && !header && !home && !footer) {
    return null;
  }

  return normalizeStorefrontTemplate({
    ...fallback,
    schemaVersion: meta?.schemaVersion || fallback.schemaVersion,
    updatedAt: meta?.updatedAt || fallback.updatedAt,
    brandName: meta?.brandName || fallback.brandName,
    theme: theme || fallback.theme,
    header: header || fallback.header,
    home: home || fallback.home,
    footer: footer || fallback.footer,
  });
}

function loadFromLegacyFile(): StorefrontTemplate | null {
  const legacy = readJsonFile<unknown>(LEGACY_DATA_FILE);
  if (!legacy) return null;
  return normalizeStorefrontTemplate(legacy);
}

function loadDb(): void {
  const db = getDb();
  if (db.loaded) return;

  db.loaded = true;
  db.template = loadFromSplitFiles() || loadFromLegacyFile() || createDefaultStorefrontTemplate();
  saveDb();
}

export function getStorefrontTemplate(): StorefrontTemplate {
  loadDb();
  return normalizeStorefrontTemplate(getDb().template);
}

export function updateStorefrontTemplate(input: unknown): StorefrontTemplate {
  loadDb();
  const db = getDb();
  const normalized = normalizeStorefrontTemplate(input);
  db.template = {
    ...normalized,
    updatedAt: nowIso(),
  };
  saveDb();
  return normalizeStorefrontTemplate(db.template);
}

export async function getStorefrontTemplateRuntime(): Promise<StorefrontTemplate> {
  const mode = getStorefrontPersistenceMode();
  if (mode === 'files') return getStorefrontTemplate();

  await seedStorefrontTemplateDatabaseFromFilesIfNeeded();
  const result = await getStorefrontTemplateFromDatabase();
  if (mode === 'database') {
    return normalizeStorefrontTemplate(
      requireDatabaseValue(result, 'ler configuracao da loja') || createDefaultStorefrontTemplate(),
    );
  }

  return result.available && result.value ? normalizeStorefrontTemplate(result.value) : getStorefrontTemplate();
}

export async function updateStorefrontTemplateRuntime(input: unknown): Promise<StorefrontTemplate> {
  const mode = getStorefrontPersistenceMode();
  if (mode === 'files') return updateStorefrontTemplate(input);

  const normalized = normalizeStorefrontTemplate(input);

  if (mode === 'database') {
    const result = await upsertStorefrontTemplateInDatabase({
      ...normalized,
      updatedAt: nowIso(),
    });
    const template = requireDatabaseValue(result, 'salvar configuracao da loja');
    await syncStorefrontRuntimeProjectionFromDatabase();
    return template;
  }

  const template = updateStorefrontTemplate(normalized);
  await upsertStorefrontTemplateInDatabase(template);
  return template;
}

import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

import {
  getPanelSettingFromDatabase,
  upsertPanelSettingInDatabase,
} from '@/features/ecommpanel/server/panelSettingsDatabaseStore';

type PanelSettingsPersistenceMode = 'files' | 'hybrid' | 'database';

export type CatalogDisplaySettings = {
  showUnavailableProducts: boolean;
  unavailableLabel: string;
  restockLabel: string;
};

const ROOT_DIR = path.join(process.cwd(), 'src/data/ecommpanel/catalog');
const SETTINGS_FILE = path.join(ROOT_DIR, 'display-settings.json');
const SETTINGS_KEY = 'catalog-display-settings';

declare global {
  var __ECOM_CATALOG_DISPLAY_SETTINGS_CACHE__: CatalogDisplaySettings | undefined;
  var __ECOM_CATALOG_DISPLAY_SETTINGS_DB_SEEDED__: Set<string> | undefined;
}

function getPersistenceMode(): PanelSettingsPersistenceMode {
  const value = process.env.ECOMM_PANEL_SETTINGS_PERSISTENCE_MODE?.trim().toLowerCase();
  if (value === 'files') return 'files';
  if (value === 'database') return 'database';
  return 'hybrid';
}

function defaultSettings(): CatalogDisplaySettings {
  return {
    showUnavailableProducts: true,
    unavailableLabel: 'Esgotado',
    restockLabel: 'Disponível em breve',
  };
}

function normalizeSettings(input: unknown): CatalogDisplaySettings {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const fallback = defaultSettings();
  return {
    showUnavailableProducts:
      typeof source.showUnavailableProducts === 'boolean' ? source.showUnavailableProducts : fallback.showUnavailableProducts,
    unavailableLabel:
      typeof source.unavailableLabel === 'string' && source.unavailableLabel.trim()
        ? source.unavailableLabel.trim().slice(0, 80)
        : fallback.unavailableLabel,
    restockLabel:
      typeof source.restockLabel === 'string' && source.restockLabel.trim()
        ? source.restockLabel.trim().slice(0, 80)
        : fallback.restockLabel,
  };
}

function readFileSettings(): CatalogDisplaySettings {
  if (!global.__ECOM_CATALOG_DISPLAY_SETTINGS_CACHE__) {
    let parsed: unknown = null;
    if (fs.existsSync(SETTINGS_FILE)) {
      try {
        parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
      } catch {
        parsed = null;
      }
    }
    const normalized = normalizeSettings(parsed);
    fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(normalized, null, 2), 'utf-8');
    global.__ECOM_CATALOG_DISPLAY_SETTINGS_CACHE__ = normalized;
  }
  return normalizeSettings(global.__ECOM_CATALOG_DISPLAY_SETTINGS_CACHE__);
}

function writeFileSettings(settings: CatalogDisplaySettings): CatalogDisplaySettings {
  const normalized = normalizeSettings(settings);
  fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(normalized, null, 2), 'utf-8');
  global.__ECOM_CATALOG_DISPLAY_SETTINGS_CACHE__ = normalized;
  return normalized;
}

async function seedDatabaseFromFilesIfNeeded() {
  if (getPersistenceMode() !== 'hybrid') return;
  const seedSet = global.__ECOM_CATALOG_DISPLAY_SETTINGS_DB_SEEDED__ || new Set<string>();
  global.__ECOM_CATALOG_DISPLAY_SETTINGS_DB_SEEDED__ = seedSet;
  if (seedSet.has(SETTINGS_KEY)) return;
  const current = await getPanelSettingFromDatabase<CatalogDisplaySettings>(SETTINGS_KEY);
  if (!current.available) return;
  if (!current.value) {
    await upsertPanelSettingInDatabase(SETTINGS_KEY, readFileSettings());
  }
  seedSet.add(SETTINGS_KEY);
}

export async function getCatalogDisplaySettingsRuntime(): Promise<CatalogDisplaySettings> {
  const mode = getPersistenceMode();
  if (mode === 'files') return readFileSettings();
  if (mode === 'hybrid') await seedDatabaseFromFilesIfNeeded();

  const result = await getPanelSettingFromDatabase<CatalogDisplaySettings>(SETTINGS_KEY);
  if (!result.available) {
    if (mode === 'database') throw new Error('Catálogo em modo database sem painel settings disponível.');
    return readFileSettings();
  }
  if (!result.value) {
    const fallback = readFileSettings();
    await upsertPanelSettingInDatabase(SETTINGS_KEY, fallback);
    return fallback;
  }
  return normalizeSettings(result.value);
}

export async function updateCatalogDisplaySettingsRuntime(input: unknown): Promise<CatalogDisplaySettings> {
  const normalized = normalizeSettings(input);
  const mode = getPersistenceMode();
  if (mode !== 'database') {
    writeFileSettings(normalized);
  }
  if (mode === 'files') return normalized;

  const result = await upsertPanelSettingInDatabase(SETTINGS_KEY, normalized);
  if (!result.available) {
    if (mode === 'database') throw new Error('Falha ao persistir configuração de vitrine do catálogo.');
    return normalized;
  }
  return normalizeSettings(result.value);
}

export async function getCatalogAvailabilityPresentationRuntime(product: {
  available: boolean;
  stock?: { incomingQuantity?: number };
}) {
  const settings = await getCatalogDisplaySettingsRuntime();
  if (product.available) {
    return { available: true, label: 'Disponível' };
  }
  const incomingQuantity = Number(product.stock?.incomingQuantity || 0);
  return {
    available: false,
    label: incomingQuantity > 0 ? settings.restockLabel : settings.unavailableLabel,
  };
}

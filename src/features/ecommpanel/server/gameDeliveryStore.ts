import 'server-only';

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type { DataImportPayload, DataStudioSnapshot } from '@/features/ecommpanel/types/dataStudio';
import type {
  GameDeliveryBundle,
  GameDeliveryEntityFeed,
  GameDeliveryManifest,
  GameDeliverySettings,
} from '@/features/ecommpanel/types/gameDelivery';

import { listEntityRecords } from './dataEntityRecords';
import { getDataStudioSnapshotResolved, readImportRows } from './dataStudioStore';

const ROOT_DIR = path.join(process.cwd(), 'src/data/ecommpanel/panel-settings');
const SETTINGS_FILE = path.join(ROOT_DIR, 'game-delivery.json');
const SCHEMA_VERSION = 1;

const CARD_ENTITY_SLUGS = [
  'cards',
  'character-cards',
  'accessory-cards',
  'skills',
  'skill-tags',
  'card-skill-pool',
  'card-skill-loadouts',
  'deck-templates',
  'deck-template-cards',
];

const CONFIG_ENTITY_SLUGS = ['game-rulesets'];
const WORLD_ENTITY_SLUGS = ['world-islands', 'island-stages', 'encounter-templates', 'boss-configs', 'game-patches', 'live-ops-configs'];

declare global {
  var __GAME_DELIVERY_SETTINGS_CACHE__:
    | {
        loaded: boolean;
        settings: GameDeliverySettings;
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
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpPath, payload, 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function createDefaultGameDeliverySettings(): GameDeliverySettings {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: nowIso(),
    publicationEnabled: true,
    gatewayMode: 'simulated',
    channel: 'dev',
    contentVersion: '0.1.0',
    minSupportedVersion: '0.1.0',
    currentPatchId: '',
    featuredEventIds: [],
    releaseNotes: '',
    publishedAt: undefined,
    lastPayloadHash: undefined,
  };
}

function normalizeString(value: unknown, fallback = '', maxLength = 320): string {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, maxLength);
}

function normalizeSettings(input: unknown): GameDeliverySettings {
  const fallback = createDefaultGameDeliverySettings();
  const source = (input && typeof input === 'object' ? input : {}) as Partial<GameDeliverySettings>;

  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: normalizeString(source.updatedAt, fallback.updatedAt, 64) || fallback.updatedAt,
    publicationEnabled: source.publicationEnabled !== false,
    gatewayMode: source.gatewayMode === 'direct-panel' ? 'direct-panel' : 'simulated',
    channel: source.channel === 'staging' || source.channel === 'production' ? source.channel : 'dev',
    contentVersion: normalizeString(source.contentVersion, fallback.contentVersion, 32) || fallback.contentVersion,
    minSupportedVersion: normalizeString(source.minSupportedVersion, fallback.minSupportedVersion, 32) || fallback.minSupportedVersion,
    currentPatchId: normalizeString(source.currentPatchId, '', 120),
    featuredEventIds: Array.isArray(source.featuredEventIds)
      ? source.featuredEventIds.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim()).slice(0, 16)
      : [],
    releaseNotes: normalizeString(source.releaseNotes, '', 4000),
    publishedAt: normalizeString(source.publishedAt, '', 64) || undefined,
    lastPayloadHash: normalizeString(source.lastPayloadHash, '', 128) || undefined,
  };
}

function getCache() {
  if (!global.__GAME_DELIVERY_SETTINGS_CACHE__) {
    global.__GAME_DELIVERY_SETTINGS_CACHE__ = {
      loaded: false,
      settings: createDefaultGameDeliverySettings(),
    };
  }
  return global.__GAME_DELIVERY_SETTINGS_CACHE__;
}

function loadSettings() {
  const cache = getCache();
  if (cache.loaded) return;
  cache.loaded = true;
  cache.settings = normalizeSettings(readJsonFile<GameDeliverySettings>(SETTINGS_FILE));
  writeJsonAtomic(SETTINGS_FILE, cache.settings);
}

export function getGameDeliverySettings(): GameDeliverySettings {
  loadSettings();
  return normalizeSettings(getCache().settings);
}

export function updateGameDeliverySettings(input: unknown): GameDeliverySettings {
  loadSettings();
  const cache = getCache();
  const partial = input && typeof input === 'object' ? input : {};
  const normalized = normalizeSettings({
    ...cache.settings,
    ...partial,
    updatedAt: nowIso(),
  });
  cache.settings = normalized;
  writeJsonAtomic(SETTINGS_FILE, normalized);
  return normalized;
}

async function listAllEntityRecords(entitySlug: string): Promise<Record<string, unknown>[]> {
  const records: Record<string, unknown>[] = [];
  let offset = 0;

  for (;;) {
    const listing = await listEntityRecords(entitySlug, { limit: 200, offset });
    records.push(...listing.records);
    offset += listing.records.length;
    if (!listing.records.length || listing.records.length < 200) break;
  }

  return records;
}

function flattenImportRows(imports: DataImportPayload[]): Record<string, unknown>[] {
  return imports.flatMap((bundle) => (Array.isArray(bundle.rows) ? bundle.rows : []));
}

async function getEntityFeed(snapshot: DataStudioSnapshot, entitySlug: string): Promise<GameDeliveryEntityFeed | null> {
  const entity = snapshot.entities.find((item) => item.slug === entitySlug);
  if (!entity) return null;

  try {
    const records = await listAllEntityRecords(entitySlug);
    return {
      entitySlug,
      entityLabel: entity.label,
      source: records.length ? 'database' : 'empty',
      count: records.length,
      records,
    };
  } catch {
    const imported = flattenImportRows(readImportRows(entitySlug));
    return {
      entitySlug,
      entityLabel: entity.label,
      source: imported.length ? 'imports' : 'empty',
      count: imported.length,
      records: imported,
    };
  }
}

async function buildFeeds(snapshot: DataStudioSnapshot, entitySlugs: string[]): Promise<GameDeliveryEntityFeed[]> {
  const feeds = await Promise.all(entitySlugs.map((entitySlug) => getEntityFeed(snapshot, entitySlug)));
  return feeds.filter((item): item is GameDeliveryEntityFeed => Boolean(item));
}

function buildPayloadHash(input: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function buildManifest(settings: GameDeliverySettings, bundleShape: {
  cards: GameDeliveryEntityFeed[];
  config: GameDeliveryEntityFeed[];
  world: GameDeliveryEntityFeed[];
  liveOps: Record<string, unknown>[];
  patches: Record<string, unknown>[];
}): GameDeliveryManifest {
  const generatedAt = nowIso();
  const totalEntities = bundleShape.cards.length + bundleShape.config.length + bundleShape.world.length;
  const totalRecords = [...bundleShape.cards, ...bundleShape.config, ...bundleShape.world].reduce((sum, item) => sum + item.count, 0);
  const payloadHash = buildPayloadHash({
    generatedAt,
    settings,
    cards: bundleShape.cards.map((item) => ({ entitySlug: item.entitySlug, count: item.count, source: item.source })),
    config: bundleShape.config.map((item) => ({ entitySlug: item.entitySlug, count: item.count, source: item.source })),
    world: bundleShape.world.map((item) => ({ entitySlug: item.entitySlug, count: item.count, source: item.source })),
    liveOps: bundleShape.liveOps,
    patches: bundleShape.patches,
  });

  return {
    channel: settings.channel,
    contentVersion: settings.contentVersion,
    minSupportedVersion: settings.minSupportedVersion,
    currentPatchId: settings.currentPatchId,
    publicationEnabled: settings.publicationEnabled,
    gatewayMode: settings.gatewayMode,
    publishedAt: settings.publishedAt,
    generatedAt,
    payloadHash,
    totalEntities,
    totalRecords,
    activeEventIds: settings.featuredEventIds,
  };
}

export async function getGameDeliveryBundle(): Promise<GameDeliveryBundle> {
  const snapshot = await getDataStudioSnapshotResolved();
  const settings = getGameDeliverySettings();
  const cards = await buildFeeds(snapshot, CARD_ENTITY_SLUGS);
  const config = await buildFeeds(snapshot, CONFIG_ENTITY_SLUGS);
  const world = await buildFeeds(snapshot, WORLD_ENTITY_SLUGS);
  const liveOps = world.find((item) => item.entitySlug === 'live-ops-configs')?.records || [];
  const patches = world.find((item) => item.entitySlug === 'game-patches')?.records || [];
  const manifest = buildManifest(settings, { cards, config, world, liveOps, patches });

  return {
    generatedAt: manifest.generatedAt,
    manifest,
    releaseNotes: settings.releaseNotes,
    cards,
    config,
    world,
    events: {
      featuredEventIds: settings.featuredEventIds,
      liveOps,
      patches,
    },
  };
}

export async function publishGameDelivery(input?: unknown): Promise<{ settings: GameDeliverySettings; bundle: GameDeliveryBundle }> {
  const merged = updateGameDeliverySettings({
    ...(input && typeof input === 'object' ? input : {}),
    publishedAt: nowIso(),
  });
  const bundle = await getGameDeliveryBundle();
  const settings = updateGameDeliverySettings({
    ...merged,
    lastPayloadHash: bundle.manifest.payloadHash,
  });
  return { settings, bundle };
}

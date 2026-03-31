import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import type { RuntimeResolvedPage } from '@/features/site-runtime/contracts';
import { publishRuntimePages } from '@/features/site-runtime/server/publishedStore';
import { normalizeStorefrontRoutePathCandidate } from '@/features/site-runtime/routeRules';
import { sanitizeColorValue, sanitizeMultilineText, sanitizeSingleLineText, sanitizeUrl } from '@/utils/inputSecurity';
import { resolveSiteRouteNamespaceBySlug } from '@/features/ecommpanel/siteNamespaces';
import { resolvePostgresRuntime } from '@/features/ecommpanel/server/postgresRuntime';
import type {
  SiteBlock,
  SiteBlockType,
  SiteLayoutPreset,
  SitePage,
  SitePageSlot,
  SitePageStatus,
} from '../types/siteBuilder';
import { nowIso, randomToken } from './crypto';
import {
  countSitePagesInDatabase,
  getSitePageByIdFromDatabase,
  getSitePageBySlugFromDatabase,
  listSitePagesFromDatabase,
  upsertSitePageInDatabase,
} from './siteDatabaseStore';

const VALID_PAGE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;
const TRASH_RETENTION_MS = 1000 * 60 * 60 * 24 * 30;

type SiteBuilderDb = {
  pages: Map<string, SitePage>;
  loaded: boolean;
  seeded: boolean;
};

type SitePageRecord = Omit<SitePage, 'slots'>;

type PersistedSiteBuilder = {
  pages: SitePage[];
};

type PersistedSiteRouteRegistry = {
  routes: SitePageRecord[];
};

type PersistedSitePageDocument = {
  pageId: string;
  slots: SitePageSlot[];
};

type SitePersistenceMode = 'files' | 'hybrid' | 'database';

export type SiteBuilderOperationalSummary = {
  totalPages: number;
  draftPages: number;
  publishedPages: number;
  archivedPages: number;
  trashedPages: number;
  latestPublishedAt?: string;
  latestPublishedTitle?: string;
};

const LEGACY_DATA_FILE = path.join(process.cwd(), 'src/data/ecommpanel/site-pages.json');
const ROUTES_FILE = path.join(process.cwd(), 'src/data/ecommpanel/site-routes.json');
const PAGES_DIR = path.join(process.cwd(), 'src/data/ecommpanel/site-pages');

declare global {
  var __ECOMMPANEL_SITE_BUILDER_DB__: SiteBuilderDb | undefined;
  var __SITE_DB_FILE_SEEDED_KEYS__: Set<string> | undefined;
}

function getDb(): SiteBuilderDb {
  if (!global.__ECOMMPANEL_SITE_BUILDER_DB__) {
    global.__ECOMMPANEL_SITE_BUILDER_DB__ = {
      pages: new Map(),
      loaded: false,
      seeded: false,
    };
  }
  return global.__ECOMMPANEL_SITE_BUILDER_DB__;
}

function createDefaultSeo(input: { title: string; description: string }): SitePage['seo'] {
  return {
    title: input.title,
    description: input.description,
    keywords: '',
    noIndex: true,
  };
}

function createDefaultTheme(): SitePage['theme'] {
  return {
    backgroundColor: '#ffffff',
    textColor: '#0f172a',
    accentColor: '#1f4738',
  };
}

function sanitizeTheme(theme: Partial<SitePage['theme']> | undefined): SitePage['theme'] {
  const fallback = createDefaultTheme();
  return {
    backgroundColor: sanitizeColorValue(theme?.backgroundColor, fallback.backgroundColor),
    textColor: sanitizeColorValue(theme?.textColor, fallback.textColor),
    accentColor: sanitizeColorValue(theme?.accentColor, fallback.accentColor),
  };
}

function sanitizeSeo(
  seo: Partial<SitePage['seo']> | undefined,
  fallbackTitle: string,
  fallbackDescription: string,
): SitePage['seo'] {
  const fallback = createDefaultSeo({ title: fallbackTitle, description: fallbackDescription });
  return {
    title: sanitizeSingleLineText(seo?.title, fallback.title),
    description: sanitizeSingleLineText(seo?.description, fallback.description),
    keywords: sanitizeSingleLineText(seo?.keywords, ''),
    noIndex: Boolean(seo?.noIndex ?? fallback.noIndex),
  };
}

function sanitizeBlockStyle(style: SiteBlock['style'] | undefined): SiteBlock['style'] {
  const backgroundColor = sanitizeColorValue(style?.backgroundColor, '');
  const textColor = sanitizeColorValue(style?.textColor, '');
  return backgroundColor || textColor ? { backgroundColor, textColor } : {};
}

function sanitizeBlock(block: SiteBlock): SiteBlock {
  const common = {
    id: sanitizeSingleLineText(block.id, `blk-${randomToken(4)}`),
    type: block.type,
    enabled: Boolean(block.enabled),
    style: sanitizeBlockStyle(block.style),
  } as const;

  switch (block.type) {
    case 'hero':
      return {
        ...common,
        type: 'hero',
        data: {
          title: sanitizeSingleLineText(block.data.title, 'Título Hero'),
          subtitle: sanitizeMultilineText(block.data.subtitle, ''),
        },
      };
    case 'rich_text':
      return {
        ...common,
        type: 'rich_text',
        data: {
          content: sanitizeMultilineText(block.data.content, ''),
        },
      };
    case 'cta':
      return {
        ...common,
        type: 'cta',
        data: {
          label: sanitizeSingleLineText(block.data.label, 'Saiba mais'),
          href: sanitizeUrl(block.data.href, { fallback: '/e-commerce', allowRelative: true, allowAnchor: true }),
        },
      };
    case 'banner':
      return {
        ...common,
        type: 'banner',
        data: {
          title: sanitizeSingleLineText(block.data.title, 'Banner promocional'),
          imageUrl: sanitizeUrl(block.data.imageUrl, { fallback: '/images/image-banner.webp', allowRelative: true, allowAnchor: false }),
        },
      };
    case 'product_card':
      return {
        ...common,
        type: 'product_card',
        data: {
          skuRef: sanitizeSingleLineText(block.data.skuRef, 'SKU-EXEMPLO-001'),
          title: sanitizeSingleLineText(block.data.title, 'Produto em destaque'),
          price: Number.isFinite(Number(block.data.price)) ? Number(block.data.price) : 0,
        },
      };
    case 'product_shelf':
    default:
      return {
        ...common,
        type: 'product_shelf',
        data: {
          title: sanitizeSingleLineText(block.data.title, 'Vitrine de produtos'),
          collection: sanitizeSingleLineText(block.data.collection, 'ofertas'),
        },
      };
  }
}

function sanitizeSlots(slots: SitePageSlot[]): SitePageSlot[] {
  return (Array.isArray(slots) ? slots : []).map((slot, index) => ({
    id: sanitizeSingleLineText(slot.id, `slot-${index + 1}`),
    label: sanitizeSingleLineText(slot.label, `Área ${index + 1}`),
    blocks: Array.isArray(slot.blocks) ? slot.blocks.map(sanitizeBlock) : [],
  }));
}

function hydratePage(page: SitePage): SitePage {
  return {
    ...page,
    title: sanitizeSingleLineText(page.title, 'Página sem título'),
    slug: normalizeSlug(page.slug),
    description: sanitizeSingleLineText(page.description, ''),
    seo: sanitizeSeo(page.seo, page.title, page.description || ''),
    theme: sanitizeTheme(page.theme),
    slots: sanitizeSlots(page.slots || []),
  };
}

function toPageRecord(page: SitePage): SitePageRecord {
  const { slots: _slots, ...record } = page;
  return record;
}

function getPageDocumentPath(pageId: string): string {
  return path.join(PAGES_DIR, `${pageId}.json`);
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

function ensureDataDir(): void {
  fs.mkdirSync(path.dirname(ROUTES_FILE), { recursive: true });
  fs.mkdirSync(PAGES_DIR, { recursive: true });
}

function toRuntimePublishedPage(page: SitePage): RuntimeResolvedPage | null {
  if (page.status !== 'published') return null;
  if (page.deletedAt) return null;
  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    description: page.description,
    status: page.status,
    layoutPreset: page.layoutPreset,
    slots: page.slots,
    seo: page.seo,
    theme: page.theme,
  };
}

function syncPublishedRuntimeSnapshot(pages: SitePage[]): void {
  const publishedPages = pages
    .map((page) => toRuntimePublishedPage(page))
    .filter((page): page is RuntimeResolvedPage => Boolean(page));
  publishRuntimePages(publishedPages);
}

function getSitePersistenceMode(): SitePersistenceMode {
  const value = process.env.ECOM_SITE_PERSISTENCE_MODE?.trim().toLowerCase();
  if (value === 'files') return 'files';
  if (value === 'database') return 'database';
  return 'hybrid';
}

function requireDatabaseValue<T>(
  result: { available: true; value: T } | { available: false },
  action: string,
): T {
  if (!result.available) {
    throw new Error(`Site builder em modo database exige PostgreSQL disponível para ${action}.`);
  }

  return result.value;
}

function listAllStoredSitePages(): SitePage[] {
  loadDb();
  if (purgeExpiredTrash()) {
    saveDb();
  }
  return Array.from(getDb().pages.values());
}

function buildSiteRuntimeManifestFromPages(pages: RuntimeResolvedPage[]) {
  if (!pages.length) return null;

  const generatedAt = nowIso();
  const raw = JSON.stringify(pages);

  return {
    schemaVersion: 1,
    generatedAt,
    source: 'ecommpanel' as const,
    snapshotFile: 'site-pages.published.json',
    pagesCount: pages.length,
    checksumSha256: crypto.createHash('sha256').update(raw).digest('hex'),
  };
}

function summarizeSitePages(pages: SitePage[]): SiteBuilderOperationalSummary {
  const livePages = pages.filter((page) => !isTrashed(page));
  const latestPublished = [...livePages]
    .filter((page) => page.status === 'published' && page.publishedAt)
    .sort((left, right) => new Date(right.publishedAt || 0).getTime() - new Date(left.publishedAt || 0).getTime())[0];

  return {
    totalPages: livePages.length,
    draftPages: livePages.filter((page) => page.status === 'draft').length,
    publishedPages: livePages.filter((page) => page.status === 'published').length,
    archivedPages: livePages.filter((page) => page.status === 'archived').length,
    trashedPages: pages.filter((page) => isTrashed(page)).length,
    latestPublishedAt: latestPublished?.publishedAt,
    latestPublishedTitle: latestPublished?.title,
  };
}

async function syncSiteRuntimeProjectionFromDatabase(): Promise<void> {
  const result = await listSitePagesFromDatabase({ includeTrashed: true });
  if (!result.available) return;
  syncPublishedRuntimeSnapshot(result.value);
}

async function seedSiteDatabaseFromFilesIfNeeded(): Promise<void> {
  if (getSitePersistenceMode() !== 'hybrid') return;

  const runtime = resolvePostgresRuntime();
  if (!runtime) return;

  const seededKeys = global.__SITE_DB_FILE_SEEDED_KEYS__ || new Set<string>();
  global.__SITE_DB_FILE_SEEDED_KEYS__ = seededKeys;
  if (seededKeys.has(runtime.key)) return;

  const count = await countSitePagesInDatabase();
  if (!count.available) return;

  if (count.value > 0) {
    seededKeys.add(runtime.key);
    return;
  }

  ensureSeededSiteBuilder();
  for (const page of listAllStoredSitePages()) {
    await upsertSitePageInDatabase(page);
  }

  seededKeys.add(runtime.key);
}

async function syncSitePageToDatabase(page: SitePage | null): Promise<void> {
  if (!page) return;
  await seedSiteDatabaseFromFilesIfNeeded();
  await upsertSitePageInDatabase(page);
}

function createBlock(type: SiteBlockType): SiteBlock {
  const id = `blk-${randomToken(4)}`;
  if (type === 'hero') {
    return {
      id,
      type,
      enabled: true,
      data: {
        title: 'Título Hero',
        subtitle: 'Subtítulo de apoio para a seção principal.',
      },
    };
  }

  if (type === 'rich_text') {
    return {
      id,
      type,
      enabled: true,
      data: {
        content: 'Bloco de texto editável com conteúdo institucional.',
      },
    };
  }

  if (type === 'cta') {
    return {
      id,
      type,
      enabled: true,
      data: {
        label: 'Saiba mais',
        href: '/e-commerce',
      },
    };
  }

  if (type === 'banner') {
    return {
      id,
      type,
      enabled: true,
      data: {
        title: 'Banner promocional',
        imageUrl: '/images/image-banner.webp',
      },
    };
  }

  if (type === 'product_card') {
    return {
      id,
      type,
      enabled: true,
      data: {
        skuRef: 'SKU-EXEMPLO-001',
        title: 'Produto em destaque',
        price: 19.9,
      },
    };
  }

  return {
    id,
    type,
    enabled: true,
    data: {
      title: 'Vitrine de produtos',
      collection: 'ofertas',
    },
  };
}

export function createSlotsForPreset(preset: SiteLayoutPreset): SitePageSlot[] {
  const count =
    preset === 'single_block'
      ? 1
      : preset === 'tic_tac_toe'
      ? 9
      : preset === 'four_quadrants'
        ? 4
        : preset === 'three_horizontal'
          ? 3
          : 3;

  return Array.from({ length: count }).map((_, index) => ({
    id: `slot-${index + 1}`,
    label: `Área ${index + 1}`,
    blocks: [],
  }));
}

function seedSlots(): SitePageSlot[] {
  const slots = createSlotsForPreset('three_vertical');
  slots[0].blocks.push(createBlock('hero'));
  slots[1].blocks.push(createBlock('rich_text'));
  slots[2].blocks.push(createBlock('cta'));
  return slots;
}

function createStarterSlotsForSlug(slug: string): { layoutPreset: SiteLayoutPreset; slots: SitePageSlot[] } {
  const namespace = resolveSiteRouteNamespaceBySlug(slug);
  const slots = createSlotsForPreset(namespace.layoutPreset);

  namespace.starterPlan.forEach((plan, slotIndex) => {
    const slot = slots[slotIndex];
    if (!slot) return;
    slot.blocks.push(...plan.map((blockType) => createBlock(blockType)));
  });

  return {
    layoutPreset: namespace.layoutPreset,
    slots,
  };
}

function readSitePageSlots(pageId: string, layoutPreset: SiteLayoutPreset): SitePageSlot[] {
  const document = readJsonFile<PersistedSitePageDocument>(getPageDocumentPath(pageId));
  if (!document?.pageId || document.pageId !== pageId || !Array.isArray(document.slots)) {
    return createSlotsForPreset(layoutPreset);
  }

  return document.slots;
}

function saveDb(): void {
  const db = getDb();
  ensureDataDir();
  const pages = Array.from(db.pages.values());

  const registry: PersistedSiteRouteRegistry = {
    routes: pages.map((page) => toPageRecord(page)),
  };
  writeJsonAtomic(ROUTES_FILE, registry);
  writeJsonAtomic(LEGACY_DATA_FILE, { pages });

  for (const page of pages) {
    const document: PersistedSitePageDocument = {
      pageId: page.id,
      slots: page.slots,
    };
    writeJsonAtomic(getPageDocumentPath(page.id), document);
  }

  syncPublishedRuntimeSnapshot(pages);
}

function loadFromSplitFiles(db: SiteBuilderDb): boolean {
  const registry = readJsonFile<PersistedSiteRouteRegistry>(ROUTES_FILE);
  if (!registry?.routes) return false;

  db.pages.clear();
  for (const route of registry.routes) {
    const hydrated = hydratePage({
      ...route,
      slots: readSitePageSlots(route.id, route.layoutPreset),
    } as SitePage);
    db.pages.set(hydrated.id, hydrated);
  }

  db.seeded = db.pages.size > 0;
  syncPublishedRuntimeSnapshot(Array.from(db.pages.values()));
  return true;
}

function loadFromLegacyFile(db: SiteBuilderDb): boolean {
  const legacy = readJsonFile<PersistedSiteBuilder>(LEGACY_DATA_FILE);
  if (!legacy?.pages) return false;

  db.pages.clear();
  for (const page of legacy.pages) {
    const hydrated = hydratePage(page);
    db.pages.set(hydrated.id, hydrated);
  }

  db.seeded = db.pages.size > 0;
  saveDb();
  return true;
}

function loadDb(): void {
  const db = getDb();
  if (db.loaded) return;

  db.loaded = true;
  if (loadFromSplitFiles(db)) return;
  if (loadFromLegacyFile(db)) return;

  db.pages.clear();
  db.seeded = false;
}

function purgeExpiredTrash(): boolean {
  const db = getDb();
  const now = Date.now();
  let changed = false;
  for (const [id, page] of db.pages.entries()) {
    if (!page.deleteExpiresAt) continue;
    if (now >= new Date(page.deleteExpiresAt).getTime()) {
      db.pages.delete(id);
      changed = true;
    }
  }
  return changed;
}

export function ensureSeededSiteBuilder(): void {
  loadDb();
  if (purgeExpiredTrash()) {
    saveDb();
  }
  const db = getDb();
  if (db.seeded) return;

  const now = nowIso();
  const page: SitePage = {
    id: 'page-quem-somos',
    title: 'Quem Somos',
    slug: 'quem-somos',
    description: 'Página institucional criada via painel administrativo.',
    seo: createDefaultSeo({
      title: 'Quem Somos',
      description: 'Página institucional criada via painel administrativo.',
    }),
    theme: createDefaultTheme(),
    status: 'draft',
    layoutPreset: 'three_vertical',
    slots: seedSlots(),
    createdAt: now,
    updatedAt: now,
  };

  db.pages.set(page.id, page);
  db.seeded = true;
  saveDb();
}

function isTrashed(page: SitePage): boolean {
  return Boolean(page.deletedAt);
}

export function listSitePages(): SitePage[] {
  ensureSeededSiteBuilder();
  const db = getDb();
  return Array.from(db.pages.values())
    .filter((page) => !isTrashed(page))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function listTrashedSitePages(): SitePage[] {
  ensureSeededSiteBuilder();
  const db = getDb();
  return Array.from(db.pages.values())
    .filter((page) => isTrashed(page))
    .sort((a, b) => (a.deletedAt || '') < (b.deletedAt || '') ? 1 : -1);
}

export function getSitePageById(pageId: string): SitePage | null {
  ensureSeededSiteBuilder();
  const page = getDb().pages.get(pageId) || null;
  if (!page || isTrashed(page)) return null;
  return page;
}

export function getSitePageBySlug(slug: string): SitePage | null {
  ensureSeededSiteBuilder();
  for (const page of getDb().pages.values()) {
    if (isTrashed(page)) continue;
    if (page.slug === slug) return page;
  }
  return null;
}

export function getPublishedSitePageBySlug(slug: string): SitePage | null {
  const page = getSitePageBySlug(slug);
  if (!page) return null;
  if (page.status !== 'published') return null;
  return page;
}

export function normalizeSlug(raw: string): string {
  return normalizeStorefrontRoutePathCandidate(raw);
}

export function isValidSlug(slug: string): boolean {
  return VALID_PAGE_SLUG.test(slug);
}

export function createSitePage(input: { title: string; slug: string; description?: string }): SitePage {
  const page = buildNewSitePage(input);
  const db = getDb();
  db.pages.set(page.id, page);
  saveDb();
  return page;
}

function buildNewSitePage(input: { title: string; slug: string; description?: string }): SitePage {
  const now = nowIso();
  const safeTitle = sanitizeSingleLineText(input.title, 'Página sem título');
  const description = sanitizeSingleLineText(input.description, '');
  const normalizedSlug = normalizeSlug(input.slug);
  const starter = createStarterSlotsForSlug(normalizedSlug);
  const page = hydratePage({
    id: `page-${randomToken(6)}`,
    title: safeTitle,
    slug: normalizedSlug,
    description,
    seo: sanitizeSeo(undefined, safeTitle, description),
    theme: sanitizeTheme(undefined),
    status: 'draft',
    layoutPreset: starter.layoutPreset,
    slots: starter.slots,
    createdAt: now,
    updatedAt: now,
  });
  return page;
}

export function updateSitePage(
  pageId: string,
  input: {
    title: string;
    slug: string;
    description: string;
    layoutPreset: SiteLayoutPreset;
    slots: SitePageSlot[];
    seo?: SitePage['seo'];
    theme?: SitePage['theme'];
  },
): SitePage | null {
  const db = getDb();
  const current = db.pages.get(pageId);
  if (!current || isTrashed(current)) return null;

  const next: SitePage = {
    ...current,
    title: sanitizeSingleLineText(input.title, current.title),
    slug: normalizeSlug(input.slug),
    description: sanitizeSingleLineText(input.description, current.description),
    seo: sanitizeSeo(input.seo, input.title, input.description),
    theme: sanitizeTheme(input.theme || current.theme),
    layoutPreset: input.layoutPreset,
    slots: sanitizeSlots(input.slots),
    updatedAt: nowIso(),
  };

  db.pages.set(pageId, next);
  saveDb();
  return next;
}

export function setSitePageStatus(pageId: string, status: SitePageStatus): SitePage | null {
  const db = getDb();
  const current = db.pages.get(pageId);
  if (!current || isTrashed(current)) return null;

  const next: SitePage = {
    ...current,
    status,
    updatedAt: nowIso(),
    publishedAt: status === 'published' ? nowIso() : current.publishedAt,
  };

  db.pages.set(pageId, next);
  saveDb();
  return next;
}

export function softDeleteSitePage(pageId: string): SitePage | null {
  const db = getDb();
  const current = db.pages.get(pageId);
  if (!current || isTrashed(current)) return null;

  const deletedAt = nowIso();
  const next: SitePage = {
    ...current,
    status: 'archived',
    deletedAt,
    deleteExpiresAt: new Date(Date.now() + TRASH_RETENTION_MS).toISOString(),
    updatedAt: deletedAt,
  };

  db.pages.set(pageId, next);
  saveDb();
  return next;
}

export function restoreSitePage(pageId: string): SitePage | null {
  const db = getDb();
  const current = db.pages.get(pageId);
  if (!current || !isTrashed(current)) return null;

  const next: SitePage = {
    ...current,
    status: 'draft',
    deletedAt: undefined,
    deleteExpiresAt: undefined,
    updatedAt: nowIso(),
  };

  db.pages.set(pageId, next);
  saveDb();
  return next;
}

export function getSiteBuilderOperationalSummary(): SiteBuilderOperationalSummary {
  ensureSeededSiteBuilder();
  return summarizeSitePages(Array.from(getDb().pages.values()));
}

export async function listSitePagesRuntime(): Promise<SitePage[]> {
  const mode = getSitePersistenceMode();
  if (mode === 'files') return listSitePages();

  await seedSiteDatabaseFromFilesIfNeeded();
  const result = await listSitePagesFromDatabase();
  if (mode === 'database') return requireDatabaseValue(result, 'listar paginas');
  return result.available ? result.value : listSitePages();
}

export async function listTrashedSitePagesRuntime(): Promise<SitePage[]> {
  const mode = getSitePersistenceMode();
  if (mode === 'files') return listTrashedSitePages();

  await seedSiteDatabaseFromFilesIfNeeded();
  const result = await listSitePagesFromDatabase({ includeTrashed: true });
  if (mode === 'database') {
    return requireDatabaseValue(result, 'listar paginas na lixeira').filter((page) => isTrashed(page));
  }

  return result.available ? result.value.filter((page) => isTrashed(page)) : listTrashedSitePages();
}

export async function getSitePageByIdRuntime(pageId: string): Promise<SitePage | null> {
  const mode = getSitePersistenceMode();
  if (mode === 'files') return getSitePageById(pageId);

  await seedSiteDatabaseFromFilesIfNeeded();
  const result = await getSitePageByIdFromDatabase(pageId);
  if (mode === 'database') return requireDatabaseValue(result, 'ler pagina por id');
  return result.available ? result.value : getSitePageById(pageId);
}

export async function getSitePageBySlugRuntime(slug: string): Promise<SitePage | null> {
  const safeSlug = normalizeSlug(slug);
  if (!safeSlug) return null;

  const mode = getSitePersistenceMode();
  if (mode === 'files') return getSitePageBySlug(safeSlug);

  await seedSiteDatabaseFromFilesIfNeeded();
  const result = await getSitePageBySlugFromDatabase(safeSlug);
  if (mode === 'database') return requireDatabaseValue(result, 'ler pagina por slug');
  return result.available ? result.value : getSitePageBySlug(safeSlug);
}

export async function getPublishedSitePageBySlugRuntime(slug: string): Promise<SitePage | null> {
  const safeSlug = normalizeSlug(slug);
  if (!safeSlug) return null;

  const mode = getSitePersistenceMode();
  if (mode === 'files') return getPublishedSitePageBySlug(safeSlug);

  await seedSiteDatabaseFromFilesIfNeeded();
  const result = await getSitePageBySlugFromDatabase(safeSlug, { publishedOnly: true });
  if (mode === 'database') return requireDatabaseValue(result, 'ler pagina publicada por slug');

  if (result.available) {
    return result.value;
  }

  return getPublishedSitePageBySlug(safeSlug);
}

export async function createSitePageRuntime(input: { title: string; slug: string; description?: string }): Promise<SitePage> {
  const mode = getSitePersistenceMode();
  if (mode === 'files') return createSitePage(input);

  if (mode === 'database') {
    const page = buildNewSitePage(input);
    const result = await upsertSitePageInDatabase(page);
    const persisted = requireDatabaseValue(result, 'criar pagina');
    await syncSiteRuntimeProjectionFromDatabase();
    return persisted;
  }

  const page = createSitePage(input);
  await syncSitePageToDatabase(page);
  return page;
}

export async function updateSitePageRuntime(
  pageId: string,
  input: {
    title: string;
    slug: string;
    description: string;
    layoutPreset: SiteLayoutPreset;
    slots: SitePageSlot[];
    seo?: SitePage['seo'];
    theme?: SitePage['theme'];
  },
): Promise<SitePage | null> {
  const mode = getSitePersistenceMode();
  if (mode === 'files') return updateSitePage(pageId, input);

  if (mode === 'database') {
    const currentResult = await getSitePageByIdFromDatabase(pageId);
    const current = requireDatabaseValue(currentResult, 'carregar pagina para atualizar');
    if (!current) return null;

    const next: SitePage = {
      ...current,
      title: sanitizeSingleLineText(input.title, current.title),
      slug: normalizeSlug(input.slug),
      description: sanitizeSingleLineText(input.description, current.description),
      seo: sanitizeSeo(input.seo, input.title, input.description),
      theme: sanitizeTheme(input.theme || current.theme),
      layoutPreset: input.layoutPreset,
      slots: sanitizeSlots(input.slots),
      updatedAt: nowIso(),
    };

    const result = await upsertSitePageInDatabase(next);
    const persisted = requireDatabaseValue(result, 'atualizar pagina');
    await syncSiteRuntimeProjectionFromDatabase();
    return persisted;
  }

  const page = updateSitePage(pageId, input);
  await syncSitePageToDatabase(page);
  return page;
}

export async function setSitePageStatusRuntime(pageId: string, status: SitePageStatus): Promise<SitePage | null> {
  const mode = getSitePersistenceMode();
  if (mode === 'files') return setSitePageStatus(pageId, status);

  if (mode === 'database') {
    const currentResult = await getSitePageByIdFromDatabase(pageId, { includeTrashed: true });
    const current = requireDatabaseValue(currentResult, 'carregar pagina para alterar status');
    if (!current) return null;

    const updatedAt = nowIso();
    const next: SitePage = {
      ...current,
      status,
      updatedAt,
      publishedAt: status === 'published' ? updatedAt : current.publishedAt,
    };

    const result = await upsertSitePageInDatabase(next);
    const persisted = requireDatabaseValue(result, 'alterar status da pagina');
    await syncSiteRuntimeProjectionFromDatabase();
    return persisted;
  }

  const page = setSitePageStatus(pageId, status);
  await syncSitePageToDatabase(page);
  return page;
}

export async function softDeleteSitePageRuntime(pageId: string): Promise<SitePage | null> {
  const mode = getSitePersistenceMode();
  if (mode === 'files') return softDeleteSitePage(pageId);

  if (mode === 'database') {
    const currentResult = await getSitePageByIdFromDatabase(pageId, { includeTrashed: true });
    const current = requireDatabaseValue(currentResult, 'carregar pagina para excluir');
    if (!current || isTrashed(current)) return null;

    const deletedAt = nowIso();
    const next: SitePage = {
      ...current,
      status: 'archived',
      deletedAt,
      deleteExpiresAt: new Date(Date.now() + TRASH_RETENTION_MS).toISOString(),
      updatedAt: deletedAt,
    };

    const result = await upsertSitePageInDatabase(next);
    const persisted = requireDatabaseValue(result, 'enviar pagina para lixeira');
    await syncSiteRuntimeProjectionFromDatabase();
    return persisted;
  }

  const page = softDeleteSitePage(pageId);
  await syncSitePageToDatabase(page);
  return page;
}

export async function restoreSitePageRuntime(pageId: string): Promise<SitePage | null> {
  const mode = getSitePersistenceMode();
  if (mode === 'files') return restoreSitePage(pageId);

  if (mode === 'database') {
    const currentResult = await getSitePageByIdFromDatabase(pageId, { includeTrashed: true });
    const current = requireDatabaseValue(currentResult, 'carregar pagina para restaurar');
    if (!current || !isTrashed(current)) return null;

    const next: SitePage = {
      ...current,
      status: 'draft',
      deletedAt: undefined,
      deleteExpiresAt: undefined,
      updatedAt: nowIso(),
    };

    const result = await upsertSitePageInDatabase(next);
    const persisted = requireDatabaseValue(result, 'restaurar pagina');
    await syncSiteRuntimeProjectionFromDatabase();
    return persisted;
  }

  const page = restoreSitePage(pageId);
  await syncSitePageToDatabase(page);
  return page;
}

export async function listPublishedRuntimePagesRuntime(): Promise<RuntimeResolvedPage[]> {
  const mode = getSitePersistenceMode();
  if (mode === 'files') {
    return listSitePages()
      .map((page) => toRuntimePublishedPage(page))
      .filter((page): page is RuntimeResolvedPage => Boolean(page));
  }

  await seedSiteDatabaseFromFilesIfNeeded();
  const result = await listSitePagesFromDatabase({ publishedOnly: true });
  if (mode === 'database') {
    return requireDatabaseValue(result, 'listar paginas publicadas do runtime')
      .map((page) => toRuntimePublishedPage(page))
      .filter((page): page is RuntimeResolvedPage => Boolean(page));
  }

  return result.available
    ? result.value
        .map((page) => toRuntimePublishedPage(page))
        .filter((page): page is RuntimeResolvedPage => Boolean(page))
    : listSitePages()
        .map((page) => toRuntimePublishedPage(page))
        .filter((page): page is RuntimeResolvedPage => Boolean(page));
}

export async function getPublishedRuntimePageBySlugRuntime(slug: string): Promise<RuntimeResolvedPage | null> {
  const page = await getPublishedSitePageBySlugRuntime(slug);
  return page ? toRuntimePublishedPage(page) : null;
}

export async function readSiteRuntimeManifestRuntime() {
  const mode = getSitePersistenceMode();
  if (mode === 'files') return null;
  const pages = await listPublishedRuntimePagesRuntime();
  return buildSiteRuntimeManifestFromPages(pages);
}

export async function getSiteBuilderOperationalSummaryRuntime(): Promise<SiteBuilderOperationalSummary> {
  const mode = getSitePersistenceMode();
  if (mode === 'files') return getSiteBuilderOperationalSummary();

  await seedSiteDatabaseFromFilesIfNeeded();
  const result = await listSitePagesFromDatabase({ includeTrashed: true });
  if (mode === 'database') return summarizeSitePages(requireDatabaseValue(result, 'montar resumo operacional do site'));
  return result.available ? summarizeSitePages(result.value) : getSiteBuilderOperationalSummary();
}

import 'server-only';

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  SITE_RUNTIME_SCHEMA_VERSION,
  type RuntimeContentManifest,
  type RuntimePublishedSnapshot,
  type RuntimeResolvedPage,
} from '@/features/site-runtime/contracts';

const SNAPSHOT_FILE_NAME = 'site-pages.published.json';
const MANIFEST_FILE_NAME = 'manifest.json';

type SnapshotCache = {
  filePath: string;
  mtimeMs: number;
  snapshot: RuntimePublishedSnapshot | null;
};

declare global {
  var __SITE_RUNTIME_SNAPSHOT_CACHE__: SnapshotCache | undefined;
}

function getContentRoot(): string {
  const envPath = process.env.ECOM_CONTENT_PATH?.trim();
  if (envPath) return path.resolve(envPath);
  return path.join(process.cwd(), 'src/data/site-runtime');
}

function getSnapshotPath(): string {
  return path.join(getContentRoot(), SNAPSHOT_FILE_NAME);
}

function getManifestPath(): string {
  return path.join(getContentRoot(), MANIFEST_FILE_NAME);
}

export function getPublishedRuntimeContentRoot(): string {
  return getContentRoot();
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const payload = JSON.stringify(value, null, 2);
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpPath, payload, 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function isRuntimePage(page: RuntimeResolvedPage): boolean {
  return Boolean(
    page &&
      typeof page.id === 'string' &&
      typeof page.slug === 'string' &&
      typeof page.title === 'string' &&
      Array.isArray(page.slots),
  );
}

function parseSnapshot(raw: string): RuntimePublishedSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as RuntimePublishedSnapshot;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.pages)) return null;
    if (!parsed.pages.every(isRuntimePage)) return null;
    return {
      schemaVersion: parsed.schemaVersion || SITE_RUNTIME_SCHEMA_VERSION,
      generatedAt: parsed.generatedAt || new Date(0).toISOString(),
      pages: parsed.pages,
    };
  } catch {
    return null;
  }
}

export function publishRuntimePages(pages: RuntimeResolvedPage[]): RuntimeContentManifest {
  const generatedAt = new Date().toISOString();
  const snapshot: RuntimePublishedSnapshot = {
    schemaVersion: SITE_RUNTIME_SCHEMA_VERSION,
    generatedAt,
    pages,
  };

  const snapshotRaw = JSON.stringify(snapshot);
  const checksumSha256 = crypto.createHash('sha256').update(snapshotRaw).digest('hex');
  const manifest: RuntimeContentManifest = {
    schemaVersion: SITE_RUNTIME_SCHEMA_VERSION,
    generatedAt,
    source: 'ecommpanel',
    snapshotFile: SNAPSHOT_FILE_NAME,
    pagesCount: pages.length,
    checksumSha256,
  };

  writeJsonAtomic(getSnapshotPath(), snapshot);
  writeJsonAtomic(getManifestPath(), manifest);

  global.__SITE_RUNTIME_SNAPSHOT_CACHE__ = {
    filePath: getSnapshotPath(),
    mtimeMs: fs.statSync(getSnapshotPath()).mtimeMs,
    snapshot,
  };

  return manifest;
}

export function readPublishedRuntimeSnapshot(): RuntimePublishedSnapshot | null {
  const filePath = getSnapshotPath();
  if (!fs.existsSync(filePath)) return null;

  const stat = fs.statSync(filePath);
  const cache = global.__SITE_RUNTIME_SNAPSHOT_CACHE__;
  if (cache && cache.filePath === filePath && cache.mtimeMs === stat.mtimeMs) {
    return cache.snapshot;
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const snapshot = parseSnapshot(raw);
  global.__SITE_RUNTIME_SNAPSHOT_CACHE__ = {
    filePath,
    mtimeMs: stat.mtimeMs,
    snapshot,
  };
  return snapshot;
}

export function readPublishedRuntimeManifest(): RuntimeContentManifest | null {
  const filePath = getManifestPath();
  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as RuntimeContentManifest;
  } catch {
    return null;
  }
}

export function getPublishedRuntimePageBySlug(slug: string): RuntimeResolvedPage | null {
  const snapshot = readPublishedRuntimeSnapshot();
  if (!snapshot) return null;
  const safeSlug = slug.trim().replace(/^\//, '');
  if (!safeSlug) return null;
  return snapshot.pages.find((page) => page.slug === safeSlug) || null;
}

export function normalizeRuntimePath(pathname: string): string {
  const safe = pathname.trim() || '/';
  const noQuery = safe.split('?')[0].split('#')[0] || '/';
  const withoutPrefix = noQuery.startsWith('/e-commerce') ? noQuery.replace(/^\/e-commerce/, '') || '/' : noQuery;
  const withLeadingSlash = withoutPrefix.startsWith('/') ? withoutPrefix : `/${withoutPrefix}`;
  return withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/') ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
}

export function resolveDynamicRuntimePath(pathname: string): RuntimeResolvedPage | null {
  const normalizedPath = normalizeRuntimePath(pathname);
  if (normalizedPath === '/') {
    return getPublishedRuntimePageBySlug('home') || getPublishedRuntimePageBySlug('index');
  }

  const slug = normalizedPath.replace(/^\//, '');
  if (!slug) return null;
  return getPublishedRuntimePageBySlug(slug);
}

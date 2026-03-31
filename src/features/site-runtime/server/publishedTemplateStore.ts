import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

import {
  STOREFRONT_TEMPLATE_SCHEMA_VERSION,
  type RuntimeStorefrontTemplateSnapshot,
  type StorefrontTemplate,
  normalizeStorefrontTemplate,
} from '@/features/site-runtime/storefrontTemplate';

const SNAPSHOT_FILE_NAME = 'storefront-template.published.json';

type TemplateSnapshotCache = {
  filePath: string;
  mtimeMs: number;
  snapshot: RuntimeStorefrontTemplateSnapshot | null;
};

declare global {
  var __SITE_RUNTIME_TEMPLATE_CACHE__: TemplateSnapshotCache | undefined;
}

function getContentRoot(): string {
  const envPath = process.env.ECOM_CONTENT_PATH?.trim();
  if (envPath) return path.resolve(envPath);
  return path.join(process.cwd(), 'src/data/site-runtime');
}

function getSnapshotPath(): string {
  return path.join(getContentRoot(), SNAPSHOT_FILE_NAME);
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const payload = JSON.stringify(value, null, 2);
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpPath, payload, 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function parseSnapshot(raw: string): RuntimeStorefrontTemplateSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as RuntimeStorefrontTemplateSnapshot;
    if (!parsed || typeof parsed !== 'object' || !parsed.template) return null;
    return {
      schemaVersion: parsed.schemaVersion || STOREFRONT_TEMPLATE_SCHEMA_VERSION,
      generatedAt: typeof parsed.generatedAt === 'string' ? parsed.generatedAt : new Date(0).toISOString(),
      template: normalizeStorefrontTemplate(parsed.template),
    };
  } catch {
    return null;
  }
}

export function publishRuntimeStorefrontTemplate(template: StorefrontTemplate): RuntimeStorefrontTemplateSnapshot {
  const snapshot: RuntimeStorefrontTemplateSnapshot = {
    schemaVersion: STOREFRONT_TEMPLATE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    template: normalizeStorefrontTemplate(template),
  };

  const filePath = getSnapshotPath();
  writeJsonAtomic(filePath, snapshot);
  global.__SITE_RUNTIME_TEMPLATE_CACHE__ = {
    filePath,
    mtimeMs: fs.statSync(filePath).mtimeMs,
    snapshot,
  };
  return snapshot;
}

export function readPublishedRuntimeStorefrontTemplate(): RuntimeStorefrontTemplateSnapshot | null {
  const filePath = getSnapshotPath();
  if (!fs.existsSync(filePath)) return null;

  const stat = fs.statSync(filePath);
  const cache = global.__SITE_RUNTIME_TEMPLATE_CACHE__;
  if (cache && cache.filePath === filePath && cache.mtimeMs === stat.mtimeMs) {
    return cache.snapshot;
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const snapshot = parseSnapshot(raw);
  global.__SITE_RUNTIME_TEMPLATE_CACHE__ = {
    filePath,
    mtimeMs: stat.mtimeMs,
    snapshot,
  };
  return snapshot;
}

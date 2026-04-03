import 'server-only';

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

import { sanitizeSingleLineText } from '@/utils/inputSecurity';
import { getPanelMediaSettingsRuntime } from '@/features/ecommpanel/server/panelMediaSettingsStore';
import type {
  PanelMediaAsset,
  PanelMediaAssetVariant,
  PanelMediaFit,
  PanelMediaFormat,
  PanelMediaPresetKey,
} from '@/features/ecommpanel/types/panelMediaSettings';

const PUBLIC_ROOT_DIR = path.join(process.cwd(), 'public');
const MEDIA_METADATA_ROOT = path.join(process.cwd(), 'src/data/ecommpanel/media/assets');

type ProcessPanelMediaUploadInput = {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  scope?: string;
  folder?: string;
};

function writeJsonAtomic(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const payload = JSON.stringify(value, null, 2);
  const tmpFile = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpFile, payload, 'utf-8');
  fs.renameSync(tmpFile, filePath);
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function normalizeAssetRecord(asset: Partial<PanelMediaAsset> | null): PanelMediaAsset | null {
  if (!asset?.id || !asset.originalName || !asset.uploadedAt || !asset.mimeType || !asset.variants) {
    return null;
  }

  const variants = asset.variants;
  const primaryUrl =
    asset.primaryUrl ||
    variants.productZoom?.url ||
    variants.productPdp?.url ||
    variants.contentHero?.url ||
    variants.productThumb?.url ||
    variants.contentCard?.url ||
    Object.values(variants)[0]?.url ||
    '';

  return {
    id: asset.id,
    scope: asset.scope || 'generic',
    folder: asset.folder || 'geral',
    originalName: asset.originalName,
    uploadedAt: asset.uploadedAt,
    mimeType: asset.mimeType,
    originalBytes: asset.originalBytes || 0,
    primaryUrl,
    variants,
  };
}

function toSafeScope(value: string | undefined): string {
  const normalized = sanitizeSingleLineText(value || '', 'generic')
    .toLowerCase()
    .replace(/[^a-z0-9-_/]+/g, '-')
    .replace(/\/{2,}/g, '/')
    .replace(/^-+|-+$/g, '');

  return normalized || 'generic';
}

function toSafeFolder(value: string | undefined, fallback = 'geral'): string {
  const normalized = sanitizeSingleLineText(value || '', 'generic')
    .toLowerCase()
    .replace(/[^a-z0-9-_/]+/g, '-')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+|\/+$/g, '');

  return normalized || fallback;
}

function ensureWritableDirectory(targetDir: string, label: string): void {
  try {
    fs.mkdirSync(targetDir, { recursive: true });
  } catch {
    throw new Error(`Não foi possível criar a pasta de ${label}. Revise permissões do sistema.`);
  }

  try {
    fs.accessSync(targetDir, fs.constants.R_OK | fs.constants.W_OK);
  } catch {
    throw new Error(`A pasta de ${label} está sem permissão de escrita. Ajuste as permissões e tente novamente.`);
  }

  try {
    const probeFile = path.join(targetDir, `.write-check-${process.pid}-${Date.now()}`);
    fs.writeFileSync(probeFile, 'ok', 'utf-8');
    fs.unlinkSync(probeFile);
  } catch {
    throw new Error(`A pasta de ${label} está sem permissão de escrita. Ajuste as permissões e tente novamente.`);
  }
}

function toExt(format: PanelMediaFormat): string {
  switch (format) {
    case 'jpeg':
      return 'jpg';
    case 'png':
      return 'png';
    case 'webp':
    default:
      return 'webp';
  }
}

function applyFit(value: PanelMediaFit): sharp.FitEnum[keyof sharp.FitEnum] {
  return value === 'cover' ? sharp.fit.cover : sharp.fit.inside;
}

function toPublicUrl(basePath: string, segments: string[]): string {
  const cleanBase = `/${basePath.replace(/^\/+|\/+$/g, '')}`;
  return `${cleanBase}/${segments.join('/')}`.replace(/\/{2,}/g, '/');
}

async function encodeVariant(
  image: sharp.Sharp,
  format: PanelMediaFormat,
  quality: number,
): Promise<Buffer> {
  switch (format) {
    case 'jpeg':
      return image.jpeg({ quality, mozjpeg: true }).toBuffer();
    case 'png':
      return image.png({ compressionLevel: 9, quality, palette: true }).toBuffer();
    case 'webp':
    default:
      return image.webp({ quality, effort: 6 }).toBuffer();
  }
}

export async function processPanelMediaUpload({
  fileName,
  mimeType,
  bytes,
  scope,
  folder,
}: ProcessPanelMediaUploadInput): Promise<PanelMediaAsset> {
  const settings = await getPanelMediaSettingsRuntime();
  const safeScope = toSafeScope(scope);
  const safeFolder = toSafeFolder(folder, toSafeFolder(settings.storage.defaultFolder, 'geral'));
  const maxBytes = settings.upload.maxFileSizeMb * 1024 * 1024;

  if (!settings.upload.allowedMimeTypes.includes(mimeType)) {
    throw new Error('Tipo de imagem não permitido. Use JPG, PNG ou WebP.');
  }

  if (!bytes.length) {
    throw new Error('Arquivo vazio. Selecione uma imagem válida.');
  }

  if (bytes.length > maxBytes) {
    throw new Error(`Arquivo excede o limite configurado de ${settings.upload.maxFileSizeMb} MB.`);
  }

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(bytes, { failOn: 'error' }).metadata();
  } catch {
    throw new Error('Não foi possível ler a imagem enviada.');
  }

  if (!metadata.width || !metadata.height) {
    throw new Error('A imagem enviada não possui dimensões válidas.');
  }

  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const assetId = randomUUID();
  const assetFolderSegments = [safeScope, ...safeFolder.split('/').filter(Boolean), year, month, assetId];
  const assetFolder = path.join(...assetFolderSegments);
  const publicRoot = path.join(PUBLIC_ROOT_DIR, settings.storage.publicBasePath.replace(/^\/+/, ''));
  const publicFolder = path.join(publicRoot, assetFolder);
  ensureWritableDirectory(publicRoot, 'mídia pública');
  ensureWritableDirectory(MEDIA_METADATA_ROOT, 'metadados da galeria');
  ensureWritableDirectory(publicFolder, `mídia pública (${safeScope}/${safeFolder})`);

  const variants: Record<string, PanelMediaAssetVariant> = {};

  for (const [key, preset] of Object.entries(settings.presets) as Array<[PanelMediaPresetKey, (typeof settings.presets)[PanelMediaPresetKey]]>) {
    if (!preset.enabled) continue;

    const image = sharp(bytes, { failOn: 'none' })
      .rotate()
      .resize({
        width: preset.maxWidth,
        height: preset.maxHeight,
        fit: applyFit(preset.fit),
        withoutEnlargement: true,
        background: preset.background,
      });

    const buffer = await encodeVariant(image, preset.format, preset.quality);
    const variantMetadata = await sharp(buffer).metadata();
    const fileNameForVariant = `${key}.${toExt(preset.format)}`;
    const filePath = path.join(publicFolder, fileNameForVariant);
    fs.writeFileSync(filePath, buffer);

    variants[key] = {
      key,
      format: preset.format,
      width: variantMetadata.width || preset.maxWidth,
      height: variantMetadata.height || preset.maxHeight,
      bytes: buffer.length,
      url: toPublicUrl(settings.storage.publicBasePath, [assetFolder, fileNameForVariant]),
    };
  }

  if (!Object.keys(variants).length) {
    throw new Error('Nenhum preset de mídia está habilitado para gerar arquivos.');
  }

  const primaryUrl =
    variants.productZoom?.url ||
    variants.productPdp?.url ||
    variants.contentHero?.url ||
    variants.productThumb?.url ||
    variants.contentCard?.url ||
    Object.values(variants)[0]?.url ||
    '';

  const asset: PanelMediaAsset = {
    id: assetId,
    scope: safeScope,
    folder: safeFolder,
    originalName: path.basename(fileName || 'upload'),
    uploadedAt: now.toISOString(),
    mimeType,
    originalBytes: bytes.length,
    primaryUrl,
    variants,
  };

  writeJsonAtomic(path.join(MEDIA_METADATA_ROOT, `${assetId}.json`), {
    ...asset,
    source: {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format || mimeType,
    },
  });

  return asset;
}

export async function listPanelMediaAssets(scope?: string): Promise<PanelMediaAsset[]> {
  if (!fs.existsSync(MEDIA_METADATA_ROOT)) {
    return [];
  }

  const normalizedScope = scope ? toSafeScope(scope) : '';
  const fileNames = fs
    .readdirSync(MEDIA_METADATA_ROOT)
    .filter((fileName) => fileName.endsWith('.json'));

  const assets = fileNames
    .map((fileName) => normalizeAssetRecord(readJsonFile<PanelMediaAsset>(path.join(MEDIA_METADATA_ROOT, fileName))))
    .filter((item): item is PanelMediaAsset => Boolean(item))
    .filter((asset) => !normalizedScope || asset.scope === normalizedScope)
    .sort((left, right) => new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime());

  return assets;
}

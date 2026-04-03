export const PANEL_MEDIA_SETTINGS_SCHEMA_VERSION = 1;

export const PANEL_MEDIA_PRESET_KEYS = [
  'productPdp',
  'productThumb',
  'productZoom',
  'contentCard',
  'contentHero',
] as const;

export type PanelMediaPresetKey = (typeof PANEL_MEDIA_PRESET_KEYS)[number];

export type PanelMediaFormat = 'webp' | 'jpeg' | 'png';
export type PanelMediaFit = 'inside' | 'cover';

export type PanelMediaPreset = {
  enabled: boolean;
  maxWidth: number;
  maxHeight: number;
  format: PanelMediaFormat;
  quality: number;
  fit: PanelMediaFit;
  background: string;
};

export type PanelMediaSettings = {
  schemaVersion: number;
  updatedAt: string;
  upload: {
    maxFileSizeMb: number;
    allowedMimeTypes: string[];
  };
  storage: {
    publicBasePath: string;
  };
  presets: Record<PanelMediaPresetKey, PanelMediaPreset>;
};

export type PanelMediaSettingsDiagnostics = {
  uploadEnabled: boolean;
  maxFileSizeMb: number;
  allowedMimeTypes: string[];
  publicBasePath: string;
  enabledPresets: PanelMediaPresetKey[];
};

export type PanelMediaAssetVariant = {
  key: PanelMediaPresetKey;
  format: PanelMediaFormat;
  width: number;
  height: number;
  bytes: number;
  url: string;
};

export type PanelMediaAsset = {
  id: string;
  scope: string;
  originalName: string;
  uploadedAt: string;
  mimeType: string;
  originalBytes: number;
  variants: Record<string, PanelMediaAssetVariant>;
};

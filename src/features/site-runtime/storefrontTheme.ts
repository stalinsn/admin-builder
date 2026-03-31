import {
  DEFAULT_ECOM_CAMPAIGN,
  DEFAULT_ECOM_THEME,
  type EcomCampaignId,
  type EcomThemeId,
} from '@/features/ecommerce/config/styleguide';
import type { StorefrontTemplateTheme, StorefrontThemeOverrides } from './storefrontTemplate';

export type ResolvedStorefrontTheme = {
  preset: EcomThemeId;
  campaign: EcomCampaignId;
  overrideCount: number;
  variables: Record<string, string>;
};

function normalizeHexColor(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';

  if (/^#[0-9a-f]{3}$/.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }

  return /^#[0-9a-f]{6}$/.test(trimmed) ? trimmed : '';
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;

  const numeric = Number.parseInt(normalized.slice(1), 16);
  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255,
  };
}

function darkenHex(hex: string, ratio: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '';

  const scale = Math.max(0, Math.min(1, 1 - ratio));
  const next = [rgb.r, rgb.g, rgb.b]
    .map((channel) => Math.max(0, Math.min(255, Math.round(channel * scale))))
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('');

  return `#${next}`;
}

function buildGradient(angle: string, start: string, end: string): string {
  return `linear-gradient(${angle}, ${start}, ${end})`;
}

export function isStorefrontHexColor(value: string): boolean {
  return Boolean(normalizeHexColor(value));
}

export function getStorefrontThemeColorInputValue(value: string, fallback: string): string {
  return normalizeHexColor(value) || normalizeHexColor(fallback) || '#ffffff';
}

export function countStorefrontThemeOverrides(overrides: StorefrontThemeOverrides): number {
  return Object.values(overrides).filter((value) => Boolean(normalizeHexColor(value))).length;
}

export function resolveStorefrontTheme(theme?: StorefrontTemplateTheme | null): ResolvedStorefrontTheme {
  const currentTheme = theme ?? {
    preset: DEFAULT_ECOM_THEME,
    campaign: DEFAULT_ECOM_CAMPAIGN,
    overrides: {
      backgroundColor: '',
      surfaceColor: '',
      surfaceSoftColor: '',
      textColor: '',
      textMutedColor: '',
      borderColor: '',
      brandColor: '',
      brandHoverColor: '',
      headerBackgroundColor: '',
      headerUtilStartColor: '',
      headerUtilEndColor: '',
      headerPromoStartColor: '',
      headerPromoEndColor: '',
      headerPromoTextColor: '',
      footerStartColor: '',
      footerEndColor: '',
    },
  };
  const overrides = currentTheme.overrides;
  const variables: Record<string, string> = {};

  const backgroundColor = normalizeHexColor(overrides.backgroundColor);
  const surfaceColor = normalizeHexColor(overrides.surfaceColor);
  const surfaceSoftColor = normalizeHexColor(overrides.surfaceSoftColor);
  const textColor = normalizeHexColor(overrides.textColor);
  const textMutedColor = normalizeHexColor(overrides.textMutedColor);
  const borderColor = normalizeHexColor(overrides.borderColor);
  const brandColor = normalizeHexColor(overrides.brandColor);
  const brandHoverColor = normalizeHexColor(overrides.brandHoverColor) || (brandColor ? darkenHex(brandColor, 0.14) : '');
  const headerBackgroundColor = normalizeHexColor(overrides.headerBackgroundColor);
  const headerUtilStartColor = normalizeHexColor(overrides.headerUtilStartColor);
  const headerUtilEndColor = normalizeHexColor(overrides.headerUtilEndColor) || headerUtilStartColor;
  const headerPromoStartColor = normalizeHexColor(overrides.headerPromoStartColor);
  const headerPromoEndColor = normalizeHexColor(overrides.headerPromoEndColor) || headerPromoStartColor;
  const headerPromoTextColor = normalizeHexColor(overrides.headerPromoTextColor);
  const footerStartColor = normalizeHexColor(overrides.footerStartColor);
  const footerEndColor = normalizeHexColor(overrides.footerEndColor) || footerStartColor;

  if (backgroundColor) variables['--ecom-color-bg'] = backgroundColor;
  if (surfaceColor) variables['--ecom-color-surface'] = surfaceColor;
  if (surfaceSoftColor) variables['--ecom-color-surface-soft'] = surfaceSoftColor;
  if (textColor) variables['--ecom-color-text'] = textColor;
  if (textMutedColor) variables['--ecom-color-text-muted'] = textMutedColor;
  if (borderColor) {
    variables['--ecom-color-border'] = borderColor;
    variables['--ecom-color-border-soft'] = borderColor;
  }
  if (brandColor) {
    variables['--ecom-color-brand'] = brandColor;
    const rgb = hexToRgb(brandColor);
    if (rgb) variables['--accent-rgb'] = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
  }
  if (brandHoverColor) variables['--ecom-color-brand-hover'] = brandHoverColor;
  if (headerBackgroundColor) variables['--ecom-header-bg'] = headerBackgroundColor;
  if (headerUtilStartColor) {
    variables['--ecom-header-util-bg'] = buildGradient('180deg', headerUtilStartColor, headerUtilEndColor);
  }
  if (headerPromoStartColor) {
    variables['--ecom-header-promo-bg'] = buildGradient('90deg', headerPromoStartColor, headerPromoEndColor);
  }
  if (headerPromoTextColor) variables['--ecom-header-promo-text'] = headerPromoTextColor;
  if (footerStartColor) {
    variables['--ecom-footer-bg'] = buildGradient('180deg', footerStartColor, footerEndColor);
  }

  return {
    preset: currentTheme.preset ?? DEFAULT_ECOM_THEME,
    campaign: currentTheme.campaign ?? DEFAULT_ECOM_CAMPAIGN,
    overrideCount: countStorefrontThemeOverrides(overrides),
    variables,
  };
}

import type { SitePage, SitePageSeo, SitePageTheme } from '@/features/ecommpanel/types/siteBuilder';

export type RuntimeRouteSource = 'dynamic' | 'native' | 'not_found';
export const SITE_RUNTIME_SCHEMA_VERSION = 1;

export type RuntimeResolvedPage = Pick<SitePage, 'id' | 'title' | 'slug' | 'description' | 'layoutPreset' | 'slots' | 'status'> & {
  seo: SitePageSeo;
  theme: SitePageTheme;
};

export type RuntimePublishedSnapshot = {
  schemaVersion: number;
  generatedAt: string;
  pages: RuntimeResolvedPage[];
};

export type RuntimeContentManifest = {
  schemaVersion: number;
  generatedAt: string;
  source: 'ecommpanel';
  snapshotFile: string;
  pagesCount: number;
  checksumSha256: string;
};

export type RuntimeResolveResult = {
  source: RuntimeRouteSource;
  path: string;
  page: RuntimeResolvedPage | null;
};

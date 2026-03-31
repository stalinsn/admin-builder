import type { NextRequest } from 'next/server';

import { getBlogOperationalSummaryRuntime, readBlogRuntimeManifestRuntime } from '@/features/blog/server/blogStore';
import { getCatalogOperationalSummaryRuntime } from '@/features/catalog/server/catalogStore';
import { getSiteBuilderOperationalSummaryRuntime } from '@/features/ecommpanel/server/siteBuilderStore';
import { getStorefrontTemplateRuntime } from '@/features/ecommpanel/server/storefrontTemplateStore';
import { jsonIntegration, withIntegrationAccess } from '@/features/public-api/integrationAuth';
import {
  getPublishedRuntimeContentRoot,
  readPublishedRuntimeManifest,
} from '@/features/site-runtime/server/publishedStore';
import { readPublishedRuntimeStorefrontTemplate } from '@/features/site-runtime/server/publishedTemplateStore';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withIntegrationAccess(req, {
    scope: 'health.read',
    handler: async () => {
      const siteSummary = await getSiteBuilderOperationalSummaryRuntime();
      const blogSummary = await getBlogOperationalSummaryRuntime();
      const catalogSummary = await getCatalogOperationalSummaryRuntime();
      const siteManifest = readPublishedRuntimeManifest();
      const blogManifest = await readBlogRuntimeManifestRuntime();
      const template = await getStorefrontTemplateRuntime();
      const publishedTemplate = readPublishedRuntimeStorefrontTemplate();

      return jsonIntegration({
        status: 'ok',
        storage: {
          rootPath: getPublishedRuntimeContentRoot(),
          mode: process.env.ECOM_CONTENT_PATH?.trim() ? 'external' : 'workspace',
        },
        siteRuntime: {
          publishedPages: siteSummary.publishedPages,
          runtimePages: siteManifest?.pagesCount || 0,
          generatedAt: siteManifest?.generatedAt || null,
          inSync: (siteManifest?.pagesCount || 0) === siteSummary.publishedPages,
        },
        blogRuntime: {
          publishedPosts: blogSummary.publishedPosts,
          runtimePosts: blogManifest?.postsCount || 0,
          generatedAt: blogManifest?.generatedAt || null,
          inSync: (blogManifest?.postsCount || 0) === blogSummary.publishedPosts,
          pendingComments: blogSummary.pendingComments,
        },
        catalogRuntime: {
          totalProducts: catalogSummary.totalProducts,
          activeProducts: catalogSummary.activeProducts,
          draftProducts: catalogSummary.draftProducts,
          lowStockProducts: catalogSummary.lowStockProducts,
        },
        storefrontTemplate: {
          updatedAt: template.updatedAt,
          publishedAt: publishedTemplate?.generatedAt || null,
          homeOverrideEnabled: template.home.override.enabled,
          homeOverridePageSlug: template.home.override.pageSlug,
          themePreset: template.theme.preset,
          campaign: template.theme.campaign,
        },
      });
    },
  });
}

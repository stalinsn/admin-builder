import type { NextRequest } from 'next/server';

import { getPublishedRuntimePageBySlug } from '@/features/site-runtime/server/publishedStore';
import { errorIntegration, jsonIntegration, withIntegrationAccess } from '@/features/public-api/integrationAuth';

export const dynamic = 'force-dynamic';

function resolvePublicPath(slug: string): string {
  if (slug === 'home' || slug === 'index') return '/e-commerce';
  return `/e-commerce/${slug}`;
}

export async function GET(req: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  return withIntegrationAccess(req, {
    scope: 'content.read',
    handler: async () => {
      const params = await context.params;
      const slug = params.slug.join('/').trim();
      const page = getPublishedRuntimePageBySlug(slug);

      if (!page) {
        return errorIntegration(404, 'Página publicada não encontrada.');
      }

      return jsonIntegration(
        {
          id: page.id,
          slug: page.slug,
          title: page.title,
          description: page.description,
          layoutPreset: page.layoutPreset,
          status: page.status,
          publicPath: resolvePublicPath(page.slug),
          seo: page.seo,
          theme: page.theme,
          slots: page.slots,
        },
        {
          meta: {
            blocksCount: page.slots.reduce((acc, slot) => acc + slot.blocks.length, 0),
          },
        },
      );
    },
  });
}

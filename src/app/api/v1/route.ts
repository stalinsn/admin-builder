import { jsonPublic } from '@/features/public-api/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return jsonPublic({
    name: 'App Hub Public API',
    resources: [
      '/api/v1/content/pages',
      '/api/v1/content/pages/[...slug]',
      '/api/v1/content/blog/posts',
      '/api/v1/content/blog/posts/[slug]',
      '/api/v1/catalog/products',
      '/api/v1/catalog/products/[slug]',
      '/api/v1/catalog/categories',
      '/api/v1/catalog/collections',
      '/api/v1/logistics/simulate',
      '/api/v1/orders/[publicToken]',
      '/api/v1/system/health',
    ],
  });
}

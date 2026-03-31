import type { NextRequest } from 'next/server';

import { getPublicOrderTracking } from '@/features/ecommerce/server/orderStore';
import { errorIntegration, jsonIntegration, withIntegrationAccess } from '@/features/public-api/integrationAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, context: { params: Promise<{ publicToken: string }> }) {
  return withIntegrationAccess(req, {
    scope: 'orders.public.read',
    handler: async () => {
      const { publicToken } = await context.params;
      const tracking = await getPublicOrderTracking(publicToken);
      if (!tracking) {
        return errorIntegration(404, 'Pedido não encontrado.');
      }

      return jsonIntegration(tracking);
    },
  });
}

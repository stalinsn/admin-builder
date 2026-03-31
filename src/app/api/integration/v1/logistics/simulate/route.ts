import type { NextRequest } from 'next/server';

import { mapLogisticsResultToShippingResponse } from '@/features/ecommerce/server/logisticsApiMapping';
import { simulateLogisticsRuntime } from '@/features/ecommerce/server/logisticsStore';
import { jsonIntegration, withIntegrationAccess } from '@/features/public-api/integrationAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return withIntegrationAccess(req, {
    scope: 'logistics.read',
    handler: async () => {
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== 'object') {
        return jsonIntegration({ error: 'Payload inválido para simulação logística.' }, { status: 400 });
      }

      const result = await simulateLogisticsRuntime({
        postalCode: typeof body.postalCode === 'string' ? body.postalCode : undefined,
        address: body.address && typeof body.address === 'object' ? body.address : undefined,
        mode: body.mode === 'pickup' || body.mode === 'delivery' ? body.mode : undefined,
        items: Array.isArray(body.items) ? body.items : [],
      });

      return jsonIntegration(mapLogisticsResultToShippingResponse(result));
    },
  });
}

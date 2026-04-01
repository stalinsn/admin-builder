import type { NextRequest } from 'next/server';

import { getDataStudioSnapshot } from '@/features/ecommpanel/server/dataStudioStore';
import { listReferenceByExposure } from '@/features/public-api/integration';
import { jsonIntegration, withIntegrationAccess } from '@/features/public-api/integrationAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withIntegrationAccess(req, {
    handler: async (context) => {
      const snapshot = getDataStudioSnapshot();
      const items = listReferenceByExposure('integration', snapshot).filter(
        (item) => !item.scope || context.scopes.includes(item.scope),
      );
      return jsonIntegration(
        {
          items,
        },
        {
          meta: {
            client: {
              keyId: context.client.keyId,
              name: context.client.name,
            },
            scopes: context.scopes,
          },
        },
      );
    },
  });
}

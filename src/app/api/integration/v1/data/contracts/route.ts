import type { NextRequest } from 'next/server';

import { generateDataStudioContracts } from '@/features/ecommpanel/server/dataEntityContracts';
import { getDataStudioSnapshot } from '@/features/ecommpanel/server/dataStudioStore';
import { jsonIntegration, withIntegrationAccess } from '@/features/public-api/integrationAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withIntegrationAccess(req, {
    scope: 'data.records.read',
    handler: async () =>
      jsonIntegration({
        ok: true,
        contracts: generateDataStudioContracts(getDataStudioSnapshot()),
      }),
  });
}

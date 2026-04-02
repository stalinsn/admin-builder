import type { NextRequest } from 'next/server';

import { generateDataStudioContracts } from '@/features/ecommpanel/server/dataEntityContracts';
import { getDataStudioSnapshotResolved } from '@/features/ecommpanel/server/dataStudioStore';
import { jsonIntegration, withIntegrationAccess } from '@/features/public-api/integrationAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withIntegrationAccess(req, {
    scope: 'data.contracts.read',
    handler: async () => {
      const snapshot = await getDataStudioSnapshotResolved();
      return jsonIntegration({
        ok: true,
        contracts: generateDataStudioContracts(snapshot),
      });
    },
  });
}

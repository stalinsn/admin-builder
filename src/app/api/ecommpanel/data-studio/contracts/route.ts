import type { NextRequest } from 'next/server';

import { getApiAuthContext } from '@/features/ecommpanel/server/auth';
import { generateDataStudioContracts } from '@/features/ecommpanel/server/dataEntityContracts';
import { getDataStudioSnapshot } from '@/features/ecommpanel/server/dataStudioStore';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';

export const dynamic = 'force-dynamic';

function canReadData(permissions: string[]): boolean {
  return permissions.includes('data.admin.manage') || permissions.includes('data.read');
}

export async function GET(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) return errorNoStore(401, 'Não autenticado.');
  if (!canReadData(auth.user.permissions)) {
    return errorNoStore(403, 'Sem permissão para ler contratos do Data Studio.');
  }

  return jsonNoStore({
    ok: true,
    contracts: generateDataStudioContracts(getDataStudioSnapshot()),
  });
}

import type { NextRequest } from 'next/server';

import { getApiAuthContext, hasValidCsrf, isTrustedOrigin } from '@/features/ecommpanel/server/auth';
import { getAdminBuilderSettings, updateAdminBuilderSettings } from '@/features/ecommpanel/server/adminBuilderSettingsStore';
import { getDataStudioSnapshot } from '@/features/ecommpanel/server/dataStudioStore';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';

export const dynamic = 'force-dynamic';

function canReadSettings(permissions: string[]): boolean {
  return permissions.includes('customers.manage') || permissions.includes('data.read') || permissions.includes('data.admin.manage');
}

function canWriteSettings(permissions: string[]): boolean {
  return permissions.includes('customers.manage') || permissions.includes('data.admin.manage') || permissions.includes('security.superuser');
}

export async function GET(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) return errorNoStore(401, 'Não autenticado.');
  if (!canReadSettings(auth.user.permissions)) {
    return errorNoStore(403, 'Sem permissão para ler as preferências do Admin Builder.');
  }

  return jsonNoStore({
    ok: true,
    settings: getAdminBuilderSettings(getDataStudioSnapshot()),
  });
}

export async function PUT(req: NextRequest) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const auth = await getApiAuthContext(req);
  if (!auth) return errorNoStore(401, 'Não autenticado.');
  if (!canWriteSettings(auth.user.permissions)) {
    return errorNoStore(403, 'Sem permissão para alterar as preferências do Admin Builder.');
  }
  if (!hasValidCsrf(req, auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const body = (await req.json().catch(() => null)) as { settings?: unknown } | null;

  return jsonNoStore({
    ok: true,
    settings: updateAdminBuilderSettings(body?.settings, getDataStudioSnapshot()),
  });
}

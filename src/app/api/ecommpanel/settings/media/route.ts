import type { NextRequest } from 'next/server';

import {
  getPanelMediaSettingsDiagnostics,
  getPanelMediaSettingsRuntime,
  normalizePanelMediaSettings,
  updatePanelMediaSettingsRuntime,
} from '@/features/ecommpanel/server/panelMediaSettingsStore';
import {
  getApiAuthContext,
  hasPermission,
  hasValidCsrf,
  isTrustedOrigin,
} from '@/features/ecommpanel/server/auth';
import { errorNoStore, jsonNoStore } from '@/features/ecommpanel/server/http';

export const dynamic = 'force-dynamic';

type UpdatePanelMediaSettingsBody = {
  settings?: unknown;
};

async function requireReadAccess(req: NextRequest) {
  const auth = await getApiAuthContext(req);
  if (!auth) return { error: errorNoStore(401, 'Não autenticado.') };

  if (!hasPermission(auth.user, 'store.settings.manage') && !hasPermission(auth.user, 'integrations.manage')) {
    return { error: errorNoStore(403, 'Sem permissão para visualizar as configurações de mídia.') };
  }

  return { auth };
}

export async function GET(req: NextRequest) {
  const guard = await requireReadAccess(req);
  if ('error' in guard) return guard.error;

  try {
    const settings = await getPanelMediaSettingsRuntime();
    return jsonNoStore({
      settings,
      diagnostics: getPanelMediaSettingsDiagnostics(settings),
    });
  } catch (error) {
    return errorNoStore(503, error instanceof Error ? error.message : 'Não foi possível carregar a configuração de mídia.');
  }
}

export async function PATCH(req: NextRequest) {
  if (!isTrustedOrigin(req)) {
    return errorNoStore(403, 'Origem não permitida.');
  }

  const guard = await requireReadAccess(req);
  if ('error' in guard) return guard.error;

  if (!hasValidCsrf(req, guard.auth.csrfToken)) {
    return errorNoStore(403, 'Token CSRF inválido.');
  }

  const body = (await req.json().catch(() => null)) as UpdatePanelMediaSettingsBody | null;
  if (!body?.settings) {
    return errorNoStore(400, 'Payload de configuração é obrigatório.');
  }

  try {
    const settings = await updatePanelMediaSettingsRuntime(normalizePanelMediaSettings(body.settings));
    return jsonNoStore({
      ok: true,
      settings,
      diagnostics: getPanelMediaSettingsDiagnostics(settings),
    });
  } catch (error) {
    return errorNoStore(503, error instanceof Error ? error.message : 'Não foi possível salvar a configuração de mídia.');
  }
}
